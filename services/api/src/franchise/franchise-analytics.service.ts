// services/api/src/franchise/franchise-analytics.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  FranchiseOverviewQueryDto,
  FranchiseOverviewResponseDto,
  FranchiseBranchKpiDto,
} from './dto/franchise-overview.dto';
import {
  FranchiseRankingsQueryDto,
  FranchiseRankingsResponseDto,
  FranchiseRankingEntryDto,
  FranchiseRankingMetric,
} from './dto/franchise-rankings.dto';
import {
  FranchiseBudgetFilterDto,
  FranchiseBudgetUpsertDto,
  FranchiseBudgetDto,
  FRANCHISE_BUDGET_CATEGORY_NET_SALES,
} from './dto/franchise-budgets.dto';
import {
  FranchiseBudgetVarianceQueryDto,
  FranchiseBudgetVarianceResponseDto,
  FranchiseBudgetVarianceBranchDto,
} from './dto/franchise-budgets-variance.dto';
import {
  FranchiseForecastQueryDto,
  FranchiseForecastResponseDto,
  FranchiseForecastBranchDto,
} from './dto/franchise-forecast.dto';
import { toCsvString } from '../common/csv/csv.util';

// E22-S2: Type definitions for advanced metrics
interface BranchWasteMap {
  [branchId: string]: number; // waste value in cents
}

interface BranchShrinkMap {
  [branchId: string]: number; // shrinkage value in cents
}

interface BranchStaffScoreMap {
  [branchId: string]: number; // average KPI score (0-100)
}

@Injectable()
export class FranchiseAnalyticsService {
  private readonly logger = new Logger(FranchiseAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get franchise overview with per-branch KPIs and totals
   */
  async getOverviewForOrg(
    orgId: string,
    query: FranchiseOverviewQueryDto,
  ): Promise<FranchiseOverviewResponseDto> {
    const { startDate, endDate, branchIds } = query;

    // Normalize dates (fallback to "today" if missing)
    const { from, to } = this.resolveDateRange(startDate, endDate);

    this.logger.log(
      `Fetching franchise overview for org ${orgId} from ${from.toISOString()} to ${to.toISOString()}`,
    );

    // Fetch all active branches for this org (with optional filter)
    const branches = await this.prisma.branch.findMany({
      where: {
        orgId,
        ...(branchIds && branchIds.length > 0 ? { id: { in: branchIds } } : {}),
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (branches.length === 0) {
      this.logger.warn(`No branches found for org ${orgId}`);
      return {
        fromDate: from.toISOString(),
        toDate: to.toISOString(),
        branches: [],
        totals: {
          grossSales: 0,
          netSales: 0,
          totalOrders: 0,
          totalGuests: 0,
          marginAmount: 0,
          marginPercent: 0,
        },
      };
    }

    // Map branch IDs for aggregation filtering
    const branchIdsToAggregate = branches.map((b) => b.id);

    // E22-S2: Fetch waste, shrinkage, and staff KPI data in parallel
    const [wasteMap, shrinkMap, staffScoreMap] = await Promise.all([
      this.getWasteByBranch(orgId, from, to),
      this.getShrinkByBranch(orgId, from, to),
      this.getStaffScoreByBranch(orgId, from, to),
    ]);

    // Aggregate orders by branch (only CLOSED orders count as revenue)
    const orderAggregates = await this.prisma.order.groupBy({
      by: ['branchId'],
      where: {
        branch: {
          orgId,
        },
        branchId: { in: branchIdsToAggregate },
        status: 'CLOSED',
        createdAt: {
          gte: from,
          lt: to,
        },
      },
      _sum: {
        subtotal: true, // Gross sales (before discount)
        total: true, // Net sales (after discount)
        tax: true,
        discount: true,
      },
      _count: true,
    });

    // Note: Guest count estimation is done inline below
    // In production, you'd aggregate from a guestCount field if it exists

    // Get voided orders for SLA metrics (via branch relation)
    const voidedAggregates = await this.prisma.order.groupBy({
      by: ['branchId'],
      where: {
        branch: {
          orgId,
        },
        branchId: { in: branchIdsToAggregate },
        status: 'VOIDED',
        createdAt: {
          gte: from,
          lt: to,
        },
      },
      _count: true,
    });

    // Build KPI map by branch
    const byBranchId: Record<string, FranchiseBranchKpiDto> = {};

    for (const branch of branches) {
      byBranchId[branch.id] = {
        branchId: branch.id,
        branchName: branch.name,
        grossSales: 0,
        netSales: 0,
        totalOrders: 0,
        avgCheck: 0,
        totalGuests: 0,
        marginAmount: 0,
        marginPercent: 0,
        cancelledOrders: 0,
        voidedOrders: 0,
        // E22-S2: Initialize advanced metrics
        wasteValue: wasteMap[branch.id] ?? 0,
        shrinkValue: shrinkMap[branch.id] ?? 0,
        wastePercent: 0,
        shrinkagePercent: 0,
        staffKpiScore: staffScoreMap[branch.id] ?? 0,
      };
    }

    // Populate order aggregates
    for (const agg of orderAggregates) {
      const entry = byBranchId[agg.branchId];
      if (!entry) continue;

      const gross = Number(agg._sum?.subtotal ?? 0);
      const net = Number(agg._sum?.total ?? 0);
      const ordersCount = agg._count ?? 0;

      entry.grossSales = gross;
      entry.netSales = net;
      entry.totalOrders = ordersCount;

      // Estimate guests (1.5 guests per order as default assumption)
      entry.totalGuests = Math.round(ordersCount * 1.5);

      // Calculate margin (simplified: assume 60% margin on net sales)
      // In production, you'd compute actual COGS from orderItems + ingredient costs
      entry.marginAmount = net * 0.6;
    }

    // Populate voided order counts
    for (const agg of voidedAggregates) {
      const entry = byBranchId[agg.branchId];
      if (!entry) continue;

      const count = agg._count ?? 0;
      entry.voidedOrders = count;
      // Note: CANCELLED status doesn't exist in OrderStatus enum, only VOIDED
    }

    // Post-process KPIs (avgCheck, marginPercent, waste%, shrinkage%)
    let totalGross = 0;
    let totalNet = 0;
    let totalMargin = 0;
    let totalGuests = 0;
    let totalOrders = 0;

    for (const entry of Object.values(byBranchId)) {
      if (entry.totalOrders > 0) {
        entry.avgCheck = entry.netSales / entry.totalOrders;
      }
      if (entry.netSales > 0) {
        entry.marginPercent = (entry.marginAmount / entry.netSales) * 100;
        
        // E22-S2: Compute waste and shrinkage as % of net sales
        // All values are in cents
        entry.wastePercent = (entry.wasteValue / entry.netSales) * 100;
        entry.shrinkagePercent = (entry.shrinkValue / entry.netSales) * 100;
      }

      totalGross += entry.grossSales;
      totalNet += entry.netSales;
      totalMargin += entry.marginAmount;
      totalGuests += entry.totalGuests;
      totalOrders += entry.totalOrders;
    }

    const totalsMarginPercent = totalNet > 0 ? (totalMargin / totalNet) * 100 : 0;

    return {
      fromDate: from.toISOString(),
      toDate: to.toISOString(),
      branches: Object.values(byBranchId),
      totals: {
        grossSales: totalGross,
        netSales: totalNet,
        totalOrders,
        totalGuests,
        marginAmount: totalMargin,
        marginPercent: totalsMarginPercent,
      },
    };
  }

  /**
   * Get franchise rankings sorted by selected metric
   */
  async getRankingsForOrg(
    orgId: string,
    query: FranchiseRankingsQueryDto,
  ): Promise<FranchiseRankingsResponseDto> {
    const { metric, branchIds, limit } = query;
    const { from, to } = this.resolveDateRange(query.startDate, query.endDate);

    this.logger.log(
      `Fetching franchise rankings for org ${orgId}, metric: ${metric}, from ${from.toISOString()} to ${to.toISOString()}`,
    );

    // Reuse overview aggregation to avoid drift in logic
    const overview = await this.getOverviewForOrg(orgId, {
      startDate: from.toISOString(),
      endDate: to.toISOString(),
      branchIds,
    });

    // Compute value per branch for chosen metric
    const entries: FranchiseRankingEntryDto[] = overview.branches.map((b) => ({
      branchId: b.branchId,
      branchName: b.branchName,
      value: this.getMetricValue(metric, b),
      rank: 0, // Will be filled after sorting
    }));

    // Filter out branches with invalid metric values
    const validEntries = entries.filter((e) => Number.isFinite(e.value));

    // Sort descending (higher is better)
    validEntries.sort((a, b) => b.value - a.value);

    // Assign ranks
    let rank = 1;
    for (const e of validEntries) {
      e.rank = rank++;
    }

    // Apply limit if specified
    const limited =
      typeof limit === 'number' && limit > 0 ? validEntries.slice(0, limit) : validEntries;

    return {
      fromDate: overview.fromDate,
      toDate: overview.toDate,
      metric,
      entries: limited,
    };
  }

  /**
   * Resolve date range with defaults (today if omitted)
   */
  private resolveDateRange(
    startDate?: string,
    endDate?: string,
  ): { from: Date; to: Date } {
    const now = new Date();

    let start: Date;
    let end: Date;

    if (startDate) {
      start = new Date(startDate);
    } else {
      // Default to start of today (UTC)
      start = new Date(now);
    }

    if (endDate) {
      end = new Date(endDate);
    } else {
      // Default to end of today (UTC)
      end = new Date(now);
    }

    // Normalize to full days (start of day to start of next day)
    const from = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 0, 0, 0),
    );
    const to = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() + 1, 0, 0, 0),
    );

    return { from, to };
  }

  /**
   * E22-S2: Get waste value per branch from Wastage table
   * Computes waste cost = qty × unitCost from StockBatch
   */
  private async getWasteByBranch(
    orgId: string,
    from: Date,
    to: Date,
  ): Promise<BranchWasteMap> {
    // Fetch wastage records with item cost from stock batches
    const wastageRecords = await this.prisma.wastage.findMany({
      where: {
        orgId,
        createdAt: { gte: from, lt: to },
      },
      select: {
        branchId: true,
        qty: true,
        item: {
          select: {
            stockBatches: {
              where: {
                branchId: {
                  not: undefined, // Match by branch
                },
              },
              orderBy: {
                receivedAt: 'desc',
              },
              take: 1,
              select: {
                unitCost: true,
              },
            },
          },
        },
      },
    });

    const map: BranchWasteMap = {};

    for (const record of wastageRecords) {
      const cost = record.item.stockBatches[0]?.unitCost ?? 0;
      const wasteCents = Number(record.qty) * Number(cost) * 100; // Convert to cents

      if (!map[record.branchId]) {
        map[record.branchId] = 0;
      }
      map[record.branchId] += wasteCents;
    }

    return map;
  }

  /**
   * E22-S2: Get shrinkage value per branch from stock count discrepancies
   * Shrinkage = (expected - actual) × unitCost for negative variances
   */
  private async getShrinkByBranch(
    orgId: string,
    from: Date,
    to: Date,
  ): Promise<BranchShrinkMap> {
    // Fetch stock count records for the period
    const stockCounts = await this.prisma.client.stockCount.findMany({
      where: {
        orgId,
        countedAt: { gte: from, lt: to },
      },
      select: {
        branchId: true,
        lines: true, // JSON: [{ itemId, countedQty, expectedQty }]
      },
    });

    const map: BranchShrinkMap = {};

    for (const count of stockCounts) {
      const lines = count.lines as any[];
      if (!Array.isArray(lines)) continue;

      for (const line of lines) {
        const { itemId, countedQty, expectedQty } = line;
        if (typeof countedQty !== 'number' || typeof expectedQty !== 'number') continue;

        const variance = expectedQty - countedQty;
        if (variance <= 0) continue; // Only count shrinkage (loss)

        // Fetch item cost from stock batch
        const batch = await this.prisma.client.stockBatch.findFirst({
          where: {
            branchId: count.branchId,
            itemId,
          },
          orderBy: {
            receivedAt: 'desc',
          },
          select: {
            unitCost: true,
          },
        });

        const cost = batch?.unitCost ?? 0;
        const shrinkCents = variance * Number(cost) * 100; // Convert to cents

        if (!map[count.branchId]) {
          map[count.branchId] = 0;
        }
        map[count.branchId] += shrinkCents;
      }
    }

    return map;
  }

  /**
   * E22-S2: Get average staff KPI composite score per branch
   * Uses staff insights composite score (performance 70% + reliability 30%)
   */
  private async getStaffScoreByBranch(
    orgId: string,
    from: Date,
    to: Date,
  ): Promise<BranchStaffScoreMap> {
    // Fetch staff awards (which contain composite scores)
    const awards = await this.prisma.staffAward.findMany({
      where: {
        orgId,
        periodStart: { gte: from },
        periodEnd: { lt: to },
      },
      select: {
        branchId: true,
        score: true,
      },
    });

    const branchScores: { [branchId: string]: number[] } = {};

    for (const award of awards) {
      if (!award.branchId) continue;

      if (!branchScores[award.branchId]) {
        branchScores[award.branchId] = [];
      }
      branchScores[award.branchId].push(Number(award.score) * 100); // Convert 0-1 to 0-100
    }

    const map: BranchStaffScoreMap = {};

    for (const branchId in branchScores) {
      const scores = branchScores[branchId];
      const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      map[branchId] = avgScore;
    }

    return map;
  }

  /**
   * Extract metric value from branch KPI
   */
  private getMetricValue(
    metric: FranchiseRankingMetric,
    branch: FranchiseBranchKpiDto,
  ): number {
    switch (metric) {
      case FranchiseRankingMetric.NET_SALES:
        return branch.netSales ?? 0;
      case FranchiseRankingMetric.MARGIN_PERCENT:
        return branch.marginPercent ?? 0;
      case FranchiseRankingMetric.WASTE_PERCENT:
        return branch.wastePercent ?? 0;
      case FranchiseRankingMetric.SHRINKAGE_PERCENT:
        return branch.shrinkagePercent ?? 0;
      case FranchiseRankingMetric.STAFF_KPI_SCORE:
        return branch.staffKpiScore ?? 0;
      default:
        return 0;
    }
  }

  /**
   * E22-S3: Get budgets for org with optional filters
   * TODO: BranchBudget schema mismatch - needs refactoring to match current schema
   */
  async getBudgetsForOrg(
    orgId: string,
    filter: FranchiseBudgetFilterDto,
  ): Promise<FranchiseBudgetDto[]> {
    // Stub: BranchBudget schema doesn't have year/month/category/amountCents fields
    // Use FranchiseService.getBudgets() for actual budget data
    return [];
  }

  /**
   * E22-S3: Bulk upsert budgets (idempotent)
   * TODO: BranchBudget schema mismatch - needs refactoring
   */
  async upsertBudgetsForOrg(
    orgId: string,
    payload: FranchiseBudgetUpsertDto,
  ): Promise<void> {
    // Stub: BranchBudget schema doesn't match expected structure
    // Use FranchiseService.upsertBudget() for actual budget updates
    return;
  }

  /**
   * E22-S3: Get budget vs actual variance for a specific month
   * TODO: BranchBudget schema mismatch - needs refactoring
   */
  async getBudgetVarianceForOrg(
    orgId: string,
    query: FranchiseBudgetVarianceQueryDto,
  ): Promise<FranchiseBudgetVarianceResponseDto> {
    const { year, month } = query;
    // Stub: BranchBudget schema doesn't have year/month/category/amountCents fields
    return { year, month, branches: [] };
  }

  // E22-S5: Forecast helpers and methods

  private getMonthRange(year: number, month: number): { from: Date; to: Date } {
    // month is 1–12; Date.UTC month is 0–11
    const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)); // exclusive
    return { from, to };
  }

  async getForecastForOrg(
    orgId: string,
    query: FranchiseForecastQueryDto,
  ): Promise<FranchiseForecastResponseDto> {
    const { year, month } = query;
    const lookbackMonths = query.lookbackMonths ?? 3;

    const targetRange = this.getMonthRange(year, month);

    // Lookback starts lookbackMonths before the target month
    const lookbackStartMonth = month - lookbackMonths;
    const lookbackYearOffset = Math.floor((lookbackStartMonth - 1) / 12);
    const normalizedStartMonth =
      ((lookbackStartMonth - 1) % 12 + 12) % 12 + 1; // 1–12
    const lookbackYear = year + lookbackYearOffset;

    const lookbackRange = this.getMonthRange(lookbackYear, normalizedStartMonth);

    const branchFilter =
      query.branchIds && query.branchIds.length
        ? { in: query.branchIds }
        : undefined;

    // 1) Fetch closed orders in lookback window
    const orders = await this.prisma.order.findMany({
      where: {
        branch: { orgId },
        status: 'CLOSED', // adapt to final states if you have multiple
        branchId: branchFilter ? branchFilter : undefined,
        createdAt: {
          gte: lookbackRange.from,
          lt: targetRange.from, // lookback ends where target month starts
        },
      },
      select: {
        branchId: true,
        createdAt: true,
        total: true,
        branch: {
          select: { id: true, name: true },
        },
      },
    });

    if (orders.length === 0) {
      return {
        year,
        month,
        lookbackMonths,
        branches: [],
      };
    }

    // 2) Group by branch + weekday
    type BranchWeekdayKey = string; // `${branchId}:${weekday}`

    const weekdaySums = new Map<BranchWeekdayKey, number>();
    const weekdayCounts = new Map<BranchWeekdayKey, number>();
    const branchNames = new Map<string, string>();

    for (const order of orders) {
      const branchId = order.branchId;
      const name = order.branch?.name ?? 'Unknown';
      branchNames.set(branchId, name);

      const weekday = order.createdAt.getUTCDay(); // 0–6
      const key = `${branchId}:${weekday}`;

      const prevSum = weekdaySums.get(key) ?? 0;
      const prevCount = weekdayCounts.get(key) ?? 0;

      weekdaySums.set(key, prevSum + Number(order.total ?? 0));
      weekdayCounts.set(key, prevCount + 1);
    }

    // 3) Precompute per-branch historical totals & coverage
    const branchHistoricalTotals = new Map<string, number>();
    const branchCoverageDays = new Map<string, number>();

    for (const order of orders) {
      const branchId = order.branchId;
      const prevTotal = branchHistoricalTotals.get(branchId) ?? 0;
      branchHistoricalTotals.set(branchId, prevTotal + Number(order.total ?? 0));
    }

    for (const [key, count] of weekdayCounts.entries()) {
      const [branchId] = key.split(':');
      const prev = branchCoverageDays.get(branchId) ?? 0;
      branchCoverageDays.set(branchId, prev + count);
    }

    // 4) Iterate each day of target month and sum forecast = avg net sales for that weekday
    const branchesSet = new Set<string>(orders.map((o) => o.branchId));
    const branchForecastSums = new Map<string, number>();

    for (const branchId of branchesSet) {
      branchForecastSums.set(branchId, 0);
    }

    for (
      let d = new Date(targetRange.from.getTime());
      d < targetRange.to;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const weekday = d.getUTCDay();

      for (const branchId of branchesSet) {
        const key = `${branchId}:${weekday}`;
        const sum = weekdaySums.get(key);
        const count = weekdayCounts.get(key);

        if (!sum || !count) {
          continue;
        }

        const avg = sum / count;
        const prev = branchForecastSums.get(branchId) ?? 0;
        branchForecastSums.set(branchId, prev + avg);
      }
    }

    // 5) Build response objects
    const branches: FranchiseForecastBranchDto[] = [];

    for (const branchId of branchesSet) {
      const branchName = branchNames.get(branchId) ?? 'Unknown';

      const historicalNetSalesCents = branchHistoricalTotals.get(branchId) ?? 0;
      const coverageDays = branchCoverageDays.get(branchId) ?? 0;

      const forecastNetSalesCents = Math.round(
        branchForecastSums.get(branchId) ?? 0,
      );

      const avgDaily =
        coverageDays > 0
          ? Math.round(historicalNetSalesCents / coverageDays)
          : 0;

      branches.push({
        branchId,
        branchName,
        year,
        month,
        forecastNetSalesCents,
        historicalNetSalesCents,
        avgDailyNetSalesCents: avgDaily,
        coverageDays,
      });
    }

    // Optional: sort by forecast descending
    branches.sort(
      (a, b) => b.forecastNetSalesCents - a.forecastNetSalesCents,
    );

    return {
      year,
      month,
      lookbackMonths,
      branches,
    };
  }

  // E22-S6: CSV Export Methods

  /**
   * Export franchise overview data as CSV
   */
  async getOverviewCsvForOrg(
    orgId: string,
    query: FranchiseOverviewQueryDto,
  ): Promise<string> {
    const overview = await this.getOverviewForOrg(orgId, query);

    const headers = [
      'branchId',
      'branchName',
      'grossSalesCents',
      'netSalesCents',
      'totalOrders',
      'avgCheckCents',
      'totalGuests',
      'marginAmountCents',
      'marginPercent',
      'cancelledOrders',
      'voidedOrders',
      'wasteValueCents',
      'shrinkValueCents',
      'wastePercent',
      'shrinkagePercent',
      'staffKpiScore',
    ];

    const rows = overview.branches.map((b) => [
      b.branchId,
      b.branchName,
      b.grossSales ?? 0,
      b.netSales ?? 0,
      b.totalOrders ?? 0,
      b.avgCheck ?? 0,
      b.totalGuests ?? 0,
      b.marginAmount ?? 0,
      b.marginPercent ?? 0,
      b.cancelledOrders ?? 0,
      b.voidedOrders ?? 0,
      b.wasteValue ?? 0,
      b.shrinkValue ?? 0,
      b.wastePercent ?? 0,
      b.shrinkagePercent ?? 0,
      b.staffKpiScore ?? 0,
    ]);

    return toCsvString(headers, rows);
  }

  /**
   * Export franchise rankings data as CSV
   */
  async getRankingsCsvForOrg(
    orgId: string,
    query: FranchiseRankingsQueryDto,
  ): Promise<string> {
    const result = await this.getRankingsForOrg(orgId, query);

    const headers = ['metric', 'rank', 'branchId', 'branchName', 'value'];

    const rows = result.entries.map((e) => [
      result.metric,
      e.rank,
      e.branchId,
      e.branchName,
      e.value,
    ]);

    return toCsvString(headers, rows);
  }

  /**
   * Export franchise budgets data as CSV
   */
  async getBudgetsCsvForOrg(
    orgId: string,
    query: FranchiseBudgetFilterDto,
  ): Promise<string> {
    const budgets = await this.getBudgetsForOrg(orgId, query);

    const headers = [
      'branchId',
      'branchName',
      'year',
      'month',
      'category',
      'amountCents',
      'currencyCode',
    ];

    const rows = budgets.map((b) => [
      b.branchId,
      b.branchName,
      b.year,
      b.month,
      b.category,
      b.amountCents,
      b.currencyCode,
    ]);

    return toCsvString(headers, rows);
  }

  /**
   * Export franchise budget variance data as CSV
   */
  async getBudgetVarianceCsvForOrg(
    orgId: string,
    query: FranchiseBudgetVarianceQueryDto,
  ): Promise<string> {
    const result = await this.getBudgetVarianceForOrg(orgId, query);

    const headers = [
      'branchId',
      'branchName',
      'year',
      'month',
      'budgetAmountCents',
      'actualNetSalesCents',
      'varianceAmountCents',
      'variancePercent',
    ];

    const rows = result.branches.map((b) => [
      b.branchId,
      b.branchName,
      result.year,
      result.month,
      b.budgetAmountCents,
      b.actualNetSalesCents,
      b.varianceAmountCents,
      b.variancePercent,
    ]);

    return toCsvString(headers, rows);
  }

  /**
   * Export franchise forecast data as CSV
   * E22-S7: Forecast CSV export for HQ reporting
   */
  async getForecastCsvForOrg(
    orgId: string,
    query: FranchiseForecastQueryDto,
  ): Promise<string> {
    const result: FranchiseForecastResponseDto =
      await this.getForecastForOrg(orgId, query);

    const headers = [
      'branchId',
      'branchName',
      'year',
      'month',
      'lookbackMonths',
      'forecastNetSalesCents',
      'historicalNetSalesCents',
      'avgDailyNetSalesCents',
      'coverageDays',
    ];

    const rows = result.branches.map((b) => [
      b.branchId,
      b.branchName,
      result.year,
      result.month,
      result.lookbackMonths,
      b.forecastNetSalesCents,
      b.historicalNetSalesCents,
      b.avgDailyNetSalesCents,
      b.coverageDays,
    ]);

    return toCsvString(headers, rows);
  }
}
