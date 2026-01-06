/**
 * M10.1: Workforce Reporting Controller
 *
 * REST endpoints for labor metrics and CSV exports.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Response } from 'express';
import { WorkforceReportingService } from './workforce-reporting.service';
import { WorkforceAuditService, WorkforceAuditAction } from './workforce-audit.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('workforce/reports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportingService: WorkforceReportingService,
    private readonly auditService: WorkforceAuditService,
  ) { }

  // ===== Labor Metrics =====

  /**
   * GET /workforce/reports/labor
   * Get labor metrics summary (L4+)
   */
  @Get('labor')
  @Roles('L4', 'L5')
  async getLaborMetrics(
    @Query('branchId') branchId: string | undefined,
    @Query('from') from: string,
    @Query('to') to: string,
    @Request() req: any,
  ): Promise<unknown> {
    return this.reportingService.getLaborMetrics({
      orgId: req.user.orgId,
      branchId,
      dateRange: {
        from: new Date(from),
        to: new Date(to),
      },
    });
  }

  // ===== Daily Summary =====

  /**
   * GET /workforce/reports/daily
   * Get daily summary for date (L3+)
   */
  @Get('daily')
  @Roles('L3', 'L4', 'L5')
  async getDailySummary(
    @Query('date') date: string,
    @Query('branchId') branchId: string | undefined,
    @Request() req: any,
  ) {
    return this.reportingService.getDailySummary({
      orgId: req.user.orgId,
      branchId,
      date: new Date(date),
    });
  }

  // ===== CSV Exports =====

  /**
   * GET /workforce/reports/export/shifts
   * Export shifts as CSV (L4+)
   */
  @Get('export/shifts')
  @Roles('L4', 'L5')
  async exportShifts(
    @Query('branchId') branchId: string | undefined,
    @Query('from') from: string,
    @Query('to') to: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const csv = await this.reportingService.exportShiftsCsv({
      orgId: req.user.orgId,
      branchId,
      dateRange: {
        from: new Date(from),
        to: new Date(to),
      },
    });

    const filename = `shifts_${from}_${to}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  /**
   * GET /workforce/reports/export/timeentries
   * Export time entries as CSV (L4+)
   */
  @Get('export/timeentries')
  @Roles('L4', 'L5')
  async exportTimeEntries(
    @Query('branchId') branchId: string | undefined,
    @Query('from') from: string,
    @Query('to') to: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const csv = await this.reportingService.exportTimeEntriesCsv({
      orgId: req.user.orgId,
      branchId,
      dateRange: {
        from: new Date(from),
        to: new Date(to),
      },
    });

    const filename = `timeentries_${from}_${to}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  /**
   * GET /workforce/reports/export/labor
   * Export labor summary as CSV (L4+)
   */
  @Get('export/labor')
  @Roles('L4', 'L5')
  async exportLaborSummary(
    @Query('branchId') branchId: string | undefined,
    @Query('from') from: string,
    @Query('to') to: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const csv = await this.reportingService.exportLaborSummaryCsv({
      orgId: req.user.orgId,
      branchId,
      dateRange: {
        from: new Date(from),
        to: new Date(to),
      },
    });

    const filename = `labor_summary_${from}_${to}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  // ===== Audit Logs =====

  /**
   * GET /workforce/reports/audit
   * Get workforce audit logs (L5 only)
   */
  @Get('audit')
  @Roles('L5')
  async getAuditLogs(
    @Query('entityType') entityType: string | undefined,
    @Query('entityId') entityId: string | undefined,
    @Query('performedById') performedById: string | undefined,
    @Query('action') action: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
    @Request() req: any,
  ): Promise<{ logs: unknown[]; total: number }> {
    return this.auditService.getAuditLogs({
      orgId: req.user.orgId,
      entityType: entityType as 'SHIFT' | 'TIME_ENTRY' | 'BREAK' | 'TEMPLATE' | undefined,
      entityId,
      performedById,
      action: action as WorkforceAuditAction | undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  // ===== M10.5: Compliance Incidents =====

  /**
   * GET /workforce/reports/incidents
   * Get compliance incident counts (L3+)
   */
  @Get('incidents')
  @Roles('L3', 'L4', 'L5')
  async getIncidentCounts(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('branchId') branchId: string | undefined,
    @Request() req: any,
  ) {
    const dateRange = from && to ? { from: new Date(from), to: new Date(to) } : undefined;
    return this.reportingService.getComplianceIncidentCounts(req.user.orgId, dateRange, branchId);
  }

  /**
   * GET /workforce/reports/export/incidents
   * Export compliance incidents as CSV (L4+)
   */
  @Get('export/incidents')
  @Roles('L4', 'L5')
  async exportIncidents(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const dateRange = from && to ? { from: new Date(from), to: new Date(to) } : undefined;
    const csv = await this.reportingService.exportIncidentsCsv(req.user.orgId, dateRange);

    const filename = `incidents_${from ?? 'all'}_${to ?? 'all'}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  /**
   * GET /workforce/reports/export/adjustments
   * Export adjustment history as CSV (L4+)
   */
  @Get('export/adjustments')
  @Roles('L4', 'L5')
  async exportAdjustments(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const dateRange = from && to ? { from: new Date(from), to: new Date(to) } : undefined;
    const csv = await this.reportingService.exportAdjustmentsCsv(req.user.orgId, dateRange);

    const filename = `adjustments_${from ?? 'all'}_${to ?? 'all'}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
