/**
 * M11.14 Demand Series Service
 * 
 * Extracts and normalizes historical demand data from inventory ledger entries.
 * 
 * Demand sources (H1 validation):
 * - SALE: Point-of-sale consumption
 * - PRODUCTION_CONSUME: Recipe-based consumption
 * 
 * Excluded from demand (non-consumption reasons):
 * - COUNT_VARIANCE, COUNT_VARIANCE_REVERSAL, ADJUSTMENT, COUNT_ADJUSTMENT
 * - WASTAGE, PURCHASE, RECEIVE, TRANSFER_IN, TRANSFER_OUT
 * - VENDOR_RETURN, PRODUCTION_PRODUCE, INITIAL, CYCLE_COUNT
 * 
 * Key features:
 * - Day bucketing respects branch timezone (H8 validation)
 * - Cross-branch isolation enforced (H2 validation)
 * - Deterministic output ordering for stable hashes (H9 validation)
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';
import { LedgerEntryReason } from './inventory-ledger.service';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const ZERO = new Decimal(0);

// Demand-contributing reasons (consumption only)
export const DEMAND_REASONS: string[] = [
  LedgerEntryReason.SALE,
  LedgerEntryReason.PRODUCTION_CONSUME,
];

export interface DailyDemandPoint {
  date: string; // ISO date string (YYYY-MM-DD)
  qty: Decimal;
}

export interface DemandSeriesResult {
  itemId: string;
  branchId: string;
  dataPoints: DailyDemandPoint[];
  totalDemand: Decimal;
  dayCount: number;
  minDate: string | null;
  maxDate: string | null;
}

export interface DemandSeriesOptions {
  windowDays: number; // Lookback window (default: 14)
  endDate?: Date; // End of window (default: now)
  itemIds?: string[]; // Optional filter to specific items
}

@Injectable()
export class InventoryDemandSeriesService {
  private readonly logger = new Logger(InventoryDemandSeriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get daily demand series for items at a branch
   * 
   * @param orgId - Organization ID (tenant isolation - H2)
   * @param branchId - Branch ID (branch isolation - H2)
   * @param options - Window configuration
   * @returns Demand series per item with daily breakdown
   */
  async getDemandSeries(
    orgId: string,
    branchId: string,
    options: DemandSeriesOptions,
  ): Promise<Map<string, DemandSeriesResult>> {
    const { windowDays = 14, endDate = new Date(), itemIds } = options;

    // Get branch timezone for day bucketing (H8)
    const branch = await this.prisma.client.branch.findUnique({
      where: { id: branchId },
      select: { timezone: true },
    });
    const timezone = branch?.timezone || 'UTC';

    // Calculate window start date
    const windowEnd = new Date(endDate);
    const windowStart = new Date(windowEnd);
    windowStart.setDate(windowStart.getDate() - windowDays);

    this.logger.debug(
      `Extracting demand series: branch=${branchId}, window=${windowDays} days, ` +
      `from=${windowStart.toISOString()} to=${windowEnd.toISOString()}, timezone=${timezone}`,
    );

    // Build where clause with tenant/branch isolation (H2)
    const where: Prisma.InventoryLedgerEntryWhereInput = {
      orgId,
      branchId,
      reason: { in: DEMAND_REASONS },
      createdAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    };

    if (itemIds?.length) {
      where.itemId = { in: itemIds };
    }

    // Fetch raw ledger entries for demand (H1)
    const entries = await this.prisma.client.inventoryLedgerEntry.findMany({
      where,
      select: {
        itemId: true,
        qty: true,
        createdAt: true,
      },
      orderBy: [
        { itemId: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    this.logger.debug(`Found ${entries.length} demand entries in window`);

    // Group by item and day (H8 - timezone-aware bucketing)
    const seriesMap = new Map<string, Map<string, Decimal>>();

    for (const entry of entries) {
      // Convert to branch timezone and extract date
      const dateStr = this.toLocalDate(entry.createdAt, timezone);
      
      // Demand is always positive (SALE/PRODUCTION_CONSUME have negative qty in ledger)
      // So we take absolute value
      const demandQty = new Decimal(entry.qty).abs();

      if (!seriesMap.has(entry.itemId)) {
        seriesMap.set(entry.itemId, new Map());
      }

      const dayMap = seriesMap.get(entry.itemId)!;
      const existing = dayMap.get(dateStr) || ZERO;
      dayMap.set(dateStr, existing.plus(demandQty));
    }

    // Convert to structured result (H9 - stable ordering)
    const results = new Map<string, DemandSeriesResult>();

    for (const [itemId, dayMap] of seriesMap) {
      // Sort dates for deterministic output
      const sortedDates = Array.from(dayMap.keys()).sort();
      
      const dataPoints: DailyDemandPoint[] = sortedDates.map((date) => ({
        date,
        qty: dayMap.get(date)!,
      }));

      const totalDemand = dataPoints.reduce((sum, dp) => sum.plus(dp.qty), ZERO);

      results.set(itemId, {
        itemId,
        branchId,
        dataPoints,
        totalDemand,
        dayCount: dataPoints.length,
        minDate: sortedDates[0] || null,
        maxDate: sortedDates[sortedDates.length - 1] || null,
      });
    }

    // Ensure result map is sorted by itemId for determinism
    const sortedResults = new Map<string, DemandSeriesResult>();
    const sortedItemIds = Array.from(results.keys()).sort();
    for (const itemId of sortedItemIds) {
      sortedResults.set(itemId, results.get(itemId)!);
    }

    this.logger.debug(`Extracted demand series for ${sortedResults.size} items`);

    return sortedResults;
  }

  /**
   * Get demand series for a single item
   */
  async getItemDemandSeries(
    orgId: string,
    branchId: string,
    itemId: string,
    options: Omit<DemandSeriesOptions, 'itemIds'>,
  ): Promise<DemandSeriesResult | null> {
    const results = await this.getDemandSeries(orgId, branchId, {
      ...options,
      itemIds: [itemId],
    });

    return results.get(itemId) || null;
  }

  /**
   * Get aggregate demand summary for all active items at a branch
   * Useful for dashboard and bulk forecast generation
   */
  async getDemandSummary(
    orgId: string,
    branchId: string,
    windowDays: number = 14,
  ): Promise<{
    totalItems: number;
    itemsWithDemand: number;
    totalDemandQty: Decimal;
    avgDailyDemand: Decimal;
  }> {
    const series = await this.getDemandSeries(orgId, branchId, { windowDays });

    let totalDemandQty = ZERO;
    let totalDays = 0;

    for (const result of series.values()) {
      totalDemandQty = totalDemandQty.plus(result.totalDemand);
      totalDays += result.dayCount;
    }

    const avgDailyDemand = totalDays > 0
      ? totalDemandQty.dividedBy(windowDays)
      : ZERO;

    // Get total active items count
    const totalItems = await this.prisma.client.inventoryItem.count({
      where: { orgId, isActive: true },
    });

    return {
      totalItems,
      itemsWithDemand: series.size,
      totalDemandQty,
      avgDailyDemand,
    };
  }

  /**
   * Convert UTC date to local date string in branch timezone (H8)
   * 
   * Uses Intl.DateTimeFormat for reliable timezone conversion
   */
  private toLocalDate(date: Date, timezone: string): string {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(date); // Returns YYYY-MM-DD format
    } catch (e) {
      // Fallback to UTC if timezone is invalid
      this.logger.warn(`Invalid timezone "${timezone}", falling back to UTC`);
      return date.toISOString().split('T')[0];
    }
  }
}
