/**
 * M11.8 Recalls Service
 *
 * Handles recall case management and lot blocking:
 * - Create/list recall cases (OPEN/CLOSED)
 * - Link/unlink lots to recall cases (blocks FEFO allocation)
 * - Recall impact reporting
 * - Traceability and audit logging
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
import { Prisma, RecallCaseStatus, LotStatus } from '@chefcloud/db';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

// Input for creating a recall case
export interface CreateRecallCaseInput {
  orgId: string;
  branchId?: string; // Optional - null means org-wide
  reason: string;
  createdById: string;
  notes?: string;
}

// Recall case summary
export interface RecallCaseSummary {
  id: string;
  caseNumber: string;
  orgId: string;
  branchId: string | null;
  status: RecallCaseStatus;
  reason: string;
  linkedLotCount: number;
  totalAffectedQty: Decimal;
  createdAt: Date;
  closedAt: Date | null;
}

// Recall case with linked lots
export interface RecallCaseDetail extends RecallCaseSummary {
  notes?: string;
  closedNotes?: string;
  linkedLots: LinkedLotDetail[];
}

export interface LinkedLotDetail {
  id: string;
  lotId: string;
  lotNumber: string;
  itemId: string;
  itemName: string;
  remainingQty: Decimal;
  expiryDate: Date | null;
  linkedAt: Date;
}

// Recall impact report
export interface RecallImpactReport {
  caseId: string;
  caseNumber: string;
  reason: string;
  status: RecallCaseStatus;
  totalLotsAffected: number;
  totalQtyBlocked: Decimal;
  itemsAffected: {
    itemId: string;
    itemName: string;
    lotsAffected: number;
    qtyBlocked: Decimal;
  }[];
  locationsAffected: {
    locationId: string;
    locationName: string;
    lotsAffected: number;
    qtyBlocked: Decimal;
  }[];
}

@Injectable()
export class InventoryRecallsService {
  private readonly logger = new Logger(InventoryRecallsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Generate unique case number
   */
  private async generateCaseNumber(orgId: string): Promise<string> {
    const prefix = 'RCL';
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Count this month's cases for this org
    const monthStart = new Date(year, date.getMonth(), 1);
    const monthEnd = new Date(year, date.getMonth() + 1, 1);

    const count = await this.prisma.client.recallCase.count({
      where: {
        orgId,
        createdAt: { gte: monthStart, lt: monthEnd },
      },
    });

    return `${prefix}-${year}${month}-${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Create a recall case
   */
  async createRecallCase(input: CreateRecallCaseInput): Promise<{ id: string; caseNumber: string }> {
    const { orgId, branchId, reason, createdById, notes } = input;

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Recall reason is required');
    }

    const caseNumber = await this.generateCaseNumber(orgId);

    const recallCase = await this.prisma.client.recallCase.create({
      data: {
        orgId,
        branchId,
        caseNumber,
        status: 'OPEN',
        reason: reason.trim(),
        notes,
        createdById,
      },
    });

    await this.auditLog.log({
      orgId,
      branchId: branchId ?? undefined,
      userId: createdById,
      action: 'RECALL_CASE_CREATED',
      resourceType: 'RecallCase',
      resourceId: recallCase.id,
      metadata: { caseNumber, reason },
    });

    return { id: recallCase.id, caseNumber };
  }

  /**
   * Get a recall case by ID
   */
  async getRecallCase(id: string, orgId: string): Promise<RecallCaseDetail | null> {
    const recallCase = await this.prisma.client.recallCase.findFirst({
      where: { id, orgId },
      include: {
        lotLinks: {
          include: {
            lot: {
              include: {
                item: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!recallCase) return null;

    const linkedLots = recallCase.lotLinks.map((link) => ({
      id: link.id,
      lotId: link.lotId,
      lotNumber: link.lot.lotNumber,
      itemId: link.lot.itemId,
      itemName: link.lot.item?.name ?? 'Unknown',
      remainingQty: link.lot.remainingQty,
      expiryDate: link.lot.expiryDate,
      linkedAt: link.linkedAt,
    }));

    const totalAffectedQty = linkedLots.reduce(
      (sum, l) => sum.plus(l.remainingQty),
      new Decimal(0),
    );

    return {
      id: recallCase.id,
      caseNumber: recallCase.caseNumber,
      orgId: recallCase.orgId,
      branchId: recallCase.branchId,
      status: recallCase.status,
      reason: recallCase.reason,
      notes: recallCase.notes ?? undefined,
      closedNotes: recallCase.closeNotes ?? undefined,
      linkedLotCount: linkedLots.length,
      totalAffectedQty,
      createdAt: recallCase.createdAt,
      closedAt: recallCase.closedAt,
      linkedLots,
    };
  }

  /**
   * List recall cases with pagination
   */
  async listRecallCases(options: {
    orgId: string;
    branchId?: string;
    status?: RecallCaseStatus | RecallCaseStatus[];
    limit?: number;
    offset?: number;
  }): Promise<{ cases: RecallCaseSummary[]; total: number }> {
    const { orgId, branchId, status, limit = 50, offset = 0 } = options;

    const where: Prisma.RecallCaseWhereInput = { orgId };
    if (branchId) {
      // Include org-wide recalls (branchId = null) OR branch-specific
      where.OR = [{ branchId: null }, { branchId }];
    }
    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }

    const [cases, total] = await Promise.all([
      this.prisma.client.recallCase.findMany({
        where,
        include: {
          lotLinks: {
            include: {
              lot: { select: { remainingQty: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.client.recallCase.count({ where }),
    ]);

    return {
      cases: cases.map((rc) => ({
        id: rc.id,
        caseNumber: rc.caseNumber,
        orgId: rc.orgId,
        branchId: rc.branchId,
        status: rc.status,
        reason: rc.reason,
        linkedLotCount: rc.lotLinks.length,
        totalAffectedQty: rc.lotLinks.reduce(
          (sum, l) => sum.plus(l.lot.remainingQty),
          new Decimal(0),
        ),
        createdAt: rc.createdAt,
        closedAt: rc.closedAt,
      })),
      total,
    };
  }

  /**
   * Link a lot to a recall case (blocks FEFO allocation)
   */
  async linkLot(
    recallCaseId: string,
    lotId: string,
    orgId: string,
    userId: string,
  ): Promise<void> {
    const recallCase = await this.prisma.client.recallCase.findFirst({
      where: { id: recallCaseId, orgId },
    });

    if (!recallCase) {
      throw new NotFoundException('Recall case not found');
    }

    if (recallCase.status !== 'OPEN') {
      throw new BadRequestException('Cannot link lots to a closed recall case');
    }

    const lot = await this.prisma.client.inventoryLot.findFirst({
      where: { id: lotId, orgId },
    });

    if (!lot) {
      throw new NotFoundException('Lot not found');
    }

    // Check if already linked
    const existing = await this.prisma.client.recallLotLink.findUnique({
      where: {
        recallCaseId_lotId: { recallCaseId, lotId },
      },
    });

    if (existing) {
      // Idempotent - already linked
      return;
    }

    await this.prisma.client.recallLotLink.create({
      data: {
        recallCaseId,
        lotId,
        linkedById: userId,
      },
    });

    await this.auditLog.log({
      orgId,
      branchId: lot.branchId,
      userId,
      action: 'RECALL_LOT_LINKED',
      resourceType: 'RecallCase',
      resourceId: recallCaseId,
      metadata: {
        caseNumber: recallCase.caseNumber,
        lotId,
        lotNumber: lot.lotNumber,
      },
    });
  }

  /**
   * Unlink a lot from a recall case
   */
  async unlinkLot(
    recallCaseId: string,
    lotId: string,
    orgId: string,
    userId: string,
  ): Promise<void> {
    const recallCase = await this.prisma.client.recallCase.findFirst({
      where: { id: recallCaseId, orgId },
    });

    if (!recallCase) {
      throw new NotFoundException('Recall case not found');
    }

    if (recallCase.status !== 'OPEN') {
      throw new BadRequestException('Cannot unlink lots from a closed recall case');
    }

    const link = await this.prisma.client.recallLotLink.findUnique({
      where: {
        recallCaseId_lotId: { recallCaseId, lotId },
      },
    });

    if (!link) {
      // Idempotent - not linked
      return;
    }

    await this.prisma.client.recallLotLink.delete({
      where: {
        recallCaseId_lotId: { recallCaseId, lotId },
      },
    });

    const lot = await this.prisma.client.inventoryLot.findUnique({
      where: { id: lotId },
    });

    await this.auditLog.log({
      orgId,
      branchId: lot?.branchId,
      userId,
      action: 'RECALL_LOT_UNLINKED',
      resourceType: 'RecallCase',
      resourceId: recallCaseId,
      metadata: {
        caseNumber: recallCase.caseNumber,
        lotId,
        lotNumber: lot?.lotNumber,
      },
    });
  }

  /**
   * Close a recall case
   */
  async closeRecallCase(
    id: string,
    orgId: string,
    userId: string,
    notes?: string,
  ): Promise<void> {
    const recallCase = await this.prisma.client.recallCase.findFirst({
      where: { id, orgId },
    });

    if (!recallCase) {
      throw new NotFoundException('Recall case not found');
    }

    if (recallCase.status === 'CLOSED') {
      throw new BadRequestException('Recall case is already closed');
    }

    await this.prisma.client.recallCase.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedById: userId,
        closeNotes: notes,
      },
    });

    await this.auditLog.log({
      orgId,
      branchId: recallCase.branchId ?? undefined,
      userId,
      action: 'RECALL_CASE_CLOSED',
      resourceType: 'RecallCase',
      resourceId: id,
      metadata: { caseNumber: recallCase.caseNumber, notes },
    });
  }

  /**
   * Get recall impact report
   */
  async getRecallImpact(id: string, orgId: string): Promise<RecallImpactReport | null> {
    const recallCase = await this.prisma.client.recallCase.findFirst({
      where: { id, orgId },
      include: {
        lotLinks: {
          include: {
            lot: {
              include: {
                item: { select: { id: true, name: true } },
                location: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!recallCase) return null;

    const totalLotsAffected = recallCase.lotLinks.length;
    const totalQtyBlocked = recallCase.lotLinks.reduce(
      (sum, l) => sum.plus(l.lot.remainingQty),
      new Decimal(0),
    );

    // Aggregate by item
    const itemMap = new Map<
      string,
      { itemId: string; itemName: string; lotsAffected: number; qtyBlocked: Decimal }
    >();
    for (const link of recallCase.lotLinks) {
      const itemId = link.lot.itemId;
      const existing = itemMap.get(itemId);
      if (existing) {
        existing.lotsAffected++;
        existing.qtyBlocked = existing.qtyBlocked.plus(link.lot.remainingQty);
      } else {
        itemMap.set(itemId, {
          itemId,
          itemName: link.lot.item?.name ?? 'Unknown',
          lotsAffected: 1,
          qtyBlocked: link.lot.remainingQty,
        });
      }
    }

    // Aggregate by location
    const locationMap = new Map<
      string,
      { locationId: string; locationName: string; lotsAffected: number; qtyBlocked: Decimal }
    >();
    for (const link of recallCase.lotLinks) {
      const locationId = link.lot.locationId;
      const existing = locationMap.get(locationId);
      if (existing) {
        existing.lotsAffected++;
        existing.qtyBlocked = existing.qtyBlocked.plus(link.lot.remainingQty);
      } else {
        locationMap.set(locationId, {
          locationId,
          locationName: link.lot.location?.name ?? 'Unknown',
          lotsAffected: 1,
          qtyBlocked: link.lot.remainingQty,
        });
      }
    }

    return {
      caseId: recallCase.id,
      caseNumber: recallCase.caseNumber,
      reason: recallCase.reason,
      status: recallCase.status,
      totalLotsAffected,
      totalQtyBlocked,
      itemsAffected: Array.from(itemMap.values()),
      locationsAffected: Array.from(locationMap.values()),
    };
  }

  /**
   * Check if a lot is under active recall
   */
  async isLotUnderRecall(lotId: string): Promise<boolean> {
    const link = await this.prisma.client.recallLotLink.findFirst({
      where: {
        lotId,
        recallCase: { status: 'OPEN' },
      },
    });

    return !!link;
  }

  /**
   * Get all lots under active recall for an org
   */
  async getRecalledLots(options: {
    orgId: string;
    branchId?: string;
    itemId?: string;
  }): Promise<{ lotId: string; lotNumber: string; recallCaseNumber: string }[]> {
    const { orgId, branchId, itemId } = options;

    const where: Prisma.RecallLotLinkWhereInput = {
      recallCase: { orgId, status: 'OPEN' },
    };

    // Build lot filter object
    const lotFilter: Prisma.InventoryLotWhereInput = {};
    if (branchId) {
      lotFilter.branchId = branchId;
    }
    if (itemId) {
      lotFilter.itemId = itemId;
    }
    if (Object.keys(lotFilter).length > 0) {
      where.lot = lotFilter;
    }

    const links = await this.prisma.client.recallLotLink.findMany({
      where,
      include: {
        lot: { select: { lotNumber: true } },
        recallCase: { select: { caseNumber: true } },
      },
    });

    return links.map((l) => ({
      lotId: l.lotId,
      lotNumber: l.lot.lotNumber,
      recallCaseNumber: l.recallCase.caseNumber,
    }));
  }

  /**
   * Export recall impact to CSV
   */
  async exportRecallImpact(
    id: string,
    orgId: string,
  ): Promise<{ csv: string; hash: string } | null> {
    const recallCase = await this.prisma.client.recallCase.findFirst({
      where: { id, orgId },
      include: {
        lotLinks: {
          include: {
            lot: {
              include: {
                item: { select: { name: true, sku: true } },
                location: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!recallCase) return null;

    const headers = [
      'Case Number',
      'Status',
      'Reason',
      'Lot Number',
      'Item SKU',
      'Item Name',
      'Location',
      'Remaining Qty',
      'Expiry Date',
      'Linked At',
    ];

    const rows: string[][] = recallCase.lotLinks.map((link) => [
      recallCase.caseNumber,
      recallCase.status,
      recallCase.reason,
      link.lot.lotNumber,
      link.lot.item?.sku ?? '',
      link.lot.item?.name ?? '',
      link.lot.location?.name ?? '',
      link.lot.remainingQty.toString(),
      link.lot.expiryDate?.toISOString() ?? '',
      link.linkedAt.toISOString(),
    ]);

    const csvContent =
      headers.join(',') +
      '\n' +
      rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');

    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(csvContent).digest('hex');

    return { csv: csvContent, hash };
  }
}
