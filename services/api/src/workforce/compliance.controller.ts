/**
 * M10.19: Workforce Compliance Controller
 *
 * Endpoints for:
 * - GET /workforce/compliance/incidents - List incidents (L3+ admin)
 * - POST /workforce/compliance/evaluate - Trigger evaluation (L3+ admin)
 * - GET /workforce/compliance/export/incidents - Export incidents CSV
 * - GET /workforce/compliance/export/penalties - Export penalties CSV
 * - GET /workforce/timeclock/export/timeentries - Export time entries with geo
 * - GET /workforce/my-compliance - Self-service incidents (L1+)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WorkforceComplianceService, EvaluationResult } from './workforce-compliance.service';
import { ComplianceExportService, ExportResult } from './compliance-export.service';

@Controller('workforce/compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplianceController {
  constructor(
    private readonly complianceService: WorkforceComplianceService,
    private readonly exportService: ComplianceExportService,
  ) {}

  /**
   * GET /workforce/compliance/incidents
   * List compliance incidents for the org.
   * Requires OWNER or MANAGER.
   */
  @Get('incidents')
  @Roles('OWNER', 'MANAGER')
  async listIncidents(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
    @Query('type') type?: string,
    @Query('resolved') resolved?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.complianceService.listIncidents(req.user.orgId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      branchId,
      type,
      resolved: resolved !== undefined ? resolved === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * POST /workforce/compliance/evaluate
   * Trigger compliance evaluation for a date range.
   * Requires OWNER or MANAGER.
   */
  @Post('evaluate')
  @Roles('OWNER', 'MANAGER')
  async evaluate(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
  ): Promise<EvaluationResult> {
    if (!from || !to) {
      throw new BadRequestException('from and to query parameters are required');
    }
    return this.complianceService.evaluateCompliance(
      req.user.orgId,
      new Date(from),
      new Date(to),
      branchId,
    );
  }

  /**
   * GET /workforce/compliance/penalties
   * Get penalty summary by user.
   */
  @Get('penalties')
  @Roles('OWNER', 'MANAGER')
  async getPenaltySummary(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException('from and to query parameters are required');
    }
    return this.complianceService.getPenaltySummary(
      req.user.orgId,
      new Date(from),
      new Date(to),
      branchId,
    );
  }

  /**
   * GET /workforce/compliance/export/incidents
   * Export incidents as CSV with hash header.
   */
  @Get('export/incidents')
  @Roles('OWNER', 'MANAGER')
  async exportIncidents(
    @Req() req: any,
    @Res() res: Response,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException('from and to query parameters are required');
    }

    const result: ExportResult = await this.exportService.exportIncidents(
      req.user.orgId,
      new Date(from),
      new Date(to),
      branchId,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="compliance-incidents-${from}-${to}.csv"`,
    );
    res.setHeader('X-Nimbus-Export-Hash', result.hash);
    res.send(result.csv);
  }

  /**
   * GET /workforce/compliance/export/penalties
   * Export penalties as CSV with hash header.
   */
  @Get('export/penalties')
  @Roles('OWNER', 'MANAGER')
  async exportPenalties(
    @Req() req: any,
    @Res() res: Response,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException('from and to query parameters are required');
    }

    const result: ExportResult = await this.exportService.exportPenalties(
      req.user.orgId,
      new Date(from),
      new Date(to),
      branchId,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="compliance-penalties-${from}-${to}.csv"`,
    );
    res.setHeader('X-Nimbus-Export-Hash', result.hash);
    res.send(result.csv);
  }
}

/**
 * Self-service compliance controller for employees.
 */
@Controller('workforce/my-compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MyComplianceController {
  constructor(
    private readonly complianceService: WorkforceComplianceService,
  ) {}

  /**
   * GET /workforce/my-compliance
   * Get own compliance incidents.
   */
  @Get()
  async getMyIncidents(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.complianceService.getMyIncidents(req.user.orgId, req.user.userId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }
}

/**
 * Extended timeclock export controller with geo metadata.
 */
@Controller('workforce/timeclock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimeclockExportController {
  constructor(
    private readonly exportService: ComplianceExportService,
  ) {}

  /**
   * GET /workforce/timeclock/export/timeentries
   * Export time entries with geo metadata as CSV.
   */
  @Get('export/timeentries')
  @Roles('OWNER', 'MANAGER')
  async exportTimeEntries(
    @Req() req: any,
    @Res() res: Response,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException('from and to query parameters are required');
    }

    const result: ExportResult = await this.exportService.exportTimeEntriesWithGeo(
      req.user.orgId,
      new Date(from),
      new Date(to),
      branchId,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="timeentries-geo-${from}-${to}.csv"`,
    );
    res.setHeader('X-Nimbus-Export-Hash', result.hash);
    res.send(result.csv);
  }
}
