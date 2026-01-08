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
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpStatus,
  HttpCode,
  ForbiddenException,
  BadRequestException,
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
@Controller('workforce/leave')
export class LeaveController {
  constructor(
    private readonly leaveTypesService: LeaveTypesService,
    private readonly leavePolicyService: LeavePolicyService,
    private readonly leaveRequestsService: LeaveRequestsService,
    private readonly leaveAccrualService: LeaveAccrualService,
    private readonly leaveReportingService: LeaveReportingService,
  ) { }

  // ==================== LEAVE TYPES ====================

  @Post('types')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Create a leave type definition' })
  @ApiResponse({ status: 201, description: 'Leave type created' })
  async createLeaveType(@Req() req: any, @Body() body: any): Promise<any> {
    return this.leaveTypesService.create({
      orgId: req.user.orgId,
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
    return this.leaveTypesService.findAll(req.user.orgId);
  }

  @Get('types/:id')
  @ApiOperation({ summary: 'Get a leave type by ID' })
  async getLeaveType(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.leaveTypesService.findOne(id, req.user.orgId);
  }

  @Patch('types/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update a leave type' })
  async updateLeaveType(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ): Promise<any> {
    return this.leaveTypesService.update(id, req.user.orgId, body);
  }

  @Delete('types/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Deactivate a leave type' })
  async deactivateLeaveType(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.leaveTypesService.deactivate(id, req.user.orgId);
  }

  // ==================== LEAVE POLICIES ====================

  @Post('policies')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Create a leave policy' })
  @ApiResponse({ status: 201, description: 'Leave policy created' })
  async createPolicy(@Req() req: any, @Body() body: any): Promise<any> {
    return this.leavePolicyService.create({
      orgId: req.user.orgId,
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
      req.user.orgId,
      branchId || undefined,
    );
  }

  @Get('policies/effective')
  @ApiOperation({ summary: 'Get effective policy for user or branch+leaveType' })
  async getEffectivePolicy(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('leaveTypeId') leaveTypeId?: string,
    @Query('userId') userId?: string,
  ) {
    // If userId provided, look up their branch
    const effectiveBranchId = branchId || req.user.branchId;
    return this.leavePolicyService.getEffectivePolicy(
      req.user.orgId,
      effectiveBranchId,
      leaveTypeId || '',
    );
  }

  @Patch('policies/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update a leave policy' })
  async updatePolicy(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.leavePolicyService.update(id, req.user.orgId, body);
  }

  @Delete('policies/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Deactivate a leave policy' })
  async deactivatePolicy(@Req() req: any, @Param('id') id: string) {
    return this.leavePolicyService.deactivate(id, req.user.orgId);
  }

  // ==================== LEAVE REQUESTS (Employee Self-Service) ====================

  @Post('requests')
  @ApiOperation({ summary: 'Create a leave request (draft)' })
  @ApiResponse({ status: 201, description: 'Leave request created' })
  async createRequest(@Req() req: any, @Body() body: any) {
    return this.leaveRequestsService.create({
      orgId: req.user.orgId,
      branchId: body.branchId || req.user.branchId,
      userId: req.user.userId,
      leaveTypeId: body.leaveTypeId,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      reason: body.reason,
    });
  }

  @Patch('requests/:id/submit')
  @ApiOperation({ summary: 'Submit a draft leave request for approval' })
  async submitRequest(@Req() req: any, @Param('id') id: string) {
    return this.leaveRequestsService.submit(
      id,
      req.user.userId,
      req.user.orgId,
    );
  }

  @Patch('requests/:id/cancel')
  @ApiOperation({ summary: 'Cancel a leave request' })
  async cancelRequest(@Req() req: any, @Param('id') id: string) {
    return this.leaveRequestsService.cancel(
      id,
      req.user.userId,
      req.user.orgId,
    );
  }

  @Get('requests/my')
  @ApiOperation({ summary: 'Get my leave requests' })
  async getMyRequests(@Req() req: any) {
    return this.leaveRequestsService.findByUser(
      req.user.userId,
      req.user.orgId,
    );
  }

  // ==================== LEAVE APPROVALS (Manager) ====================
  // NOTE: Must come BEFORE requests/:id to avoid route matching conflict

  @Get('requests/pending')
  @Roles('OWNER', 'MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Get pending leave requests for approval' })
  async getPendingApprovals(@Req() req: any) {
    const branchIds = req.user.branchIds || [req.user.branchId];
    return this.leaveRequestsService.findPendingApprovals(
      req.user.orgId,
      branchIds,
    );
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get a leave request by ID' })
  async getRequest(@Req() req: any, @Param('id') id: string) {
    return this.leaveRequestsService.findOne(id, req.user.orgId);
  }

  @Get('balances/my')
  @ApiOperation({ summary: 'Get my leave balances' })
  async getMyBalances(@Req() req: any) {
    return this.leaveRequestsService.getUserBalances(
      req.user.userId,
      req.user.orgId,
    );
  }

  @Patch('requests/:id/approve')
  @Roles('OWNER', 'MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Approve a leave request' })
  async approveRequest(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const branchIds = req.user.branchIds || [req.user.branchId];
    return this.leaveRequestsService.approve(id, req.user.orgId, {
      approverId: req.user.userId,
      approverBranchIds: branchIds,
      overrideConflict: body.overrideConflict,
    });
  }

  @Patch('requests/:id/reject')
  @Roles('OWNER', 'MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Reject a leave request' })
  async rejectRequest(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const branchIds = req.user.branchIds || [req.user.branchId];
    return this.leaveRequestsService.reject(
      id,
      req.user.orgId,
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
      orgId: req.user.orgId,
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
    @Query('year') year?: string,
  ) {
    // Support year-based query
    let start: Date | undefined = startDate ? new Date(startDate) : undefined;
    let end: Date | undefined = endDate ? new Date(endDate) : undefined;
    
    if (year && !startDate && !endDate) {
      const y = parseInt(year, 10);
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31);
    }
    
    return this.leaveReportingService.getUsageReport({
      orgId: req.user.orgId,
      branchIds: branchIds?.split(','),
      startDate: start,
      endDate: end,
      leaveTypeId,
    });
  }

  @Get('reports/calendar')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Get team calendar' })
  async getTeamCalendar(
    @Req() req: any,
    @Query('branchIds') branchIds?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    // Support both (startDate,endDate) and (month,year) formats
    let start: Date;
    let end: Date;
    
    if (month && year) {
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 0); // Last day of month
    } else {
      start = startDate ? new Date(startDate) : new Date();
      end = endDate ? new Date(endDate) : new Date();
    }
    
    const branches = branchIds?.split(',') || [];
    return this.leaveReportingService.getTeamCalendar(
      req.user.orgId,
      branches,
      start,
      end,
    );
  }

  @Get('reports/dashboard')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Get dashboard stats' })
  async getDashboardStats(@Req() req: any, @Query('branchIds') branchIds?: string) {
    return this.leaveReportingService.getDashboardStats(
      req.user.orgId,
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
      orgId: req.user.orgId,
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
      orgId: req.user.orgId,
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
      req.user.orgId,
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
      req.user.orgId,
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
      req.user.orgId,
      year,
    );
  }

  @Post('admin/balance/adjust')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Manual balance adjustment (admin)' })
  async adjustBalance(@Req() req: any, @Body() body: any): Promise<any> {
    return this.leaveAccrualService.adjustBalance(
      req.user.orgId,
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

  // ==================== ROUTE ALIASES (for test compatibility) ====================

  @Post('admin/run-accrual')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER')
  @ApiOperation({ summary: 'Run monthly accrual (alias)' })
  async runAccrualAlias(@Req() req: any, @Body() body: any) {
    const month = body.month || new Date().getMonth() + 1;
    const year = body.year || new Date().getFullYear();
    const results = await this.leaveAccrualService.runMonthlyAccrual(
      req.user.orgId,
      month,
      year,
    );
    return { processedCount: results.length, results };
  }

  @Post('balance/adjust')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Manual balance adjustment (alias)' })
  async adjustBalanceAlias(@Req() req: any, @Body() body: any): Promise<any> {
    return this.leaveAccrualService.adjustBalance(
      req.user.orgId,
      body.userId,
      body.leaveTypeId,
      body.deltaHours ?? body.days * 8, // Convert days to hours if needed
      body.reason,
      req.user.userId,
    );
  }

  @Get('balance')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Get current balance for a user and leave type' })
  async getBalance(
    @Req() req: any,
    @Query('userId') userId: string,
    @Query('leaveTypeId') leaveTypeId: string,
  ): Promise<any> {
    if (!userId || !leaveTypeId) {
      throw new BadRequestException('userId and leaveTypeId are required');
    }
    const balance = await this.leaveAccrualService.getCurrentBalance(userId, leaveTypeId);
    return { balance: balance.toNumber() };
  }

  @Get('balance/history')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Get ledger history (alias)' })
  async getBalanceHistory(
    @Req() req: any,
    @Query('userId') userId: string,
    @Query('leaveTypeId') leaveTypeId?: string,
  ): Promise<any[]> {
    return this.leaveAccrualService.getLedgerHistory(userId, leaveTypeId || '');
  }

  @Get('reports/balance-summary')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Get balance summary (alias)' })
  async getBalanceSummaryAlias(@Req() req: any) {
    return this.leaveReportingService.getBalanceSummary({
      orgId: req.user.orgId,
    });
  }

  @Get('exports/balance-summary')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Export balance summary (alias)' })
  async exportBalanceSummaryAlias(@Req() req: any, @Res() res: Response) {
    const csv = await this.leaveReportingService.exportBalanceSummaryCsv({
      orgId: req.user.orgId,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leave-balances.csv"');
    res.status(HttpStatus.OK).send(csv);
  }

  @Get('requests/user/:userId')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Get leave requests for a user (admin view)' })
  async getUserRequests(
    @Req() req: any,
    @Param('userId') userId: string,
  ) {
    // RBAC: Only OWNER/MANAGER can view other users' requests
    // Staff can't call this due to @Roles guard
    return this.leaveRequestsService.findByUser(
      userId,
      req.user.orgId,
    );
  }
}
