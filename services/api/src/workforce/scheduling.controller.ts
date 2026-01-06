/**
 * M10.1: Workforce Scheduling Controller
 *
 * REST endpoints for shift templates and scheduled shifts.
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
  UseGuards,
  Request,
} from '@nestjs/common';
import { WorkforceSchedulingService } from './workforce-scheduling.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('workforce/scheduling')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SchedulingController {
  constructor(private readonly schedulingService: WorkforceSchedulingService) { }

  // ===== Shift Templates =====

  /**
   * GET /workforce/scheduling/templates
   * List shift templates (L3+)
   */
  @Get('templates')
  @Roles('L3', 'L4', 'L5')
  async getTemplates(
    @Query('branchId') branchId: string | undefined,
    @Query('isActive') isActive: string | undefined,
    @Request() req: any,
  ) {
    return this.schedulingService.getTemplates({
      orgId: req.user.orgId,
      branchId,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  /**
   * GET /workforce/scheduling/templates/:id
   * Get single template (L3+)
   */
  @Get('templates/:id')
  @Roles('L3', 'L4', 'L5')
  async getTemplate(@Param('id') id: string) {
    return this.schedulingService.getTemplate(id);
  }

  /**
   * POST /workforce/scheduling/templates
   * Create shift template (L4+)
   */
  @Post('templates')
  @Roles('L4', 'L5')
  async createTemplate(
    @Body()
    body: {
      name: string;
      branchId?: string;
      role?: string;
      startTime: string;
      endTime: string;
      breakMinutes?: number;
      description?: string;
    },
    @Request() req: any,
  ) {
    return this.schedulingService.createTemplate({
      orgId: req.user.orgId,
      name: body.name,
      branchId: body.branchId,
      role: body.role,
      startTime: body.startTime,
      endTime: body.endTime,
      breakMinutes: body.breakMinutes,
      description: body.description,
    });
  }

  /**
   * PATCH /workforce/scheduling/templates/:id
   * Update shift template (L4+)
   */
  @Patch('templates/:id')
  @Roles('L4', 'L5')
  async updateTemplate(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      branchId?: string;
      role?: string;
      startTime?: string;
      endTime?: string;
      durationMinutes?: number;
      breakMinutes?: number;
      color?: string;
      isActive?: boolean;
    },
  ) {
    return this.schedulingService.updateTemplate(id, body);
  }

  /**
   * DELETE /workforce/scheduling/templates/:id
   * Delete shift template (L5 only)
   */
  @Delete('templates/:id')
  @Roles('L5')
  async deleteTemplate(@Param('id') id: string) {
    return this.schedulingService.deleteTemplate(id);
  }

  // ===== Scheduled Shifts =====

  /**
   * GET /workforce/scheduling/shifts
   * List scheduled shifts (L2+, staff see own only)
   */
  @Get('shifts')
  @Roles('L2', 'L3', 'L4', 'L5')
  async getShifts(
    @Query('branchId') branchId: string | undefined,
    @Query('userId') userId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Request() req: any,
  ) {
    // Staff (L2) can only see own shifts
    const effectiveUserId =
      req.user.roleLevel === 'L2' ? req.user.id : userId;

    // Cast status to ShiftStatus type
    const statusFilter = status as 'DRAFT' | 'PUBLISHED' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'CANCELLED' | undefined;

    return this.schedulingService.getShifts({
      orgId: req.user.orgId,
      branchId,
      userId: effectiveUserId,
      status: statusFilter,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  /**
   * GET /workforce/scheduling/shifts/:id
   * Get single shift (L2+)
   */
  @Get('shifts/:id')
  @Roles('L2', 'L3', 'L4', 'L5')
  async getShift(@Param('id') id: string, @Request() req: any) {
    const shift = await this.schedulingService.getShift(id);
    // Staff can only view own shifts
    if (req.user.roleLevel === 'L2' && shift.userId !== req.user.id) {
      throw new Error('Access denied');
    }
    return shift;
  }

  /**
   * POST /workforce/scheduling/shifts
   * Create scheduled shift (L4+)
   */
  @Post('shifts')
  @Roles('L4', 'L5')
  async createShift(
    @Body()
    body: {
      branchId: string;
      userId: string;
      role: string;
      startAt: string;
      endAt: string;
      notes?: string;
    },
    @Request() req: any,
  ) {
    return this.schedulingService.createShift({
      orgId: req.user.orgId,
      branchId: body.branchId,
      userId: body.userId,
      role: body.role,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      notes: body.notes,
    });
  }

  /**
   * PATCH /workforce/scheduling/shifts/:id
   * Update scheduled shift (L4+, only DRAFT shifts)
   */
  @Patch('shifts/:id')
  @Roles('L4', 'L5')
  async updateShift(
    @Param('id') id: string,
    @Body()
    body: {
      startAt?: string;
      endAt?: string;
      role?: string;
      notes?: string;
    },
  ) {
    return this.schedulingService.updateShift(id, {
      startAt: body.startAt ? new Date(body.startAt) : undefined,
      endAt: body.endAt ? new Date(body.endAt) : undefined,
      role: body.role,
      notes: body.notes,
    });
  }

  /**
   * DELETE /workforce/scheduling/shifts/:id
   * Delete scheduled shift (L4+, only DRAFT shifts)
   */
  @Delete('shifts/:id')
  @Roles('L4', 'L5')
  async deleteShift(@Param('id') id: string) {
    return this.schedulingService.deleteShift(id);
  }

  /**
   * POST /workforce/scheduling/shifts/:id/cancel
   * Cancel a shift (L4+)
   */
  @Post('shifts/:id/cancel')
  @Roles('L4', 'L5')
  async cancelShift(@Param('id') id: string, @Request() req: any) {
    return this.schedulingService.cancelShift(id, req.user.id);
  }

  // ===== Publishing =====

  /**
   * POST /workforce/scheduling/publish
   * Publish DRAFT shifts in a date range (L4+)
   */
  @Post('publish')
  @Roles('L4', 'L5')
  async publishShifts(
    @Body() body: { branchId: string; from: string; to: string },
    @Request() req: any,
  ) {
    return this.schedulingService.publishShifts({
      orgId: req.user.orgId,
      branchId: body.branchId,
      from: new Date(body.from),
      to: new Date(body.to),
      publishedById: req.user.id,
    });
  }

  // ===== Conflict Detection =====

  /**
   * POST /workforce/scheduling/conflicts
   * Check for conflicts before creating/publishing (L4+)
   */
  @Post('conflicts')
  @Roles('L4', 'L5')
  async checkConflicts(
    @Body()
    body: {
      userId: string;
      startAt: string;
      endAt: string;
      excludeShiftId?: string;
    },
  ) {
    return this.schedulingService.checkConflicts(
      body.userId,
      new Date(body.startAt),
      new Date(body.endAt),
      body.excludeShiftId,
    );
  }

  // ===== Approvals =====

  /**
   * POST /workforce/scheduling/shifts/:id/approve
   * Approve a completed shift (L4+)
   */
  @Post('shifts/:id/approve')
  @Roles('L4', 'L5')
  async approveShift(@Param('id') id: string, @Request() req: any) {
    return this.schedulingService.approveShift(id, req.user.id);
  }
}
