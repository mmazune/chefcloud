/**
 * E43-s1: Workforce Controller
 *
 * Endpoints for leave, roster, time clock, and payroll.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { WorkforceService } from './workforce.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('workforce')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class WorkforceController {
  constructor(private readonly workforceService: WorkforceService) {}

  // ===== Leave Management =====

  /**
   * POST /workforce/leave
   * Create leave request (L2+)
   */
  @Post('leave')
  @Roles('L2', 'L3', 'L4', 'L5')
  async createLeaveRequest(
    @Body()
    body: {
      type: 'ANNUAL' | 'SICK' | 'UNPAID' | 'OTHER';
      startDate: string;
      endDate: string;
      reason?: string;
    },
    @Request() req: any,
  ): Promise<any> {
    return this.workforceService.createLeaveRequest({
      orgId: req.user.orgId,
      userId: req.user.id,
      type: body.type,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      reason: body.reason,
    });
  }

  /**
   * PATCH /workforce/leave/:id/approve
   * Approve or reject leave request (L3+)
   */
  @Patch('leave/:id/approve')
  @Roles('L3', 'L4', 'L5')
  async approveLeaveRequest(
    @Param('id') id: string,
    @Body() body: { action: 'APPROVED' | 'REJECTED' },
    @Request() req: any,
  ): Promise<any> {
    return this.workforceService.approveLeaveRequest(id, req.user.id, body.action);
  }

  // ===== Roster Management =====

  /**
   * POST /workforce/roster
   * Create duty shift (L3+)
   */
  @Post('roster')
  @Roles('L3', 'L4', 'L5')
  async createDutyShift(
    @Body()
    body: {
      branchId: string;
      userId: string;
      startsAt: string;
      endsAt: string;
      roleSlug: string;
      notes?: string;
    },
    @Request() req: any,
  ): Promise<any> {
    return this.workforceService.createDutyShift({
      orgId: req.user.orgId,
      branchId: body.branchId,
      userId: body.userId,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
      roleSlug: body.roleSlug,
      assignedById: req.user.id,
      notes: body.notes,
    });
  }

  /**
   * POST /workforce/swaps
   * Propose shift swap (L2+)
   */
  @Post('swaps')
  @Roles('L2', 'L3', 'L4', 'L5')
  async proposeShiftSwap(
    @Body()
    body: {
      toUserId: string;
      dutyShiftId: string;
    },
    @Request() req: any,
  ): Promise<any> {
    return this.workforceService.proposeShiftSwap({
      orgId: req.user.orgId,
      fromUserId: req.user.id,
      toUserId: body.toUserId,
      dutyShiftId: body.dutyShiftId,
    });
  }

  /**
   * PATCH /workforce/swaps/:id/approve
   * Approve or reject shift swap (L3+)
   */
  @Patch('swaps/:id/approve')
  @Roles('L3', 'L4', 'L5')
  async approveShiftSwap(
    @Param('id') id: string,
    @Body() body: { action: 'APPROVED' | 'REJECTED' },
    @Request() req: any,
  ): Promise<any> {
    return this.workforceService.approveShiftSwap(id, req.user.id, body.action);
  }

  // ===== Time Clock =====

  /**
   * POST /workforce/clock/in
   * Clock in (all authenticated users)
   */
  @Post('clock/in')
  async clockIn(
    @Body() body: { method?: 'MSR' | 'PASSKEY' | 'PASSWORD' },
    @Request() req: any,
  ): Promise<any> {
    return this.workforceService.clockIn({
      orgId: req.user.orgId,
      branchId: req.user.branchId || 'default',
      userId: req.user.id,
      method: body.method || 'PASSWORD',
    });
  }

  /**
   * POST /workforce/clock/out
   * Clock out (all authenticated users)
   */
  @Post('clock/out')
  async clockOut(@Request() req: any): Promise<any> {
    return this.workforceService.clockOut(req.user.id, req.user.orgId);
  }

  /**
   * GET /workforce/time-entries
   * Get time entries (L3+)
   */
  @Get('time-entries')
  @Roles('L3', 'L4', 'L5')
  async getTimeEntries(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('userId') userId?: string,
    @Query('branchId') branchId?: string,
    @Request() req?: any,
  ): Promise<any> {
    return this.workforceService.getTimeEntries({
      orgId: req.user.orgId,
      branchId,
      userId,
      from: new Date(from),
      to: new Date(to),
    });
  }

  // ===== Payroll Export =====

  /**
   * GET /workforce/payroll/export
   * Export payroll data (L4+)
   */
  @Get('payroll/export')
  @Roles('L4', 'L5')
  async exportPayroll(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
    @Request() req?: any,
  ): Promise<any> {
    return this.workforceService.exportPayroll({
      orgId: req.user.orgId,
      branchId,
      from: new Date(from),
      to: new Date(to),
    });
  }

  /**
   * GET /workforce/absence-violations
   * Check absence cap violations (L4+)
   */
  @Get('absence-violations')
  @Roles('L4', 'L5')
  async checkAbsenceCaps(@Request() req: any): Promise<any> {
    return this.workforceService.checkAbsenceCaps(req.user.orgId);
  }
}
