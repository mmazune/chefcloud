/**
 * M10.18: Leave Enterprise Controller
 *
 * Endpoints for enterprise leave features:
 * - Calendar (team and self-service)
 * - Delegation management
 * - Two-step approvals
 * - Attachments
 * - Projections
 * - Extended exports
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { LeaveCalendarService } from './leave-calendar.service';
import { LeaveDelegationService } from './leave-delegation.service';
import { LeaveAttachmentsService } from './leave-attachments.service';
import { LeaveProjectionService } from './leave-projection.service';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveReportingService } from './leave-reporting.service';

// ==================== CALENDAR CONTROLLER ====================

@ApiTags('Leave Calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/workforce/leave')
export class LeaveCalendarController {
  constructor(
    private readonly calendarService: LeaveCalendarService,
    private readonly requestsService: LeaveRequestsService,
    private readonly reportingService: LeaveReportingService,
    private readonly projectionService: LeaveProjectionService,
    private readonly attachmentsService: LeaveAttachmentsService,
  ) { }

  // ===== A) Team Calendar =====

  @Get('calendar')
  @Roles('SUPERVISOR', 'MANAGER', 'OWNER')
  @ApiOperation({ summary: 'Get team leave calendar (L3+)' })
  async getTeamCalendar(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    return this.calendarService.getTeamCalendar(req.user.organizationId, {
      branchId,
      from: fromDate,
      to: toDate,
    });
  }

  @Get('calendar/summary')
  @Roles('SUPERVISOR', 'MANAGER', 'OWNER')
  @ApiOperation({ summary: 'Get calendar summary by day' })
  async getCalendarSummary(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    return this.calendarService.getCalendarSummary(req.user.organizationId, {
      branchId,
      from: fromDate,
      to: toDate,
    });
  }

  @Get('my-calendar')
  @Roles('STAFF', 'SUPERVISOR', 'MANAGER', 'OWNER')
  @ApiOperation({ summary: 'Get own leave calendar' })
  async getMyCalendar(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    return this.calendarService.getMyCalendar(
      req.user.organizationId,
      req.user.userId,
      fromDate,
      toDate,
    );
  }

  // ===== C) Two-Step Approvals =====

  @Post('requests/:id/approve-step1')
  @Roles('SUPERVISOR')
  @ApiOperation({ summary: 'Approve step 1 (supervisor)' })
  async approveStep1(@Req() req: any, @Param('id') id: string) {
    return this.requestsService.approveStep1(
      id,
      req.user.organizationId,
      req.user.userId,
      req.user.branchIds || [req.user.branchId],
    );
  }

  @Post('requests/:id/approve-final')
  @Roles('MANAGER', 'OWNER')
  @ApiOperation({ summary: 'Final approval (manager/owner)' })
  async approveFinal(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const roleLevel = req.user.role === 'OWNER' ? 5 : req.user.role === 'MANAGER' ? 4 : 3;
    return this.requestsService.approveWithStep(
      id,
      req.user.organizationId,
      {
        approverId: req.user.userId,
        approverBranchIds: req.user.branchIds || [req.user.branchId],
        overrideConflict: body.overrideConflict,
      },
      roleLevel,
    );
  }

  @Post('requests/:id/reject')
  @Roles('SUPERVISOR', 'MANAGER', 'OWNER')
  @ApiOperation({ summary: 'Reject at current step' })
  async rejectRequest(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.requestsService.rejectWithStep(
      id,
      req.user.organizationId,
      req.user.userId,
      req.user.branchIds || [req.user.branchId],
      body.reason,
    );
  }

  @Get('requests/pending-all')
  @Roles('SUPERVISOR', 'MANAGER', 'OWNER')
  @ApiOperation({ summary: 'Get all pending approvals including step1' })
  async getPendingAll(@Req() req: any) {
    const roleLevel = req.user.role === 'OWNER' ? 5 : req.user.role === 'MANAGER' ? 4 : 3;
    return this.requestsService.findPendingApprovalsWithSteps(
      req.user.organizationId,
      req.user.branchIds || [req.user.branchId],
      roleLevel,
    );
  }

  // ===== D) Attachments =====

  @Post('requests/:id/attachments')
  @Roles('STAFF', 'SUPERVISOR', 'MANAGER', 'OWNER')
  @ApiOperation({ summary: 'Add attachment to request' })
  async addAttachment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const roleLevel = req.user.role === 'OWNER' ? 5 : req.user.role === 'MANAGER' ? 4 : req.user.role === 'SUPERVISOR' ? 3 : 1;
    return this.attachmentsService.addAttachment(
      req.user.organizationId,
      id,
      body,
      req.user.userId,
      roleLevel,
    );
  }

  @Get('requests/:id/attachments')
  @Roles('STAFF', 'SUPERVISOR', 'MANAGER', 'OWNER')
  @ApiOperation({ summary: 'List attachments for request' })
  async listAttachments(@Req() req: any, @Param('id') id: string) {
    return this.attachmentsService.listAttachments(req.user.organizationId, id);
  }

  @Delete('attachments/:attachmentId')
  @Roles('STAFF', 'SUPERVISOR', 'MANAGER', 'OWNER')
  @ApiOperation({ summary: 'Delete attachment' })
  async deleteAttachment(@Req() req: any, @Param('attachmentId') attachmentId: string) {
    const roleLevel = req.user.role === 'OWNER' ? 5 : req.user.role === 'MANAGER' ? 4 : req.user.role === 'SUPERVISOR' ? 3 : 1;
    await this.attachmentsService.deleteAttachment(
      req.user.organizationId,
      attachmentId,
      req.user.userId,
      roleLevel,
    );
    return { success: true };
  }

  // ===== E) Projections =====

  @Get('balances/projection')
  @Roles('STAFF', 'SUPERVISOR', 'MANAGER', 'OWNER')
  @ApiOperation({ summary: 'Get balance projection' })
  async getProjection(
    @Req() req: any,
    @Query('userId') userId?: string,
    @Query('leaveTypeId') leaveTypeId?: string,
    @Query('months') months?: string,
  ) {
    const targetUserId = userId || req.user.userId;
    const monthCount = months ? parseInt(months, 10) : 12;

    if (leaveTypeId) {
      return this.projectionService.getProjection(
        req.user.organizationId,
        targetUserId,
        leaveTypeId,
        monthCount,
      );
    }

    return this.projectionService.getAllProjections(
      req.user.organizationId,
      targetUserId,
      monthCount,
    );
  }

  // ===== F) Extended Reports & Exports =====

  @Get('reports/approvals')
  @Roles('SUPERVISOR', 'MANAGER', 'OWNER')
  @ApiOperation({ summary: 'Get approval statistics' })
  async getApprovalStats(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const branchIds = branchId ? [branchId] : req.user.branchIds || [req.user.branchId];
    const startDate = from ? new Date(from) : undefined;
    const endDate = to ? new Date(to) : undefined;

    return this.reportingService.getApprovalStats(
      req.user.organizationId,
      branchIds,
      startDate,
      endDate,
    );
  }

  @Get('reports/export/calendar')
  @Roles('SUPERVISOR', 'MANAGER', 'OWNER')
  @ApiOperation({ summary: 'Export calendar as CSV' })
  async exportCalendar(
    @Req() req: any,
    @Res() res: Response,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const branchIds = branchId ? [branchId] : req.user.branchIds || [req.user.branchId];
    const startDate = from ? new Date(from) : undefined;
    const endDate = to ? new Date(to) : undefined;

    const csv = await this.reportingService.exportCalendarCsv(
      req.user.organizationId,
      branchIds,
      startDate,
      endDate,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=leave-calendar.csv');
    return res.send(csv);
  }

  @Get('reports/export/approvals')
  @Roles('SUPERVISOR', 'MANAGER', 'OWNER')
  @ApiOperation({ summary: 'Export approvals report as CSV' })
  async exportApprovals(
    @Req() req: any,
    @Res() res: Response,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const branchIds = branchId ? [branchId] : req.user.branchIds || [req.user.branchId];
    const startDate = from ? new Date(from) : undefined;
    const endDate = to ? new Date(to) : undefined;

    const csv = await this.reportingService.exportApprovalsCsv(
      req.user.organizationId,
      branchIds,
      startDate,
      endDate,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=leave-approvals.csv');
    return res.send(csv);
  }
}

// ==================== DELEGATION CONTROLLER ====================

@ApiTags('Leave Delegation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/workforce/leave/delegates')
export class LeaveDelegationController {
  constructor(private readonly delegationService: LeaveDelegationService) { }

  @Get()
  @Roles('MANAGER', 'OWNER')
  @ApiOperation({ summary: 'List approval delegates' })
  async listDelegates(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('principalUserId') principalUserId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.delegationService.listDelegates(req.user.organizationId, {
      branchId,
      principalUserId,
      activeOnly: activeOnly === 'true',
    });
  }

  @Post()
  @Roles('MANAGER', 'OWNER')
  @ApiOperation({ summary: 'Create approval delegate' })
  async createDelegate(@Req() req: any, @Body() body: any) {
    const roleLevel = req.user.role === 'OWNER' ? 5 : 4;
    return this.delegationService.createDelegate(
      req.user.organizationId,
      {
        principalUserId: body.principalUserId,
        delegateUserId: body.delegateUserId,
        branchId: body.branchId,
        startAt: new Date(body.startAt),
        endAt: new Date(body.endAt),
      },
      req.user.userId,
      roleLevel,
    );
  }

  @Get(':id')
  @Roles('MANAGER', 'OWNER')
  @ApiOperation({ summary: 'Get delegate by ID' })
  async getDelegate(@Req() req: any, @Param('id') id: string) {
    return this.delegationService.getDelegate(req.user.organizationId, id);
  }

  @Patch(':id')
  @Roles('MANAGER', 'OWNER')
  @ApiOperation({ summary: 'Update delegate' })
  async updateDelegate(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.delegationService.updateDelegate(req.user.organizationId, id, {
      startAt: body.startAt ? new Date(body.startAt) : undefined,
      endAt: body.endAt ? new Date(body.endAt) : undefined,
      enabled: body.enabled,
    });
  }

  @Delete(':id')
  @Roles('MANAGER', 'OWNER')
  @ApiOperation({ summary: 'Delete delegate' })
  async deleteDelegate(@Req() req: any, @Param('id') id: string) {
    await this.delegationService.deleteDelegate(req.user.organizationId, id);
    return { success: true };
  }
}
