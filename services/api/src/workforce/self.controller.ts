/**
 * M10.5: Self-Service Controller
 * 
 * Staff-facing endpoints for viewing own schedules, time entries, and timesheets.
 * SECURITY: All endpoints use req.user.userId - never accept userId as parameter.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WorkforceSelfService, SelfScheduleFilters, SelfTimeFilters } from './workforce-self.service';

@Controller('workforce/self')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SelfController {
  constructor(private readonly selfService: WorkforceSelfService) {}

  /**
   * GET /workforce/self/schedule
   * Get upcoming shifts for the authenticated user
   * 
   * RBAC: All roles (L1-L5) can view their own schedule
   */
  @Get('schedule')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async getMySchedule(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Request() req?: any,
  ) {
    const filters: SelfScheduleFilters = {};
    if (from) filters.from = new Date(from);
    if (to) filters.to = new Date(to);

    return this.selfService.getMySchedule(req.user.userId, req.user.orgId, filters);
  }

  /**
   * GET /workforce/self/time-entries
   * Get time entries for the authenticated user
   * 
   * RBAC: All roles (L1-L5) can view their own time entries
   */
  @Get('time-entries')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async getMyTimeEntries(
    @Query('payPeriodId') payPeriodId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Request() req?: any,
  ) {
    const filters: SelfTimeFilters = {};
    if (payPeriodId) filters.payPeriodId = payPeriodId;
    if (from) filters.from = new Date(from);
    if (to) filters.to = new Date(to);

    return this.selfService.getMyTimeEntries(req.user.userId, req.user.orgId, filters);
  }

  /**
   * GET /workforce/self/clock-status
   * Get current clock-in status for the authenticated user
   * 
   * RBAC: All roles (L1-L5) can view their own clock status
   */
  @Get('clock-status')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async getMyClockStatus(@Request() req: any) {
    return this.selfService.getMyClockStatus(req.user.userId, req.user.orgId);
  }

  /**
   * GET /workforce/self/timesheet
   * Get computed timesheet totals for the authenticated user
   * 
   * RBAC: All roles (L1-L5) can view their own timesheet
   */
  @Get('timesheet')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async getMyTimesheet(
    @Query('payPeriodId') payPeriodId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Request() req?: any,
  ) {
    const filters: SelfTimeFilters = {};
    if (payPeriodId) filters.payPeriodId = payPeriodId;
    if (from) filters.from = new Date(from);
    if (to) filters.to = new Date(to);

    return this.selfService.getMyTimesheet(req.user.userId, req.user.orgId, filters);
  }
}
