/**
 * M10.20: Geo-Fence Controller
 *
 * REST endpoints for branch geo-fence configuration, enforcement, and reporting.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { GeoFenceService, GeoFenceConfigDto, GeoFenceOverrideDto } from './geofence.service';
import { GeoFenceReportingService } from './geofence-reporting.service';

@Controller('workforce/geofence')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class GeoFenceController {
  constructor(
    private readonly geoFenceService: GeoFenceService,
    private readonly reportingService: GeoFenceReportingService,
  ) {}

  // ===== Configuration Endpoints =====

  /**
   * GET /workforce/geofence/config
   * List all geo-fence configs for organization (L3+)
   */
  @Get('config')
  @Roles('L3', 'L4', 'L5')
  async listConfigs(@Request() req: any) {
    return this.geoFenceService.listGeoFenceConfigs(req.user.orgId);
  }

  /**
   * GET /workforce/geofence/config/:branchId
   * Get geo-fence config for specific branch (L3+)
   */
  @Get('config/:branchId')
  @Roles('L3', 'L4', 'L5')
  async getConfig(@Param('branchId') branchId: string, @Request() req: any) {
    return this.geoFenceService.getGeoFenceConfig(req.user.orgId, branchId);
  }

  /**
   * PUT /workforce/geofence/config
   * Create or update geo-fence config (L4+)
   */
  @Put('config')
  @Roles('L4', 'L5')
  async upsertConfig(
    @Body()
    body: {
      branchId: string;
      enabled: boolean;
      centerLat: number;
      centerLng: number;
      radiusMeters: number;
      enforceClockIn: boolean;
      enforceClockOut: boolean;
      allowManagerOverride: boolean;
      maxAccuracyMeters?: number;
    },
    @Request() req: any,
  ) {
    const dto: GeoFenceConfigDto = {
      branchId: body.branchId,
      enabled: body.enabled,
      centerLat: Number(body.centerLat),
      centerLng: Number(body.centerLng),
      radiusMeters: Number(body.radiusMeters),
      enforceClockIn: body.enforceClockIn,
      enforceClockOut: body.enforceClockOut,
      allowManagerOverride: body.allowManagerOverride,
      maxAccuracyMeters: body.maxAccuracyMeters ? Number(body.maxAccuracyMeters) : undefined,
    };
    return this.geoFenceService.upsertGeoFenceConfig(req.user.orgId, req.user.id, dto);
  }

  /**
   * DELETE /workforce/geofence/config/:branchId
   * Delete geo-fence config for branch (L5)
   */
  @Delete('config/:branchId')
  @Roles('L5')
  async deleteConfig(@Param('branchId') branchId: string, @Request() req: any) {
    return this.geoFenceService.deleteGeoFenceConfig(req.user.orgId, branchId, req.user.id);
  }

  // ===== Enforcement Check Endpoint =====

  /**
   * POST /workforce/geofence/check
   * Check if clock action is allowed (pre-flight check) (L1+)
   */
  @Post('check')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async checkEnforcement(
    @Body()
    body: {
      branchId: string;
      clockAction: 'CLOCK_IN' | 'CLOCK_OUT';
      location?: {
        lat: number;
        lng: number;
        accuracyMeters?: number;
      };
    },
    @Request() req: any,
  ) {
    return this.geoFenceService.checkEnforcement(
      req.user.orgId,
      body.branchId,
      body.clockAction,
      body.location,
      this.getRoleLevel(req.user.roleLevel),
    );
  }

  // ===== Manager Override Endpoint =====

  /**
   * POST /workforce/geofence/override
   * Apply manager override for blocked clock action (L3+)
   */
  @Post('override')
  @Roles('L3', 'L4', 'L5')
  async applyOverride(
    @Body()
    body: {
      timeEntryId: string;
      clockAction: 'CLOCK_IN' | 'CLOCK_OUT';
      reason: string;
    },
    @Request() req: any,
  ) {
    const dto: GeoFenceOverrideDto = {
      timeEntryId: body.timeEntryId,
      clockAction: body.clockAction,
      reason: body.reason,
    };
    return this.geoFenceService.applyOverride(
      req.user.orgId,
      req.user.id,
      this.getRoleLevel(req.user.roleLevel),
      dto,
    );
  }

  // ===== Reporting Endpoints =====

  /**
   * GET /workforce/geofence/kpis
   * Get enforcement KPIs (L3+)
   */
  @Get('kpis')
  @Roles('L3', 'L4', 'L5')
  async getKpis(
    @Query('branchId') branchId: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Request() req: any,
  ) {
    return this.geoFenceService.getEnforcementKpis(
      req.user.orgId,
      branchId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * GET /workforce/geofence/events
   * Get event history with pagination (L3+)
   */
  @Get('events')
  @Roles('L3', 'L4', 'L5')
  async getEvents(
    @Query('branchId') branchId: string | undefined,
    @Query('userId') userId: string | undefined,
    @Query('eventType') eventType: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
    @Request() req: any,
  ) {
    return this.geoFenceService.getEventHistory(req.user.orgId, {
      branchId,
      userId,
      eventType: eventType as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * GET /workforce/geofence/reports/branch-kpis
   * Get KPIs aggregated by branch (L3+)
   */
  @Get('reports/branch-kpis')
  @Roles('L3', 'L4', 'L5')
  async getBranchKpis(
    @Query('branchId') branchId: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Request() req: any,
  ) {
    return this.reportingService.getBranchKpis({
      orgId: req.user.orgId,
      branchId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  /**
   * GET /workforce/geofence/reports/daily-trends
   * Get daily enforcement trends (L3+)
   */
  @Get('reports/daily-trends')
  @Roles('L3', 'L4', 'L5')
  async getDailyTrends(
    @Query('branchId') branchId: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Request() req: any,
  ) {
    return this.reportingService.getDailyTrends({
      orgId: req.user.orgId,
      branchId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  /**
   * GET /workforce/geofence/reports/top-offenders
   * Get top employees with blocked attempts (L3+)
   */
  @Get('reports/top-offenders')
  @Roles('L3', 'L4', 'L5')
  async getTopOffenders(
    @Query('branchId') branchId: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Query('limit') limit: string | undefined,
    @Request() req: any,
  ) {
    return this.reportingService.getTopOffenders(
      {
        orgId: req.user.orgId,
        branchId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
      limit ? parseInt(limit, 10) : 10,
    );
  }

  /**
   * GET /workforce/geofence/reports/override-summary
   * Get summary of manager overrides (L3+)
   */
  @Get('reports/override-summary')
  @Roles('L3', 'L4', 'L5')
  async getOverrideSummary(
    @Query('branchId') branchId: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Request() req: any,
  ) {
    return this.reportingService.getOverrideSummary({
      orgId: req.user.orgId,
      branchId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  /**
   * GET /workforce/geofence/export
   * Export events to CSV with BOM + hash (L4+)
   */
  @Get('export')
  @Roles('L4', 'L5')
  async exportCsv(
    @Query('branchId') branchId: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const { csv, hash } = await this.reportingService.exportToCsv({
      orgId: req.user.orgId,
      branchId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    const filename = `geofence-report-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Content-Hash', hash);
    res.send(csv);
  }

  // ===== Utility Methods =====

  /**
   * Extract numeric role level from RoleLevel enum.
   */
  private getRoleLevel(roleLevel: string): number {
    const match = roleLevel.match(/L(\d)/);
    return match ? parseInt(match[1], 10) : 1;
  }
}
