/**
 * Inventory Analytics Service
 * 
 * Provides COGS, stock valuation, and wastage analytics.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';

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

@Injectable()
export class InventoryAnalyticsService {
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
}
