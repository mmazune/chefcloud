/**
 * M11.5 Inventory Costing Service
 * 
 * Manages cost tracking via append-only InventoryCostLayer records:
 * - Weighted Average Cost (WAC) calculation
 * - Cost layer creation on goods receipt posting
 * - COGS breakdown on order depletion
 * - Inventory valuation reporting
 * - Branch-level scoping (orgId + branchId + itemId)
 * 
 * WAC Formula:
 * newWac = (existingQty × existingWac + receivedQty × receivedUnitCost) / (existingQty + receivedQty)
 * 
 * Precision: Decimal(12,4) throughout; round only at export/display boundary
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { Prisma, CostMethod, CostSourceType } from '@chefcloud/db';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

// Zero as Decimal for reuse
const ZERO = new Decimal(0);

export interface CreateCostLayerDto {
  itemId: string;
  locationId?: string;
  qtyReceived: Decimal | string | number;
  unitCost: Decimal | string | number;
  sourceType: CostSourceType;
  sourceId: string;
  effectiveAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface CostLayerResult {
  id: string;
  priorWac: Decimal;
  newWac: Decimal;
  qtyReceived: Decimal;
  unitCost: Decimal;
}

export interface ValuationLine {
  itemId: string;
  itemCode: string;
  itemName: string;
  categoryName?: string;
  onHandQty: Decimal;
  wac: Decimal;
  totalValue: Decimal;
  lastCostLayerAt?: Date;
}

export interface ValuationSummary {
  branchId: string;
  branchName: string;
  lines: ValuationLine[];
  totalValue: Decimal;
  itemCount: number;
  asOfDate: Date;
}

export interface CogsLine {
  depletionId: string;
  orderId: string;
  orderNumber?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  qtyDepleted: Decimal;
  unitCost: Decimal;
  lineCogs: Decimal;
  depletedAt: Date;
}

export interface CogsSummary {
  branchId: string;
  branchName: string;
  fromDate: Date;
  toDate: Date;
  lines: CogsLine[];
  totalCogs: Decimal;
  lineCount: number;
}

@Injectable()
export class InventoryCostingService {
  private readonly logger = new Logger(InventoryCostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Get current WAC for an item at a branch.
   * Uses the most recent cost layer's newWac.
   * Returns 0 if no cost layers exist.
   */
  async getCurrentWac(
    orgId: string,
    branchId: string,
    itemId: string,
  ): Promise<Decimal> {
    const latestLayer = await this.prisma.client.inventoryCostLayer.findFirst({
      where: { orgId, branchId, itemId },
      orderBy: { effectiveAt: 'desc' },
      select: { newWac: true },
    });

    return latestLayer ? new Decimal(latestLayer.newWac) : ZERO;
  }

  /**
   * Get current on-hand quantity for an item at a branch.
   * Aggregates from InventoryLedgerEntry.
   */
  async getOnHandQty(
    orgId: string,
    branchId: string,
    itemId: string,
  ): Promise<Decimal> {
    const result = await this.prisma.client.inventoryLedgerEntry.aggregate({
      where: { orgId, branchId, itemId },
      _sum: { qty: true },
    });

    return result._sum.qty ? new Decimal(result._sum.qty) : ZERO;
  }

  /**
   * Create a cost layer on goods receipt (or manual adjustment).
   * Calculates new WAC based on existing on-hand and prior WAC.
   * 
   * IDEMPOTENT: Uses sourceType + sourceId to prevent duplicates.
   */
  async createCostLayer(
    orgId: string,
    branchId: string,
    userId: string,
    dto: CreateCostLayerDto,
    options?: { tx?: Prisma.TransactionClient },
  ): Promise<CostLayerResult> {
    const client = options?.tx ?? this.prisma.client;

    // Idempotency check: same source should not create duplicate layers
    const existing = await client.inventoryCostLayer.findFirst({
      where: {
        orgId,
        branchId,
        itemId: dto.itemId,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
      },
    });

    if (existing) {
      this.logger.log(`Idempotent return for cost layer source=${dto.sourceType}:${dto.sourceId}`);
      return {
        id: existing.id,
        priorWac: new Decimal(existing.priorWac),
        newWac: new Decimal(existing.newWac),
        qtyReceived: new Decimal(existing.qtyReceived),
        unitCost: new Decimal(existing.unitCost),
      };
    }

    const qtyReceived = new Decimal(dto.qtyReceived);
    const unitCost = new Decimal(dto.unitCost);

    // Get prior WAC and on-hand qty
    const priorWac = await this.getCurrentWac(orgId, branchId, dto.itemId);
    const existingQty = await this.getOnHandQty(orgId, branchId, dto.itemId);

    // Calculate new WAC
    // newWac = (existingQty × priorWac + qtyReceived × unitCost) / (existingQty + qtyReceived)
    let newWac: Decimal;
    const totalQty = existingQty.plus(qtyReceived);

    if (totalQty.isZero()) {
      // Edge case: no stock after this operation (shouldn't happen on receipt, but handle it)
      newWac = unitCost;
    } else if (existingQty.isZero()) {
      // First receipt - WAC is just the unit cost
      newWac = unitCost;
    } else {
      // Standard WAC calculation
      const existingValue = existingQty.times(priorWac);
      const addedValue = qtyReceived.times(unitCost);
      newWac = existingValue.plus(addedValue).dividedBy(totalQty);
    }

    // Create the cost layer (append-only)
    const layer = await client.inventoryCostLayer.create({
      data: {
        orgId,
        branchId,
        itemId: dto.itemId,
        locationId: dto.locationId,
        method: CostMethod.WAC,
        qtyReceived,
        unitCost,
        priorWac,
        newWac,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        effectiveAt: dto.effectiveAt ?? new Date(),
        createdById: userId,
        metadata: dto.metadata as any,
      },
    });

    this.logger.log(
      `Created cost layer for item=${dto.itemId}: priorWac=${priorWac}, newWac=${newWac}, source=${dto.sourceType}:${dto.sourceId}`,
    );

    return {
      id: layer.id,
      priorWac,
      newWac,
      qtyReceived,
      unitCost,
    };
  }

  /**
   * Record COGS breakdown for a depletion.
   * Called after depletion is POSTED.
   * Uses current WAC at time of depletion.
   * 
   * IDEMPOTENT: Uses depletionId + itemId unique constraint.
   */
  async recordCogsBreakdown(
    orgId: string,
    depletionId: string,
    orderId: string,
    branchId: string,
    items: Array<{ itemId: string; qtyDepleted: Decimal | string | number }>,
    options?: { tx?: Prisma.TransactionClient },
  ): Promise<{ totalCogs: Decimal; breakdowns: number }> {
    const client = options?.tx ?? this.prisma.client;
    let totalCogs = ZERO;
    let breakdowns = 0;

    for (const item of items) {
      const qtyDepleted = new Decimal(item.qtyDepleted);
      
      // Skip if qty is zero or negative
      if (qtyDepleted.isZero() || qtyDepleted.isNegative()) {
        continue;
      }

      // Check idempotency (unique on depletionId + itemId)
      const existing = await client.depletionCostBreakdown.findUnique({
        where: { depletionId_itemId: { depletionId, itemId: item.itemId } },
      });

      if (existing) {
        totalCogs = totalCogs.plus(new Decimal(existing.lineCogs));
        breakdowns++;
        continue;
      }

      // Get current WAC for the item
      const wac = await this.getCurrentWac(orgId, branchId, item.itemId);
      
      // Calculate line COGS: qtyDepleted × WAC
      const lineCogs = qtyDepleted.times(wac);

      // Create breakdown record
      await client.depletionCostBreakdown.create({
        data: {
          orgId,
          depletionId,
          orderId,
          itemId: item.itemId,
          qtyDepleted,
          unitCost: wac,
          lineCogs,
        },
      });

      totalCogs = totalCogs.plus(lineCogs);
      breakdowns++;
    }

    this.logger.log(
      `Recorded COGS breakdown for depletion=${depletionId}: totalCogs=${totalCogs}, breakdowns=${breakdowns}`,
    );

    return { totalCogs, breakdowns };
  }

  /**
   * Get inventory valuation for a branch.
   * Returns on-hand qty × WAC for each item.
   */
  async getValuation(
    orgId: string,
    branchId: string,
    options?: { categoryId?: string; includeZeroStock?: boolean },
  ): Promise<ValuationSummary> {
    // Get branch info
    const branch = await this.prisma.client.branch.findFirst({
      where: { id: branchId, orgId },
      select: { id: true, name: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Get all items with ledger aggregation
    const itemFilter: Prisma.InventoryItemWhereInput = {
      orgId,
      isActive: true,
    };
    if (options?.categoryId) {
      // category is a plain string field, not a relation
      itemFilter.category = options.categoryId;
    }

    const items = await this.prisma.client.inventoryItem.findMany({
      where: itemFilter,
      select: {
        id: true,
        sku: true,
        name: true,
        category: true,
      },
      orderBy: { name: 'asc' },
    });

    const lines: ValuationLine[] = [];
    let totalValue = ZERO;

    for (const item of items) {
      const onHandQty = await this.getOnHandQty(orgId, branchId, item.id);
      
      // Skip zero stock unless requested
      if (!options?.includeZeroStock && onHandQty.isZero()) {
        continue;
      }

      const wac = await this.getCurrentWac(orgId, branchId, item.id);
      const itemValue = onHandQty.times(wac);

      // Get last cost layer timestamp
      const lastLayer = await this.prisma.client.inventoryCostLayer.findFirst({
        where: { orgId, branchId, itemId: item.id },
        orderBy: { effectiveAt: 'desc' },
        select: { effectiveAt: true },
      });

      lines.push({
        itemId: item.id,
        itemCode: item.sku ?? item.id.substring(0, 8),
        itemName: item.name,
        categoryName: item.category ?? undefined,
        onHandQty,
        wac,
        totalValue: itemValue,
        lastCostLayerAt: lastLayer?.effectiveAt,
      });

      totalValue = totalValue.plus(itemValue);
    }

    return {
      branchId: branch.id,
      branchName: branch.name,
      lines,
      totalValue,
      itemCount: lines.length,
      asOfDate: new Date(),
    };
  }

  /**
   * Get COGS report for a date range.
   */
  async getCogsReport(
    orgId: string,
    branchId: string,
    fromDate: Date,
    toDate: Date,
    options?: { categoryId?: string },
  ): Promise<CogsSummary> {
    // Get branch info
    const branch = await this.prisma.client.branch.findFirst({
      where: { id: branchId, orgId },
      select: { id: true, name: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Build filter
    const where: Prisma.DepletionCostBreakdownWhereInput = {
      orgId,
      depletion: {
        branchId,
        postedAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
    };

    if (options?.categoryId) {
      // category is a plain string field
      where.item = { category: options.categoryId };
    }

    // Get breakdown records with related data
    const breakdowns = await this.prisma.client.depletionCostBreakdown.findMany({
      where,
      include: {
        depletion: {
          select: {
            id: true,
            orderId: true,
            postedAt: true,
          },
        },
        item: {
          select: {
            id: true,
            sku: true,
            name: true,
          },
        },
      },
      orderBy: { computedAt: 'desc' },
    });

    // Map to CogsLine
    const lines: CogsLine[] = [];
    let totalCogs = ZERO;

    for (const bd of breakdowns) {
      const lineCogs = new Decimal(bd.lineCogs);
      
      lines.push({
        depletionId: bd.depletionId,
        orderId: bd.orderId,
        itemId: bd.itemId,
        itemCode: bd.item.sku ?? bd.item.id.substring(0, 8),
        itemName: bd.item.name,
        qtyDepleted: new Decimal(bd.qtyDepleted),
        unitCost: new Decimal(bd.unitCost),
        lineCogs,
        depletedAt: bd.depletion.postedAt ?? bd.computedAt,
      });

      totalCogs = totalCogs.plus(lineCogs);
    }

    return {
      branchId: branch.id,
      branchName: branch.name,
      fromDate,
      toDate,
      lines,
      totalCogs,
      lineCount: lines.length,
    };
  }

  /**
   * Get cost layer history for an item.
   */
  async getCostLayerHistory(
    orgId: string,
    branchId: string,
    itemId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{
    layers: Array<{
      id: string;
      effectiveAt: Date;
      qtyReceived: Decimal;
      unitCost: Decimal;
      priorWac: Decimal;
      newWac: Decimal;
      sourceType: CostSourceType;
      sourceId: string;
    }>;
    totalCount: number;
  }> {
    const where = { orgId, branchId, itemId };

    const [layers, totalCount] = await Promise.all([
      this.prisma.client.inventoryCostLayer.findMany({
        where,
        orderBy: { effectiveAt: 'desc' },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
        select: {
          id: true,
          effectiveAt: true,
          qtyReceived: true,
          unitCost: true,
          priorWac: true,
          newWac: true,
          sourceType: true,
          sourceId: true,
        },
      }),
      this.prisma.client.inventoryCostLayer.count({ where }),
    ]);

    return {
      layers: layers.map((l) => ({
        ...l,
        qtyReceived: new Decimal(l.qtyReceived),
        unitCost: new Decimal(l.unitCost),
        priorWac: new Decimal(l.priorWac),
        newWac: new Decimal(l.newWac),
      })),
      totalCount,
    };
  }

  /**
   * Seed initial cost for an item (manual entry).
   * Used when importing existing inventory with known cost.
   */
  async seedInitialCost(
    orgId: string,
    branchId: string,
    userId: string,
    itemId: string,
    unitCost: Decimal | string | number,
    notes?: string,
  ): Promise<CostLayerResult> {
    // Verify item exists
    const item = await this.prisma.client.inventoryItem.findFirst({
      where: { id: itemId, orgId },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    // Get current on-hand
    const onHandQty = await this.getOnHandQty(orgId, branchId, itemId);

    if (onHandQty.isZero()) {
      throw new BadRequestException(
        'Cannot seed cost for item with zero on-hand quantity. Receive stock first.',
      );
    }

    // Create cost layer with INITIAL_SEED source
    const result = await this.createCostLayer(orgId, branchId, userId, {
      itemId,
      qtyReceived: onHandQty, // Use current on-hand as the "received" qty for WAC calc
      unitCost,
      sourceType: CostSourceType.INITIAL_SEED,
      sourceId: `seed-${itemId}-${Date.now()}`,
      metadata: { notes },
    });

    await this.auditLog.log({
      orgId,
      branchId,
      userId,
      action: 'COST_SEEDED',
      resourceType: 'InventoryItem',
      resourceId: itemId,
      metadata: { unitCost: unitCost.toString(), newWac: result.newWac.toString() },
    });

    return result;
  }
}
