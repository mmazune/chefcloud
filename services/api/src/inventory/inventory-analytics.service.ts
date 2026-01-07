/**
 * Inventory Analytics Service
 * 
 * Provides COGS, stock valuation, and wastage analytics.
 * M11.12: Extended with Shrink/Variance, Dead Stock, Expiry Risk, Reorder Health KPIs.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';

const Decimal = Prisma.Decimal;

export interface COGSTimeseriesPoint {
  date: string;
  cogs: number;
  orderCount: number;
  revenue: number;
  grossMargin: number;
  grossMarginPct: number;
}

export interface StockValuationPoint {
  category: string;
  totalQty: number;
  totalValue: number;
  itemCount: number;
}

export interface WastageSummaryPoint {
  date: string;
  wastageValue: number;
  wastageQty: number;
  itemCount: number;
}

// ============================================
// M11.12 Analytics DTOs
// ============================================

export interface AnalyticsFilters {
  branchId?: string;
  locationId?: string;
  itemId?: string;
  from?: Date;
  to?: Date;
}

export interface ShrinkResult {
  branchId: string;
  branchName: string;
  locationId: string;
  locationName: string;
  itemId: string;
  itemName: string;
  sku: string | null;
  varianceQty: string;
  varianceValue: string;
  sessionCount: number;
}

export interface DeadStockResult {
  branchId: string;
  branchName: string;
  itemId: string;
  itemName: string;
  sku: string | null;
  onHand: string;
  lastMovementDate: Date | null;
  daysSinceMovement: number;
}

export interface ExpiryRiskResult {
  bucket: 'expired' | 'within7' | 'within30' | 'within60';
  lotCount: number;
  totalQty: string;
  lots: {
    lotId: string;
    lotNumber: string;
    itemId: string;
    itemName: string;
    expiryDate: Date;
    daysToExpiry: number;
    qty: string;
    status: string;
  }[];
}

export interface ReorderHealthResult {
  belowReorderCount: number;
  suggestionRunsTotal: number;
  suggestionsActionedCount: number;
  itemsBelowReorder: {
    itemId: string;
    itemName: string;
    sku: string | null;
    onHand: string;
    reorderLevel: string;
    shortfall: string;
  }[];
}

export interface AnalyticsSummary {
  shrink: {
    totalVarianceQty: string;
    totalVarianceValue: string;
    itemCount: number;
  };
  waste: {
    totalWasteQty: string;
    totalWasteValue: string;
    topItemsCount: number;
  };
  deadStock: {
    itemCount: number;
    totalOnHand: string;
  };
  expiryRisk: {
    expiredCount: number;
    within7Count: number;
    within30Count: number;
    within60Count: number;
  };
  reorderHealth: {
    belowReorderCount: number;
    suggestionRunsTotal: number;
  };
}

@Injectable()
export class InventoryAnalyticsService {
  private readonly logger = new Logger(InventoryAnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get COGS timeseries for a branch
   */
  async getCOGSTimeseries(
    branchId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<COGSTimeseriesPoint[]> {
    // Get COGS from SALE stock movements grouped by day
    const cogsData = await this.prisma.client.$queryRaw<Array<{
      date: Date;
      cogs: Prisma.Decimal;
      movementCount: bigint;
    }>>`
      SELECT 
        DATE(created_at) as date,
        SUM(cost) as cogs,
        COUNT(*) as movement_count
      FROM stock_movements
      WHERE branch_id = ${branchId}
        AND type = 'SALE'
        AND created_at >= ${fromDate}
        AND created_at <= ${toDate}
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `;

    // Get revenue from orders grouped by day
    const revenueData = await this.prisma.client.$queryRaw<Array<{
      date: Date;
      revenue: Prisma.Decimal;
      orderCount: bigint;
    }>>`
      SELECT 
        DATE(created_at) as date,
        SUM(total) as revenue,
        COUNT(*) as order_count
      FROM orders
      WHERE branch_id = ${branchId}
        AND status IN ('COMPLETED', 'PAID', 'DELIVERED')
        AND created_at >= ${fromDate}
        AND created_at <= ${toDate}
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `;

    // Merge COGS and revenue data
    const dataByDate = new Map<string, COGSTimeseriesPoint>();

    for (const row of cogsData) {
      const dateStr = row.date.toISOString().split('T')[0];
      dataByDate.set(dateStr, {
        date: dateStr,
        cogs: Number(row.cogs),
        orderCount: 0,
        revenue: 0,
        grossMargin: 0,
        grossMarginPct: 0,
      });
    }

    for (const row of revenueData) {
      const dateStr = row.date.toISOString().split('T')[0];
      const point = dataByDate.get(dateStr) || {
        date: dateStr,
        cogs: 0,
        orderCount: 0,
        revenue: 0,
        grossMargin: 0,
        grossMarginPct: 0,
      };

      point.orderCount = Number(row.orderCount);
      point.revenue = Number(row.revenue);
      point.grossMargin = point.revenue - point.cogs;
      point.grossMarginPct = point.revenue > 0 
        ? (point.grossMargin / point.revenue) * 100 
        : 0;

      dataByDate.set(dateStr, point);
    }

    return Array.from(dataByDate.values()).sort((a, b) => 
      a.date.localeCompare(b.date)
    );
  }

  /**
   * Get stock valuation by category as of a specific date
   */
  async getStockValuation(
    branchId: string,
    asOfDate: Date,
  ): Promise<StockValuationPoint[]> {
    const valuationData = await this.prisma.client.$queryRaw<Array<{
      category: string;
      totalQty: Prisma.Decimal;
      totalValue: Prisma.Decimal;
      itemCount: bigint;
    }>>`
      SELECT 
        ii.category,
        SUM(sb.remaining_qty) as total_qty,
        SUM(sb.remaining_qty * sb.unit_cost) as total_value,
        COUNT(DISTINCT ii.id) as item_count
      FROM stock_batches sb
      INNER JOIN inventory_items ii ON ii.id = sb.item_id
      WHERE sb.branch_id = ${branchId}
        AND sb.received_at <= ${asOfDate}
        AND sb.remaining_qty > 0
      GROUP BY ii.category
      ORDER BY total_value DESC
    `;

    return valuationData.map(row => ({
      category: row.category,
      totalQty: Number(row.totalQty),
      totalValue: Number(row.totalValue),
      itemCount: Number(row.itemCount),
    }));
  }

  /**
   * Get wastage summary for a date range
   */
  async getWastageSummary(
    branchId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<WastageSummaryPoint[]> {
    const wastageData = await this.prisma.client.$queryRaw<Array<{
      date: Date;
      wastageValue: Prisma.Decimal;
      wastageQty: Prisma.Decimal;
      itemCount: bigint;
    }>>`
      SELECT 
        DATE(sm.created_at) as date,
        SUM(sm.cost) as wastage_value,
        SUM(ABS(sm.qty)) as wastage_qty,
        COUNT(DISTINCT sm.item_id) as item_count
      FROM stock_movements sm
      WHERE sm.branch_id = ${branchId}
        AND sm.type = 'WASTAGE'
        AND sm.created_at >= ${fromDate}
        AND sm.created_at <= ${toDate}
      GROUP BY DATE(sm.created_at)
      ORDER BY DATE(sm.created_at)
    `;

    return wastageData.map(row => ({
      date: row.date.toISOString().split('T')[0],
      wastageValue: Number(row.wastageValue),
      wastageQty: Number(row.wastageQty),
      itemCount: Number(row.itemCount),
    }));
  }

  /**
   * Get org-wide COGS timeseries (all branches)
   */
  async getOrgCOGSTimeseries(
    orgId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<COGSTimeseriesPoint[]> {
    const cogsData = await this.prisma.client.$queryRaw<Array<{
      date: Date;
      cogs: Prisma.Decimal;
      movementCount: bigint;
    }>>`
      SELECT 
        DATE(created_at) as date,
        SUM(cost) as cogs,
        COUNT(*) as movement_count
      FROM stock_movements
      WHERE org_id = ${orgId}
        AND type = 'SALE'
        AND created_at >= ${fromDate}
        AND created_at <= ${toDate}
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `;

    const revenueData = await this.prisma.client.$queryRaw<Array<{
      date: Date;
      revenue: Prisma.Decimal;
      orderCount: bigint;
    }>>`
      SELECT 
        DATE(o.created_at) as date,
        SUM(o.total) as revenue,
        COUNT(*) as order_count
      FROM orders o
      INNER JOIN branches b ON b.id = o.branch_id
      WHERE b.org_id = ${orgId}
        AND o.status IN ('COMPLETED', 'PAID', 'DELIVERED')
        AND o.created_at >= ${fromDate}
        AND o.created_at <= ${toDate}
      GROUP BY DATE(o.created_at)
      ORDER BY DATE(o.created_at)
    `;

    const dataByDate = new Map<string, COGSTimeseriesPoint>();

    for (const row of cogsData) {
      const dateStr = row.date.toISOString().split('T')[0];
      dataByDate.set(dateStr, {
        date: dateStr,
        cogs: Number(row.cogs),
        orderCount: 0,
        revenue: 0,
        grossMargin: 0,
        grossMarginPct: 0,
      });
    }

    for (const row of revenueData) {
      const dateStr = row.date.toISOString().split('T')[0];
      const point = dataByDate.get(dateStr) || {
        date: dateStr,
        cogs: 0,
        orderCount: 0,
        revenue: 0,
        grossMargin: 0,
        grossMarginPct: 0,
      };

      point.orderCount = Number(row.orderCount);
      point.revenue = Number(row.revenue);
      point.grossMargin = point.revenue - point.cogs;
      point.grossMarginPct = point.revenue > 0 
        ? (point.grossMargin / point.revenue) * 100 
        : 0;

      dataByDate.set(dateStr, point);
    }

    return Array.from(dataByDate.values()).sort((a, b) => 
      a.date.localeCompare(b.date)
    );
  }

  // ============================================
  // M11.12: A1. Shrink / Variance
  // ============================================

  async getShrinkData(
    orgId: string,
    filters: AnalyticsFilters,
  ): Promise<ShrinkResult[]> {
    this.logger.log(`Getting shrink data for org ${orgId}`);

    const where: Prisma.StocktakeLineWhereInput = {
      session: {
        orgId,
        status: 'POSTED',
        ...(filters.branchId && { branchId: filters.branchId }),
        ...(filters.from && { postedAt: { gte: filters.from } }),
        ...(filters.to && { postedAt: { lte: filters.to } }),
      },
      ...(filters.locationId && { locationId: filters.locationId }),
      ...(filters.itemId && { itemId: filters.itemId }),
      variance: { not: new Decimal(0) },
    };

    const lines = await this.prisma.client.stocktakeLine.findMany({
      where,
      include: {
        session: {
          include: { branch: { select: { name: true } } },
        },
        item: { select: { name: true, sku: true } },
        location: { select: { name: true } },
      },
    });

    // Aggregate by branch/location/item
    const aggregated = new Map<string, ShrinkResult>();

    for (const line of lines) {
      const key = `${line.session.branchId}:${line.locationId}:${line.itemId}`;
      const existing = aggregated.get(key);
      const varianceQty = new Decimal(line.variance?.toString() ?? '0');
      // Use the varianceValue calculated when stocktake was posted
      const varianceValue = new Decimal(line.varianceValue?.toString() ?? '0');

      if (existing) {
        existing.varianceQty = new Decimal(existing.varianceQty)
          .plus(varianceQty)
          .toFixed(4);
        existing.varianceValue = new Decimal(existing.varianceValue)
          .plus(varianceValue)
          .toFixed(4);
        existing.sessionCount += 1;
      } else {
        aggregated.set(key, {
          branchId: line.session.branchId,
          branchName: line.session.branch?.name ?? 'Unknown',
          locationId: line.locationId,
          locationName: line.location?.name ?? 'Unknown',
          itemId: line.itemId,
          itemName: line.item.name,
          sku: line.item.sku,
          varianceQty: varianceQty.toFixed(4),
          varianceValue: varianceValue.toFixed(4),
          sessionCount: 1,
        });
      }
    }

    return Array.from(aggregated.values());
  }

  // ============================================
  // M11.12: A3. Dead Stock (H2: Include all movement types)
  // ============================================

  async getDeadStockData(
    orgId: string,
    filters: AnalyticsFilters & { deadStockDays?: number },
  ): Promise<DeadStockResult[]> {
    const deadStockDays = filters.deadStockDays ?? 30;
    this.logger.log(`Getting dead stock for org ${orgId}, threshold ${deadStockDays} days`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - deadStockDays);

    // Get items with on-hand > 0
    const items = await this.prisma.client.inventoryItem.findMany({
      where: {
        orgId,
        isActive: true,
        ...(filters.itemId && { id: filters.itemId }),
      },
      select: {
        id: true,
        name: true,
        sku: true,
      },
    });

    const results: DeadStockResult[] = [];

    for (const item of items) {
      // Get on-hand by branch (or specific branch)
      const ledgerWhere: Prisma.InventoryLedgerEntryWhereInput = {
        orgId,
        itemId: item.id,
        ...(filters.branchId && { branchId: filters.branchId }),
      };

      // Calculate on-hand
      const onHandAgg = await this.prisma.client.inventoryLedgerEntry.aggregate({
        where: ledgerWhere,
        _sum: { qty: true },
      });

      const onHand = new Decimal(onHandAgg._sum.qty?.toString() ?? '0');

      if (onHand.lte(0)) continue;

      // H2: Check last movement excluding COUNT_VARIANCE types
      const lastMovement = await this.prisma.client.inventoryLedgerEntry.findFirst({
        where: {
          ...ledgerWhere,
          reason: {
            notIn: ['COUNT_VARIANCE', 'COUNT_VARIANCE_REVERSAL'],
          },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, branchId: true },
      });

      if (lastMovement && lastMovement.createdAt >= cutoffDate) {
        continue; // Has recent movement, not dead stock
      }

      const daysSinceMovement = lastMovement
        ? Math.floor(
            (Date.now() - lastMovement.createdAt.getTime()) / (1000 * 60 * 60 * 24),
          )
        : 9999;

      // Get branch name
      const branchId = filters.branchId ?? lastMovement?.branchId ?? 'unknown';
      let branchName = 'Unknown';
      if (branchId !== 'unknown') {
        const branch = await this.prisma.client.branch.findUnique({
          where: { id: branchId },
          select: { name: true },
        });
        branchName = branch?.name ?? 'Unknown';
      }

      results.push({
        branchId,
        branchName,
        itemId: item.id,
        itemName: item.name,
        sku: item.sku,
        onHand: onHand.toFixed(4),
        lastMovementDate: lastMovement?.createdAt ?? null,
        daysSinceMovement,
      });
    }

    // Sort by days since movement descending
    results.sort((a, b) => b.daysSinceMovement - a.daysSinceMovement);

    return results;
  }

  // ============================================
  // M11.12: A4. Expiry Risk
  // ============================================

  async getExpiryRiskData(
    orgId: string,
    filters: AnalyticsFilters,
  ): Promise<ExpiryRiskResult[]> {
    this.logger.log(`Getting expiry risk for org ${orgId}`);

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const where: Prisma.InventoryLotWhereInput = {
      orgId,
      status: 'ACTIVE',
      expiryDate: { not: null },
      ...(filters.branchId && { branchId: filters.branchId }),
    };

    const lots = await this.prisma.client.inventoryLot.findMany({
      where,
      include: {
        item: { select: { name: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });

    const buckets: Record<string, ExpiryRiskResult> = {
      expired: { bucket: 'expired', lotCount: 0, totalQty: '0', lots: [] },
      within7: { bucket: 'within7', lotCount: 0, totalQty: '0', lots: [] },
      within30: { bucket: 'within30', lotCount: 0, totalQty: '0', lots: [] },
      within60: { bucket: 'within60', lotCount: 0, totalQty: '0', lots: [] },
    };

    for (const lot of lots) {
      if (!lot.expiryDate) continue;

      const daysToExpiry = Math.floor(
        (lot.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      let bucket: string;
      if (lot.expiryDate < now) {
        bucket = 'expired';
      } else if (lot.expiryDate <= in7Days) {
        bucket = 'within7';
      } else if (lot.expiryDate <= in30Days) {
        bucket = 'within30';
      } else if (lot.expiryDate <= in60Days) {
        bucket = 'within60';
      } else {
        continue; // Beyond 60 days, not in risk
      }

      const lotData = {
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        itemId: lot.itemId,
        itemName: lot.item?.name ?? 'Unknown',
        expiryDate: lot.expiryDate,
        daysToExpiry,
        qty: lot.receivedQty?.toString() ?? '0',
        status: lot.status,
      };

      buckets[bucket].lots.push(lotData);
      buckets[bucket].lotCount += 1;
      buckets[bucket].totalQty = new Decimal(buckets[bucket].totalQty)
        .plus(lot.receivedQty ?? 0)
        .toString();
    }

    return Object.values(buckets);
  }

  // ============================================
  // M11.12: A5. Reorder Health
  // ============================================

  async getReorderHealthData(
    orgId: string,
    filters: AnalyticsFilters,
  ): Promise<ReorderHealthResult> {
    this.logger.log(`Getting reorder health for org ${orgId}`);

    // Get items with reorder level set
    const items = await this.prisma.client.inventoryItem.findMany({
      where: {
        orgId,
        isActive: true,
        reorderLevel: { gt: 0 },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        reorderLevel: true,
      },
    });

    const belowReorder: ReorderHealthResult['itemsBelowReorder'] = [];

    for (const item of items) {
      // Calculate on-hand
      const ledgerWhere: Prisma.InventoryLedgerEntryWhereInput = {
        orgId,
        itemId: item.id,
        ...(filters.branchId && { branchId: filters.branchId }),
      };

      const onHandAgg = await this.prisma.client.inventoryLedgerEntry.aggregate({
        where: ledgerWhere,
        _sum: { qty: true },
      });

      const onHand = new Decimal(onHandAgg._sum.qty?.toString() ?? '0');
      const reorderLevel = new Decimal(item.reorderLevel?.toString() ?? '0');

      if (onHand.lt(reorderLevel)) {
        belowReorder.push({
          itemId: item.id,
          itemName: item.name,
          sku: item.sku,
          onHand: onHand.toFixed(4),
          reorderLevel: reorderLevel.toFixed(4),
          shortfall: reorderLevel.minus(onHand).toFixed(4),
        });
      }
    }

    // Count suggestion runs
    const suggestionRunsTotal = await this.prisma.client.reorderSuggestionRun.count({
      where: {
        orgId,
        ...(filters.branchId && { branchId: filters.branchId }),
        ...(filters.from && { createdAt: { gte: filters.from } }),
        ...(filters.to && { createdAt: { lte: filters.to } }),
      },
    });

    // Count actioned runs (those that generated at least one PO)
    const runsWithPOs = await this.prisma.client.reorderSuggestionRun.findMany({
      where: {
        orgId,
        ...(filters.branchId && { branchId: filters.branchId }),
        generatedPOs: {
          some: {},
        },
      },
      select: { id: true },
    });
    const suggestionsActionedCount = runsWithPOs.length;

    return {
      belowReorderCount: belowReorder.length,
      suggestionRunsTotal,
      suggestionsActionedCount,
      itemsBelowReorder: belowReorder,
    };
  }

  // ============================================
  // M11.12: Analytics Summary (All KPIs)
  // ============================================

  async getAnalyticsSummary(
    orgId: string,
    filters: AnalyticsFilters,
  ): Promise<AnalyticsSummary> {
    this.logger.log(`Getting analytics summary for org ${orgId}`);

    const [shrink, deadStock, expiryRisk, reorderHealth] = await Promise.all([
      this.getShrinkData(orgId, filters),
      this.getDeadStockData(orgId, { ...filters, deadStockDays: 30 }),
      this.getExpiryRiskData(orgId, filters),
      this.getReorderHealthData(orgId, filters),
    ]);

    // Get waste from existing method if branch is specified
    const wasteTotal = { qty: new Decimal(0), value: new Decimal(0), count: 0 };
    if (filters.branchId && filters.from && filters.to) {
      const wastage = await this.getWastageSummary(
        filters.branchId,
        filters.from,
        filters.to,
      );
      for (const w of wastage) {
        wasteTotal.qty = wasteTotal.qty.plus(w.wastageQty);
        wasteTotal.value = wasteTotal.value.plus(w.wastageValue);
        wasteTotal.count += w.itemCount;
      }
    }

    const totalVarianceQty = shrink.reduce(
      (sum, s) => sum.plus(s.varianceQty),
      new Decimal(0),
    );
    const totalVarianceValue = shrink.reduce(
      (sum, s) => sum.plus(s.varianceValue),
      new Decimal(0),
    );
    const totalDeadOnHand = deadStock.reduce(
      (sum, d) => sum.plus(d.onHand),
      new Decimal(0),
    );

    return {
      shrink: {
        totalVarianceQty: totalVarianceQty.toFixed(4),
        totalVarianceValue: totalVarianceValue.toFixed(4),
        itemCount: shrink.length,
      },
      waste: {
        totalWasteQty: wasteTotal.qty.toFixed(4),
        totalWasteValue: wasteTotal.value.toFixed(4),
        topItemsCount: wasteTotal.count,
      },
      deadStock: {
        itemCount: deadStock.length,
        totalOnHand: totalDeadOnHand.toFixed(4),
      },
      expiryRisk: {
        expiredCount: expiryRisk.find((b) => b.bucket === 'expired')?.lotCount ?? 0,
        within7Count: expiryRisk.find((b) => b.bucket === 'within7')?.lotCount ?? 0,
        within30Count: expiryRisk.find((b) => b.bucket === 'within30')?.lotCount ?? 0,
        within60Count: expiryRisk.find((b) => b.bucket === 'within60')?.lotCount ?? 0,
      },
      reorderHealth: {
        belowReorderCount: reorderHealth.belowReorderCount,
        suggestionRunsTotal: reorderHealth.suggestionRunsTotal,
      },
    };
  }
}
