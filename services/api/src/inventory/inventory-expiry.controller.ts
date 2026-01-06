/**
 * M11.8 Expiry Enforcement Controller
 *
 * Endpoints:
 * - POST /inventory/expiry/evaluate - Evaluate and enforce expiry (callable, no timers)
 * - GET /inventory/expiry/expiring-soon - Get lots expiring within threshold
 * - GET /inventory/expiry/expired - Get expired lots
 * - GET /inventory/expiry/summary - Get expiry summary stats
 * - GET /inventory/expiry/export - Export expired lots to CSV
 */
import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { InventoryExpiryService } from './inventory-expiry.service';

interface EvaluateExpiryDto {
  branchId?: string;
  dryRun?: boolean;
}

interface ExpiringSoonQuery {
  branchId?: string;
  days?: string;
  limit?: string;
}

interface ExpiredLotsQuery {
  branchId?: string;
  includeZeroQty?: string;
  limit?: string;
  offset?: string;
}

interface SummaryQuery {
  branchId?: string;
}

interface ExportQuery {
  branchId?: string;
  includeZeroQty?: string;
}

@Controller('inventory/expiry')
@UseGuards(JwtAuthGuard)
export class InventoryExpiryController {
  constructor(private readonly expiryService: InventoryExpiryService) {}

  /**
   * POST /inventory/expiry/evaluate
   * Evaluate and enforce expiry on all active lots
   * 
   * This is a callable endpoint - no timers or cron.
   * Can be triggered by external scheduler or on-demand.
   */
  @Post('evaluate')
  @Roles('L3', 'L4', 'L5') // L3+ can trigger evaluation
  @HttpCode(HttpStatus.OK)
  async evaluateExpiry(
    @Req() req: Request,
    @Body() body: EvaluateExpiryDto,
  ): Promise<object> {
    const orgId = (req as any).user?.orgId;
    if (!orgId) throw new NotFoundException('Organization not found');

    const result = await this.expiryService.evaluateExpiry({
      orgId,
      branchId: body.branchId,
      dryRun: body.dryRun ?? false,
    });

    return {
      evaluatedAt: result.evaluatedAt.toISOString(),
      lotsMarkedExpired: result.lotsMarkedExpired,
      lotsExpiringSoon: result.lotsExpiringSoon,
      totalExpiredValue: result.totalExpiredValue.toNumber(),
      details: result.details.map((d) => ({
        lotId: d.lotId,
        lotNumber: d.lotNumber,
        itemId: d.itemId,
        itemName: d.itemName,
        branchId: d.branchId,
        locationId: d.locationId,
        locationName: d.locationName,
        remainingQty: d.remainingQty.toNumber(),
        unitCost: d.unitCost?.toNumber() ?? null,
        estimatedValue: d.estimatedValue.toNumber(),
        expiryDate: d.expiryDate.toISOString(),
        previousStatus: d.previousStatus,
      })),
    };
  }

  /**
   * GET /inventory/expiry/expiring-soon
   * Get lots expiring within threshold days
   */
  @Get('expiring-soon')
  @Roles('L2', 'L3', 'L4', 'L5') // L2+ can read
  async getExpiringSoon(
    @Req() req: Request,
    @Query() query: ExpiringSoonQuery,
  ): Promise<object> {
    const orgId = (req as any).user?.orgId;
    if (!orgId) throw new NotFoundException('Organization not found');

    const daysThreshold = query.days ? parseInt(query.days, 10) : 30;
    const limit = query.limit ? parseInt(query.limit, 10) : 100;

    const alerts = await this.expiryService.getExpiringSoon({
      orgId,
      branchId: query.branchId,
      daysThreshold,
      limit,
    });

    return {
      items: alerts.map((a) => ({
        lotId: a.lotId,
        lotNumber: a.lotNumber,
        itemId: a.itemId,
        itemName: a.itemName,
        branchId: a.branchId,
        locationId: a.locationId,
        locationName: a.locationName,
        remainingQty: a.remainingQty.toNumber(),
        expiryDate: a.expiryDate.toISOString(),
        daysToExpiry: a.daysToExpiry,
        estimatedValue: a.estimatedValue.toNumber(),
      })),
      daysThreshold,
      total: alerts.length,
    };
  }

  /**
   * GET /inventory/expiry/expired
   * Get expired lots
   */
  @Get('expired')
  @Roles('L2', 'L3', 'L4', 'L5') // L2+ can read
  async getExpiredLots(
    @Req() req: Request,
    @Query() query: ExpiredLotsQuery,
  ): Promise<object> {
    const orgId = (req as any).user?.orgId;
    if (!orgId) throw new NotFoundException('Organization not found');

    const { lots, total } = await this.expiryService.getExpiredLots({
      orgId,
      branchId: query.branchId,
      includeZeroQty: query.includeZeroQty === 'true',
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    });

    return {
      items: lots.map((l) => ({
        lotId: l.lotId,
        lotNumber: l.lotNumber,
        itemId: l.itemId,
        itemName: l.itemName,
        branchId: l.branchId,
        locationId: l.locationId,
        locationName: l.locationName,
        remainingQty: l.remainingQty.toNumber(),
        unitCost: l.unitCost?.toNumber() ?? null,
        estimatedValue: l.estimatedValue.toNumber(),
        expiryDate: l.expiryDate.toISOString(),
      })),
      total,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    };
  }

  /**
   * GET /inventory/expiry/summary
   * Get expiry summary stats
   */
  @Get('summary')
  @Roles('L2', 'L3', 'L4', 'L5') // L2+ can read
  async getExpirySummary(
    @Req() req: Request,
    @Query() query: SummaryQuery,
  ): Promise<object> {
    const orgId = (req as any).user?.orgId;
    if (!orgId) throw new NotFoundException('Organization not found');

    const summary = await this.expiryService.getExpirySummary({
      orgId,
      branchId: query.branchId,
    });

    return {
      expiredLotsCount: summary.expiredLotsCount,
      expiredLotsValue: summary.expiredLotsValue.toNumber(),
      expiringSoon7d: summary.expiringSoon7d,
      expiringSoon30d: summary.expiringSoon30d,
      expiringSoonValue7d: summary.expiringSoonValue7d.toNumber(),
      expiringSoonValue30d: summary.expiringSoonValue30d.toNumber(),
    };
  }

  /**
   * GET /inventory/expiry/export
   * Export expired lots to CSV
   */
  @Get('export')
  @Roles('L4', 'L5') // L4+ can export
  async exportExpiredLots(
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: ExportQuery,
  ): Promise<void> {
    const orgId = (req as any).user?.orgId;
    if (!orgId) throw new NotFoundException('Organization not found');

    const { csv, hash } = await this.expiryService.exportExpiredLots({
      orgId,
      branchId: query.branchId,
      includeZeroQty: query.includeZeroQty === 'true',
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="expired-lots-${Date.now()}.csv"`,
    );
    res.setHeader('X-Content-Hash', hash);
    res.send(csv);
  }
}
