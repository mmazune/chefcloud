/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * M10.13: Auto-Scheduler Controller
 * M10.14: Extended with mode parameter and publish endpoint
 *
 * REST endpoints for auto-schedule generation and application.
 * RBAC: L4+ for write operations, L3+ for read operations.
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkforceAutoSchedulerService, ASSIGNMENT_MODES, AssignmentMode } from './workforce-auto-scheduler.service';
import { WorkforceAutoScheduleApplyService } from './workforce-auto-schedule-apply.service';

@Controller('workforce/planning/auto-schedule')
@UseGuards(JwtAuthGuard)
export class WorkforceAutoSchedulerController {
  constructor(
    private readonly schedulerService: WorkforceAutoSchedulerService,
    private readonly applyService: WorkforceAutoScheduleApplyService,
  ) { }

  /**
   * Generate an auto-schedule run from staffing plan.
   * POST /workforce/planning/auto-schedule/generate?branchId=&date=&mode=
   * M10.14: mode=UNASSIGNED (default) or ASSIGNED (with deterministic assignment)
   */
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generateRun(
    @Query('branchId') branchId: string,
    @Query('date') date: string,
    @Query('mode') mode: string,
    @Request() req: any,
  ): Promise<any> {
    const { orgId, sub: userId, roleLevel } = req.user;

    // RBAC: L4+ only
    if (!this.hasWriteAccess(roleLevel)) {
      return { error: 'Forbidden', statusCode: 403 };
    }

    if (!branchId || !date) {
      return { error: 'branchId and date are required', statusCode: 400 };
    }

    // M10.14: Validate mode parameter
    const assignmentMode: AssignmentMode =
      mode === 'ASSIGNED' ? ASSIGNMENT_MODES.ASSIGNED : ASSIGNMENT_MODES.UNASSIGNED;

    return this.schedulerService.generateRun(orgId, branchId, date, userId, { mode: assignmentMode });
  }

  /**
   * Get latest run or specific run by ID.
   * GET /workforce/planning/auto-schedule?branchId=&date=&runId=
   */
  @Get()
  async getRun(
    @Query('branchId') branchId: string,
    @Query('date') date: string,
    @Query('runId') runId: string,
    @Request() req: any,
  ): Promise<any> {
    const { orgId, roleLevel } = req.user;

    // RBAC: L3+ can read
    if (!this.hasReadAccess(roleLevel)) {
      return { error: 'Forbidden', statusCode: 403 };
    }

    if (runId) {
      return this.schedulerService.getRun(orgId, branchId, date, runId);
    }

    if (!branchId || !date) {
      return { error: 'branchId and date are required', statusCode: 400 };
    }

    return this.schedulerService.getRun(orgId, branchId, date);
  }

  /**
   * List runs for a branch/date range.
   * GET /workforce/planning/auto-schedule/list?branchId=&startDate=&endDate=
   */
  @Get('list')
  async listRuns(
    @Query('branchId') branchId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req: any,
  ): Promise<any> {
    const { orgId, roleLevel } = req.user;

    if (!this.hasReadAccess(roleLevel)) {
      return { error: 'Forbidden', statusCode: 403 };
    }

    if (!branchId) {
      return { error: 'branchId is required', statusCode: 400 };
    }

    return this.schedulerService.listRuns(orgId, branchId, startDate, endDate);
  }

  /**
   * Apply suggestions from a run to create shifts.
   * POST /workforce/planning/auto-schedule/:runId/apply
   */
  @Post(':runId/apply')
  @HttpCode(HttpStatus.OK)
  async applyRun(
    @Param('runId') runId: string,
    @Request() req: any,
  ): Promise<any> {
    const { orgId, sub: userId, roleLevel } = req.user;

    if (!this.hasWriteAccess(roleLevel)) {
      return { error: 'Forbidden', statusCode: 403 };
    }

    return this.applyService.applyRun(runId, orgId, userId);
  }

  /**
   * Void a run (soft delete).
   * POST /workforce/planning/auto-schedule/:runId/void
   */
  @Post(':runId/void')
  @HttpCode(HttpStatus.OK)
  async voidRun(
    @Param('runId') runId: string,
    @Request() req: any,
  ): Promise<any> {
    const { orgId, sub: userId, roleLevel } = req.user;

    if (!this.hasWriteAccess(roleLevel)) {
      return { error: 'Forbidden', statusCode: 403 };
    }

    return this.schedulerService.voidRun(runId, orgId, userId);
  }

  /**
   * M10.14: Publish an applied run (send notifications to assigned employees).
   * POST /workforce/planning/auto-schedule/:runId/publish
   * Idempotent: returns existing publish timestamp if already published.
   */
  @Post(':runId/publish')
  @HttpCode(HttpStatus.OK)
  async publishRun(
    @Param('runId') runId: string,
    @Request() req: any,
  ): Promise<any> {
    const { orgId, sub: userId, roleLevel } = req.user;

    if (!this.hasWriteAccess(roleLevel)) {
      return { error: 'Forbidden', statusCode: 403 };
    }

    return this.schedulerService.publishRun(runId, orgId, userId);
  }

  /**
   * Get impact report (before/after variance).
   * GET /workforce/planning/auto-schedule/:runId/impact
   */
  @Get(':runId/impact')
  async getImpact(
    @Param('runId') runId: string,
    @Request() req: any,
  ): Promise<any> {
    const { orgId, roleLevel } = req.user;

    if (!this.hasReadAccess(roleLevel)) {
      return { error: 'Forbidden', statusCode: 403 };
    }

    return this.applyService.getImpact(runId, orgId);
  }

  /**
   * Generate residual alerts for unmet demand.
   * POST /workforce/planning/auto-schedule/:runId/alerts
   */
  @Post(':runId/alerts')
  @HttpCode(HttpStatus.OK)
  async generateAlerts(
    @Param('runId') runId: string,
    @Request() req: any,
  ): Promise<any> {
    const { orgId, sub: userId, roleLevel } = req.user;

    if (!this.hasWriteAccess(roleLevel)) {
      return { error: 'Forbidden', statusCode: 403 };
    }

    return this.applyService.generateResidualAlerts(runId, orgId, userId);
  }

  // ===== RBAC HELPERS =====

  private hasWriteAccess(roleLevel: string): boolean {
    return ['L4', 'L5'].includes(roleLevel);
  }

  private hasReadAccess(roleLevel: string): boolean {
    return ['L3', 'L4', 'L5'].includes(roleLevel);
  }
}
