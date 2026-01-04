/**
 * M10.11: Open Shifts Controller
 * 
 * Endpoints for open shift management:
 * - Self-service: /workforce/self/open-shifts
 * - Manager view: /workforce/open-shifts
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OpenShiftsService, OpenShiftFilters } from './open-shifts.service';

// ===== SELF-SERVICE CONTROLLER =====

@Controller('workforce/self/open-shifts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SelfOpenShiftsController {
  constructor(private readonly openShiftsService: OpenShiftsService) {}

  /**
   * GET /workforce/self/open-shifts
   * Get available open shifts to claim
   */
  @Get()
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async getOpenShifts(
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('role') role?: string,
    @Request() req?: any,
  ) {
    const filters: OpenShiftFilters = {};
    if (branchId) filters.branchId = branchId;
    if (from) filters.from = new Date(from);
    if (to) filters.to = new Date(to);
    if (role) filters.role = role;
    return this.openShiftsService.getOpenShifts(req.user.userId, req.user.orgId, filters);
  }

  /**
   * GET /workforce/self/open-shifts/my-claims
   * Get my open shift claims
   */
  @Get('my-claims')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async getMyClaims(@Request() req: any) {
    return this.openShiftsService.getMyClaims(req.user.userId, req.user.orgId);
  }

  /**
   * POST /workforce/self/open-shifts/:shiftId/claim
   * Claim an open shift
   */
  @Post(':shiftId/claim')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async claimShift(
    @Param('shiftId') shiftId: string,
    @Request() req: any,
  ) {
    return this.openShiftsService.claimShift(req.user.userId, req.user.orgId, shiftId);
  }

  /**
   * PUT /workforce/self/open-shifts/claims/:claimId/withdraw
   * Withdraw my claim on an open shift
   */
  @Put('claims/:claimId/withdraw')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async withdrawClaim(
    @Param('claimId') claimId: string,
    @Request() req: any,
  ) {
    return this.openShiftsService.withdrawClaim(req.user.userId, req.user.orgId, claimId);
  }
}

// ===== MANAGER CONTROLLER =====

@Controller('workforce/open-shifts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class OpenShiftsController {
  constructor(private readonly openShiftsService: OpenShiftsService) {}

  /**
   * GET /workforce/open-shifts
   * Get all open shifts (manager view)
   */
  @Get()
  @Roles('L3', 'L4', 'L5')
  async getOpenShifts(
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('role') role?: string,
    @Request() req?: any,
  ) {
    const filters: OpenShiftFilters = {};
    if (branchId) filters.branchId = branchId;
    if (from) filters.from = new Date(from);
    if (to) filters.to = new Date(to);
    if (role) filters.role = role;
    return this.openShiftsService.getOpenShifts(req.user.userId, req.user.orgId, filters);
  }

  /**
   * POST /workforce/open-shifts
   * Create a new open shift
   */
  @Post()
  @Roles('L3', 'L4', 'L5')
  async createOpenShift(
    @Body() body: {
      branchId: string;
      startAt: string;
      endAt: string;
      role?: string;
      notes?: string;
    },
    @Request() req: any,
  ) {
    return this.openShiftsService.createOpenShift(
      req.user.userId,
      req.user.orgId,
      body.branchId,
      {
        startAt: new Date(body.startAt),
        endAt: new Date(body.endAt),
        role: body.role,
        notes: body.notes,
      },
    );
  }

  /**
   * PUT /workforce/open-shifts/:shiftId/publish
   * Publish an existing shift as open
   */
  @Put(':shiftId/publish')
  @Roles('L3', 'L4', 'L5')
  async publishAsOpen(
    @Param('shiftId') shiftId: string,
    @Request() req: any,
  ) {
    return this.openShiftsService.publishAsOpen(req.user.userId, req.user.orgId, shiftId);
  }

  /**
   * PUT /workforce/open-shifts/:shiftId/close
   * Close an open shift
   */
  @Put(':shiftId/close')
  @Roles('L3', 'L4', 'L5')
  async closeOpenShift(
    @Param('shiftId') shiftId: string,
    @Request() req: any,
  ) {
    return this.openShiftsService.closeOpenShift(req.user.userId, req.user.orgId, shiftId);
  }

  /**
   * GET /workforce/open-shifts/:shiftId/claims
   * Get claims for a specific open shift
   */
  @Get(':shiftId/claims')
  @Roles('L3', 'L4', 'L5')
  async getClaimsForShift(
    @Param('shiftId') shiftId: string,
    @Request() req: any,
  ) {
    return this.openShiftsService.getClaimsForShift(req.user.orgId, shiftId);
  }

  /**
   * GET /workforce/open-shifts/claims/pending
   * Get all pending claims (manager view)
   */
  @Get('claims/pending')
  @Roles('L3', 'L4', 'L5')
  async getPendingClaims(
    @Query('branchId') branchId?: string,
    @Request() req?: any,
  ) {
    return this.openShiftsService.getPendingClaims(req.user.orgId, branchId);
  }

  /**
   * PUT /workforce/open-shifts/claims/:claimId/approve
   * Approve a claim
   */
  @Put('claims/:claimId/approve')
  @Roles('L3', 'L4', 'L5')
  async approveClaim(
    @Param('claimId') claimId: string,
    @Request() req: any,
  ) {
    return this.openShiftsService.approveClaim(req.user.userId, req.user.orgId, claimId);
  }

  /**
   * PUT /workforce/open-shifts/claims/:claimId/reject
   * Reject a claim
   */
  @Put('claims/:claimId/reject')
  @Roles('L3', 'L4', 'L5')
  async rejectClaim(
    @Param('claimId') claimId: string,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    return this.openShiftsService.rejectClaim(req.user.userId, req.user.orgId, claimId, body.reason);
  }
}
