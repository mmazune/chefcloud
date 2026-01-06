/**
 * M10.12: Workforce Planning Controller
 *
 * REST endpoints for labor targets, forecasts, staffing plans,
 * variance reports, alerts, and CSV exports.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  Request,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { WorkforcePlanningService } from './workforce-planning.service';
import { WorkforcePlanningExportService } from './workforce-planning-export.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('workforce/planning')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class WorkforcePlanningController {
  constructor(
    private readonly planningService: WorkforcePlanningService,
    private readonly exportService: WorkforcePlanningExportService,
  ) { }

  // ===== Labor Targets =====

  /**
   * GET /workforce/planning/targets
   * List labor targets (L3+)
   */
  @Get('targets')
  @Roles('L3', 'L4', 'L5')
  async listTargets(
    @Query('branchId') branchId: string | undefined,
    @Request() req: { user: { orgId: string } },
  ): Promise<any[]> {
    return this.planningService.listTargets(req.user.orgId, branchId);
  }

  /**
   * POST /workforce/planning/targets
   * Create labor target (L4+)
   */
  @Post('targets')
  @Roles('L4', 'L5')
  async createTarget(
    @Body() body: {
      branchId?: string;
      roleKey: string;
      dayOfWeek: number;
      hourStart: number;
      hourEnd: number;
      targetCoversPerStaff?: number;
      targetLaborPct?: number;
      enabled?: boolean;
    },
    @Request() req: { user: { orgId: string } },
  ): Promise<any> {
    return this.planningService.createTarget(req.user.orgId, body);
  }

  /**
   * PATCH /workforce/planning/targets/:id
   * Update labor target (L4+)
   */
  @Patch('targets/:id')
  @Roles('L4', 'L5')
  async updateTarget(
    @Param('id') id: string,
    @Body() body: {
      targetCoversPerStaff?: number;
      targetLaborPct?: number;
      enabled?: boolean;
    },
    @Request() req: { user: { orgId: string } },
  ): Promise<any> {
    return this.planningService.updateTarget(req.user.orgId, id, body);
  }

  /**
   * DELETE /workforce/planning/targets/:id
   * Delete labor target (L4+)
   */
  @Delete('targets/:id')
  @Roles('L4', 'L5')
  async deleteTarget(
    @Param('id') id: string,
    @Request() req: { user: { orgId: string } },
  ): Promise<any> {
    return this.planningService.deleteTarget(req.user.orgId, id);
  }

  // ===== Forecast =====

  /**
   * POST /workforce/planning/forecast/generate
   * Generate forecast snapshot (L4+)
   */
  @Post('forecast/generate')
  @Roles('L4', 'L5')
  async generateForecast(
    @Body() body: { branchId: string; date: string },
    @Request() req: { user: { orgId: string } },
  ): Promise<any> {
    if (!body.branchId || !body.date) {
      throw new BadRequestException('branchId and date are required');
    }
    return this.planningService.generateForecast(
      req.user.orgId,
      body.branchId,
      new Date(body.date),
    );
  }

  /**
   * GET /workforce/planning/forecast
   * Get forecast for date/branch (L3+)
   */
  @Get('forecast')
  @Roles('L3', 'L4', 'L5')
  async getForecast(
    @Query('branchId') branchId: string,
    @Query('date') date: string,
    @Request() req: { user: { orgId: string } },
  ): Promise<any> {
    if (!branchId || !date) {
      throw new BadRequestException('branchId and date are required');
    }
    return this.planningService.getForecast(
      req.user.orgId,
      branchId,
      new Date(date),
    );
  }

  // ===== Staffing Plans =====

  /**
   * POST /workforce/planning/plans/generate
   * Generate staffing plan (L4+)
   */
  @Post('plans/generate')
  @Roles('L4', 'L5')
  async generatePlan(
    @Body() body: { branchId: string; date: string },
    @Request() req: { user: { orgId: string } },
  ): Promise<any> {
    if (!body.branchId || !body.date) {
      throw new BadRequestException('branchId and date are required');
    }
    return this.planningService.generatePlan(
      req.user.orgId,
      body.branchId,
      new Date(body.date),
    );
  }

  /**
   * GET /workforce/planning/plans
   * Get plan for date/branch (L3+)
   */
  @Get('plans')
  @Roles('L3', 'L4', 'L5')
  async getPlan(
    @Query('branchId') branchId: string,
    @Query('date') date: string,
    @Request() req: { user: { orgId: string } },
  ): Promise<any> {
    if (!branchId || !date) {
      throw new BadRequestException('branchId and date are required');
    }
    return this.planningService.getPlan(
      req.user.orgId,
      branchId,
      new Date(date),
    );
  }

  /**
   * POST /workforce/planning/plans/:id/publish
   * Publish staffing plan (L4+)
   */
  @Post('plans/:id/publish')
  @Roles('L4', 'L5')
  async publishPlan(
    @Param('id') id: string,
    @Request() req: { user: { orgId: string; id: string } },
  ): Promise<any> {
    return this.planningService.publishPlan(req.user.orgId, id, req.user.id);
  }

  // ===== Variance =====

  /**
   * GET /workforce/planning/variance
   * Get variance report (L3+)
   */
  @Get('variance')
  @Roles('L3', 'L4', 'L5')
  async getVariance(
    @Query('branchId') branchId: string,
    @Query('date') date: string,
    @Request() req: { user: { orgId: string } },
  ): Promise<any[]> {
    if (!branchId || !date) {
      throw new BadRequestException('branchId and date are required');
    }
    return this.planningService.getVariance(
      req.user.orgId,
      branchId,
      new Date(date),
    );
  }

  // ===== Alerts =====

  /**
   * POST /workforce/planning/alerts/generate
   * Generate alerts from variance (L4+)
   */
  @Post('alerts/generate')
  @Roles('L4', 'L5')
  async generateAlerts(
    @Body() body: { branchId: string; date: string },
    @Request() req: { user: { orgId: string } },
  ): Promise<any> {
    if (!body.branchId || !body.date) {
      throw new BadRequestException('branchId and date are required');
    }
    return this.planningService.generateAlerts(
      req.user.orgId,
      body.branchId,
      new Date(body.date),
    );
  }

  /**
   * GET /workforce/planning/alerts
   * List alerts (L3+)
   */
  @Get('alerts')
  @Roles('L3', 'L4', 'L5')
  async listAlerts(
    @Query('branchId') branchId: string,
    @Query('date') date: string | undefined,
    @Query('includeResolved') includeResolved: string | undefined,
    @Request() req: { user: { orgId: string } },
  ): Promise<any[]> {
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }
    return this.planningService.listAlerts(
      req.user.orgId,
      branchId,
      date ? new Date(date) : undefined,
      includeResolved === 'true',
    );
  }

  /**
   * POST /workforce/planning/alerts/:id/resolve
   * Resolve alert (L4+)
   */
  @Post('alerts/:id/resolve')
  @Roles('L4', 'L5')
  async resolveAlert(
    @Param('id') id: string,
    @Request() req: { user: { orgId: string; id: string } },
  ): Promise<any> {
    return this.planningService.resolveAlert(req.user.orgId, id, req.user.id);
  }

  // ===== Exports =====

  /**
   * GET /workforce/planning/export/forecast
   * Export forecast as CSV (L4+)
   */
  @Get('export/forecast')
  @Roles('L4', 'L5')
  async exportForecast(
    @Query('branchId') branchId: string,
    @Query('date') date: string,
    @Request() req: { user: { orgId: string } },
    @Res() res: Response,
  ): Promise<void> {
    if (!branchId || !date) {
      throw new BadRequestException('branchId and date are required');
    }
    const csv = await this.exportService.exportForecastCsv(
      req.user.orgId,
      branchId,
      new Date(date),
    );
    const filename = `forecast_${branchId}_${date}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  /**
   * GET /workforce/planning/export/plan
   * Export plan as CSV (L4+)
   */
  @Get('export/plan')
  @Roles('L4', 'L5')
  async exportPlan(
    @Query('branchId') branchId: string,
    @Query('date') date: string,
    @Request() req: { user: { orgId: string } },
    @Res() res: Response,
  ): Promise<void> {
    if (!branchId || !date) {
      throw new BadRequestException('branchId and date are required');
    }
    const csv = await this.exportService.exportPlanCsv(
      req.user.orgId,
      branchId,
      new Date(date),
    );
    const filename = `plan_${branchId}_${date}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  /**
   * GET /workforce/planning/export/variance
   * Export variance as CSV (L4+)
   */
  @Get('export/variance')
  @Roles('L4', 'L5')
  async exportVariance(
    @Query('branchId') branchId: string,
    @Query('date') date: string,
    @Request() req: { user: { orgId: string } },
    @Res() res: Response,
  ): Promise<void> {
    if (!branchId || !date) {
      throw new BadRequestException('branchId and date are required');
    }
    const csv = await this.exportService.exportVarianceCsv(
      req.user.orgId,
      branchId,
      new Date(date),
    );
    const filename = `variance_${branchId}_${date}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  /**
   * GET /workforce/planning/export/alerts
   * Export alerts as CSV (L4+)
   */
  @Get('export/alerts')
  @Roles('L4', 'L5')
  async exportAlerts(
    @Query('branchId') branchId: string,
    @Query('date') date: string,
    @Request() req: { user: { orgId: string } },
    @Res() res: Response,
  ): Promise<void> {
    if (!branchId || !date) {
      throw new BadRequestException('branchId and date are required');
    }
    const csv = await this.exportService.exportAlertsCsv(
      req.user.orgId,
      branchId,
      new Date(date),
    );
    const filename = `alerts_${branchId}_${date}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
