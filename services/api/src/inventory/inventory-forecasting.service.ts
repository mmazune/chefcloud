/**
 * M11.14 Forecasting Service
 * 
 * Generates demand forecasts using deterministic algorithms.
 * 
 * Forecast Model: Trailing Moving Average (TMA)
 * - Simple, explainable, auditable
 * - Configurable window sizes: 7, 14, 28 days
 * - Configurable horizon: default 14 days
 * 
 * Key features:
 * - Deterministic hash for idempotency (H4, H9)
 * - Confidence bands: ±20% of avgDailyQty
 * - Daily forecast breakdown in JSON
 * - Snapshot-based caching (immutable once created)
 */
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { InventoryDemandSeriesService, DemandSeriesResult } from './inventory-demand-series.service';
import { Prisma, ForecastModelType } from '@chefcloud/db';
import { createHash } from 'crypto';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const ZERO = new Decimal(0);

// Supported window sizes
export const VALID_WINDOW_DAYS = [7, 14, 28];
export const DEFAULT_WINDOW_DAYS = 14;
export const DEFAULT_HORIZON_DAYS = 14;
export const CONFIDENCE_BAND_PCT = 0.2; // ±20%

export interface ForecastInput {
  itemId: string;
  demandSeries?: DemandSeriesResult; // Pre-computed or will be fetched
}

export interface ForecastOutputPoint {
  date: string;
  qty: number;
  low: number;
  high: number;
}

export interface ForecastOutput {
  itemId: string;
  avgDailyQty: Decimal;
  forecastTotalQty: Decimal;
  confidenceLow: Decimal;
  confidenceHigh: Decimal;
  dailyForecast: ForecastOutputPoint[];
  dataPoints: number;
  lastObservedDate: Date | null;
  deterministicHash: string;
}

export interface GenerateSnapshotOptions {
  windowDays?: number;
  horizonDays?: number;
  itemIds?: string[]; // Optional filter
}

export interface GenerateSnapshotResult {
  snapshotIds: string[];
  itemsProcessed: number;
  created: number;
  skipped: number; // Already existed (idempotent)
}

@Injectable()
export class InventoryForecastingService {
  private readonly logger = new Logger(InventoryForecastingService.name);
  private readonly modelVersion = '1.0.0';

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly demandSeriesService: InventoryDemandSeriesService,
  ) {}

  // ============================================================================
  // Forecast Generation
  // ============================================================================

  /**
   * Generate forecast snapshots for items at a branch
   * 
   * @param orgId - Organization ID
   * @param branchId - Branch ID
   * @param userId - User performing generation
   * @param options - Window and horizon configuration
   * @returns Summary of created/skipped snapshots
   */
  async generateSnapshots(
    orgId: string,
    branchId: string,
    userId: string,
    options: GenerateSnapshotOptions = {},
  ): Promise<GenerateSnapshotResult> {
    const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
    const horizonDays = options.horizonDays ?? DEFAULT_HORIZON_DAYS;

    // Validate window
    if (!VALID_WINDOW_DAYS.includes(windowDays)) {
      throw new BadRequestException(
        `Invalid windowDays: ${windowDays}. Must be one of: ${VALID_WINDOW_DAYS.join(', ')}`,
      );
    }

    this.logger.log(
      `Generating forecasts: org=${orgId}, branch=${branchId}, window=${windowDays}, horizon=${horizonDays}`,
    );

    // Get demand series for all active items (or filtered items)
    const demandSeries = await this.demandSeriesService.getDemandSeries(
      orgId,
      branchId,
      {
        windowDays,
        itemIds: options.itemIds,
      },
    );

    // Get all active items to ensure we have forecasts even for zero-demand items
    const where: Prisma.InventoryItemWhereInput = { orgId, isActive: true };
    if (options.itemIds?.length) {
      where.id = { in: options.itemIds };
    }

    const activeItems = await this.prisma.client.inventoryItem.findMany({
      where,
      select: { id: true },
    });

    this.logger.debug(`Processing ${activeItems.length} active items`);

    const snapshotIds: string[] = [];
    let created = 0;
    let skipped = 0;

    for (const item of activeItems) {
      const series = demandSeries.get(item.id) || this.emptyDemandSeries(item.id, branchId);
      
      // Calculate forecast
      const forecast = this.calculateForecast(
        item.id,
        branchId,
        series,
        windowDays,
        horizonDays,
      );

      // Check for existing snapshot with same hash (H4 - idempotency)
      const existing = await this.prisma.client.demandForecastSnapshot.findUnique({
        where: { deterministicHash: forecast.deterministicHash },
        select: { id: true },
      });

      if (existing) {
        snapshotIds.push(existing.id);
        skipped++;
        continue;
      }

      // Create new snapshot
      const snapshot = await this.prisma.client.demandForecastSnapshot.create({
        data: {
          orgId,
          branchId,
          inventoryItemId: item.id,
          windowDays,
          horizonDays,
          model: ForecastModelType.TRAILING_MOVING_AVG,
          modelVersion: this.modelVersion,
          avgDailyQty: forecast.avgDailyQty,
          forecastTotalQty: forecast.forecastTotalQty,
          confidenceLow: forecast.confidenceLow,
          confidenceHigh: forecast.confidenceHigh,
          lastObservedDate: forecast.lastObservedDate,
          dataPoints: forecast.dataPoints,
          deterministicHash: forecast.deterministicHash,
          generatedById: userId,
          dailyForecast: forecast.dailyForecast as unknown as Prisma.InputJsonValue,
        },
      });

      snapshotIds.push(snapshot.id);
      created++;
    }

    // Audit log
    await this.auditLog.log({
      orgId,
      userId,
      action: 'FORECAST_SNAPSHOTS_GENERATED',
      resourceType: 'DemandForecastSnapshot',
      resourceId: branchId,
      metadata: {
        branchId,
        windowDays,
        horizonDays,
        itemsProcessed: activeItems.length,
        created,
        skipped,
      },
    });

    this.logger.log(
      `Forecast generation complete: ${created} created, ${skipped} skipped (existing)`,
    );

    return {
      snapshotIds,
      itemsProcessed: activeItems.length,
      created,
      skipped,
    };
  }

  /**
   * Get latest snapshot for an item (or null if none exists)
   */
  async getLatestSnapshot(
    orgId: string,
    branchId: string,
    itemId: string,
    windowDays?: number,
  ) {
    const where: Prisma.DemandForecastSnapshotWhereInput = {
      orgId,
      branchId,
      inventoryItemId: itemId,
    };

    if (windowDays) {
      where.windowDays = windowDays;
    }

    return this.prisma.client.demandForecastSnapshot.findFirst({
      where,
      orderBy: { generatedAt: 'desc' },
      include: {
        inventoryItem: { select: { id: true, sku: true, name: true, unit: true } },
        generatedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * List snapshots for a branch with pagination
   */
  async listSnapshots(
    orgId: string,
    branchId: string,
    options: {
      itemId?: string;
      windowDays?: number;
      limit?: number;
      cursor?: string;
    } = {},
  ) {
    const { limit = 50, cursor } = options;

    const where: Prisma.DemandForecastSnapshotWhereInput = {
      orgId,
      branchId,
    };

    if (options.itemId) {
      where.inventoryItemId = options.itemId;
    }

    if (options.windowDays) {
      where.windowDays = options.windowDays;
    }

    const snapshots = await this.prisma.client.demandForecastSnapshot.findMany({
      where,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { generatedAt: 'desc' },
      include: {
        inventoryItem: { select: { id: true, sku: true, name: true, unit: true } },
      },
    });

    const hasMore = snapshots.length > limit;
    if (hasMore) snapshots.pop();

    return {
      snapshots,
      nextCursor: hasMore ? snapshots[snapshots.length - 1]?.id : undefined,
    };
  }

  /**
   * Get snapshot by ID
   */
  async getSnapshotById(orgId: string, snapshotId: string) {
    const snapshot = await this.prisma.client.demandForecastSnapshot.findFirst({
      where: { id: snapshotId, orgId },
      include: {
        inventoryItem: { select: { id: true, sku: true, name: true, unit: true } },
        generatedBy: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true, timezone: true } },
      },
    });

    if (!snapshot) {
      throw new NotFoundException('Forecast snapshot not found');
    }

    return snapshot;
  }

  // ============================================================================
  // Forecast Calculation (Pure, Deterministic)
  // ============================================================================

  /**
   * Calculate forecast using Trailing Moving Average (TMA)
   * 
   * Formula:
   * - avgDailyQty = totalDemand / windowDays
   * - forecastTotalQty = avgDailyQty * horizonDays
   * - confidenceLow = forecastTotalQty * (1 - CONFIDENCE_BAND_PCT)
   * - confidenceHigh = forecastTotalQty * (1 + CONFIDENCE_BAND_PCT)
   * 
   * Determinism (H9):
   * - Inputs are sorted by date
   * - Hash includes all inputs and outputs
   */
  private calculateForecast(
    itemId: string,
    branchId: string,
    demandSeries: DemandSeriesResult,
    windowDays: number,
    horizonDays: number,
  ): ForecastOutput {
    // Calculate average daily demand
    const totalDemand = demandSeries.totalDemand;
    const avgDailyQty = totalDemand.dividedBy(windowDays);

    // Project forward
    const forecastTotalQty = avgDailyQty.times(horizonDays);

    // Confidence bands (±20%)
    const bandFactor = new Decimal(CONFIDENCE_BAND_PCT);
    const confidenceLow = forecastTotalQty.times(new Decimal(1).minus(bandFactor));
    const confidenceHigh = forecastTotalQty.times(new Decimal(1).plus(bandFactor));

    // Generate daily forecast points
    const dailyForecast: ForecastOutputPoint[] = [];
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < horizonDays; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i + 1);
      const dateStr = date.toISOString().split('T')[0];

      dailyForecast.push({
        date: dateStr,
        qty: avgDailyQty.toNumber(),
        low: avgDailyQty.times(new Decimal(1).minus(bandFactor)).toNumber(),
        high: avgDailyQty.times(new Decimal(1).plus(bandFactor)).toNumber(),
      });
    }

    // Parse last observed date
    const lastObservedDate = demandSeries.maxDate
      ? new Date(demandSeries.maxDate + 'T00:00:00Z')
      : null;

    // Generate deterministic hash (H9)
    const deterministicHash = this.computeHash({
      itemId,
      branchId,
      windowDays,
      horizonDays,
      model: 'TRAILING_MOVING_AVG',
      modelVersion: this.modelVersion,
      totalDemand: totalDemand.toString(),
      dataPoints: demandSeries.dayCount,
      minDate: demandSeries.minDate,
      maxDate: demandSeries.maxDate,
    });

    return {
      itemId,
      avgDailyQty,
      forecastTotalQty,
      confidenceLow,
      confidenceHigh,
      dailyForecast,
      dataPoints: demandSeries.dayCount,
      lastObservedDate,
      deterministicHash,
    };
  }

  /**
   * Create empty demand series for items with no history
   */
  private emptyDemandSeries(itemId: string, branchId: string): DemandSeriesResult {
    return {
      itemId,
      branchId,
      dataPoints: [],
      totalDemand: ZERO,
      dayCount: 0,
      minDate: null,
      maxDate: null,
    };
  }

  /**
   * Compute deterministic SHA-256 hash from forecast inputs (H9)
   */
  private computeHash(inputs: Record<string, unknown>): string {
    // Sort keys for determinism
    const sortedKeys = Object.keys(inputs).sort();
    const normalized = sortedKeys.map((k) => `${k}:${inputs[k]}`).join('|');
    return createHash('sha256').update(normalized).digest('hex');
  }
}
