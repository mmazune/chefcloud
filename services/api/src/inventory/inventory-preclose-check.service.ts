/**
 * M12.2: Pre-Close Check Service
 *
 * Provides deterministic pre-close validation for inventory periods.
 * Returns READY/BLOCKED/WARNING status with detailed blockers and warnings.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface BlockerItem {
  code: string;
  category: string;
  count: number;
  sampleIds: string[];
  description: string;
}

export interface PreCloseCheckResult {
  status: 'READY' | 'BLOCKED' | 'WARNING';
  blockers: BlockerItem[];
  warnings: BlockerItem[];
  requiredActions: string[];
  checkedAt: string;
}

@Injectable()
export class InventoryPreCloseCheckService {
  private readonly logger = new Logger(InventoryPreCloseCheckService.name);
  private readonly SAMPLE_LIMIT = 5;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run pre-close validation for a branch and date range.
   * Returns deterministic status based on blocking conditions.
   */
  async runCheck(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PreCloseCheckResult> {
    const blockers: BlockerItem[] = [];
    const warnings: BlockerItem[] = [];
    const requiredActions: string[] = [];

    // Check each blocker condition
    await Promise.all([
      this.checkStocktakesInProgress(orgId, branchId, startDate, endDate, blockers),
      this.checkProductionBatchDraft(orgId, branchId, startDate, endDate, blockers),
      this.checkTransfersInTransit(orgId, branchId, endDate, blockers),
      this.checkReceiptsInconsistent(orgId, branchId, startDate, endDate, blockers),
      this.checkGLPostingFailed(orgId, branchId, startDate, endDate, blockers),
    ]);

    // Check warning conditions
    await Promise.all([
      this.checkGLPostingSkipped(orgId, branchId, startDate, endDate, warnings),
      this.checkPendingAdjustments(orgId, branchId, startDate, endDate, warnings),
    ]);

    // Build required actions
    for (const blocker of blockers) {
      switch (blocker.code) {
        case 'STOCKTAKE_IN_PROGRESS':
          requiredActions.push(`Complete or cancel ${blocker.count} in-progress stocktake(s)`);
          break;
        case 'PRODUCTION_BATCH_DRAFT':
          requiredActions.push(`Complete or delete ${blocker.count} draft production batch(es)`);
          break;
        case 'TRANSFER_IN_TRANSIT':
          requiredActions.push(`Receive or cancel ${blocker.count} in-transit transfer(s)`);
          break;
        case 'RECEIPT_INCONSISTENT':
          requiredActions.push(`Fix ${blocker.count} inconsistent receipt(s)`);
          break;
        case 'GL_POSTING_FAILED':
          requiredActions.push(`Resolve ${blocker.count} failed GL posting(s)`);
          break;
      }
    }

    // Determine overall status
    let status: 'READY' | 'BLOCKED' | 'WARNING' = 'READY';
    if (blockers.length > 0) {
      status = 'BLOCKED';
    } else if (warnings.length > 0) {
      status = 'WARNING';
    }

    return {
      status,
      blockers,
      warnings,
      requiredActions,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Check for stocktakes in IN_PROGRESS, SUBMITTED, or APPROVED status
   * that overlap with the period date range.
   */
  private async checkStocktakesInProgress(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
    blockers: BlockerItem[],
  ): Promise<void> {
    const stocktakes = await this.prisma.client.stocktakeSession.findMany({
      where: {
        orgId,
        branchId,
        status: { in: ['IN_PROGRESS', 'SUBMITTED', 'APPROVED'] },
        OR: [
          // Started within period
          { startedAt: { gte: startDate, lte: endDate } },
          // Will affect period (started before, not posted/voided)
          { startedAt: { lte: endDate }, postedAt: null, voidedAt: null },
        ],
      },
      select: { id: true },
      take: this.SAMPLE_LIMIT + 1,
    });

    if (stocktakes.length > 0) {
      blockers.push({
        code: 'STOCKTAKE_IN_PROGRESS',
        category: 'STOCKTAKES',
        count: stocktakes.length > this.SAMPLE_LIMIT ? this.SAMPLE_LIMIT : stocktakes.length,
        sampleIds: stocktakes.slice(0, this.SAMPLE_LIMIT).map((s) => s.id),
        description: 'Stocktake sessions are in progress and must be completed before close',
      });
    }
  }

  /**
   * Check for production batches in DRAFT status that overlap the period.
   */
  private async checkProductionBatchDraft(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
    blockers: BlockerItem[],
  ): Promise<void> {
    const batches = await this.prisma.client.productionBatch.findMany({
      where: {
        orgId,
        branchId,
        status: 'DRAFT',
        // Draft batches created within the period
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { id: true },
      take: this.SAMPLE_LIMIT + 1,
    });

    if (batches.length > 0) {
      blockers.push({
        code: 'PRODUCTION_BATCH_DRAFT',
        category: 'PRODUCTION',
        count: batches.length > this.SAMPLE_LIMIT ? this.SAMPLE_LIMIT : batches.length,
        sampleIds: batches.slice(0, this.SAMPLE_LIMIT).map((b) => b.id),
        description: 'Draft production batches must be completed or deleted before close',
      });
    }
  }

  /**
   * Check for transfers in IN_TRANSIT status with shipDate <= endDate.
   */
  private async checkTransfersInTransit(
    orgId: string,
    branchId: string,
    endDate: Date,
    blockers: BlockerItem[],
  ): Promise<void> {
    const transfers = await this.prisma.client.inventoryTransfer.findMany({
      where: {
        orgId,
        OR: [{ fromBranchId: branchId }, { toBranchId: branchId }],
        status: 'IN_TRANSIT',
        shippedAt: { lte: endDate },
      },
      select: { id: true },
      take: this.SAMPLE_LIMIT + 1,
    });

    if (transfers.length > 0) {
      blockers.push({
        code: 'TRANSFER_IN_TRANSIT',
        category: 'TRANSFERS',
        count: transfers.length > this.SAMPLE_LIMIT ? this.SAMPLE_LIMIT : transfers.length,
        sampleIds: transfers.slice(0, this.SAMPLE_LIMIT).map((t) => t.id),
        description: 'In-transit transfers must be received or cancelled before close',
      });
    }
  }

  /**
   * Check for inconsistent receipts (posted but missing GL entries).
   */
  private async checkReceiptsInconsistent(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
    blockers: BlockerItem[],
  ): Promise<void> {
    // Find posted receipts that should have GL journal but don't
    // Note: Prisma's `in` operator doesn't accept null in array - use explicit OR
    const receipts = await this.prisma.client.goodsReceiptV2.findMany({
      where: {
        orgId,
        branchId,
        status: 'POSTED',
        postedAt: { gte: startDate, lte: endDate },
        glJournalEntryId: null,
        OR: [
          { glPostingStatus: 'FAILED' },
          { glPostingStatus: null },
        ],
      },
      select: { id: true },
      take: this.SAMPLE_LIMIT + 1,
    });

    if (receipts.length > 0) {
      blockers.push({
        code: 'RECEIPT_INCONSISTENT',
        category: 'RECEIPTS',
        count: receipts.length,
        sampleIds: receipts.slice(0, this.SAMPLE_LIMIT).map((r) => r.id),
        description: 'Posted receipts are missing GL journal entries and require correction',
      });
    }
  }

  /**
   * Check for failed GL postings in the period.
   * H4: Includes depletions, receipts, and waste.
   */
  private async checkGLPostingFailed(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
    blockers: BlockerItem[],
  ): Promise<void> {
    // Check OrderInventoryDepletion for failed GL postings
    const depletions = await this.prisma.client.orderInventoryDepletion.findMany({
      where: {
        orgId,
        branchId,
        postedAt: { gte: startDate, lte: endDate },
        glPostingStatus: 'FAILED',
      },
      select: { id: true },
      take: this.SAMPLE_LIMIT + 1,
    });

    // H4: Also check receipts for failed GL postings
    const receipts = await this.prisma.client.goodsReceiptV2.findMany({
      where: {
        orgId,
        branchId,
        postedAt: { gte: startDate, lte: endDate },
        glPostingStatus: 'FAILED',
      },
      select: { id: true },
      take: this.SAMPLE_LIMIT + 1,
    });

    // H4: Also check waste for failed GL postings
    const waste = await this.prisma.client.inventoryWaste.findMany({
      where: {
        orgId,
        branchId,
        postedAt: { gte: startDate, lte: endDate },
        glPostingStatus: 'FAILED',
      },
      select: { id: true },
      take: this.SAMPLE_LIMIT + 1,
    });

    const allFailed = [...depletions, ...receipts, ...waste];

    if (allFailed.length > 0) {
      blockers.push({
        code: 'GL_POSTING_FAILED',
        category: 'GL_POSTINGS',
        count: allFailed.length > this.SAMPLE_LIMIT ? this.SAMPLE_LIMIT : allFailed.length,
        sampleIds: allFailed.slice(0, this.SAMPLE_LIMIT).map((d) => d.id),
        description: 'Failed GL postings must be resolved before close',
      });
    }
  }

  /**
   * Check for skipped GL postings (warning only).
   */
  private async checkGLPostingSkipped(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
    warnings: BlockerItem[],
  ): Promise<void> {
    const depletions = await this.prisma.client.orderInventoryDepletion.findMany({
      where: {
        orgId,
        branchId,
        postedAt: { gte: startDate, lte: endDate },
        glPostingStatus: 'SKIPPED',
      },
      select: { id: true },
      take: this.SAMPLE_LIMIT + 1,
    });

    if (depletions.length > 0) {
      warnings.push({
        code: 'GL_POSTING_SKIPPED',
        category: 'GL_POSTINGS',
        count: depletions.length > this.SAMPLE_LIMIT ? this.SAMPLE_LIMIT : depletions.length,
        sampleIds: depletions.slice(0, this.SAMPLE_LIMIT).map((d) => d.id),
        description: 'Some GL postings were skipped - review if intentional',
      });
    }
  }

  /**
   * Check for pending stock adjustments (warning only).
   */
  private async checkPendingAdjustments(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
    warnings: BlockerItem[],
  ): Promise<void> {
    const adjustments = await this.prisma.client.stockAdjustment.findMany({
      where: {
        orgId,
        branchId,
        status: 'PENDING',
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { id: true },
      take: this.SAMPLE_LIMIT + 1,
    });

    if (adjustments.length > 0) {
      warnings.push({
        code: 'PENDING_ADJUSTMENTS',
        category: 'ADJUSTMENTS',
        count: adjustments.length > this.SAMPLE_LIMIT ? this.SAMPLE_LIMIT : adjustments.length,
        sampleIds: adjustments.slice(0, this.SAMPLE_LIMIT).map((a) => a.id),
        description: 'Pending adjustments should be reviewed before close',
      });
    }
  }
}
