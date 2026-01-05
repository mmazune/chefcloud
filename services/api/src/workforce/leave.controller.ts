/**
 * M10.17: Leave Management Controller
 *
 * Endpoints:
 * - Leave Types (org admin)
 * - Leave Policies (org admin)
 * - Leave Requests (employee self-service + manager approvals)
 * - Reports & Exports (manager/admin)
 * - Accrual admin operations
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
  Req,
  Res,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { LeaveTypesService } from './leave-types.service';
import { LeavePolicyService } from './leave-policy.service';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveAccrualService } from './leave-accrual.service';
import { LeaveReportingService } from './leave-reporting.service';

@ApiTags('Leave Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/workforce/leave')
export class LeaveController {
  constructor(
    private readonly leaveTypesService: LeaveTypesService,
    private readonly leavePolicyService: LeavePolicyService,
    private readonly leaveRequestsService: LeaveRequestsService,
    private readonly leaveAccrualService: LeaveAccrualService,
    private readonly leaveReportingService: LeaveReportingService,
  ) {}

  // ==================== LEAVE TYPES ====================

  @Post('types')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Create a leave type definition' })
  @ApiResponse({ status: 201, description: 'Leave type created' })
  async createLeaveType(@Req() req: any, @Body() body: any): Promise<any> {
    return this.leaveTypesService.create({
      orgId: req.user.organizationId,
      code: body.code,
      name: body.name,
      isPaid: body.isPaid,
      requiresApproval: body.requiresApproval ?? true,
      minNoticeHours: body.minNoticeHours ?? 0,
      maxConsecutiveDays: body.maxConsecutiveDays ?? 0,
    });
  }

  @Get('types')
  @ApiOperation({ summary: 'List all leave types for org' })
  async listLeaveTypes(@Req() req: any): Promise<any[]> {
    return this.leaveTypesService.findAll(req.user.organizationId);
  }

  @Get('types/:id')
  @ApiOperation({ summary: 'Get a leave type by ID' })
  async getLeaveType(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.leaveTypesService.findOne(id, req.user.organizationId);
  }

  @Put('types/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update a leave type' })
  async updateLeaveType(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ): Promise<any> {
    return this.leaveTypesService.update(id, req.user.organizationId, body);
  }

  @Delete('types/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Deactivate a leave type' })
  async deactivateLeaveType(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.leaveTypesService.deactivate(id, req.user.organizationId);
  }

  // ==================== LEAVE POLICIES ====================

  @Post('policies')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Create a leave policy' })
  @ApiResponse({ status: 201, description: 'Leave policy created' })
  async createPolicy(@Req() req: any, @Body() body: any): Promise<any> {
    return this.leavePolicyService.create({
      orgId: req.user.organizationId,
      branchId: body.branchId,
      leaveTypeId: body.leaveTypeId,
      name: body.name,
      accrualMethod: body.accrualMethod ?? 'NONE',
      accrualRate: body.accrualRate,
      carryoverMaxHours: body.carryoverMaxHours,
      maxBalanceHours: body.maxBalanceHours,
    });
  }

  @Get('policies')
  @ApiOperation({ summary: 'List all leave policies' })
  async listPolicies(@Req() req: any, @Query('branchId') branchId?: string): Promise<any[]> {
    return this.leavePolicyService.findAll(
      req.user.organizationId,
      branchId || undefined,
    );
  }

  @Get('policies/effective')
  @ApiOperation({ summary: 'Get effective policy for branch+leaveType' })
  async getEffectivePolicy(
    @Req() req: any,
    @Query('branchId') branchId: string,
    @Query('leaveTypeId') leaveTypeId: string,
  ) {
    return this.leavePolicyService.getEffectivePolicy(
      req.user.organizationId,
      branchId,
      leaveTypeId,
    );
  }

  @Put('policies/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update a leave policy' })
  async updatePolicy(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.leavePolicyService.update(id, req.user.organizationId, body);
  }

  @Delete('policies/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Deactivate a leave policy' })
  async deactivatePolicy(@Req() req: any, @Param('id') id: string) {
    return this.leavePolicyService.deactivate(id, req.user.organizationId);
  }

  // ==================== LEAVE REQUESTS (Employee Self-Service) ====================

  @Post('requests')
  @ApiOperation({ summary: 'Create a leave request (draft)' })
  @ApiResponse({ status: 201, description: 'Leave request created' })
  async createRequest(@Req() req: any, @Body() body: any) {
    return this.leaveRequestsService.create({
      orgId: req.user.organizationId,
      branchId: body.branchId || req.user.branchId,
      userId: req.user.userId,
      leaveTypeId: body.leaveTypeId,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      reason: body.reason,
    });
  }

  @Post('requests/:id/submit')
  @ApiOperation({ summary: 'Submit a draft leave request for approval' })
  async submitRequest(@Req() req: any, @Param('id') id: string) {
    return this.leaveRequestsService.submit(
      id,
      req.user.userId,
      req.user.organizationId,
    );
  }

  @Post('requests/:id/cancel')
  @ApiOperation({ summary: 'Cancel a leave request' })
  async cancelRequest(@Req() req: any, @Param('id') id: string) {
    return this.leaveRequestsService.cancel(
      id,
      req.user.userId,
      req.user.organizationId,
    );
  }

  @Get('requests/my')
  @ApiOperation({ summary: 'Get my leave requests' })
  async getMyRequests(@Req() req: any) {
    return this.leaveRequestsService.findByUser(
      req.user.userId,
      req.user.organizationId,
    );
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get a leave request by ID' })
  async getRequest(@Req() req: any, @Param('id') id: string) {
    return this.leaveRequestsService.findOne(id, req.user.organizationId);
  }

  @Get('balances/my')
  @ApiOperation({ summary: 'Get my leave balances' })
  async getMyBalances(@Req() req: any) {
    return this.leaveRequestsService.getUserBalances(
      req.user.userId,
      req.user.organizationId,
    );
  }

  // ==================== LEAVE APPROVALS (Manager) ====================

  @Get('approvals/pending')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Get pending leave requests for approval' })
  async getPendingApprovals(@Req() req: any) {
    const branchIds = req.user.branchIds || [req.user.branchId];
    return this.leaveRequestsService.findPendingApprovals(
      req.user.organizationId,
      branchIds,
    );
  }

  @Post('approvals/:id/approve')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Approve a leave request' })
  async approveRequest(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const branchIds = req.user.branchIds || [req.user.branchId];
    return this.leaveRequestsService.approve(id, req.user.organizationId, {
      approverId: req.user.userId,
      approverBranchIds: branchIds,
      overrideConflict: body.overrideConflict,
    });
  }

  @Post('approvals/:id/reject')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Reject a leave request' })
  async rejectRequest(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const branchIds = req.user.branchIds || [req.user.branchId];
    return this.leaveRequestsService.reject(
      id,
      req.user.organizationId,
      req.user.userId,
      branchIds,
      body.reason,
    );
  }

  // ==================== REPORTS & EXPORTS ====================

  @Get('reports/balances')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Get balance summary report' })
  async getBalanceReport(
    @Req() req: any,
    @Query('branchIds') branchIds?: string,
    @Query('leaveTypeId') leaveTypeId?: string,
  ) {
    return this.leaveReportingService.getBalanceSummary({
      orgId: req.user.organizationId,
      branchIds: branchIds?.split(','),
      leaveTypeId,
    });
  }

  @Get('reports/usage')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Get usage report' })
  async getUsageReport(
    @Req() req: any,
    @Query('branchIds') branchIds?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('leaveTypeId') leaveTypeId?: string,
  ) {
    return this.leaveReportingService.getUsageReport({
      orgId: req.user.organizationId,
      branchIds: branchIds?.split(','),
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      leaveTypeId,
    });
  }

  @Get('reports/calendar')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Get team calendar' })
  async getTeamCalendar(
    @Req() req: any,
    @Query('branchIds') branchIds: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.leaveReportingService.getTeamCalendar(
      req.user.organizationId,
      branchIds.split(','),
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('reports/dashboard')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Get dashboard stats' })
  async getDashboardStats(@Req() req: any, @Query('branchIds') branchIds?: string) {
    return this.leaveReportingService.getDashboardStats(
      req.user.organizationId,
      branchIds?.split(','),
    );
  }

  @Get('exports/balances')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Export balance summary as CSV' })
  async exportBalances(
    @Req() req: any,
    @Res() res: Response,
    @Query('branchIds') branchIds?: string,
  ) {
    const csv = await this.leaveReportingService.exportBalanceSummaryCsv({
      orgId: req.user.organizationId,
      branchIds: branchIds?.split(','),
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leave-balances.csv"');
    res.status(HttpStatus.OK).send(csv);
  }

  @Get('exports/usage')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Export usage report as CSV' })
  async exportUsage(
    @Req() req: any,
    @Res() res: Response,
    @Query('branchIds') branchIds?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const csv = await this.leaveReportingService.exportUsageReportCsv({
      orgId: req.user.organizationId,
      branchIds: branchIds?.split(','),
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leave-usage.csv"');
    res.status(HttpStatus.OK).send(csv);
  }

  @Get('exports/ledger')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Export ledger history as CSV' })
  async exportLedger(
    @Req() req: any,
    @Res() res: Response,
    @Query('userId') userId?: string,
    @Query('leaveTypeId') leaveTypeId?: string,
  ) {
    const csv = await this.leaveReportingService.exportLedgerHistoryCsv(
      req.user.organizationId,
      userId,
      leaveTypeId,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leave-ledger.csv"');
    res.status(HttpStatus.OK).send(csv);
  }

  // ==================== ACCRUAL ADMIN ====================

  @Post('admin/accrual/run')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Run monthly accrual (admin)' })
  async runAccrual(@Req() req: any, @Body() body: any) {
    const month = body.month || new Date().getMonth() + 1;
    const year = body.year || new Date().getFullYear();
    return this.leaveAccrualService.runMonthlyAccrual(
      req.user.organizationId,
      month,
      year,
    );
  }

  @Post('admin/carryover/run')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Run year-end carryover (admin)' })
  async runCarryover(@Req() req: any, @Body() body: any) {
    const year = body.year || new Date().getFullYear() - 1;
    return this.leaveAccrualService.runYearEndCarryover(
      req.user.organizationId,
      year,
    );
  }

  @Post('admin/balance/adjust')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Manual balance adjustment (admin)' })
  async adjustBalance(@Req() req: any, @Body() body: any): Promise<any> {
    return this.leaveAccrualService.adjustBalance(
      req.user.organizationId,
      body.userId,
      body.leaveTypeId,
      body.deltaHours,
      body.reason,
      req.user.userId,
    );
  }

  @Get('admin/ledger/:userId')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Get ledger history for a user' })
  async getLedgerHistory(
    @Param('userId') userId: string,
    @Query('leaveTypeId') leaveTypeId?: string,
  ): Promise<any[]> {
    return this.leaveAccrualService.getLedgerHistory(userId, leaveTypeId || '');
  }
}