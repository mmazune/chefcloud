/**
 * M11.3 Inventory Waste Service
 * 
 * Manages waste documentation and posting:
 * - Create waste documents with lines
 * - Post waste to create WASTE ledger entries
 * - Idempotent posting (prevents duplicate ledger entries)
 * - Negative stock prevention by default
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { InventoryLedgerService, LedgerEntryReason, LedgerSourceType } from './inventory-ledger.service';
import { Prisma, InventoryWasteStatus, InventoryWasteReason } from '@chefcloud/db';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export interface CreateWasteDto {
  branchId: string;
  reason?: InventoryWasteReason;
  notes?: string;
  idempotencyKey?: string;
  lines: CreateWasteLineDto[];
}

export interface CreateWasteLineDto {
  itemId: string;
  locationId: string;
  qty: number | string;
  unitCost?: number | string;
  reason?: InventoryWasteReason;
  notes?: string;
}

export interface UpdateWasteDto {
  reason?: InventoryWasteReason;
  notes?: string;
  lines?: CreateWasteLineDto[];
}

export interface WasteQueryOptions {
  status?: InventoryWasteStatus | InventoryWasteStatus[];
  branchId?: string;
  reason?: InventoryWasteReason;
  fromDate?: Date;
  toDate?: Date;
  includeLines?: boolean;
}

@Injectable()
export class InventoryWasteService {
  private readonly logger = new Logger(InventoryWasteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly ledgerService: InventoryLedgerService,
  ) {}

  /**
   * Generate a unique waste number
   */
  private async generateWasteNumber(orgId: string): Promise<string> {
    const count = await this.prisma.client.inventoryWaste.count({
      where: { orgId },
    });
    const date = new Date();
    const yy = date.getFullYear().toString().slice(-2);
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    return `WST-${yy}${mm}-${(count + 1).toString().padStart(5, '0')}`;
  }

  /**
   * Create a draft waste document
   */
  async create(
    orgId: string,
    userId: string,
    dto: CreateWasteDto,
  ) {
    this.logger.log(`Creating waste document for org=${orgId}, branch=${dto.branchId}`);

    // Check idempotency
    if (dto.idempotencyKey) {
      const existing = await this.prisma.client.inventoryWaste.findUnique({
        where: { orgId_idempotencyKey: { orgId, idempotencyKey: dto.idempotencyKey } },
        include: { lines: true, branch: true },
      });
      if (existing) {
        this.logger.log(`Idempotent return for waste ${existing.id}`);
        return { ...existing, isIdempotent: true };
      }
    }

    // Verify branch exists and belongs to org
    const branch = await this.prisma.client.branch.findFirst({
      where: { id: dto.branchId, orgId },
    });
    if (!branch) {
      throw new BadRequestException('Branch not found');
    }

    // Validate lines exist
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('At least one line is required');
    }

    // Process and validate lines
    const processedLines: {
      itemId: string;
      locationId: string;
      qty: Decimal;
      unitCost?: Decimal;
      reason?: InventoryWasteReason;
      notes?: string;
    }[] = [];

    for (const line of dto.lines) {
      // Validate qty is positive
      const qty = new Decimal(line.qty);
      if (qty.lessThanOrEqualTo(0)) {
        throw new BadRequestException('Quantity must be greater than zero');
      }

      // Verify item exists and belongs to org
      const item = await this.prisma.client.inventoryItem.findFirst({
        where: { id: line.itemId, orgId },
      });
      if (!item) {
        throw new BadRequestException(`Item ${line.itemId} not found`);
      }

      // Verify location exists and belongs to branch
      const location = await this.prisma.client.inventoryLocation.findFirst({
        where: { id: line.locationId, branchId: dto.branchId, isActive: true },
      });
      if (!location) {
        throw new BadRequestException(`Location ${line.locationId} not found or inactive`);
      }

      processedLines.push({
        itemId: line.itemId,
        locationId: line.locationId,
        qty,
        unitCost: line.unitCost !== undefined ? new Decimal(line.unitCost) : undefined,
        reason: line.reason,
        notes: line.notes,
      });
    }

    // Create waste with lines
    const wasteNumber = await this.generateWasteNumber(orgId);

    const waste = await this.prisma.client.inventoryWaste.create({
      data: {
        orgId,
        branchId: dto.branchId,
        wasteNumber,
        status: 'DRAFT',
        reason: dto.reason ?? 'OTHER',
        notes: dto.notes,
        idempotencyKey: dto.idempotencyKey,
        createdById: userId,
        lines: {
          create: processedLines,
        },
      },
      include: {
        lines: { include: { item: true, location: true } },
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await this.auditLog.log({
      orgId,
      branchId: dto.branchId,
      userId,
      action: 'INVENTORY_WASTE_CREATED',
      resourceType: 'InventoryWaste',
      resourceId: waste.id,
      metadata: { reason: dto.reason, lineCount: dto.lines.length },
    });

    this.logger.log(`Created waste ${waste.wasteNumber} with ${processedLines.length} lines`);
    return waste;
  }

  /**
   * Get a waste document by ID
   */
  async findById(
    orgId: string,
    branchId: string,
    wasteId: string,
    options?: { includeLines?: boolean },
  ) {
    const waste = await this.prisma.client.inventoryWaste.findFirst({
      where: { id: wasteId, orgId, branchId },
      include: {
        lines: options?.includeLines !== false ? {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            location: { select: { id: true, code: true, name: true } },
          },
        } : false,
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        postedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!waste) {
      throw new NotFoundException('Waste document not found');
    }

    return waste;
  }

  /**
   * List waste documents
   */
  async findMany(
    orgId: string,
    branchId?: string,
    options?: WasteQueryOptions,
  ) {
    const where: Prisma.InventoryWasteWhereInput = { orgId };

    if (branchId) {
      where.branchId = branchId;
    }

    if (options?.status) {
      where.status = Array.isArray(options.status)
        ? { in: options.status }
        : options.status;
    }

    if (options?.reason) {
      where.reason = options.reason;
    }

    if (options?.fromDate || options?.toDate) {
      where.createdAt = {};
      if (options.fromDate) where.createdAt.gte = options.fromDate;
      if (options.toDate) where.createdAt.lte = options.toDate;
    }

    return this.prisma.client.inventoryWaste.findMany({
      where,
      include: {
        lines: options?.includeLines ? {
          include: { item: true, location: true },
        } : false,
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        postedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Post a waste document (creates WASTE ledger entries)
   * This is IDEMPOTENT - posting the same waste twice returns success without duplication
   */
  async post(
    orgId: string,
    branchId: string,
    wasteId: string,
    userId: string,
  ): Promise<{ waste: any; isAlreadyPosted: boolean; ledgerEntryCount: number }> {
    const waste = await this.prisma.client.inventoryWaste.findFirst({
      where: { id: wasteId, orgId, branchId },
      include: { lines: { include: { item: true, location: true } } },
    });

    if (!waste) {
      throw new NotFoundException('Waste document not found');
    }

    // Idempotency check
    if (waste.status === 'POSTED') {
      this.logger.log(`Waste ${waste.wasteNumber} already posted - idempotent return`);
      return { waste, isAlreadyPosted: true, ledgerEntryCount: 0 };
    }

    // Validate state
    if (waste.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot post waste in ${waste.status} status`);
    }

    let ledgerEntryCount = 0;

    // Post in transaction
    const postedWaste = await this.prisma.client.$transaction(async (tx) => {
      // Create WASTE ledger entries (negative qty)
      for (const line of waste.lines) {
        // Skip zero quantity lines
        if (new Decimal(line.qty).isZero()) {
          continue;
        }

        await this.ledgerService.recordEntry(
          orgId,
          branchId,
          {
            itemId: line.itemId,
            locationId: line.locationId,
            qty: new Decimal(line.qty).negated(), // Negative for waste
            reason: LedgerEntryReason.WASTAGE,
            sourceType: LedgerSourceType.WASTAGE,
            sourceId: wasteId,
            notes: `Waste ${waste.wasteNumber} - ${line.reason || waste.reason}`,
            createdById: userId,
            metadata: {
              wasteNumber: waste.wasteNumber,
              reason: line.reason || waste.reason,
              unitCost: line.unitCost?.toString(),
            },
          },
          { tx },
        );
        ledgerEntryCount++;
      }

      // Update waste status
      return tx.inventoryWaste.update({
        where: { id: wasteId },
        data: {
          status: 'POSTED',
          postedAt: new Date(),
          postedById: userId,
        },
        include: {
          lines: { include: { item: true, location: true } },
          branch: { select: { id: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          postedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    });

    await this.auditLog.log({
      orgId,
      branchId,
      userId,
      action: 'INVENTORY_WASTE_POSTED',
      resourceType: 'InventoryWaste',
      resourceId: wasteId,
      metadata: { ledgerEntryCount },
    });

    this.logger.log(`Posted waste ${waste.wasteNumber} with ${ledgerEntryCount} ledger entries`);
    return { waste: postedWaste, isAlreadyPosted: false, ledgerEntryCount };
  }

  /**
   * Void a draft waste document
   */
  async void(
    orgId: string,
    branchId: string,
    wasteId: string,
    userId: string,
  ) {
    const waste = await this.prisma.client.inventoryWaste.findFirst({
      where: { id: wasteId, orgId, branchId },
    });

    if (!waste) {
      throw new NotFoundException('Waste document not found');
    }

    // Can only void DRAFT waste documents
    if (waste.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot void waste in ${waste.status} status. Only DRAFT waste documents can be voided.`);
    }

    const voidedWaste = await this.prisma.client.inventoryWaste.update({
      where: { id: wasteId },
      data: { status: 'VOID' },
      include: {
        lines: { include: { item: true, location: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    await this.auditLog.log({
      orgId,
      branchId,
      userId,
      action: 'INVENTORY_WASTE_VOIDED',
      resourceType: 'InventoryWaste',
      resourceId: wasteId,
      metadata: {},
    });

    this.logger.log(`Voided waste ${waste.wasteNumber}`);
    return voidedWaste;
  }

  /**
   * Export waste as CSV
   */
  async exportCsv(
    orgId: string,
    branchId?: string,
    options?: WasteQueryOptions,
  ): Promise<{ csv: string; hash: string }> {
    const wasteRecords = await this.findMany(orgId, branchId, { ...options, includeLines: true });

    // Sort deterministically for stable hash
    wasteRecords.sort((a, b) => {
      const dateCompare = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.id.localeCompare(b.id);
    });

    // Build CSV
    const BOM = '\uFEFF';
    const headers = [
      'Waste Number',
      'Status',
      'Branch',
      'Reason',
      'Posted At',
      'Created At',
      'Item SKU',
      'Item Name',
      'Location',
      'Qty',
      'Unit Cost',
      'Line Reason',
    ].join(',');

    const rows: string[] = [];
    for (const waste of wasteRecords) {
      const lines = (waste as any).lines || [];
      if (lines.length === 0) {
        rows.push([
          waste.wasteNumber,
          waste.status,
          (waste as any).branch?.name || '',
          waste.reason,
          waste.postedAt?.toISOString() || '',
          waste.createdAt.toISOString(),
          '', '', '', '', '', '',
        ].join(','));
      } else {
        for (const line of lines) {
          rows.push([
            waste.wasteNumber,
            waste.status,
            (waste as any).branch?.name || '',
            waste.reason,
            waste.postedAt?.toISOString() || '',
            waste.createdAt.toISOString(),
            line.item?.sku || '',
            `"${(line.item?.name || '').replace(/"/g, '""')}"`,
            line.location?.code || '',
            line.qty.toString(),
            line.unitCost?.toString() || '',
            line.reason || '',
          ].join(','));
        }
      }
    }

    const csv = BOM + headers + '\n' + rows.join('\n');

    // Calculate SHA-256 hash
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(csv).digest('hex');

    return { csv, hash };
  }

  /**
   * Get total wasted quantity for an item in a period
   */
  async getTotalWastedQty(
    orgId: string,
    branchId: string,
    itemId: string,
    fromDate?: Date,
    toDate?: Date,
  ): Promise<Decimal> {
    const where: Prisma.InventoryWasteLineWhereInput = {
      waste: {
        orgId,
        branchId,
        status: 'POSTED',
      },
      itemId,
    };

    if (fromDate || toDate) {
      where.waste = {
        ...where.waste as any,
        postedAt: {},
      };
      if (fromDate) (where.waste as any).postedAt.gte = fromDate;
      if (toDate) (where.waste as any).postedAt.lte = toDate;
    }

    const result = await this.prisma.client.inventoryWasteLine.aggregate({
      where,
      _sum: { qty: true },
    });

    return result._sum.qty ?? new Decimal(0);
  }
}
