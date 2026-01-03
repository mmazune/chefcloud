/**
 * M10.3: Enterprise Controller
 *
 * Policy, Pay Periods, Timesheet Approvals, Payroll Export endpoints.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { 
  WorkforceEnterpriseService, 
  PolicyDto, 
  GeneratePayPeriodsDto, 
  BulkApprovalDto, 
  PayrollExportDto,
  PayPeriodStatus,
} from './workforce-enterprise.service';

@Controller('workforce')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class EnterpriseController {
  constructor(private readonly enterpriseService: WorkforceEnterpriseService) {}

  // ===== Policy Management =====

  /**
   * GET /workforce/policy
   * Get workforce policy (L4+)
   */
  @Get('policy')
  @Roles('L4', 'L5')
  async getPolicy(@Request() req: any) {
    return this.enterpriseService.getPolicy(req.user.orgId);
  }

  /**
   * PUT /workforce/policy
   * Update workforce policy (L4+)
   */
  @Put('policy')
  @Roles('L4', 'L5')
  async updatePolicy(@Body() body: PolicyDto, @Request() req: any) {
    return this.enterpriseService.upsertPolicy(req.user.orgId, body, req.user.id);
  }

  // ===== Pay Period Management =====

  /**
   * POST /workforce/pay-periods/generate
   * Generate pay periods for date range (L4+)
   */
  @Post('pay-periods/generate')
  @Roles('L4', 'L5')
  async generatePayPeriods(@Body() body: GeneratePayPeriodsDto, @Request() req: any) {
    return this.enterpriseService.generatePayPeriods(req.user.orgId, body, req.user.id);
  }

  /**
   * GET /workforce/pay-periods
   * List pay periods (L3+)
   */
  @Get('pay-periods')
  @Roles('L3', 'L4', 'L5')
  async listPayPeriods(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Request() req?: any,
  ) {
    return this.enterpriseService.listPayPeriods(req.user.orgId, {
      branchId,
      status: status as PayPeriodStatus,
    });
  }

  /**
   * POST /workforce/pay-periods/:id/close
   * Close pay period (L4+)
   */
  @Post('pay-periods/:id/close')
  @Roles('L4', 'L5')
  async closePayPeriod(@Param('id') id: string, @Request() req: any) {
    return this.enterpriseService.closePayPeriod(req.user.orgId, id, req.user.id);
  }

  // ===== Timesheet Approvals =====

  /**
   * GET /workforce/timesheets/pending
   * List pending timesheet approvals (L3+)
   */
  @Get('timesheets/pending')
  @Roles('L3', 'L4', 'L5')
  async getPendingApprovals(
    @Query('branchId') branchId?: string,
    @Query('userId') userId?: string,
    @Request() req?: any,
  ) {
    return this.enterpriseService.getPendingApprovals(req.user.orgId, { branchId, userId });
  }

  /**
   * POST /workforce/timesheets/approve
   * Bulk approve timesheets (L3+)
   */
  @Post('timesheets/approve')
  @Roles('L3', 'L4', 'L5')
  async bulkApprove(@Body() body: BulkApprovalDto, @Request() req: any) {
    return this.enterpriseService.bulkApprove(req.user.orgId, body, req.user.id);
  }

  /**
   * POST /workforce/timesheets/reject
   * Bulk reject timesheets (L3+)
   */
  @Post('timesheets/reject')
  @Roles('L3', 'L4', 'L5')
  async bulkReject(@Body() body: BulkApprovalDto, @Request() req: any) {
    return this.enterpriseService.bulkReject(req.user.orgId, body, req.user.id);
  }

  // ===== Payroll Export =====

  /**
   * POST /workforce/payroll/export
   * Export payroll data (L4+)
   */
  @Post('payroll/export')
  @Roles('L4', 'L5')
  async exportPayroll(@Body() body: PayrollExportDto, @Request() req: any) {
    return this.enterpriseService.exportPayroll(req.user.orgId, body, req.user.id);
  }
}
