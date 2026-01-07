/**
 * M12.1 Inventory Reconciliation Service
 *
 * Compares inventory movement totals vs GL journal postings.
 * Uses InventoryPostingMapping and GlPostingStatus from M11.13.
 */
import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

const ZERO = new Decimal(0);

export type ReconciliationStatus = 'MATCH' | 'WARN' | 'FAIL';

export interface ReconciliationCategory {
  category: string;
  inventorySide: {
    qty: Decimal;
    value: Decimal;
  };
  glSide: {
    debitTotal: Decimal;
    creditTotal: Decimal;
    netValue: Decimal;
  };
  delta: Decimal;
  status: ReconciliationStatus;
  warnings: string[];
  journalEntryIds: string[];
  journalEntryCount: number;
}

export interface ReconciliationResult {
  periodId: string;
  branchId: string;
  branchName: string;
  startDate: Date;
  endDate: Date;
  postingMapping: {
    inventoryAssetAccountId: string;
    cogsAccountId: string;
    wasteExpenseAccountId: string;
    grniAccountId: string;
  } | null;
  categories: ReconciliationCategory[];
  overallStatus: ReconciliationStatus;
  generatedAt: Date;
}

@Injectable()
export class InventoryReconciliationService {
  private readonly logger = new Logger(InventoryReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get reconciliation report for a closed period.
   */
  async getReconciliation(
    orgId: string,
    periodId: string,
  ): Promise<ReconciliationResult> {
    // Get period
    const period = await this.prisma.client.inventoryPeriod.findFirst({
      where: { id: periodId, orgId },
      include: {
        branch: { select: { name: true } },
      },
    });

    if (!period) {
      throw new NotFoundException('Period not found');
    }

    // Get posting mapping for branch (or org default)
    const mapping = await this.prisma.client.inventoryPostingMapping.findFirst({
      where: {
        orgId,
        OR: [
          { branchId: period.branchId },
          { branchId: null },
        ],
      },
      orderBy: { branchId: 'desc' }, // Prefer branch-specific
    });

    // Get movement summary for period (branch total row)
    const movementTotal = await this.prisma.client.inventoryPeriodMovementSummary.findFirst({
      where: { periodId, orgId, itemId: null },
    });

    const categories: ReconciliationCategory[] = [];

    // Extend dates for query
    const startDate = period.startDate;
    const endDate = new Date(period.endDate);
    endDate.setHours(23, 59, 59, 999);

    // Category 1: Receipts (GRNI)
    const receiptsCategory = await this.buildReceiptsCategory(
      orgId,
      period.branchId,
      startDate,
      endDate,
      movementTotal?.receiveQty ?? ZERO,
      movementTotal?.receiveValue ?? ZERO,
      mapping?.grniAccountId,
    );
    categories.push(receiptsCategory);

    // Category 2: Depletion/COGS
    const cogsCategory = await this.buildCogsCategory(
      orgId,
      period.branchId,
      startDate,
      endDate,
      movementTotal?.depletionQty ?? ZERO,
      movementTotal?.depletionValue ?? ZERO,
      mapping?.cogsAccountId,
    );
    categories.push(cogsCategory);

    // Category 3: Waste
    const wasteCategory = await this.buildWasteCategory(
      orgId,
      period.branchId,
      startDate,
      endDate,
      movementTotal?.wasteQty ?? ZERO,
      movementTotal?.wasteValue ?? ZERO,
      mapping?.wasteExpenseAccountId,
    );
    categories.push(wasteCategory);

    // Category 4: Stocktake Variance
    const varianceCategory = await this.buildVarianceCategory(
      orgId,
      period.branchId,
      startDate,
      endDate,
      movementTotal?.countVarianceQty ?? ZERO,
      movementTotal?.countVarianceValue ?? ZERO,
    );
    categories.push(varianceCategory);

    // Determine overall status
    let overallStatus: ReconciliationStatus = 'MATCH';
    for (const cat of categories) {
      if (cat.status === 'FAIL') {
        overallStatus = 'FAIL';
        break;
      }
      if (cat.status === 'WARN') {
        overallStatus = 'WARN';
      }
    }

    return {
      periodId,
      branchId: period.branchId,
      branchName: period.branch.name,
      startDate: period.startDate,
      endDate: period.endDate,
      postingMapping: mapping ? {
        inventoryAssetAccountId: mapping.inventoryAssetAccountId,
        cogsAccountId: mapping.cogsAccountId,
        wasteExpenseAccountId: mapping.wasteExpenseAccountId,
        grniAccountId: mapping.grniAccountId,
      } : null,
      categories,
      overallStatus,
      generatedAt: new Date(),
    };
  }

  private async buildReceiptsCategory(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
    inventoryQty: Decimal | number,
    inventoryValue: Decimal | number,
    grniAccountId?: string,
  ): Promise<ReconciliationCategory> {
    const warnings: string[] = [];
    const journalEntryIds: string[] = [];

    // Get GL journal lines for GRNI account
    let debitTotal = ZERO;
    let creditTotal = ZERO;

    if (grniAccountId) {
      const journalLines = await this.prisma.client.journalLine.findMany({
        where: {
          accountId: grniAccountId,
          entry: {
            orgId,
            branchId,
            date: { gte: startDate, lte: endDate },
            status: 'POSTED',
          },
        },
      });

      const seenIds = new Set<string>();
      for (const line of journalLines) {
        debitTotal = debitTotal.plus(line.debit ?? 0);
        creditTotal = creditTotal.plus(line.credit ?? 0);
        if (!seenIds.has(line.entryId)) {
          seenIds.add(line.entryId);
          if (journalEntryIds.length < 10) {
            journalEntryIds.push(line.entryId);
          }
        }
      }
    } else {
      warnings.push('No GRNI account mapping configured');
    }

    // Check for failed GL postings
    const failedReceipts = await this.prisma.client.goodsReceiptV2.count({
      where: {
        orgId,
        branchId,
        postedAt: { gte: startDate, lte: endDate },
        glPostingStatus: { in: ['FAILED', 'SKIPPED'] },
      },
    });
    if (failedReceipts > 0) {
      warnings.push(`${failedReceipts} receipt(s) with FAILED/SKIPPED GL posting`);
    }

    const netValue = debitTotal.minus(creditTotal);
    const invValue = new Decimal(inventoryValue);
    const delta = invValue.minus(netValue.abs());

    // Determine status
    let status: ReconciliationStatus = 'MATCH';
    if (warnings.length > 0) status = 'WARN';
    if (delta.abs().greaterThan(0.01) && grniAccountId) status = 'WARN';

    return {
      category: 'RECEIPTS',
      inventorySide: {
        qty: new Decimal(inventoryQty),
        value: invValue,
      },
      glSide: {
        debitTotal,
        creditTotal,
        netValue,
      },
      delta,
      status,
      warnings,
      journalEntryIds,
      journalEntryCount: journalEntryIds.length,
    };
  }

  private async buildCogsCategory(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
    inventoryQty: Decimal | number,
    inventoryValue: Decimal | number,
    cogsAccountId?: string,
  ): Promise<ReconciliationCategory> {
    const warnings: string[] = [];
    const journalEntryIds: string[] = [];

    let debitTotal = ZERO;
    let creditTotal = ZERO;

    if (cogsAccountId) {
      const journalLines = await this.prisma.client.journalLine.findMany({
        where: {
          accountId: cogsAccountId,
          entry: {
            orgId,
            branchId,
            date: { gte: startDate, lte: endDate },
            status: 'POSTED',
          },
        },
      });

      const seenIds = new Set<string>();
      for (const line of journalLines) {
        debitTotal = debitTotal.plus(line.debit ?? 0);
        creditTotal = creditTotal.plus(line.credit ?? 0);
        if (!seenIds.has(line.entryId)) {
          seenIds.add(line.entryId);
          if (journalEntryIds.length < 10) {
            journalEntryIds.push(line.entryId);
          }
        }
      }
    } else {
      warnings.push('No COGS account mapping configured');
    }

    // Check for failed depletion postings
    const failedDepletions = await this.prisma.client.orderInventoryDepletion.count({
      where: {
        orgId,
        branchId,
        postedAt: { gte: startDate, lte: endDate },
        glPostingStatus: { in: ['FAILED', 'SKIPPED'] },
      },
    });
    if (failedDepletions > 0) {
      warnings.push(`${failedDepletions} depletion(s) with FAILED/SKIPPED GL posting`);
    }

    const netValue = debitTotal.minus(creditTotal);
    const invValue = new Decimal(inventoryValue);
    const delta = invValue.minus(netValue.abs());

    let status: ReconciliationStatus = 'MATCH';
    if (warnings.length > 0) status = 'WARN';
    if (delta.abs().greaterThan(0.01) && cogsAccountId) status = 'WARN';

    return {
      category: 'COGS',
      inventorySide: {
        qty: new Decimal(inventoryQty),
        value: invValue,
      },
      glSide: {
        debitTotal,
        creditTotal,
        netValue,
      },
      delta,
      status,
      warnings,
      journalEntryIds,
      journalEntryCount: journalEntryIds.length,
    };
  }

  private async buildWasteCategory(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
    inventoryQty: Decimal | number,
    inventoryValue: Decimal | number,
    wasteAccountId?: string,
  ): Promise<ReconciliationCategory> {
    const warnings: string[] = [];
    const journalEntryIds: string[] = [];

    let debitTotal = ZERO;
    let creditTotal = ZERO;

    if (wasteAccountId) {
      const journalLines = await this.prisma.client.journalLine.findMany({
        where: {
          accountId: wasteAccountId,
          entry: {
            orgId,
            branchId,
            date: { gte: startDate, lte: endDate },
            status: 'POSTED',
          },
        },
      });

      const seenIds = new Set<string>();
      for (const line of journalLines) {
        debitTotal = debitTotal.plus(line.debit ?? 0);
        creditTotal = creditTotal.plus(line.credit ?? 0);
        if (!seenIds.has(line.entryId)) {
          seenIds.add(line.entryId);
          if (journalEntryIds.length < 10) {
            journalEntryIds.push(line.entryId);
          }
        }
      }
    } else {
      warnings.push('No waste expense account mapping configured');
    }

    // Check for failed waste postings
    const failedWaste = await this.prisma.client.inventoryWaste.count({
      where: {
        orgId,
        branchId,
        postedAt: { gte: startDate, lte: endDate },
        glPostingStatus: { in: ['FAILED', 'SKIPPED'] },
      },
    });
    if (failedWaste > 0) {
      warnings.push(`${failedWaste} waste document(s) with FAILED/SKIPPED GL posting`);
    }

    const netValue = debitTotal.minus(creditTotal);
    const invValue = new Decimal(inventoryValue);
    const delta = invValue.minus(netValue.abs());

    let status: ReconciliationStatus = 'MATCH';
    if (warnings.length > 0) status = 'WARN';
    if (delta.abs().greaterThan(0.01) && wasteAccountId) status = 'WARN';

    return {
      category: 'WASTE',
      inventorySide: {
        qty: new Decimal(inventoryQty),
        value: invValue,
      },
      glSide: {
        debitTotal,
        creditTotal,
        netValue,
      },
      delta,
      status,
      warnings,
      journalEntryIds,
      journalEntryCount: journalEntryIds.length,
    };
  }

  private async buildVarianceCategory(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
    inventoryQty: Decimal | number,
    inventoryValue: Decimal | number,
  ): Promise<ReconciliationCategory> {
    const warnings: string[] = [];
    const journalEntryIds: string[] = [];

    // Stocktake variance typically posts to inventory adjustment accounts
    // For now, just report the inventory side
    const invQty = new Decimal(inventoryQty);
    const invValue = new Decimal(inventoryValue);

    // Check for stocktakes in the period
    const stocktakeCount = await this.prisma.client.stocktakeSession.count({
      where: {
        orgId,
        branchId,
        status: 'POSTED',
        postedAt: { gte: startDate, lte: endDate },
      },
    });

    if (stocktakeCount === 0 && !invQty.isZero()) {
      warnings.push('Variance qty without POSTED stocktakes');
    }

    return {
      category: 'STOCKTAKE_VARIANCE',
      inventorySide: {
        qty: invQty,
        value: invValue,
      },
      glSide: {
        debitTotal: ZERO,
        creditTotal: ZERO,
        netValue: ZERO,
      },
      delta: invValue,
      status: warnings.length > 0 ? 'WARN' : 'MATCH',
      warnings,
      journalEntryIds,
      journalEntryCount: 0,
    };
  }
}
