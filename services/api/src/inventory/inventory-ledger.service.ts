import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export enum LedgerEntryReason {
  PURCHASE = 'PURCHASE',
  SALE = 'SALE',
  WASTAGE = 'WASTAGE',
  ADJUSTMENT = 'ADJUSTMENT',
  COUNT_ADJUSTMENT = 'COUNT_ADJUSTMENT',
  CYCLE_COUNT = 'CYCLE_COUNT',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
  INITIAL = 'INITIAL',
  // M11.8: Vendor Returns
  VENDOR_RETURN = 'VENDOR_RETURN',
  // M11.9: Production Batches
  PRODUCTION_CONSUME = 'PRODUCTION_CONSUME', // Negative - inputs consumed
  PRODUCTION_PRODUCE = 'PRODUCTION_PRODUCE', // Positive - output created
}

export enum LedgerSourceType {
  GOODS_RECEIPT = 'GOODS_RECEIPT',
  ORDER = 'ORDER',
  WASTAGE = 'WASTAGE',
  STOCK_ADJUSTMENT = 'STOCK_ADJUSTMENT',
  COUNT_SESSION = 'COUNT_SESSION',
  TRANSFER = 'TRANSFER',
  MANUAL = 'MANUAL',
  // M11.8: Vendor Returns
  VENDOR_RETURN = 'VENDOR_RETURN',
  // M11.9: Production Batches
  PRODUCTION = 'PRODUCTION',
}

export interface RecordLedgerEntryDto {
  itemId: string;
  locationId: string;
  qty: number | string | Decimal;
  reason: LedgerEntryReason | string;
  sourceType: LedgerSourceType | string;
  sourceId?: string;
  notes?: string;
  createdById?: string;
  metadata?: Record<string, unknown>;
}

export interface OnHandResult {
  itemId: string;
  itemSku?: string;
  itemName?: string;
  locationId: string;
  locationCode?: string;
  locationName?: string;
  branchId: string;
  onHand: Decimal;
}

@Injectable()
export class InventoryLedgerService {
  private readonly logger = new Logger(InventoryLedgerService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Record an entry in the inventory ledger
   * THIS IS APPEND-ONLY - entries are NEVER updated or deleted
   */
  async recordEntry(
    orgId: string,
    branchId: string,
    dto: RecordLedgerEntryDto,
    options?: { allowNegative?: boolean; tx?: Prisma.TransactionClient },
  ) {
    const client = options?.tx ?? this.prisma.client;
    const qty = new Decimal(dto.qty);

    this.logger.debug(
      `Recording ledger entry: item=${dto.itemId}, location=${dto.locationId}, qty=${qty}, reason=${dto.reason}`,
    );

    // Verify item exists and belongs to org
    const item = await client.inventoryItem.findFirst({
      where: { id: dto.itemId, orgId },
    });

    if (!item) {
      throw new BadRequestException('Inventory item not found');
    }

    // Verify location exists and belongs to branch
    const location = await client.inventoryLocation.findFirst({
      where: { id: dto.locationId, branchId },
    });

    if (!location) {
      throw new BadRequestException('Inventory location not found');
    }

    // Check for negative stock if not allowed
    if (!options?.allowNegative && qty.lessThan(0)) {
      const currentOnHand = await this.getOnHandRaw(client, dto.itemId, dto.locationId, branchId);
      const resultingOnHand = currentOnHand.plus(qty);

      if (resultingOnHand.lessThan(0)) {
        throw new BadRequestException(
          `Insufficient stock: current on-hand is ${currentOnHand}, cannot subtract ${qty.abs()}`,
        );
      }
    }

    // INSERT-ONLY - no UPDATE or DELETE on ledger entries
    const entry = await client.inventoryLedgerEntry.create({
      data: {
        orgId,
        branchId,
        itemId: dto.itemId,
        locationId: dto.locationId,
        qty,
        reason: dto.reason,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        notes: dto.notes,
        createdById: dto.createdById,
        metadata: dto.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
      },
    });

    this.logger.log(
      `Ledger entry ${entry.id} created: item=${dto.itemId}, qty=${qty}, reason=${dto.reason}`,
    );

    return entry;
  }

  /**
   * Get on-hand quantity for an item at a location
   * Computed as SUM(qty) from ledger entries
   */
  async getOnHand(itemId: string, locationId: string, branchId: string): Promise<Decimal> {
    return this.getOnHandRaw(this.prisma.client, itemId, locationId, branchId);
  }

  /**
   * Internal method for getting on-hand within a transaction
   */
  private async getOnHandRaw(
    client: Prisma.TransactionClient | PrismaService['client'],
    itemId: string,
    locationId: string,
    branchId: string,
  ): Promise<Decimal> {
    const result = await client.inventoryLedgerEntry.aggregate({
      where: { itemId, locationId, branchId },
      _sum: { qty: true },
    });

    return result._sum.qty ?? new Decimal(0);
  }

  /**
   * Get on-hand levels for an item at a specific location
   */
  async getOnHandByLocation(itemId: string, branchId: string): Promise<OnHandResult[]> {
    // First, get aggregated quantities by location
    const results = await this.prisma.client.inventoryLedgerEntry.groupBy({
      by: ['locationId'],
      where: { itemId, branchId },
      _sum: { qty: true },
    });

    // Get item and location details
    const [item, locations] = await Promise.all([
      this.prisma.client.inventoryItem.findUnique({
        where: { id: itemId },
        select: { sku: true, name: true },
      }),
      this.prisma.client.inventoryLocation.findMany({
        where: { branchId, id: { in: results.map((r) => r.locationId) } },
        select: { id: true, code: true, name: true },
      }),
    ]);

    const locationMap = new Map(locations.map((l) => [l.id, l]));

    return results.map((r) => {
      const loc = locationMap.get(r.locationId);
      return {
        itemId,
        itemSku: item?.sku,
        itemName: item?.name,
        locationId: r.locationId,
        locationCode: loc?.code,
        locationName: loc?.name,
        branchId,
        onHand: r._sum.qty ?? new Decimal(0),
      };
    });
  }

  /**
   * Get on-hand levels for all items in a branch (optionally filtered by location)
   */
  async getOnHandByBranch(branchId: string, locationId?: string): Promise<OnHandResult[]> {
    const where: any = { branchId };
    if (locationId) where.locationId = locationId;

    const results = await this.prisma.client.inventoryLedgerEntry.groupBy({
      by: ['itemId', 'locationId'],
      where,
      _sum: { qty: true },
    });

    // Get item and location details
    const itemIds = [...new Set(results.map((r) => r.itemId))];
    const locationIds = [...new Set(results.map((r) => r.locationId))];

    const [items, locations] = await Promise.all([
      this.prisma.client.inventoryItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, sku: true, name: true },
      }),
      this.prisma.client.inventoryLocation.findMany({
        where: { id: { in: locationIds } },
        select: { id: true, code: true, name: true },
      }),
    ]);

    const itemMap = new Map(items.map((i) => [i.id, i]));
    const locationMap = new Map(locations.map((l) => [l.id, l]));

    return results.map((r) => {
      const item = itemMap.get(r.itemId);
      const loc = locationMap.get(r.locationId);
      return {
        itemId: r.itemId,
        itemSku: item?.sku,
        itemName: item?.name,
        locationId: r.locationId,
        locationCode: loc?.code,
        locationName: loc?.name,
        branchId,
        onHand: r._sum.qty ?? new Decimal(0),
      };
    });
  }

  /**
   * Get ledger entries for an item (for audit trail)
   */
  async getLedgerEntries(
    orgId: string,
    branchId: string,
    filters: {
      itemId?: string;
      locationId?: string;
      reason?: string;
      sourceType?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: any = { orgId, branchId };

    if (filters.itemId) where.itemId = filters.itemId;
    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.reason) where.reason = filters.reason;
    if (filters.sourceType) where.sourceType = filters.sourceType;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [entries, total] = await Promise.all([
      this.prisma.client.inventoryLedgerEntry.findMany({
        where,
        include: {
          item: { select: { id: true, name: true, sku: true } },
          location: { select: { id: true, code: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 100,
        skip: filters.offset ?? 0,
      }),
      this.prisma.client.inventoryLedgerEntry.count({ where }),
    ]);

    return { entries, total };
  }

  /**
   * Record an adjustment (creates ledger entry)
   * This is a convenience method that wraps recordEntry
   */
  async recordAdjustment(
    orgId: string,
    branchId: string,
    itemId: string,
    locationId: string,
    qty: number | string,
    options: {
      reason?: string;
      notes?: string;
      createdById: string;
      sourceId?: string;
      allowNegative?: boolean;
    },
  ) {
    return this.recordEntry(orgId, branchId, {
      itemId,
      locationId,
      qty,
      reason: LedgerEntryReason.ADJUSTMENT,
      sourceType: LedgerSourceType.STOCK_ADJUSTMENT,
      sourceId: options.sourceId,
      notes: options.notes,
      createdById: options.createdById,
    }, { allowNegative: options.allowNegative });
  }

  /**
   * Record a count adjustment (from cycle count)
   */
  async recordCountAdjustment(
    orgId: string,
    branchId: string,
    itemId: string,
    locationId: string,
    delta: Decimal,
    options: {
      countSessionId: string;
      notes?: string;
      createdById?: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    return this.recordEntry(
      orgId,
      branchId,
      {
        itemId,
        locationId,
        qty: delta,
        reason: LedgerEntryReason.COUNT_ADJUSTMENT,
        sourceType: LedgerSourceType.COUNT_SESSION,
        sourceId: options.countSessionId,
        notes: options.notes ?? `Count adjustment from session ${options.countSessionId}`,
        createdById: options.createdById,
      },
      { allowNegative: true, tx }, // Count adjustments can go negative if counting finds less than system
    );
  }
}
