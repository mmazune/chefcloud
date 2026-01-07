/**
 * M11.14 Forecasting Controller
 * 
 * Endpoints:
 *   POST   /inventory/forecasting/snapshots       - Generate forecast snapshots (L4+)
 *   GET    /inventory/forecasting/snapshots       - List snapshots (L2+)
 *   GET    /inventory/forecasting/snapshots/:id   - Get snapshot detail (L2+)
 *   GET    /inventory/forecasting/demand-series   - Get raw demand series (L2+)
 *   GET    /inventory/forecasting/demand-summary  - Get demand summary (L2+)
 *   
 *   POST   /inventory/reorder-optimization/runs           - Generate optimization run (L4+)
 *   GET    /inventory/reorder-optimization/runs           - List runs (L2+)
 *   GET    /inventory/reorder-optimization/runs/:id       - Get run detail (L2+)
 *   POST   /inventory/reorder-optimization/runs/:id/pos   - Create draft POs (L4+)
 *   GET    /inventory/reorder-optimization/runs/:id/export - Export run (L2+)
 * 
 * RBAC:
 *   L2+ (Supervisor): Read access
 *   L4+ (Manager): Write access (generate, create POs)
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { InventoryForecastingService, VALID_WINDOW_DAYS } from './inventory-forecasting.service';
import { InventoryReorderOptimizationService } from './inventory-reorder-optimization.service';
import { InventoryDemandSeriesService } from './inventory-demand-series.service';
import { ForecastOptimizationStatus } from '@chefcloud/db';

// DTOs
interface GenerateSnapshotsDto {
  windowDays?: number;
  horizonDays?: number;
  itemIds?: string[];
}

interface ListSnapshotsQuery {
  itemId?: string;
  windowDays?: string;
  limit?: string;
  cursor?: string;
}

interface GenerateOptimizationDto {
  horizonDays?: number;
  leadTimeDaysOverride?: number;
  safetyStockDaysOverride?: number;
  snapshotIds?: string[];
  itemIds?: string[];
}

interface ListRunsQuery {
  status?: ForecastOptimizationStatus;
  limit?: string;
  cursor?: string;
}

interface DemandSeriesQuery {
  windowDays?: string;
  itemIds?: string;
}

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryForecastingController {
  constructor(
    private readonly forecastingService: InventoryForecastingService,
    private readonly optimizationService: InventoryReorderOptimizationService,
    private readonly demandSeriesService: InventoryDemandSeriesService,
  ) {}

  // ============================================================================
  // Demand Series Endpoints
  // ============================================================================

  /**
   * Get raw demand series for branch
   */
  @Get('forecasting/demand-series')
  @Roles('L2', 'L3', 'L4', 'L5')
  async getDemandSeries(
    @Request() req: any,
    @Query() query: DemandSeriesQuery,
  ) {
    const { orgId, branchId } = req.user;
    const windowDays = query.windowDays ? parseInt(query.windowDays, 10) : 14;
    const itemIds = query.itemIds?.split(',').filter(Boolean);

    const series = await this.demandSeriesService.getDemandSeries(orgId, branchId, {
      windowDays,
      itemIds,
    });

    // Convert Map to array for JSON response
    return {
      windowDays,
      itemCount: series.size,
      series: Array.from(series.values()).map((s) => ({
        itemId: s.itemId,
        totalDemand: s.totalDemand.toNumber(),
        dayCount: s.dayCount,
        minDate: s.minDate,
        maxDate: s.maxDate,
        dataPoints: s.dataPoints.map((dp) => ({
          date: dp.date,
          qty: dp.qty.toNumber(),
        })),
      })),
    };
  }

  /**
   * Get demand summary for branch
   */
  @Get('forecasting/demand-summary')
  @Roles('L2', 'L3', 'L4', 'L5')
  async getDemandSummary(
    @Request() req: any,
    @Query('windowDays') windowDaysStr?: string,
  ) {
    const { orgId, branchId } = req.user;
    const windowDays = windowDaysStr ? parseInt(windowDaysStr, 10) : 14;

    const summary = await this.demandSeriesService.getDemandSummary(orgId, branchId, windowDays);

    return {
      windowDays,
      totalItems: summary.totalItems,
      itemsWithDemand: summary.itemsWithDemand,
      totalDemandQty: summary.totalDemandQty.toNumber(),
      avgDailyDemand: summary.avgDailyDemand.toNumber(),
    };
  }

  // ============================================================================
  // Forecast Snapshot Endpoints
  // ============================================================================

  /**
   * Generate forecast snapshots (L4+ - Manager only)
   */
  @Post('forecasting/snapshots')
  @Roles('L4', 'L5')
  @HttpCode(HttpStatus.CREATED)
  async generateSnapshots(
    @Request() req: any,
    @Body() dto: GenerateSnapshotsDto,
  ) {
    const { orgId, branchId, userId } = req.user;

    const result = await this.forecastingService.generateSnapshots(
      orgId,
      branchId,
      userId,
      {
        windowDays: dto.windowDays,
        horizonDays: dto.horizonDays,
        itemIds: dto.itemIds,
      },
    );

    return {
      success: true,
      ...result,
    };
  }

  /**
   * List forecast snapshots
   */
  @Get('forecasting/snapshots')
  @Roles('L2', 'L3', 'L4', 'L5')
  async listSnapshots(
    @Request() req: any,
    @Query() query: ListSnapshotsQuery,
  ) {
    const { orgId, branchId } = req.user;

    const result = await this.forecastingService.listSnapshots(orgId, branchId, {
      itemId: query.itemId,
      windowDays: query.windowDays ? parseInt(query.windowDays, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      cursor: query.cursor,
    });

    return {
      snapshots: result.snapshots.map((s) => ({
        id: s.id,
        itemId: s.inventoryItemId,
        item: s.inventoryItem,
        windowDays: s.windowDays,
        horizonDays: s.horizonDays,
        model: s.model,
        avgDailyQty: s.avgDailyQty.toNumber(),
        forecastTotalQty: s.forecastTotalQty.toNumber(),
        confidenceLow: s.confidenceLow.toNumber(),
        confidenceHigh: s.confidenceHigh.toNumber(),
        dataPoints: s.dataPoints,
        generatedAt: s.generatedAt,
      })),
      nextCursor: result.nextCursor,
    };
  }

  /**
   * Get snapshot by ID
   */
  @Get('forecasting/snapshots/:id')
  @Roles('L2', 'L3', 'L4', 'L5')
  async getSnapshot(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<Record<string, unknown>> {
    const { orgId } = req.user;

    const snapshot = await this.forecastingService.getSnapshotById(orgId, id);

    return {
      id: snapshot.id,
      itemId: snapshot.inventoryItemId,
      item: snapshot.inventoryItem,
      branch: snapshot.branch,
      windowDays: snapshot.windowDays,
      horizonDays: snapshot.horizonDays,
      model: snapshot.model,
      modelVersion: snapshot.modelVersion,
      avgDailyQty: snapshot.avgDailyQty.toNumber(),
      forecastTotalQty: snapshot.forecastTotalQty.toNumber(),
      confidenceLow: snapshot.confidenceLow.toNumber(),
      confidenceHigh: snapshot.confidenceHigh.toNumber(),
      lastObservedDate: snapshot.lastObservedDate,
      dataPoints: snapshot.dataPoints,
      dailyForecast: snapshot.dailyForecast,
      generatedBy: snapshot.generatedBy,
      generatedAt: snapshot.generatedAt,
      deterministicHash: snapshot.deterministicHash,
    };
  }

  /**
   * Get valid window sizes
   */
  @Get('forecasting/windows')
  @Roles('L2', 'L3', 'L4', 'L5')
  getValidWindows() {
    return { windowDays: VALID_WINDOW_DAYS };
  }

  // ============================================================================
  // Reorder Optimization Endpoints
  // ============================================================================

  /**
   * Generate optimization run (L4+ - Manager only)
   */
  @Post('reorder-optimization/runs')
  @Roles('L4', 'L5')
  @HttpCode(HttpStatus.CREATED)
  async generateOptimizationRun(
    @Request() req: any,
    @Body() dto: GenerateOptimizationDto,
  ) {
    const { orgId, branchId, userId } = req.user;

    const result = await this.optimizationService.generateOptimizationRun(
      orgId,
      branchId,
      userId,
      {
        horizonDays: dto.horizonDays,
        leadTimeDaysOverride: dto.leadTimeDaysOverride,
        safetyStockDaysOverride: dto.safetyStockDaysOverride,
        snapshotIds: dto.snapshotIds,
        itemIds: dto.itemIds,
      },
    );

    return {
      success: true,
      runId: result.runId,
      status: result.status,
      itemCount: result.itemCount,
      totalSuggestedQty: result.totalSuggestedQty.toNumber(),
      created: result.created,
    };
  }

  /**
   * List optimization runs
   */
  @Get('reorder-optimization/runs')
  @Roles('L2', 'L3', 'L4', 'L5')
  async listOptimizationRuns(
    @Request() req: any,
    @Query() query: ListRunsQuery,
  ) {
    const { orgId, branchId } = req.user;

    const result = await this.optimizationService.listRuns(orgId, branchId, {
      status: query.status,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      cursor: query.cursor,
    });

    return {
      runs: result.runs.map((r) => ({
        id: r.id,
        status: r.status,
        horizonDays: r.horizonDays,
        itemCount: r.itemCount,
        totalSuggestedQty: r.totalSuggestedQty.toNumber(),
        createdBy: r.createdBy,
        createdAt: r.createdAt,
        lineCount: r._count.lines,
      })),
      nextCursor: result.nextCursor,
    };
  }

  /**
   * Get optimization run detail
   */
  @Get('reorder-optimization/runs/:id')
  @Roles('L2', 'L3', 'L4', 'L5')
  async getOptimizationRun(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<Record<string, unknown>> {
    const { orgId } = req.user;

    const run = await this.optimizationService.getRunById(orgId, id);

    return {
      id: run.id,
      status: run.status,
      branch: run.branch,
      horizonDays: run.horizonDays,
      leadTimeDaysOverride: run.leadTimeDaysOverride,
      safetyStockDaysOverride: run.safetyStockDaysOverride,
      itemCount: run.itemCount,
      totalSuggestedQty: run.totalSuggestedQty.toNumber(),
      createdBy: run.createdBy,
      createdAt: run.createdAt,
      deterministicHash: run.deterministicHash,
      lines: run.lines.map((l) => ({
        id: l.id,
        itemId: l.inventoryItemId,
        item: l.inventoryItem,
        onHandQty: l.onHandQty.toNumber(),
        inTransitQty: l.inTransitQty.toNumber(),
        onOrderQty: l.onOrderQty.toNumber(),
        quarantinedQty: l.quarantinedQty.toNumber(),
        availableQty: l.availableQty.toNumber(),
        avgDailyQty: l.avgDailyQty.toNumber(),
        forecastDemandQty: l.forecastDemandQty.toNumber(),
        targetStockQty: l.targetStockQty.toNumber(),
        reorderPointQty: l.reorderPointQty.toNumber(),
        suggestedQty: l.suggestedQty.toNumber(),
        reasonCodes: l.reasonCodes,
        explanation: l.explanation,
        suggestedVendor: l.suggestedVendor,
      })),
      generatedPOs: run.generatedPOs,
    };
  }

  /**
   * Create draft POs from optimization run (L4+ - Manager only)
   */
  @Post('reorder-optimization/runs/:id/pos')
  @Roles('L4', 'L5')
  @HttpCode(HttpStatus.CREATED)
  async createDraftPOs(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const { orgId, userId } = req.user;

    const result = await this.optimizationService.createDraftPOs(orgId, id, userId);

    return {
      success: true,
      poIds: result.poIds,
      poCount: result.poCount,
    };
  }

  /**
   * Export optimization run to CSV/JSON
   */
  @Get('reorder-optimization/runs/:id/export')
  @Roles('L2', 'L3', 'L4', 'L5')
  async exportOptimizationRun(
    @Request() req: any,
    @Param('id') id: string,
    @Query('format') format: string = 'json',
  ): Promise<Record<string, unknown>> {
    const { orgId } = req.user;

    const run = await this.optimizationService.getRunById(orgId, id);

    if (format === 'csv') {
      // Return CSV format
      const headers = [
        'Item ID',
        'SKU',
        'Name',
        'On Hand',
        'In Transit',
        'On Order',
        'Available',
        'Avg Daily Qty',
        'Target Stock',
        'Suggested Qty',
        'Reason Codes',
        'Explanation',
      ];

      const rows = run.lines.map((l) => [
        l.inventoryItemId,
        l.inventoryItem.sku || '',
        l.inventoryItem.name,
        l.onHandQty.toString(),
        l.inTransitQty.toString(),
        l.onOrderQty.toString(),
        l.availableQty.toString(),
        l.avgDailyQty.toString(),
        l.targetStockQty.toString(),
        l.suggestedQty.toString(),
        l.reasonCodes.join(';'),
        `"${l.explanation.replace(/"/g, '""')}"`,
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      return {
        format: 'csv',
        filename: `optimization-run-${id}.csv`,
        content: csv,
      };
    }

    // Default JSON format
    return {
      format: 'json',
      filename: `optimization-run-${id}.json`,
      run,
    };
  }
}
