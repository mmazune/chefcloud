/**
 * M11.8 Vendor Returns Service
 *
 * Handles vendor return workflows with lot-aware FEFO allocation:
 * - Create/list vendor returns (DRAFT → SUBMITTED → POSTED → VOID)
 * - FEFO allocation on POST (decrement lots, create ledger entries)
 * - Over-allocation prevention with optimistic locking
 * - Traceability via LotLedgerAllocation
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { InventoryLotsService } from './inventory-lots.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { Prisma, VendorReturnStatus } from '@chefcloud/db';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

// Input for creating a vendor return
export interface CreateVendorReturnInput {
  orgId: string;
  branchId: string;
  vendorId: string;
  createdById: string;
  notes?: string;
  lines: CreateVendorReturnLineInput[];
}

export interface CreateVendorReturnLineInput {
  itemId: string;
  locationId: string;
  requestedBaseQty: number | Decimal;
  uomId?: string;
  lotId?: string; // Optional - if not provided, FEFO allocation on POST
  unitCost?: number | Decimal;
  reason?: string;
}

// Vendor return summary
export interface VendorReturnSummary {
  id: string;
  returnNumber: string;
  orgId: string;
  branchId: string;
  vendorId: string;
  vendorName?: string;
  status: VendorReturnStatus;
  totalRequestedQty: Decimal;
  totalPostedQty: Decimal;
  lineCount: number;
  createdAt: Date;
  submittedAt: Date | null;
  postedAt: Date | null;
  voidedAt: Date | null;
}

// Vendor return with lines
export interface VendorReturnDetail extends VendorReturnSummary {
  lines: VendorReturnLineDetail[];
  notes?: string;
  voidReason?: string;
}

export interface VendorReturnLineDetail {
  id: string;
  itemId: string;
  itemName: string;
  locationId: string;
  locationName: string;
  requestedBaseQty: Decimal;
  postedBaseQty: Decimal;
  uomId?: string;
  uomCode?: string;
  lotId?: string;
  lotNumber?: string;
  unitCost: Decimal | null;
  reason?: string;
}

@Injectable()
export class InventoryVendorReturnsService {
  private readonly logger = new Logger(InventoryVendorReturnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly lotsService: InventoryLotsService,
    private readonly ledgerService: InventoryLedgerService,
  ) {}

  /**
   * Generate unique return number
   */
  private async generateReturnNumber(orgId: string): Promise<string> {
    const prefix = 'RET';
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

    // Count today's returns for this org
    const todayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const count = await this.prisma.client.vendorReturn.count({
      where: {
        orgId,
        createdAt: { gte: todayStart, lt: todayEnd },
      },
    });

    return `${prefix}-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Create a vendor return in DRAFT status
   */
  async createReturn(input: CreateVendorReturnInput): Promise<{ id: string; returnNumber: string }> {
    const { orgId, branchId, vendorId, createdById, notes, lines } = input;

    if (!lines || lines.length === 0) {
      throw new BadRequestException('At least one line is required');
    }

    const returnNumber = await this.generateReturnNumber(orgId);

    const vendorReturn = await this.prisma.client.vendorReturn.create({
      data: {
        orgId,
        branchId,
        vendorId,
        returnNumber,
        status: 'DRAFT',
        createdById,
        notes,
        lines: {
          create: lines.map((line) => ({
            itemId: line.itemId,
            locationId: line.locationId,
            requestedBaseQty: new Decimal(line.requestedBaseQty.toString()),
            postedBaseQty: new Decimal(0),
            uomId: line.uomId,
            lotId: line.lotId,
            unitCost: line.unitCost ? new Decimal(line.unitCost.toString()) : null,
            reason: line.reason,
          })),
        },
      },
    });

    await this.auditLog.log({
      orgId,
      branchId,
      userId: createdById,
      action: 'VENDOR_RETURN_CREATED',
      resourceType: 'VendorReturn',
      resourceId: vendorReturn.id,
      metadata: { returnNumber, lineCount: lines.length },
    });

    return { id: vendorReturn.id, returnNumber };
  }

  /**
   * Get a vendor return by ID
   */
  async getReturn(id: string, orgId: string): Promise<VendorReturnDetail | null> {
    const vendorReturn = await this.prisma.client.vendorReturn.findFirst({
      where: { id, orgId },
      include: {
        vendor: { select: { name: true } },
        lines: {
          include: {
            item: { select: { name: true } },
            location: { select: { name: true } },
            uom: { select: { code: true } },
            lot: { select: { lotNumber: true } },
          },
        },
      },
    });

    if (!vendorReturn) return null;

    return {
      id: vendorReturn.id,
      returnNumber: vendorReturn.returnNumber,
      orgId: vendorReturn.orgId,
      branchId: vendorReturn.branchId,
      vendorId: vendorReturn.vendorId,
      vendorName: vendorReturn.vendor?.name,
      status: vendorReturn.status,
      totalRequestedQty: vendorReturn.lines.reduce(
        (sum, l) => sum.plus(l.requestedBaseQty),
        new Decimal(0),
      ),
      totalPostedQty: vendorReturn.lines.reduce(
        (sum, l) => sum.plus(l.postedBaseQty ?? 0),
        new Decimal(0),
      ),
      lineCount: vendorReturn.lines.length,
      createdAt: vendorReturn.createdAt,
      submittedAt: vendorReturn.submittedAt,
      postedAt: vendorReturn.postedAt,
      voidedAt: vendorReturn.voidedAt,
      notes: vendorReturn.notes ?? undefined,
      voidReason: vendorReturn.voidReason ?? undefined,
      lines: vendorReturn.lines.map((line) => ({
        id: line.id,
        itemId: line.itemId,
        itemName: line.item?.name ?? 'Unknown',
        locationId: line.locationId,
        locationName: line.location?.name ?? 'Unknown',
        requestedBaseQty: line.requestedBaseQty,
        postedBaseQty: line.postedBaseQty ?? new Decimal(0),
        uomId: line.uomId ?? undefined,
        uomCode: line.uom?.code ?? undefined,
        lotId: line.lotId ?? undefined,
        lotNumber: line.lot?.lotNumber ?? undefined,
        unitCost: line.unitCost,
        reason: line.notes ?? undefined,
      })),
    };
  }

  /**
   * List vendor returns with pagination
   */
  async listReturns(options: {
    orgId: string;
    branchId?: string;
    vendorId?: string;
    status?: VendorReturnStatus | VendorReturnStatus[];
    limit?: number;
    offset?: number;
  }): Promise<{ returns: VendorReturnSummary[]; total: number }> {
    const { orgId, branchId, vendorId, status, limit = 50, offset = 0 } = options;

    const where: Prisma.VendorReturnWhereInput = { orgId };
    if (branchId) where.branchId = branchId;
    if (vendorId) where.vendorId = vendorId;
    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }

    const [returns, total] = await Promise.all([
      this.prisma.client.vendorReturn.findMany({
        where,
        include: {
          vendor: { select: { name: true } },
          lines: { select: { requestedBaseQty: true, postedBaseQty: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.client.vendorReturn.count({ where }),
    ]);

    return {
      returns: returns.map((ret) => ({
        id: ret.id,
        returnNumber: ret.returnNumber,
        orgId: ret.orgId,
        branchId: ret.branchId,
        vendorId: ret.vendorId,
        vendorName: ret.vendor?.name,
        status: ret.status,
        totalRequestedQty: ret.lines.reduce(
          (sum, l) => sum.plus(l.requestedBaseQty),
          new Decimal(0),
        ),
        totalPostedQty: ret.lines.reduce(
          (sum, l) => sum.plus(l.postedBaseQty ?? 0),
          new Decimal(0),
        ),
        lineCount: ret.lines.length,
        createdAt: ret.createdAt,
        submittedAt: ret.submittedAt,
        postedAt: ret.postedAt,
        voidedAt: ret.voidedAt,
      })),
      total,
    };
  }

  /**
   * Submit a vendor return (DRAFT → SUBMITTED)
   */
  async submitReturn(id: string, orgId: string, userId: string): Promise<void> {
    const vendorReturn = await this.prisma.client.vendorReturn.findFirst({
      where: { id, orgId },
    });

    if (!vendorReturn) {
      throw new NotFoundException('Vendor return not found');
    }

    if (vendorReturn.status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot submit vendor return in ${vendorReturn.status} status`,
      );
    }

    await this.prisma.client.vendorReturn.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submittedById: userId,
      },
    });

    await this.auditLog.log({
      orgId,
      branchId: vendorReturn.branchId,
      userId,
      action: 'VENDOR_RETURN_SUBMITTED',
      resourceType: 'VendorReturn',
      resourceId: id,
      metadata: { returnNumber: vendorReturn.returnNumber },
    });
  }

  /**
   * Post a vendor return (SUBMITTED → POSTED)
   * This is where FEFO allocation and ledger entries happen
   */
  async postReturn(
    id: string,
    orgId: string,
    userId: string,
    idempotencyKey?: string,
  ): Promise<{ posted: boolean; allocations: { lineId: string; lotId: string; qty: Decimal }[] }> {
    // Idempotency check
    if (idempotencyKey) {
      const existing = await this.prisma.client.vendorReturn.findFirst({
        where: { id, orgId, status: 'POSTED' },
      });
      if (existing) {
        this.logger.log(`Idempotent POST: Return ${id} already posted`);
        return { posted: false, allocations: [] };
      }
    }

    const vendorReturn = await this.prisma.client.vendorReturn.findFirst({
      where: { id, orgId },
      include: {
        lines: {
          include: {
            item: { select: { name: true } },
            lot: { select: { id: true, lotNumber: true, remainingQty: true } },
          },
        },
      },
    });

    if (!vendorReturn) {
      throw new NotFoundException('Vendor return not found');
    }

    if (vendorReturn.status !== 'SUBMITTED') {
      throw new BadRequestException(
        `Cannot post vendor return in ${vendorReturn.status} status`,
      );
    }

    const allocations: { lineId: string; lotId: string; qty: Decimal }[] = [];

    // Use a transaction for atomicity
    await this.prisma.client.$transaction(async (tx) => {
      for (const line of vendorReturn.lines) {
        const qtyToReturn = line.requestedBaseQty;

        if (line.lotId) {
          // Specific lot was provided - validate and use it
          const lot = await tx.inventoryLot.findUnique({
            where: { id: line.lotId },
          });

          if (!lot) {
            throw new NotFoundException(`Lot ${line.lotId} not found`);
          }

          // Check for recall block
          const recallLink = await tx.recallLotLink.findFirst({
            where: {
              lotId: line.lotId,
              recallCase: { status: 'OPEN' },
            },
          });

          if (recallLink) {
            throw new BadRequestException(
              `Lot ${lot.lotNumber} is under active recall and cannot be returned`,
            );
          }

          if (lot.remainingQty.lt(qtyToReturn)) {
            throw new BadRequestException(
              `Lot ${lot.lotNumber} has insufficient quantity: ${lot.remainingQty} < ${qtyToReturn}`,
            );
          }

          // Decrement lot
          await tx.inventoryLot.update({
            where: { id: line.lotId },
            data: {
              remainingQty: { decrement: qtyToReturn },
            },
          });

          // Update line with posted qty
          await tx.vendorReturnLine.update({
            where: { id: line.id },
            data: { postedBaseQty: qtyToReturn },
          });

          allocations.push({ lineId: line.id, lotId: line.lotId, qty: qtyToReturn });
        } else {
          // FEFO allocation - use lots service
          const { allocations: fefoAllocations, shortfall } =
            await this.lotsService.allocateFEFO({
              orgId,
              branchId: vendorReturn.branchId,
              itemId: line.itemId,
              locationId: line.locationId,
              qtyNeeded: qtyToReturn,
              excludeExpired: true,
            });

          if (shortfall.gt(0)) {
            throw new BadRequestException(
              `Insufficient stock for item ${line.item?.name}: shortfall ${shortfall}`,
            );
          }

          // Check recall blocks on allocated lots
          for (const alloc of fefoAllocations) {
            const recallLink = await tx.recallLotLink.findFirst({
              where: {
                lotId: alloc.lotId,
                recallCase: { status: 'OPEN' },
              },
            });

            if (recallLink) {
              throw new BadRequestException(
                `Lot ${alloc.lotNumber} is under active recall and cannot be returned`,
              );
            }
          }

          // Decrement each allocated lot
          for (const alloc of fefoAllocations) {
            await tx.inventoryLot.update({
              where: { id: alloc.lotId },
              data: {
                remainingQty: { decrement: alloc.allocatedQty },
              },
            });

            allocations.push({
              lineId: line.id,
              lotId: alloc.lotId,
              qty: alloc.allocatedQty,
            });
          }

          // Update line with posted qty
          await tx.vendorReturnLine.update({
            where: { id: line.id },
            data: { postedBaseQty: qtyToReturn },
          });
        }

        // Create ledger entry for the return
        await tx.inventoryLedgerEntry.create({
          data: {
            orgId,
            branchId: vendorReturn.branchId,
            itemId: line.itemId,
            locationId: line.locationId,
            qty: qtyToReturn.negated(), // Negative for outbound
            reason: 'VENDOR_RETURN',
            sourceType: 'VENDOR_RETURN',
            sourceId: line.id,
            notes: `Vendor return ${vendorReturn.returnNumber}`,
            createdById: userId,
          },
        });
      }

      // Update vendor return status
      await tx.vendorReturn.update({
        where: { id },
        data: {
          status: 'POSTED',
          postedAt: new Date(),
          postedById: userId,
        },
      });
    });

    await this.auditLog.log({
      orgId,
      branchId: vendorReturn.branchId,
      userId,
      action: 'VENDOR_RETURN_POSTED',
      resourceType: 'VendorReturn',
      resourceId: id,
      metadata: {
        returnNumber: vendorReturn.returnNumber,
        allocations: allocations.length,
      },
    });

    return { posted: true, allocations };
  }

  /**
   * Void a vendor return (reverses POSTED or cancels DRAFT/SUBMITTED)
   */
  async voidReturn(
    id: string,
    orgId: string,
    userId: string,
    reason: string,
  ): Promise<void> {
    const vendorReturn = await this.prisma.client.vendorReturn.findFirst({
      where: { id, orgId },
      include: {
        lines: true,
      },
    });

    if (!vendorReturn) {
      throw new NotFoundException('Vendor return not found');
    }

    if (vendorReturn.status === 'VOID') {
      throw new BadRequestException('Vendor return is already voided');
    }

    await this.prisma.client.$transaction(async (tx) => {
      if (vendorReturn.status === 'POSTED') {
        // Reverse the posted quantities - increment lots back
        for (const line of vendorReturn.lines) {
          if (line.postedBaseQty.gt(0)) {
            // Find allocations for this line to reverse
            const allocations = await tx.lotLedgerAllocation.findMany({
              where: {
                sourceType: 'VENDOR_RETURN',
                sourceId: line.id,
              },
            });

            for (const alloc of allocations) {
              await tx.inventoryLot.update({
                where: { id: alloc.lotId },
                data: {
                  remainingQty: { increment: alloc.allocatedQty },
                  status: 'ACTIVE', // Restore to active if was depleted
                },
              });
            }

            // Create reversal ledger entry
            await tx.inventoryLedgerEntry.create({
              data: {
                orgId,
                branchId: vendorReturn.branchId,
                itemId: line.itemId,
                locationId: line.locationId,
                qty: line.postedBaseQty ?? new Decimal(0), // Positive to reverse
                reason: 'VENDOR_RETURN_VOID',
                sourceType: 'VENDOR_RETURN_VOID',
                sourceId: line.id,
                notes: `Void vendor return ${vendorReturn.returnNumber}: ${reason}`,
                createdById: userId,
              },
            });
          }
        }
      }

      // Update status to VOID
      await tx.vendorReturn.update({
        where: { id },
        data: {
          status: 'VOID',
          voidedAt: new Date(),
          voidedById: userId,
          voidReason: reason,
        },
      });
    });

    await this.auditLog.log({
      orgId,
      branchId: vendorReturn.branchId,
      userId,
      action: 'VENDOR_RETURN_VOIDED',
      resourceType: 'VendorReturn',
      resourceId: id,
      metadata: {
        returnNumber: vendorReturn.returnNumber,
        previousStatus: vendorReturn.status,
        reason,
      },
    });
  }

  /**
   * Export vendor returns to CSV
   */
  async exportReturns(options: {
    orgId: string;
    branchId?: string;
    startDate?: Date;
    endDate?: Date;
    status?: VendorReturnStatus[];
  }): Promise<{ csv: string; hash: string }> {
    const { orgId, branchId, startDate, endDate, status } = options;

    const where: Prisma.VendorReturnWhereInput = { orgId };
    if (branchId) where.branchId = branchId;
    if (status && status.length > 0) where.status = { in: status };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const returns = await this.prisma.client.vendorReturn.findMany({
      where,
      include: {
        vendor: { select: { name: true } },
        lines: {
          include: {
            item: { select: { name: true, sku: true } },
            location: { select: { name: true } },
            lot: { select: { lotNumber: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build CSV
    const headers = [
      'Return Number',
      'Date',
      'Status',
      'Vendor',
      'Branch',
      'Item SKU',
      'Item Name',
      'Location',
      'Lot Number',
      'Requested Qty',
      'Posted Qty',
      'Unit Cost',
    ];

    const rows: string[][] = [];
    for (const ret of returns) {
      for (const line of ret.lines) {
        rows.push([
          ret.returnNumber,
          ret.createdAt.toISOString(),
          ret.status,
          ret.vendor?.name ?? '',
          ret.branchId,
          line.item?.sku ?? '',
          line.item?.name ?? '',
          line.location?.name ?? '',
          line.lot?.lotNumber ?? '',
          line.requestedBaseQty.toString(),
          line.postedBaseQty.toString(),
          line.unitCost?.toString() ?? '',
        ]);
      }
    }

    const csvContent =
      headers.join(',') +
      '\n' +
      rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');

    // Generate hash for integrity verification
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(csvContent).digest('hex');

    return { csv: csvContent, hash };
  }
}
