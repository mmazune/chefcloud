/**
 * M11.7 Inventory Lots Service
 * 
 * Handles lot/batch management with FEFO (First Expiry First Out) allocation:
 * - Lot creation from goods receipts
 * - FEFO allocation for depletions
 * - Lot-aware transfers and waste
 * - Expiry tracking and alerts
 * - Traceability via LotLedgerAllocation
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { Prisma, LotStatus } from '@chefcloud/db';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

// Lot creation input
export interface CreateLotInput {
  orgId: string;
  branchId: string;
  itemId: string;
  locationId: string;
  lotNumber: string;
  receivedQty: number | Decimal;
  unitCost?: number | Decimal;
  expiryDate?: Date | string;
  manufacturingDate?: Date | string;
  supplierLotRef?: string;
  sourceType: string;
  sourceId?: string;
  notes?: string;
  createdById?: string;
}

// FEFO allocation result
export interface FEFOAllocation {
  lotId: string;
  lotNumber: string;
  allocatedQty: Decimal;
  expiryDate: Date | null;
  allocationOrder: number;
}

// Lot summary for queries
export interface LotSummary {
  id: string;
  lotNumber: string;
  itemId: string;
  itemName: string;
  branchId: string;
  locationId: string;
  receivedQty: Decimal;
  remainingQty: Decimal;
  expiryDate: Date | null;
  status: LotStatus;
  daysToExpiry: number | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
  createdAt: Date;
}

// Traceability entry
export interface TraceabilityEntry {
  id: string;
  sourceType: string;
  sourceId: string;
  allocatedQty: Decimal;
  createdAt: Date;
  metadata: Record<string, unknown> | null;
}

@Injectable()
export class InventoryLotsService {
  private readonly logger = new Logger(InventoryLotsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Create a new lot (typically from goods receipt)
   */
  async createLot(input: CreateLotInput): Promise<{ id: string; lotNumber: string }> {
    const {
      orgId,
      branchId,
      itemId,
      locationId,
      lotNumber,
      receivedQty,
      unitCost,
      expiryDate,
      manufacturingDate,
      supplierLotRef,
      sourceType,
      sourceId,
      notes,
      createdById,
    } = input;

    // Check for duplicate lot number at same item/location
    const existing = await this.prisma.client.inventoryLot.findUnique({
      where: {
        orgId_branchId_itemId_locationId_lotNumber: {
          orgId,
          branchId,
          itemId,
          locationId,
          lotNumber,
        },
      },
    });

    if (existing) {
      // If lot exists with same source, this is idempotent - return existing
      if (existing.sourceType === sourceType && existing.sourceId === sourceId) {
        return { id: existing.id, lotNumber: existing.lotNumber };
      }
      throw new BadRequestException(
        `Lot ${lotNumber} already exists for this item at this location`,
      );
    }

    const qty = new Decimal(receivedQty.toString());
    
    // Determine initial status based on expiry date
    let status: LotStatus = 'ACTIVE';
    if (expiryDate) {
      const expiry = new Date(expiryDate);
      if (expiry < new Date()) {
        status = 'EXPIRED';
      }
    }

    const lot = await this.prisma.client.inventoryLot.create({
      data: {
        orgId,
        branchId,
        itemId,
        locationId,
        lotNumber,
        receivedQty: qty,
        remainingQty: qty,
        unitCost: unitCost ? new Decimal(unitCost.toString()) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : null,
        supplierLotRef,
        sourceType,
        sourceId,
        status,
        notes,
        createdById,
      },
    });

    await this.auditLog.log({
      orgId,
      branchId,
      userId: createdById || 'system',
      action: 'LOT_CREATED',
      resourceType: 'InventoryLot',
      resourceId: lot.id,
      metadata: {
        lotNumber,
        itemId,
        receivedQty: qty.toString(),
        expiryDate: expiryDate?.toString(),
        sourceType,
        sourceId,
      },
    });

    return { id: lot.id, lotNumber: lot.lotNumber };
  }

  /**
   * Get a lot by ID
   */
  async getLot(lotId: string): Promise<LotSummary | null> {
    const lot = await this.prisma.client.inventoryLot.findUnique({
      where: { id: lotId },
      include: {
        item: { select: { name: true } },
      },
    });

    if (!lot) return null;

    return this.toLotSummary(lot);
  }

  /**
   * List lots for an item at a branch/location
   */
  async listLots(options: {
    orgId: string;
    branchId?: string;
    itemId?: string;
    locationId?: string;
    status?: LotStatus | LotStatus[];
    includeExpired?: boolean;
    includeDepleted?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ lots: LotSummary[]; total: number }> {
    const {
      orgId,
      branchId,
      itemId,
      locationId,
      status,
      includeExpired = false,
      includeDepleted = false,
      limit = 50,
      offset = 0,
    } = options;

    const where: Prisma.InventoryLotWhereInput = { orgId };

    if (branchId) where.branchId = branchId;
    if (itemId) where.itemId = itemId;
    if (locationId) where.locationId = locationId;

    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    } else {
      // Default: exclude EXPIRED and DEPLETED unless requested
      const excludeStatuses: LotStatus[] = [];
      if (!includeExpired) excludeStatuses.push('EXPIRED');
      if (!includeDepleted) excludeStatuses.push('DEPLETED');
      if (excludeStatuses.length > 0) {
        where.status = { notIn: excludeStatuses };
      }
    }

    const [lots, total] = await Promise.all([
      this.prisma.client.inventoryLot.findMany({
        where,
        include: { item: { select: { name: true } } },
        orderBy: [
          { expiryDate: 'asc' },
          { createdAt: 'asc' },
        ],
        take: limit,
        skip: offset,
      }),
      this.prisma.client.inventoryLot.count({ where }),
    ]);

    return {
      lots: lots.map((lot) => this.toLotSummary(lot)),
      total,
    };
  }

  /**
   * Get lots expiring within N days
   */
  async getExpiringSoon(options: {
    orgId: string;
    branchId?: string;
    daysThreshold: number;
    limit?: number;
  }): Promise<LotSummary[]> {
    const { orgId, branchId, daysThreshold, limit = 100 } = options;

    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(now.getDate() + daysThreshold);

    const where: Prisma.InventoryLotWhereInput = {
      orgId,
      status: 'ACTIVE',
      expiryDate: {
        gte: now,
        lte: thresholdDate,
      },
      remainingQty: { gt: 0 },
    };

    if (branchId) where.branchId = branchId;

    const lots = await this.prisma.client.inventoryLot.findMany({
      where,
      include: { item: { select: { name: true } } },
      orderBy: { expiryDate: 'asc' },
      take: limit,
    });

    return lots.map((lot) => this.toLotSummary(lot));
  }

  /**
   * Allocate stock using FEFO (First Expiry First Out)
   * 
   * Returns array of lot allocations in FEFO order.
   * Does NOT actually decrement lots - caller must do that.
   */
  async allocateFEFO(options: {
    orgId: string;
    branchId: string;
    itemId: string;
    locationId: string;
    qtyNeeded: number | Decimal;
    excludeExpired?: boolean;
  }): Promise<{ allocations: FEFOAllocation[]; totalAllocated: Decimal; shortfall: Decimal }> {
    const {
      orgId,
      branchId,
      itemId,
      locationId,
      qtyNeeded,
      excludeExpired = true,
    } = options;

    const qty = new Decimal(qtyNeeded.toString());
    const now = new Date();

    // Build where clause
    const where: Prisma.InventoryLotWhereInput = {
      orgId,
      branchId,
      itemId,
      locationId,
      status: 'ACTIVE',
      remainingQty: { gt: 0 },
    };

    // Exclude expired lots by default
    if (excludeExpired) {
      where.OR = [
        { expiryDate: null },
        { expiryDate: { gte: now } },
      ];
    }

    // Get lots ordered by expiry (FEFO: First Expiry First Out)
    // NULLS LAST: lots without expiry date are used last
    const lots = await this.prisma.client.inventoryLot.findMany({
      where,
      orderBy: [
        { expiryDate: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    const allocations: FEFOAllocation[] = [];
    let remaining = qty;
    let order = 1;

    for (const lot of lots) {
      if (remaining.lte(0)) break;

      const allocateQty = Decimal.min(remaining, lot.remainingQty);
      allocations.push({
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        allocatedQty: allocateQty,
        expiryDate: lot.expiryDate,
        allocationOrder: order++,
      });

      remaining = remaining.minus(allocateQty);
    }

    const totalAllocated = qty.minus(remaining);

    return {
      allocations,
      totalAllocated,
      shortfall: remaining.gt(0) ? remaining : new Decimal(0),
    };
  }

  /**
   * Decrement lot quantity and record allocation
   */
  async decrementLot(options: {
    lotId: string;
    qty: number | Decimal;
    sourceType: string;
    sourceId: string;
    ledgerEntryId?: string;
    allocationOrder?: number;
  }): Promise<void> {
    const { lotId, qty, sourceType, sourceId, ledgerEntryId, allocationOrder = 1 } = options;

    const decrementQty = new Decimal(qty.toString());

    const lot = await this.prisma.client.inventoryLot.findUnique({
      where: { id: lotId },
    });

    if (!lot) {
      throw new NotFoundException(`Lot ${lotId} not found`);
    }

    if (lot.remainingQty.lt(decrementQty)) {
      throw new BadRequestException(
        `Cannot decrement ${decrementQty} from lot ${lot.lotNumber} - only ${lot.remainingQty} remaining`,
      );
    }

    const newRemaining = lot.remainingQty.minus(decrementQty);
    const newStatus: LotStatus = newRemaining.lte(0) ? 'DEPLETED' : lot.status;

    await this.prisma.client.$transaction([
      // Update lot
      this.prisma.client.inventoryLot.update({
        where: { id: lotId },
        data: {
          remainingQty: newRemaining,
          status: newStatus,
        },
      }),
      // Create allocation record for traceability
      this.prisma.client.lotLedgerAllocation.create({
        data: {
          orgId: lot.orgId,
          lotId,
          ledgerEntryId,
          allocatedQty: decrementQty,
          sourceType,
          sourceId,
          allocationOrder,
        },
      }),
    ]);
  }

  /**
   * Increment lot quantity (for receiving transfers or adjustments)
   */
  async incrementLot(options: {
    lotId: string;
    qty: number | Decimal;
    userId?: string;
  }): Promise<void> {
    const { lotId, qty } = options;
    const incrementQty = new Decimal(qty.toString());

    const lot = await this.prisma.client.inventoryLot.findUnique({
      where: { id: lotId },
    });

    if (!lot) {
      throw new NotFoundException(`Lot ${lotId} not found`);
    }

    const newRemaining = lot.remainingQty.plus(incrementQty);
    
    // If lot was depleted, reactivate it
    const newStatus: LotStatus = lot.status === 'DEPLETED' ? 'ACTIVE' : lot.status;

    await this.prisma.client.inventoryLot.update({
      where: { id: lotId },
      data: {
        remainingQty: newRemaining,
        status: newStatus,
      },
    });
  }

  /**
   * Get traceability info for a lot (where did all units go?)
   */
  async getTraceability(lotId: string): Promise<{
    lot: LotSummary | null;
    allocations: TraceabilityEntry[];
    summary: { total: Decimal; bySourceType: Record<string, Decimal> };
  }> {
    const lot = await this.getLot(lotId);
    if (!lot) {
      return {
        lot: null,
        allocations: [],
        summary: { total: new Decimal(0), bySourceType: {} },
      };
    }

    const allocations = await this.prisma.client.lotLedgerAllocation.findMany({
      where: { lotId },
      orderBy: { createdAt: 'asc' },
    });

    const bySourceType: Record<string, Decimal> = {};
    let total = new Decimal(0);

    for (const alloc of allocations) {
      const qty = alloc.allocatedQty;
      total = total.plus(qty);
      bySourceType[alloc.sourceType] = (bySourceType[alloc.sourceType] || new Decimal(0)).plus(qty);
    }

    return {
      lot,
      allocations: allocations.map((a) => ({
        id: a.id,
        sourceType: a.sourceType,
        sourceId: a.sourceId,
        allocatedQty: a.allocatedQty,
        createdAt: a.createdAt,
        metadata: a.metadata as Record<string, unknown> | null,
      })),
      summary: { total, bySourceType },
    };
  }

  /**
   * Get allocations for a specific source (e.g., all lots consumed by an order)
   */
  async getAllocationsForSource(sourceType: string, sourceId: string): Promise<FEFOAllocation[]> {
    const allocations = await this.prisma.client.lotLedgerAllocation.findMany({
      where: { sourceType, sourceId },
      include: {
        lot: true,
      },
      orderBy: { allocationOrder: 'asc' },
    });

    return allocations.map((a) => ({
      lotId: a.lotId,
      lotNumber: a.lot.lotNumber,
      allocatedQty: a.allocatedQty,
      expiryDate: a.lot.expiryDate,
      allocationOrder: a.allocationOrder,
    }));
  }

  /**
   * Update expired lots status (run periodically)
   */
  async updateExpiredLots(orgId: string): Promise<number> {
    const now = new Date();

    const result = await this.prisma.client.inventoryLot.updateMany({
      where: {
        orgId,
        status: 'ACTIVE',
        expiryDate: { lt: now },
        remainingQty: { gt: 0 },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    if (result.count > 0) {
      this.logger.log(`Marked ${result.count} lots as expired for org ${orgId}`);
    }

    return result.count;
  }

  /**
   * Set lot to quarantine status
   */
  async quarantineLot(lotId: string, userId?: string): Promise<void> {
    const lot = await this.prisma.client.inventoryLot.findUnique({
      where: { id: lotId },
    });

    if (!lot) {
      throw new NotFoundException(`Lot ${lotId} not found`);
    }

    await this.prisma.client.inventoryLot.update({
      where: { id: lotId },
      data: { status: 'QUARANTINE' },
    });

    await this.auditLog.log({
      orgId: lot.orgId,
      branchId: lot.branchId,
      userId: userId || 'system',
      action: 'LOT_QUARANTINED',
      resourceType: 'InventoryLot',
      resourceId: lotId,
      metadata: { lotNumber: lot.lotNumber },
    });
  }

  /**
   * Release lot from quarantine
   */
  async releaseLot(lotId: string, userId?: string): Promise<void> {
    const lot = await this.prisma.client.inventoryLot.findUnique({
      where: { id: lotId },
    });

    if (!lot) {
      throw new NotFoundException(`Lot ${lotId} not found`);
    }

    if (lot.status !== 'QUARANTINE') {
      throw new BadRequestException(`Lot ${lot.lotNumber} is not in quarantine`);
    }

    // Determine new status
    const now = new Date();
    let newStatus: LotStatus = 'ACTIVE';
    if (lot.remainingQty.lte(0)) {
      newStatus = 'DEPLETED';
    } else if (lot.expiryDate && lot.expiryDate < now) {
      newStatus = 'EXPIRED';
    }

    await this.prisma.client.inventoryLot.update({
      where: { id: lotId },
      data: { status: newStatus },
    });

    await this.auditLog.log({
      orgId: lot.orgId,
      branchId: lot.branchId,
      userId: userId || 'system',
      action: 'LOT_RELEASED',
      resourceType: 'InventoryLot',
      resourceId: lotId,
      metadata: { lotNumber: lot.lotNumber, newStatus },
    });
  }

  /**
   * Convert lot record to summary
   */
  private toLotSummary(lot: {
    id: string;
    lotNumber: string;
    itemId: string;
    branchId: string;
    locationId: string;
    receivedQty: Decimal;
    remainingQty: Decimal;
    expiryDate: Date | null;
    status: LotStatus;
    createdAt: Date;
    item?: { name: string };
  }): LotSummary {
    const now = new Date();
    let daysToExpiry: number | null = null;
    let isExpired = false;
    let isExpiringSoon = false;

    if (lot.expiryDate) {
      const diffMs = lot.expiryDate.getTime() - now.getTime();
      daysToExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      isExpired = daysToExpiry < 0;
      isExpiringSoon = daysToExpiry >= 0 && daysToExpiry <= 30;
    }

    return {
      id: lot.id,
      lotNumber: lot.lotNumber,
      itemId: lot.itemId,
      itemName: lot.item?.name || '',
      branchId: lot.branchId,
      locationId: lot.locationId,
      receivedQty: lot.receivedQty,
      remainingQty: lot.remainingQty,
      expiryDate: lot.expiryDate,
      status: lot.status,
      daysToExpiry,
      isExpired,
      isExpiringSoon,
      createdAt: lot.createdAt,
    };
  }
}
