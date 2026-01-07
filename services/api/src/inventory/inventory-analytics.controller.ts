/**
 * Inventory Analytics Controller - M11.12
 * 
 * Provides endpoints for KPI analytics: shrink, waste, dead stock, expiry risk, reorder health.
 * RBAC: L2+ read, L4+ exports.
 */

import { 
  Controller, 
  Get, 
  Query, 
  Req, 
  Res, 
  UseGuards,
  Header,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import * as crypto from 'crypto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { 
  InventoryAnalyticsService, 
  AnalyticsFilters,
  ShrinkResult,
  DeadStockResult,
  ExpiryRiskResult,
  ReorderHealthResult,
  AnalyticsSummary,
} from './inventory-analytics.service';

// ============================================
// Query DTO
// ============================================

class AnalyticsQueryDto {
  branchId?: string;
  locationId?: string;
  itemId?: string;
  from?: string;
  to?: string;
  deadStockDays?: string;
}

// ============================================
// Controller
// ============================================

@Controller('inventory/analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@SkipThrottle()
export class InventoryAnalyticsController {
  constructor(private readonly analyticsService: InventoryAnalyticsService) {}

  // ============================================
  // Summary (all KPIs)
  // ============================================

  @Get('summary')
  @Roles('L2')
  async getSummary(
    @Req() req: any,
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsSummary> {
    const filters = this.parseFilters(query);
    return this.analyticsService.getAnalyticsSummary(req.user.orgId, filters);
  }

  // ============================================
  // Shrink / Variance
  // ============================================

  @Get('shrink')
  @Roles('L2')
  async getShrink(
    @Req() req: any,
    @Query() query: AnalyticsQueryDto,
  ): Promise<ShrinkResult[]> {
    const filters = this.parseFilters(query);
    return this.analyticsService.getShrinkData(req.user.orgId, filters);
  }

  @Get('shrink/export')
  @Roles('L4')
  @Header('Content-Type', 'text/csv')
  async exportShrink(
    @Req() req: any,
    @Res() res: Response,
    @Query() query: AnalyticsQueryDto,
  ): Promise<void> {
    const filters = this.parseFilters(query);
    const data = await this.analyticsService.getShrinkData(req.user.orgId, filters);
    
    const csv = this.shrinkToCsv(data);
    const hash = this.computeHash(csv);

    res.setHeader('Content-Disposition', 'attachment; filename="shrink-analytics.csv"');
    res.setHeader('X-Nimbus-Export-Hash', hash);
    res.send(csv);
  }

  // ============================================
  // Dead Stock
  // ============================================

  @Get('dead-stock')
  @Roles('L2')
  async getDeadStock(
    @Req() req: any,
    @Query() query: AnalyticsQueryDto,
  ): Promise<DeadStockResult[]> {
    const filters = this.parseFilters(query);
    const deadStockDays = query.deadStockDays ? parseInt(query.deadStockDays, 10) : 30;
    return this.analyticsService.getDeadStockData(req.user.orgId, { ...filters, deadStockDays });
  }

  @Get('dead-stock/export')
  @Roles('L4')
  @Header('Content-Type', 'text/csv')
  async exportDeadStock(
    @Req() req: any,
    @Res() res: Response,
    @Query() query: AnalyticsQueryDto,
  ): Promise<void> {
    const filters = this.parseFilters(query);
    const deadStockDays = query.deadStockDays ? parseInt(query.deadStockDays, 10) : 30;
    const data = await this.analyticsService.getDeadStockData(req.user.orgId, { ...filters, deadStockDays });
    
    const csv = this.deadStockToCsv(data);
    const hash = this.computeHash(csv);

    res.setHeader('Content-Disposition', 'attachment; filename="dead-stock-analytics.csv"');
    res.setHeader('X-Nimbus-Export-Hash', hash);
    res.send(csv);
  }

  // ============================================
  // Expiry Risk
  // ============================================

  @Get('expiry-risk')
  @Roles('L2')
  async getExpiryRisk(
    @Req() req: any,
    @Query() query: AnalyticsQueryDto,
  ): Promise<ExpiryRiskResult[]> {
    const filters = this.parseFilters(query);
    return this.analyticsService.getExpiryRiskData(req.user.orgId, filters);
  }

  @Get('expiry-risk/export')
  @Roles('L4')
  @Header('Content-Type', 'text/csv')
  async exportExpiryRisk(
    @Req() req: any,
    @Res() res: Response,
    @Query() query: AnalyticsQueryDto,
  ): Promise<void> {
    const filters = this.parseFilters(query);
    const data = await this.analyticsService.getExpiryRiskData(req.user.orgId, filters);
    
    const csv = this.expiryRiskToCsv(data);
    const hash = this.computeHash(csv);

    res.setHeader('Content-Disposition', 'attachment; filename="expiry-risk-analytics.csv"');
    res.setHeader('X-Nimbus-Export-Hash', hash);
    res.send(csv);
  }

  // ============================================
  // Reorder Health
  // ============================================

  @Get('reorder-health')
  @Roles('L2')
  async getReorderHealth(
    @Req() req: any,
    @Query() query: AnalyticsQueryDto,
  ): Promise<ReorderHealthResult> {
    const filters = this.parseFilters(query);
    return this.analyticsService.getReorderHealthData(req.user.orgId, filters);
  }

  @Get('reorder-health/export')
  @Roles('L4')
  @Header('Content-Type', 'text/csv')
  async exportReorderHealth(
    @Req() req: any,
    @Res() res: Response,
    @Query() query: AnalyticsQueryDto,
  ): Promise<void> {
    const filters = this.parseFilters(query);
    const data = await this.analyticsService.getReorderHealthData(req.user.orgId, filters);
    
    const csv = this.reorderHealthToCsv(data);
    const hash = this.computeHash(csv);

    res.setHeader('Content-Disposition', 'attachment; filename="reorder-health-analytics.csv"');
    res.setHeader('X-Nimbus-Export-Hash', hash);
    res.send(csv);
  }

  // ============================================
  // Helpers
  // ============================================

  private parseFilters(query: AnalyticsQueryDto): AnalyticsFilters {
    return {
      branchId: query.branchId,
      locationId: query.locationId,
      itemId: query.itemId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    };
  }

  // H4: LF normalization before hash
  private computeHash(content: string): string {
    const normalized = content.replace(/\r\n/g, '\n');
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  private shrinkToCsv(data: ShrinkResult[]): string {
    const header = 'BranchId,BranchName,LocationId,LocationName,ItemId,ItemName,SKU,VarianceQty,VarianceValue,SessionCount';
    const rows = data.map(r => 
      `${r.branchId},${this.escapeCsv(r.branchName)},${r.locationId},${this.escapeCsv(r.locationName)},${r.itemId},${this.escapeCsv(r.itemName)},${r.sku ?? ''},${r.varianceQty},${r.varianceValue},${r.sessionCount}`
    );
    return [header, ...rows].join('\n');
  }

  private deadStockToCsv(data: DeadStockResult[]): string {
    const header = 'BranchId,BranchName,ItemId,ItemName,SKU,OnHand,LastMovementDate,DaysSinceMovement';
    const rows = data.map(r => 
      `${r.branchId},${this.escapeCsv(r.branchName)},${r.itemId},${this.escapeCsv(r.itemName)},${r.sku ?? ''},${r.onHand},${r.lastMovementDate?.toISOString() ?? ''},${r.daysSinceMovement}`
    );
    return [header, ...rows].join('\n');
  }

  private expiryRiskToCsv(data: ExpiryRiskResult[]): string {
    const header = 'Bucket,LotId,LotNumber,ItemId,ItemName,ExpiryDate,DaysToExpiry,Qty,Status';
    const rows: string[] = [];
    for (const bucket of data) {
      for (const lot of bucket.lots) {
        rows.push(
          `${bucket.bucket},${lot.lotId},${this.escapeCsv(lot.lotNumber)},${lot.itemId},${this.escapeCsv(lot.itemName)},${lot.expiryDate.toISOString()},${lot.daysToExpiry},${lot.qty},${lot.status}`
        );
      }
    }
    return [header, ...rows].join('\n');
  }

  private reorderHealthToCsv(data: ReorderHealthResult): string {
    const header = 'ItemId,ItemName,SKU,OnHand,ReorderLevel,Shortfall';
    const rows = data.itemsBelowReorder.map(r => 
      `${r.itemId},${this.escapeCsv(r.itemName)},${r.sku ?? ''},${r.onHand},${r.reorderLevel},${r.shortfall}`
    );
    return [header, ...rows].join('\n');
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
