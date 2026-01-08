/**
 * M12.1 + M12.2 Inventory Period Service
 *
 * Manages inventory period lifecycle:
 * - Create/list/close periods
 * - Lock enforcement for posting within closed periods
 * - Blocking state validation before close
 * - Valuation snapshot + movement summary generation
 * - M12.2: Reopen workflow with revision tracking
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { InventoryCostingService } from './inventory-costing.service';
import { InventoryPeriodEventsService } from './inventory-period-events.service';
import { Prisma, InventoryPeriodStatus, RoleLevel } from '@chefcloud/db';
import { InventoryCloseRequestsService } from './inventory-close-requests.service';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

const ZERO = new Decimal(0);

export interface CreatePeriodDto {
  branchId: string;
  startDate: Date;
  endDate: Date;
  lockReason?: string;
}

export interface ClosePeriodDto {
  branchId: string;
  startDate: Date;
  endDate: Date;
  lockReason?: string;
  // M12.4: Approval gating + force-close
  forceClose?: boolean;
  forceCloseReason?: string;
  userRoleLevel?: RoleLevel;
}

export interface ReopenPeriodDto {
  periodId: string;
  reason: string;
}

export interface ReopenResult {
  periodId: string;
  previousStatus: InventoryPeriodStatus;
  newStatus: InventoryPeriodStatus;
  reopenedAt: Date;
  reopenedById: string;
  reason: string;
  eventId: string;
}

export interface PeriodListResult {
  id: string;
  branchId: string;
  branchName: string;
  startDate: Date;
  endDate: Date;
  status: InventoryPeriodStatus;
  closedAt: Date | null;
  closedByName: string | null;
  lockReason: string | null;
  snapshotCount: number;
}

export interface BlockingStateResult {
  valid: boolean;
  blockers: {
    type: string;
    count: number;
    message: string;
  }[];
}

export interface ValuationSnapshotLine {
  itemId: string;
  itemCode: string;
  itemName: string;
  locationId: string;
  locationCode: string;
  qtyOnHand: Decimal;
  wac: Decimal;
  value: Decimal;
}

export interface PeriodLockCheckResult {
  locked: boolean;
  periodId?: string;
  startDate?: Date;
  endDate?: Date;
  lockReason?: string;
}

// Error thrown when posting into a locked period
export class InventoryPeriodLockedError extends Error {
  constructor(
    public readonly periodId: string,
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly reason?: string,
  ) {
    super(`Inventory period ${periodId} is locked. Cannot post entries within ${startDate.toISOString()} - ${endDate.toISOString()}`);
    this.name = 'InventoryPeriodLockedError';
  }
}

@Injectable()
export class InventoryPeriodsService {
  private readonly logger = new Logger(InventoryPeriodsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly costingService: InventoryCostingService,
    private readonly periodEventsService: InventoryPeriodEventsService,
    private readonly closeRequestsService: InventoryCloseRequestsService,
  ) {}

  /**
   * Check if a timestamp falls within a closed inventory period for a branch.
   * Used by all posting actions to enforce period locks.
   * 
   * CRITICAL: This is the centralized lock check. All posting actions must call this.
   */
  async checkPeriodLock(
    orgId: string,
    branchId: string,
    timestamp: Date,
  ): Promise<PeriodLockCheckResult> {
    // Find any CLOSED period that contains the timestamp
    const closedPeriod = await this.prisma.client.inventoryPeriod.findFirst({
      where: {
        orgId,
        branchId,
        status: 'CLOSED',
        startDate: { lte: timestamp },
        endDate: { gte: timestamp },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        lockReason: true,
      },
    });

    if (closedPeriod) {
      return {
        locked: true,
        periodId: closedPeriod.id,
        startDate: closedPeriod.startDate,
        endDate: closedPeriod.endDate,
        lockReason: closedPeriod.lockReason ?? undefined,
      };
    }

    return { locked: false };
  }

  /**
   * Enforce period lock - throws ForbiddenException if locked.
   * Should be called by all posting actions before creating ledger entries.
   * 
   * M12.3: Added override support for L5 users.
   * When override is used, logs OVERRIDE_USED event with reason.
   * 
   * @param orgId - Organization ID
   * @param branchId - Branch ID  
   * @param timestamp - The effectiveAt date to check against periods
   * @param override - Optional override with userId and reason (L5 only)
   */
  async enforcePeriodLock(
    orgId: string,
    branchId: string,
    timestamp: Date,
    override?: { userId: string; reason: string; actionType: string; entityType: string; entityId: string },
  ): Promise<void> {
    const check = await this.checkPeriodLock(orgId, branchId, timestamp);
    if (check.locked) {
      // If override provided, log event and allow
      if (override) {
        // Validate reason length
        if (!override.reason || override.reason.trim().length < 10) {
          throw new ForbiddenException({
            code: 'OVERRIDE_REASON_REQUIRED',
            message: 'Override reason must be at least 10 characters',
          });
        }

        // Log override usage
        await this.periodEventsService.logEvent({
          orgId,
          branchId,
          periodId: check.periodId!,
          type: 'OVERRIDE_USED',
          actorUserId: override.userId,
          reason: override.reason.trim(),
          metadataJson: {
            actionType: override.actionType,
            targetEntityType: override.entityType,
            targetEntityId: override.entityId,
            effectiveAt: timestamp.toISOString(),
          },
        });

        // Audit log
        await this.auditLog.log({
          orgId,
          userId: override.userId,
          action: 'INVENTORY_PERIOD_OVERRIDE_USED',
          resourceType: 'InventoryPeriod',
          resourceId: check.periodId!,
          metadata: {
            reason: override.reason.trim(),
            actionType: override.actionType,
            targetEntityType: override.entityType,
            targetEntityId: override.entityId,
            effectiveAt: timestamp.toISOString(),
          },
        });

        this.logger.warn(
          `Period lock override used by ${override.userId} on period ${check.periodId}: ${override.reason}`,
        );
        return; // Allow the operation
      }

      throw new ForbiddenException({
        code: 'INVENTORY_PERIOD_LOCKED',
        message: `Cannot post entries to locked inventory period`,
        periodId: check.periodId,
        startDate: check.startDate,
        endDate: check.endDate,
        lockReason: check.lockReason,
      });
    }
  }

  /**
   * List periods for a branch.
   */
  async listPeriods(
    orgId: string,
    branchId?: string,
    options?: { status?: InventoryPeriodStatus },
  ): Promise<PeriodListResult[]> {
    const where: Prisma.InventoryPeriodWhereInput = { orgId };
    if (branchId) where.branchId = branchId;
    if (options?.status) where.status = options.status;

    const periods = await this.prisma.client.inventoryPeriod.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        closedBy: { select: { firstName: true, lastName: true } },
        _count: { select: { valuationSnapshots: true } },
      },
      orderBy: [{ branchId: 'asc' }, { endDate: 'desc' }],
    });

    return periods.map((p) => ({
      id: p.id,
      branchId: p.branchId,
      branchName: p.branch.name,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
      closedAt: p.closedAt,
      closedByName: p.closedBy
        ? `${p.closedBy.firstName} ${p.closedBy.lastName}`
        : null,
      lockReason: p.lockReason,
      snapshotCount: p._count.valuationSnapshots,
    }));
  }

  /**
   * Get a single period by ID with full details.
   */
  async getPeriod(orgId: string, periodId: string) {
    const period = await this.prisma.client.inventoryPeriod.findFirst({
      where: { id: periodId, orgId },
      include: {
        branch: { select: { name: true } },
        closedBy: { select: { firstName: true, lastName: true } },
        _count: {
          select: { valuationSnapshots: true, movementSummaries: true },
        },
      },
    });

    if (!period) {
      throw new NotFoundException('Period not found');
    }

    return period;
  }

  /**
   * Create a new period (OPEN by default).
   */
  async createPeriod(
    orgId: string,
    userId: string,
    dto: CreatePeriodDto,
  ) {
    // Validate branch belongs to org
    const branch = await this.prisma.client.branch.findFirst({
      where: { id: dto.branchId, orgId },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Validate dates
    if (dto.startDate > dto.endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Check for overlapping periods
    const overlap = await this.prisma.client.inventoryPeriod.findFirst({
      where: {
        orgId,
        branchId: dto.branchId,
        OR: [
          // New period starts within existing
          { startDate: { lte: dto.startDate }, endDate: { gte: dto.startDate } },
          // New period ends within existing
          { startDate: { lte: dto.endDate }, endDate: { gte: dto.endDate } },
          // New period contains existing
          { startDate: { gte: dto.startDate }, endDate: { lte: dto.endDate } },
        ],
      },
    });

    if (overlap) {
      throw new ConflictException('Period overlaps with existing period');
    }

    const period = await this.prisma.client.inventoryPeriod.create({
      data: {
        orgId,
        branchId: dto.branchId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        lockReason: dto.lockReason,
        status: 'OPEN',
      },
    });

    return period;
  }

  /**
   * Check blocking states before close.
   * Returns list of issues that must be resolved before close.
   */
  async checkBlockingStates(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<BlockingStateResult> {
    const blockers: BlockingStateResult['blockers'] = [];

    // Extend endDate to end of day for inclusive boundary (H1)
    const endBoundary = new Date(endDate);
    endBoundary.setHours(23, 59, 59, 999);

    // 1. Check stocktakes in SUBMITTED/APPROVED (not POSTED/VOID) within range
    const pendingStocktakes = await this.prisma.client.stocktakeSession.count({
      where: {
        orgId,
        branchId,
        status: { in: ['SUBMITTED', 'APPROVED'] },
        createdAt: { gte: startDate, lte: endBoundary },
      },
    });
    if (pendingStocktakes > 0) {
      blockers.push({
        type: 'PENDING_STOCKTAKE',
        count: pendingStocktakes,
        message: `${pendingStocktakes} stocktake(s) in SUBMITTED/APPROVED status within period`,
      });
    }

    // 2. Check production batches in DRAFT within range
    const draftProduction = await this.prisma.client.productionBatch.count({
      where: {
        orgId,
        branchId,
        status: 'DRAFT',
        createdAt: { gte: startDate, lte: endBoundary },
      },
    });
    if (draftProduction > 0) {
      blockers.push({
        type: 'DRAFT_PRODUCTION',
        count: draftProduction,
        message: `${draftProduction} production batch(es) in DRAFT status within period`,
      });
    }

    // 3. Check transfers IN_TRANSIT older than endDate (H7)
    const inTransitTransfers = await this.prisma.client.inventoryTransfer.count({
      where: {
        orgId,
        OR: [
          { fromBranchId: branchId },
          { toBranchId: branchId },
        ],
        status: 'IN_TRANSIT',
        shippedAt: { lte: endBoundary },
      },
    });
    if (inTransitTransfers > 0) {
      blockers.push({
        type: 'IN_TRANSIT_TRANSFER',
        count: inTransitTransfers,
        message: `${inTransitTransfers} transfer(s) IN_TRANSIT before period end`,
      });
    }

    // 4. Check pending stock adjustments within range
    const pendingAdjustments = await this.prisma.client.stockAdjustment.count({
      where: {
        orgId,
        branchId,
        status: 'PENDING',
        createdAt: { gte: startDate, lte: endBoundary },
      },
    });
    if (pendingAdjustments > 0) {
      blockers.push({
        type: 'PENDING_ADJUSTMENT',
        count: pendingAdjustments,
        message: `${pendingAdjustments} adjustment(s) PENDING approval within period`,
      });
    }

    return {
      valid: blockers.length === 0,
      blockers,
    };
  }

  /**
   * Close a period. Idempotent - returns existing if already closed (H2).
   */
  async closePeriod(
    orgId: string,
    userId: string,
    dto: ClosePeriodDto,
  ) {
    // Validate branch belongs to org (H9)
    const branch = await this.prisma.client.branch.findFirst({
      where: { id: dto.branchId, orgId },
      select: { id: true, name: true },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Check for existing CLOSED period with same range (H2: idempotency)
    const existingClosed = await this.prisma.client.inventoryPeriod.findFirst({
      where: {
        orgId,
        branchId: dto.branchId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        status: 'CLOSED',
      },
      include: {
        _count: { select: { valuationSnapshots: true, movementSummaries: true } },
      },
    });

    if (existingClosed) {
      this.logger.log(`Period ${existingClosed.id} already closed, returning existing`);
      return existingClosed;
    }

    // Find or create the period early so alerts/events can attach to it
    let period = await this.prisma.client.inventoryPeriod.findFirst({
      where: {
        orgId,
        branchId: dto.branchId,
        startDate: dto.startDate,
        endDate: dto.endDate,
      },
    });

    if (!period) {
      period = await this.createPeriod(orgId, userId, {
        branchId: dto.branchId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        lockReason: dto.lockReason,
      });
    }

    // Check blocking states and emit BLOCKED alert if needed (M12.4)
    const blockCheck = await this.checkBlockingStates(
      orgId,
      dto.branchId,
      dto.startDate,
      dto.endDate,
    );
    if (!blockCheck.valid) {
      try {
        await this.closeRequestsService.createBlockedAlert(
          orgId,
          dto.branchId,
          period.id,
          blockCheck.blockers.reduce((sum, b) => sum + (b.count ?? 1), 0),
          blockCheck.blockers.map((b) => b.message),
        );
      } catch (e) {
        this.logger.warn(`Failed to create blocked alert for period ${period.id}: ${String(e)}`);
      }
      throw new BadRequestException({
        code: 'PERIOD_CLOSE_BLOCKED',
        message: 'Cannot close period due to blocking states',
        blockers: blockCheck.blockers,
      });
    }

    // M12.4: Approval gating - require APPROVED request or valid force-close (L5+)
    const approval = await this.closeRequestsService.validateApprovalForClose(
      orgId,
      period.id,
      !!dto.forceClose,
      dto.forceCloseReason,
      userId,
      dto.userRoleLevel,
    );
    if (!approval.approved) {
      throw new ForbiddenException({
        code: 'CLOSE_APPROVAL_REQUIRED',
        message: approval.error ?? 'Approved close request required',
      });
    }

    // Extend endDate to end of day for inclusive boundary (H1)
    const endBoundary = new Date(dto.endDate);
    endBoundary.setHours(23, 59, 59, 999);

    // M12.2: Get current revision and increment for re-close scenario
    const currentRevision = await this.getCurrentRevision(period.id);
    const newRevision = currentRevision + 1;

    // Generate valuation snapshots with revision
    await this.generateValuationSnapshots(
      orgId,
      dto.branchId,
      period.id,
      endBoundary,
      newRevision,
    );

    // Generate movement summaries with revision
    await this.generateMovementSummaries(
      orgId,
      dto.branchId,
      period.id,
      dto.startDate,
      endBoundary,
      newRevision,
    );

    // Mark period as CLOSED
    const closedPeriod = await this.prisma.client.inventoryPeriod.update({
      where: { id: period.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedById: userId,
        lockReason: dto.lockReason ?? period.lockReason,
      },
      include: {
        _count: { select: { valuationSnapshots: true, movementSummaries: true } },
      },
    });

    // Audit log
    await this.auditLog.log({
      orgId,
      userId,
      action: 'INVENTORY_PERIOD_CLOSED',
      resourceType: 'InventoryPeriod',
      resourceId: closedPeriod.id,
      metadata: {
        branchId: dto.branchId,
        startDate: dto.startDate.toISOString(),
        endDate: dto.endDate.toISOString(),
        snapshotCount: closedPeriod._count.valuationSnapshots,
        summaryCount: closedPeriod._count.movementSummaries,
      },
    });

    // Log period event for audit trail (M12.2)
    await this.periodEventsService.logEvent({
      orgId,
      branchId: dto.branchId,
      periodId: closedPeriod.id,
      type: 'CLOSED',
      actorUserId: userId,
      reason: dto.lockReason ?? 'Period closed',
      metadataJson: {
        snapshotCount: closedPeriod._count.valuationSnapshots,
        summaryCount: closedPeriod._count.movementSummaries,
      },
    });

    return closedPeriod;
  }

  /**
   * M12.2: Reopen a closed period (L5 only).
   * 
   * Behavior:
   * - Only CLOSED periods can be reopened
   * - Changes status to OPEN
   * - Logs REOPENED event with reason (required)
   * - Does NOT delete existing snapshots (kept for audit)
   * - On next close, generates new snapshots with revision+1
   */
  async reopenPeriod(
    orgId: string,
    userId: string,
    dto: ReopenPeriodDto,
  ): Promise<ReopenResult> {
    // Get period
    const period = await this.prisma.client.inventoryPeriod.findFirst({
      where: { id: dto.periodId, orgId },
      include: { branch: { select: { id: true, name: true } } },
    });

    if (!period) {
      throw new NotFoundException('Period not found');
    }

    if (period.status !== 'CLOSED') {
      throw new BadRequestException({
        code: 'PERIOD_NOT_CLOSED',
        message: `Cannot reopen period with status ${period.status}. Only CLOSED periods can be reopened.`,
      });
    }

    if (!dto.reason || dto.reason.trim().length < 10) {
      throw new BadRequestException({
        code: 'REOPEN_REASON_REQUIRED',
        message: 'A reason of at least 10 characters is required to reopen a period.',
      });
    }

    // Update status to OPEN
    const reopenedAt = new Date();
    await this.prisma.client.inventoryPeriod.update({
      where: { id: period.id },
      data: {
        status: 'OPEN',
        // Keep closedAt/closedById for audit trail - they show when it was last closed
      },
    });

    // Log REOPENED event
    const event = await this.periodEventsService.logEvent({
      orgId,
      branchId: period.branchId,
      periodId: period.id,
      type: 'REOPENED',
      actorUserId: userId,
      reason: dto.reason.trim(),
      metadataJson: {
        previousClosedAt: period.closedAt?.toISOString(),
        previousClosedById: period.closedById,
      },
    });

    // Audit log
    await this.auditLog.log({
      orgId,
      userId,
      action: 'INVENTORY_PERIOD_REOPENED',
      resourceType: 'InventoryPeriod',
      resourceId: period.id,
      metadata: {
        branchId: period.branchId,
        branchName: period.branch.name,
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString(),
        reason: dto.reason.trim(),
      },
    });

    this.logger.log(`Period ${period.id} reopened by user ${userId}: ${dto.reason.trim()}`);

    return {
      periodId: period.id,
      previousStatus: 'CLOSED',
      newStatus: 'OPEN',
      reopenedAt,
      reopenedById: userId,
      reason: dto.reason.trim(),
      eventId: event.id,
    };
  }

  /**
   * M12.2: Get the current revision number for a period's snapshots.
   */
  async getCurrentRevision(periodId: string): Promise<number> {
    const maxRevision = await this.prisma.client.inventoryValuationSnapshot.aggregate({
      where: { periodId },
      _max: { revision: true },
    });
    return maxRevision._max.revision ?? 0;
  }

  /**
   * Generate valuation snapshots for all items/locations at period end.
   * M12.2: Added revision parameter for re-close workflow.
   * M12.3: Uses effectiveAt for period boundary queries.
   */
  private async generateValuationSnapshots(
    orgId: string,
    branchId: string,
    periodId: string,
    asOf: Date,
    revision: number = 1,
  ): Promise<number> {
    // Get all item/location combinations with ledger entries up to asOf
    const locations = await this.prisma.client.inventoryLocation.findMany({
      where: { branchId, isActive: true },
      select: { id: true, code: true },
    });

    const items = await this.prisma.client.inventoryItem.findMany({
      where: { orgId, isActive: true },
      select: { id: true, sku: true, name: true },
    });

    let snapshotCount = 0;

    for (const item of items) {
      for (const location of locations) {
        // Get on-hand at end boundary (H1: inclusive endDate)
        // M12.3: Use effectiveAt for period boundary - transactions dated within period
        const ledgerAgg = await this.prisma.client.inventoryLedgerEntry.aggregate({
          where: {
            orgId,
            branchId,
            itemId: item.id,
            locationId: location.id,
            effectiveAt: { lte: asOf },
          },
          _sum: { qty: true },
        });

        const qtyOnHand = ledgerAgg._sum.qty
          ? new Decimal(ledgerAgg._sum.qty)
          : ZERO;

        // Skip if no stock
        if (qtyOnHand.isZero()) continue;

        // Get WAC at period end
        const wac = await this.costingService.getCurrentWac(orgId, branchId, item.id);

        // Calculate value (H10: use Decimal throughout)
        const value = qtyOnHand.times(wac);

        // Create snapshot with revision (M12.2: unique constraint includes revision)
        try {
          await this.prisma.client.inventoryValuationSnapshot.create({
            data: {
              orgId,
              branchId,
              periodId,
              itemId: item.id,
              locationId: location.id,
              qtyOnHand,
              wac,
              value,
              asOf,
              revision,
            },
          });
          snapshotCount++;
        } catch (e) {
          // Unique constraint violation = already exists (idempotent)
          if ((e as any)?.code === 'P2002') {
            this.logger.debug(`Snapshot already exists for item ${item.id} location ${location.id} revision ${revision}`);
          } else {
            throw e;
          }
        }
      }
    }

    return snapshotCount;
  }

  /**
   * Generate movement summaries for the period.
   * M12.2: Added revision parameter for re-close workflow.
   * M12.3: Uses effectiveAt for period boundary queries.
   */
  private async generateMovementSummaries(
    orgId: string,
    branchId: string,
    periodId: string,
    startDate: Date,
    endDate: Date,
    revision: number = 1,
  ): Promise<number> {
    // Aggregate ledger entries by item and reason
    // M12.3: Use effectiveAt for period boundary - transactions dated within period
    const ledgerEntries = await this.prisma.client.inventoryLedgerEntry.groupBy({
      by: ['itemId', 'reason'],
      where: {
        orgId,
        branchId,
        effectiveAt: { gte: startDate, lte: endDate },
      },
      _sum: { qty: true },
    });

    // Build per-item summaries
    const itemSummaries = new Map<string, {
      receiveQty: Decimal;
      depletionQty: Decimal;
      wasteQty: Decimal;
      transferInQty: Decimal;
      transferOutQty: Decimal;
      adjustmentQty: Decimal;
      countVarianceQty: Decimal;
      productionConsumeQty: Decimal;
      productionProduceQty: Decimal;
    }>();

    for (const entry of ledgerEntries) {
      if (!itemSummaries.has(entry.itemId)) {
        itemSummaries.set(entry.itemId, {
          receiveQty: ZERO,
          depletionQty: ZERO,
          wasteQty: ZERO,
          transferInQty: ZERO,
          transferOutQty: ZERO,
          adjustmentQty: ZERO,
          countVarianceQty: ZERO,
          productionConsumeQty: ZERO,
          productionProduceQty: ZERO,
        });
      }

      const summary = itemSummaries.get(entry.itemId)!;
      const qty = entry._sum.qty ? new Decimal(entry._sum.qty) : ZERO;

      // Map reason codes to summary fields
      switch (entry.reason) {
        case 'PURCHASE':
        case 'GOODS_RECEIPT':
          summary.receiveQty = summary.receiveQty.plus(qty);
          break;
        case 'SALE':
        case 'DEPLETION':
          summary.depletionQty = summary.depletionQty.plus(qty.abs());
          break;
        case 'WASTAGE':
        case 'WASTE':
          summary.wasteQty = summary.wasteQty.plus(qty.abs());
          break;
        case 'TRANSFER_IN':
          summary.transferInQty = summary.transferInQty.plus(qty);
          break;
        case 'TRANSFER_OUT':
          summary.transferOutQty = summary.transferOutQty.plus(qty.abs());
          break;
        case 'ADJUSTMENT':
        case 'STOCK_ADJUSTMENT':
          summary.adjustmentQty = summary.adjustmentQty.plus(qty);
          break;
        case 'COUNT_ADJUSTMENT':
        case 'STOCKTAKE_VARIANCE':
          summary.countVarianceQty = summary.countVarianceQty.plus(qty);
          break;
        case 'PRODUCTION_CONSUME':
          summary.productionConsumeQty = summary.productionConsumeQty.plus(qty.abs());
          break;
        case 'PRODUCTION_PRODUCE':
          summary.productionProduceQty = summary.productionProduceQty.plus(qty);
          break;
      }
    }

    // Create per-item summaries with revision
    let summaryCount = 0;
    for (const [itemId, summary] of itemSummaries) {
      try {
        await this.prisma.client.inventoryPeriodMovementSummary.create({
          data: {
            orgId,
            branchId,
            periodId,
            itemId,
            revision,
            ...summary,
            // Values are 0 for now - could compute from cost layers
            receiveValue: ZERO,
            depletionValue: ZERO,
            wasteValue: ZERO,
            adjustmentValue: ZERO,
            countVarianceValue: ZERO,
            productionConsumeValue: ZERO,
            productionProduceValue: ZERO,
          },
        });
        summaryCount++;
      } catch (e) {
        if ((e as any)?.code === 'P2002') {
          this.logger.debug(`Summary already exists for item ${itemId} revision ${revision}`);
        } else {
          throw e;
        }
      }
    }

    // Create branch total row (itemId = null) with revision
    const branchTotal = {
      receiveQty: ZERO,
      depletionQty: ZERO,
      wasteQty: ZERO,
      transferInQty: ZERO,
      transferOutQty: ZERO,
      adjustmentQty: ZERO,
      countVarianceQty: ZERO,
      productionConsumeQty: ZERO,
      productionProduceQty: ZERO,
    };

    for (const summary of itemSummaries.values()) {
      branchTotal.receiveQty = branchTotal.receiveQty.plus(summary.receiveQty);
      branchTotal.depletionQty = branchTotal.depletionQty.plus(summary.depletionQty);
      branchTotal.wasteQty = branchTotal.wasteQty.plus(summary.wasteQty);
      branchTotal.transferInQty = branchTotal.transferInQty.plus(summary.transferInQty);
      branchTotal.transferOutQty = branchTotal.transferOutQty.plus(summary.transferOutQty);
      branchTotal.adjustmentQty = branchTotal.adjustmentQty.plus(summary.adjustmentQty);
      branchTotal.countVarianceQty = branchTotal.countVarianceQty.plus(summary.countVarianceQty);
      branchTotal.productionConsumeQty = branchTotal.productionConsumeQty.plus(summary.productionConsumeQty);
      branchTotal.productionProduceQty = branchTotal.productionProduceQty.plus(summary.productionProduceQty);
    }

    try {
      await this.prisma.client.inventoryPeriodMovementSummary.create({
        data: {
          orgId,
          branchId,
          periodId,
          itemId: null,
          revision,
          ...branchTotal,
          receiveValue: ZERO,
          depletionValue: ZERO,
          wasteValue: ZERO,
          adjustmentValue: ZERO,
          countVarianceValue: ZERO,
          productionConsumeValue: ZERO,
          productionProduceValue: ZERO,
        },
      });
      summaryCount++;
    } catch (e) {
      if ((e as any)?.code !== 'P2002') throw e;
    }

    return summaryCount;
  }

  /**
   * Get valuation snapshots for a period (latest revision by default).
   * M12.2: Added optional revision parameter to query specific revision.
   */
  async getValuationSnapshots(
    orgId: string,
    periodId: string,
    revision?: number,
  ): Promise<ValuationSnapshotLine[]> {
    // Validate period exists and belongs to org
    await this.getPeriod(orgId, periodId);

    // If no revision specified, get the latest
    const targetRevision = revision ?? await this.getCurrentRevision(periodId);

    const snapshots = await this.prisma.client.inventoryValuationSnapshot.findMany({
      where: { periodId, orgId, revision: targetRevision },
      include: {
        item: { select: { sku: true, name: true } },
        location: { select: { code: true } },
      },
      orderBy: [{ itemId: 'asc' }, { locationId: 'asc' }],
    });

    return snapshots.map((s) => ({
      itemId: s.itemId,
      itemCode: s.item.sku ?? s.itemId.substring(0, 8),
      itemName: s.item.name,
      locationId: s.locationId,
      locationCode: s.location.code,
      qtyOnHand: new Decimal(s.qtyOnHand),
      wac: new Decimal(s.wac),
      value: new Decimal(s.value),
    }));
  }

  /**
   * Get movement summaries for a period.
   * M12.2: Updated to query latest revision by default.
   */
  async getMovementSummaries(orgId: string, periodId: string, revision?: number) {
    // Validate period exists and belongs to org
    await this.getPeriod(orgId, periodId);

    // If no revision specified, get the latest
    const targetRevision = revision ?? await this.getCurrentRevision(periodId);

    const summaries = await this.prisma.client.inventoryPeriodMovementSummary.findMany({
      where: { periodId, orgId, revision: targetRevision },
      include: {
        item: { select: { sku: true, name: true } },
      },
      orderBy: { itemId: 'asc' },
    });

    return summaries.map((s) => ({
      itemId: s.itemId,
      itemCode: s.item?.sku ?? (s.itemId ? s.itemId.substring(0, 8) : 'TOTAL'),
      itemName: s.item?.name ?? 'Branch Total',
      revision: s.revision,
      receiveQty: new Decimal(s.receiveQty),
      depletionQty: new Decimal(s.depletionQty),
      wasteQty: new Decimal(s.wasteQty),
      transferInQty: new Decimal(s.transferInQty),
      transferOutQty: new Decimal(s.transferOutQty),
      adjustmentQty: new Decimal(s.adjustmentQty),
      countVarianceQty: new Decimal(s.countVarianceQty),
      productionConsumeQty: new Decimal(s.productionConsumeQty),
      productionProduceQty: new Decimal(s.productionProduceQty),
    }));
  }

  /**
   * M12.2: Get all revisions for a period.
   */
  async getRevisionHistory(orgId: string, periodId: string): Promise<number[]> {
    // Validate period exists and belongs to org
    await this.getPeriod(orgId, periodId);

    const revisions = await this.prisma.client.inventoryValuationSnapshot.findMany({
      where: { periodId, orgId },
      select: { revision: true },
      distinct: ['revision'],
      orderBy: { revision: 'asc' },
    });

    return revisions.map((r) => r.revision);
  }

  /**
   * Log override usage for audit trail.
   */
  async logOverrideUsage(
    orgId: string,
    userId: string,
    periodId: string,
    reason: string,
    actionType: string,
    entityType: string,
    entityId: string,
  ): Promise<void> {
    await this.auditLog.log({
      orgId,
      userId,
      action: 'INVENTORY_PERIOD_OVERRIDE_USED',
      resourceType: 'InventoryPeriod',
      resourceId: periodId,
      metadata: {
        reason,
        actionType,
        targetEntityType: entityType,
        targetEntityId: entityId,
      },
    });
  }
}
