/**
 * M10.5: Adjustments Controller
 * 
 * Endpoints for timesheet adjustment workflow: request → approve/reject
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Controller,
  Get,
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
  AdjustmentsService, 
  RequestAdjustmentDto, 
  AdjustmentStatus 
} from './adjustments.service';

@Controller('workforce/adjustments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AdjustmentsController {
  constructor(private readonly adjustmentsService: AdjustmentsService) {}

  /**
   * POST /workforce/adjustments
   * Request an adjustment for own time entry
   * 
   * RBAC: All roles (L1-L5) can request adjustments for their own entries
   */
  @Post()
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async requestAdjustment(@Body() dto: RequestAdjustmentDto, @Request() req: any) {
    return this.adjustmentsService.requestAdjustment(
      req.user.orgId,
      req.user.userId,
      dto
    );
  }

  /**
   * GET /workforce/adjustments
   * List adjustments (for supervisors/managers)
   * 
   * RBAC: L3+ can list adjustments
   */
  @Get()
  @Roles('L3', 'L4', 'L5')
  async listAdjustments(
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query('userId') userId?: string,
    @Request() req?: any,
  ) {
    return this.adjustmentsService.listAdjustments(req.user.orgId, {
      status: status as AdjustmentStatus,
      branchId,
      userId,
    });
  }

  /**
   * GET /workforce/adjustments/:id
   * Get a single adjustment
   * 
   * RBAC: L3+ can view adjustment details
   */
  @Get(':id')
  @Roles('L3', 'L4', 'L5')
  async getAdjustment(@Param('id') id: string, @Request() req: any) {
    return this.adjustmentsService.getAdjustment(req.user.orgId, id);
  }

  /**
   * POST /workforce/adjustments/:id/approve
   * Approve an adjustment
   * 
   * RBAC: L3+ can approve adjustments
   */
  @Post(':id/approve')
  @Roles('L3', 'L4', 'L5')
  async approveAdjustment(@Param('id') id: string, @Request() req: any) {
    return this.adjustmentsService.approveAdjustment(
      req.user.orgId,
      req.user.userId,
      { adjustmentId: id }
    );
  }

  /**
   * POST /workforce/adjustments/:id/reject
   * Reject an adjustment
   * 
   * RBAC: L3+ can reject adjustments
   */
  @Post(':id/reject')
  @Roles('L3', 'L4', 'L5')
  async rejectAdjustment(
    @Param('id') id: string,
    @Body('rejectionReason') rejectionReason?: string,
    @Request() req?: any,
  ) {
    return this.adjustmentsService.rejectAdjustment(
      req.user.orgId,
      req.user.userId,
      { adjustmentId: id, rejectionReason }
    );
  }

  /**
   * GET /workforce/adjustments/counts
   * Get adjustment counts for reporting
   * 
   * RBAC: L3+ can view counts
   */
  @Get('report/counts')
  @Roles('L3', 'L4', 'L5')
  async getAdjustmentCounts(
    @Query('branchId') branchId?: string,
    @Request() req?: any,
  ) {
    return this.adjustmentsService.getAdjustmentCounts(req.user.orgId, branchId);
  }
}
