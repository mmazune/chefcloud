/**
 * M12.7: Blockers Engine v2 (Deterministic + Actionable)
 *
 * Enhanced preclose engine that returns structured blockers with:
 * - status: READY | WARNING | BLOCKED
 * - checks[]: detailed check results with resolution hints
 * - Entity references for UI action buttons
 * - RBAC-aware resolution actions
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { InventoryPreCloseCheckService } from './inventory-preclose-check.service';

// ============================================
// Types
// ============================================

export type CheckType =
  | 'OPEN_STOCKTAKES'
  | 'UNPOSTED_RECEIPTS'
  | 'UNPOSTED_WASTE'
  | 'FAILED_GL_POSTINGS'
  | 'PERIOD_NOT_APPROVED'
  | 'PENDING_TRANSFERS'
  | 'DRAFT_PRODUCTION';

export type CheckStatus = 'PASS' | 'WARNING' | 'BLOCKED';

export type ResolutionAction =
  | 'VOID_STOCKTAKE'
  | 'POST_STOCKTAKE'
  | 'POST_RECEIPT'
  | 'VOID_RECEIPT'
  | 'POST_WASTE'
  | 'VOID_WASTE'
  | 'RETRY_GL_POSTING'
  | 'CREATE_CLOSE_REQUEST'
  | 'LINK_APPROVAL'
  | 'VOID_TRANSFER'
  | 'COMPLETE_TRANSFER'
  | 'COMPLETE_PRODUCTION'
  | 'VOID_PRODUCTION';

export interface ResolutionHint {
  action: ResolutionAction;
  label: string;
  requiredRole: 'L3' | 'L4' | 'L5';
  canOverride: boolean;
}

export interface EntityRef {
  id: string;
  type: string;
  label?: string;
}

export interface BlockerCheck {
  type: CheckType;
  status: CheckStatus;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  entityRefs: EntityRef[];
  canOverride: boolean;
  resolutionHints: ResolutionHint[];
}

export interface BlockersEngineResult {
  status: 'READY' | 'WARNING' | 'BLOCKED';
  checks: BlockerCheck[];
  checkedAt: string;
  periodId?: string;
  branchId?: string;
}

// ============================================
// Service
// ============================================

@Injectable()
export class InventoryBlockersEngineService {
  private readonly logger = new Logger(InventoryBlockersEngineService.name);
  private readonly SAMPLE_LIMIT = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly legacyPrecloseService: InventoryPreCloseCheckService,
  ) {}

  /**
   * Run blockers engine for a period.
   * Returns structured checks with resolution hints.
   */
  async runBlockersCheck(
    orgId: string,
    branchId: string,
    periodId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<BlockersEngineResult> {
    const checks: BlockerCheck[] = [];

    // Run all checks in parallel
    await Promise.all([
      this.checkOpenStocktakes(orgId, branchId, startDate, endDate, checks),
      this.checkUnpostedReceipts(orgId, branchId, startDate, endDate, checks),
      this.checkUnpostedWaste(orgId, branchId, startDate, endDate, checks),
      this.checkFailedGLPostings(orgId, branchId, startDate, endDate, checks),
      this.checkPeriodNotApproved(orgId, branchId, periodId, checks),
      this.checkPendingTransfers(orgId, branchId, endDate, checks),
      this.checkDraftProduction(orgId, branchId, startDate, endDate, checks),
    ]);

    // Determine overall status
    let status: 'READY' | 'WARNING' | 'BLOCKED' = 'READY';
    const hasBlocked = checks.some((c) => c.status === 'BLOCKED');
    const hasWarning = checks.some((c) => c.status === 'WARNING');

    if (hasBlocked) {
      status = 'BLOCKED';
    } else if (hasWarning) {
      status = 'WARNING';
    }

    return {
      status,
      checks,
      checkedAt: new Date().toISOString(),
      periodId,
      branchId,
    };
  }

  // ============================================
  // Individual Checks
  // ============================================

  private async checkOpenStocktakes(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
    checks: BlockerCheck[],
  ): Promise<void> {
    const stocktakes = await this.prisma.client.stocktakeSession.findMany({
      where: {
        orgId,
        branchId,
        status: { in: ['IN_PROGRESS', 'SUBMITTED', 'APPROVED'] },
        OR: [
          { startedAt: { gte: startDate, lte: endDate } },
          { startedAt: { lte: endDate }, postedAt: null, voidedAt: null },
        ],
      },
      select: { id: true, status: true },
      take: this.SAMPLE_LIMIT,
    });

    if (stocktakes.length > 0) {
      checks.push({
        type: 'OPEN_STOCKTAKES',
        status: 'BLOCKED',
        severity: 'ERROR',
        message: `${stocktakes.length} stocktake session(s) are open and must be completed or voided`,
        entityRefs: stocktakes.map((s) => ({
          id: s.id,
          type: 'STOCKTAKE_SESSION',
          label: `Stocktake ${s.id.slice(-6)}`,
        })),
        canOverride: true,
        resolutionHints: [
          {
            action: 'POST_STOCKTAKE',
            label: 'Post Stocktake',
            requiredRole: 'L4',
            canOverride: false,
          },
          {
            action: 'VOID_STOCKTAKE',
            label: 'Void Stocktake',
            requiredRole: 'L4',
            canOverride: false,
          },
        ],
      });
    } else {
      checks.push({
        type: 'OPEN_STOCKTAKES',
        status: 'PASS',
        severity: 'INFO',
        message: 'No open stocktakes',
        entityRefs: [],
        canOverride: false,
        resolutionHints: [],
      });
    }
  }

  private async checkUnpostedReceipts(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
    checks: BlockerCheck[],
  ): Promise<void> {
    const receipts = await this.prisma.client.goodsReceiptV2.findMany({
      where: {
        orgId,
        branchId,
        status: 'DRAFT',
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { id: true, status: true, referenceNumber: true },
      take: this.SAMPLE_LIMIT,
    });

    if (receipts.length > 0) {
      checks.push({
        type: 'UNPOSTED_RECEIPTS',
        status: 'BLOCKED',
        severity: 'ERROR',
        message: `${receipts.length} receipt(s) are unposted`,
        entityRefs: receipts.map((r) => ({
          id: r.id,
          type: 'GOODS_RECEIPT',
          label: r.referenceNumber || `Receipt ${r.id.slice(-6)}`,
        })),
        canOverride: true,
        resolutionHints: [
          {
            action: 'POST_RECEIPT',
            label: 'Post Receipt',
            requiredRole: 'L3',
            canOverride: false,
          },
          {
            action: 'VOID_RECEIPT',
            label: 'Void Receipt',
            requiredRole: 'L4',
            canOverride: false,
          },
        ],
      });
    } else {
      checks.push({
        type: 'UNPOSTED_RECEIPTS',
        status: 'PASS',
        severity: 'INFO',
        message: 'All receipts posted',
        entityRefs: [],
        canOverride: false,
        resolutionHints: [],
      });
    }
  }

  private async checkUnpostedWaste(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
    checks: BlockerCheck[],
  ): Promise<void> {
    const waste = await this.prisma.client.inventoryWaste.findMany({
      where: {
        orgId,
        branchId,
        status: 'DRAFT',
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { id: true, status: true },
      take: this.SAMPLE_LIMIT,
    });

    if (waste.length > 0) {
      checks.push({
        type: 'UNPOSTED_WASTE',
        status: 'BLOCKED',
        severity: 'ERROR',
        message: `${waste.length} waste record(s) are unposted`,
        entityRefs: waste.map((w) => ({
          id: w.id,
          type: 'INVENTORY_WASTE',
          label: `Waste ${w.id.slice(-6)}`,
        })),
        canOverride: true,
        resolutionHints: [
          {
            action: 'POST_WASTE',
            label: 'Post Waste',
            requiredRole: 'L3',
            canOverride: false,
          },
          {
            action: 'VOID_WASTE',
            label: 'Void Waste',
            requiredRole: 'L4',
            canOverride: false,
          },
        ],
      });
    } else {
      checks.push({
        type: 'UNPOSTED_WASTE',
        status: 'PASS',
        severity: 'INFO',
        message: 'All waste records posted',
        entityRefs: [],
        canOverride: false,
        resolutionHints: [],
      });
    }
  }

  private async checkFailedGLPostings(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
    checks: BlockerCheck[],
  ): Promise<void> {
    // Check depletions with failed GL
    const depletions = await this.prisma.client.orderInventoryDepletion.findMany({
      where: {
        orgId,
        branchId,
        postedAt: { gte: startDate, lte: endDate },
        glPostingStatus: 'FAILED',
      },
      select: { id: true },
      take: this.SAMPLE_LIMIT,
    });

    // Check receipts with failed GL
    const receipts = await this.prisma.client.goodsReceiptV2.findMany({
      where: {
        orgId,
        branchId,
        postedAt: { gte: startDate, lte: endDate },
        glPostingStatus: 'FAILED',
      },
      select: { id: true },
      take: this.SAMPLE_LIMIT,
    });

    // H4: Also check waste with failed GL
    const waste = await this.prisma.client.inventoryWaste.findMany({
      where: {
        orgId,
        branchId,
        postedAt: { gte: startDate, lte: endDate },
        glPostingStatus: 'FAILED',
      },
      select: { id: true },
      take: this.SAMPLE_LIMIT,
    });

    const totalFailed = depletions.length + receipts.length + waste.length;

    if (totalFailed > 0) {
      const entityRefs: EntityRef[] = [
        ...depletions.map((d) => ({
          id: d.id,
          type: 'ORDER_DEPLETION',
          label: `Depletion ${d.id.slice(-6)}`,
        })),
        ...receipts.map((r) => ({
          id: r.id,
          type: 'GOODS_RECEIPT',
          label: `Receipt ${r.id.slice(-6)}`,
        })),
        ...waste.map((w) => ({
          id: w.id,
          type: 'INVENTORY_WASTE',
          label: `Waste ${w.id.slice(-6)}`,
        })),
      ];

      checks.push({
        type: 'FAILED_GL_POSTINGS',
        status: 'BLOCKED',
        severity: 'ERROR',
        message: `${totalFailed} GL posting(s) failed and require retry`,
        entityRefs,
        canOverride: true,
        resolutionHints: [
          {
            action: 'RETRY_GL_POSTING',
            label: 'Retry GL Posting',
            requiredRole: 'L4',
            canOverride: false,
          },
        ],
      });
    } else {
      checks.push({
        type: 'FAILED_GL_POSTINGS',
        status: 'PASS',
        severity: 'INFO',
        message: 'No failed GL postings',
        entityRefs: [],
        canOverride: false,
        resolutionHints: [],
      });
    }
  }

  private async checkPeriodNotApproved(
    orgId: string,
    branchId: string,
    periodId: string,
    checks: BlockerCheck[],
  ): Promise<void> {
    // Check for approved close request
    const approvedRequest = await this.prisma.client.inventoryPeriodCloseRequest.findFirst({
      where: {
        orgId,
        periodId,
        status: 'APPROVED',
      },
    });

    if (!approvedRequest) {
      // Check if any request exists
      const existingRequest = await this.prisma.client.inventoryPeriodCloseRequest.findFirst({
        where: { orgId, periodId },
        orderBy: { createdAt: 'desc' },
      });

      checks.push({
        type: 'PERIOD_NOT_APPROVED',
        status: 'BLOCKED',
        severity: 'ERROR',
        message: existingRequest
          ? `Close request is in ${existingRequest.status} status - approval required`
          : 'No close request exists - create and approve before closing',
        entityRefs: existingRequest
          ? [{ id: existingRequest.id, type: 'CLOSE_REQUEST', label: 'Close Request' }]
          : [],
        canOverride: true, // L5 can force close
        resolutionHints: existingRequest
          ? [
              {
                action: 'LINK_APPROVAL',
                label: 'Approve Request',
                requiredRole: 'L5',
                canOverride: false,
              },
            ]
          : [
              {
                action: 'CREATE_CLOSE_REQUEST',
                label: 'Create Close Request',
                requiredRole: 'L3',
                canOverride: false,
              },
            ],
      });
    } else {
      checks.push({
        type: 'PERIOD_NOT_APPROVED',
        status: 'PASS',
        severity: 'INFO',
        message: 'Close request approved',
        entityRefs: [{ id: approvedRequest.id, type: 'CLOSE_REQUEST' }],
        canOverride: false,
        resolutionHints: [],
      });
    }
  }

  private async checkPendingTransfers(
    orgId: string,
    branchId: string,
    endDate: Date,
    checks: BlockerCheck[],
  ): Promise<void> {
    const transfers = await this.prisma.client.inventoryTransfer.findMany({
      where: {
        orgId,
        OR: [{ fromBranchId: branchId }, { toBranchId: branchId }],
        status: 'IN_TRANSIT',
        shippedAt: { lte: endDate },
      },
      select: { id: true, transferNumber: true },
      take: this.SAMPLE_LIMIT,
    });

    if (transfers.length > 0) {
      checks.push({
        type: 'PENDING_TRANSFERS',
        status: 'BLOCKED',
        severity: 'ERROR',
        message: `${transfers.length} transfer(s) are in-transit`,
        entityRefs: transfers.map((t) => ({
          id: t.id,
          type: 'INVENTORY_TRANSFER',
          label: t.transferNumber || `Transfer ${t.id.slice(-6)}`,
        })),
        canOverride: true,
        resolutionHints: [
          {
            action: 'COMPLETE_TRANSFER',
            label: 'Complete Transfer',
            requiredRole: 'L3',
            canOverride: false,
          },
          {
            action: 'VOID_TRANSFER',
            label: 'Void Transfer',
            requiredRole: 'L4',
            canOverride: false,
          },
        ],
      });
    } else {
      checks.push({
        type: 'PENDING_TRANSFERS',
        status: 'PASS',
        severity: 'INFO',
        message: 'No pending transfers',
        entityRefs: [],
        canOverride: false,
        resolutionHints: [],
      });
    }
  }

  private async checkDraftProduction(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
    checks: BlockerCheck[],
  ): Promise<void> {
    const batches = await this.prisma.client.productionBatch.findMany({
      where: {
        orgId,
        branchId,
        status: 'DRAFT',
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { id: true, batchNumber: true },
      take: this.SAMPLE_LIMIT,
    });

    if (batches.length > 0) {
      checks.push({
        type: 'DRAFT_PRODUCTION',
        status: 'BLOCKED',
        severity: 'ERROR',
        message: `${batches.length} production batch(es) are in draft`,
        entityRefs: batches.map((b) => ({
          id: b.id,
          type: 'PRODUCTION_BATCH',
          label: b.batchNumber || `Batch ${b.id.slice(-6)}`,
        })),
        canOverride: true,
        resolutionHints: [
          {
            action: 'COMPLETE_PRODUCTION',
            label: 'Complete Batch',
            requiredRole: 'L3',
            canOverride: false,
          },
          {
            action: 'VOID_PRODUCTION',
            label: 'Void Batch',
            requiredRole: 'L4',
            canOverride: false,
          },
        ],
      });
    } else {
      checks.push({
        type: 'DRAFT_PRODUCTION',
        status: 'PASS',
        severity: 'INFO',
        message: 'No draft production batches',
        entityRefs: [],
        canOverride: false,
        resolutionHints: [],
      });
    }
  }
}
