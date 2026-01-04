/**
 * M10.11: Swaps Controller
 * 
 * Endpoints for shift swap workflows:
 * - Self-service: /workforce/self/swaps
 * - Manager view: /workforce/swaps
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
import { SwapsService, CreateSwapInput, SwapFilters } from './swaps.service';
import type { ShiftSwapRequestStatus, ShiftSwapRequestType } from '@chefcloud/db';

// ===== SELF-SERVICE CONTROLLER =====

@Controller('workforce/self/swaps')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SelfSwapsController {
  constructor(private readonly swapsService: SwapsService) {}

  /**
   * GET /workforce/self/swaps
   * Get my swap requests (as requester)
   */
  @Get()
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async getMySwapRequests(
    @Query('status') status?: ShiftSwapRequestStatus,
    @Query('type') type?: ShiftSwapRequestType,
    @Request() req?: any,
  ) {
    const filters: SwapFilters = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
    return this.swapsService.getMySwapRequests(req.user.userId, req.user.orgId, filters);
  }

  /**
   * GET /workforce/self/swaps/incoming
   * Get swap requests targeting me
   */
  @Get('incoming')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async getIncomingSwapRequests(
    @Query('status') status?: ShiftSwapRequestStatus,
    @Request() req?: any,
  ) {
    const filters: SwapFilters = {};
    if (status) filters.status = status;
    return this.swapsService.getSwapRequestsForMe(req.user.userId, req.user.orgId, filters);
  }

  /**
   * GET /workforce/self/swaps/offers
   * Get available shift offers to claim
   */
  @Get('offers')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async getAvailableOffers(
    @Query('branchId') branchId?: string,
    @Request() req?: any,
  ) {
    return this.swapsService.getAvailableOffers(req.user.orgId, branchId);
  }

  /**
   * POST /workforce/self/swaps
   * Create a new swap request
   */
  @Post()
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async createSwapRequest(
    @Body() body: {
      type: ShiftSwapRequestType;
      requesterShiftId: string;
      targetUserId?: string;
      targetShiftId?: string;
      reason?: string;
      submitImmediately?: boolean;
    },
    @Request() req: any,
  ) {
    const input: CreateSwapInput = {
      type: body.type,
      requesterShiftId: body.requesterShiftId,
      targetUserId: body.targetUserId,
      targetShiftId: body.targetShiftId,
      reason: body.reason,
      submitImmediately: body.submitImmediately ?? true,
    };
    return this.swapsService.createSwapRequest(req.user.userId, req.user.orgId, input);
  }

  /**
   * PUT /workforce/self/swaps/:id/submit
   * Submit a draft swap request
   */
  @Put(':id/submit')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async submitSwapRequest(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.swapsService.submitSwapRequest(req.user.userId, req.user.orgId, id);
  }

  /**
   * PUT /workforce/self/swaps/:id/cancel
   * Cancel my swap request
   */
  @Put(':id/cancel')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async cancelSwapRequest(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.swapsService.cancelSwapRequest(req.user.userId, req.user.orgId, id);
  }

  /**
   * PUT /workforce/self/swaps/:id/accept
   * Accept a swap request (as target)
   */
  @Put(':id/accept')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async acceptSwap(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.swapsService.acceptSwap(req.user.userId, req.user.orgId, id);
  }

  /**
   * PUT /workforce/self/swaps/:id/decline
   * Decline a swap request (as target)
   */
  @Put(':id/decline')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async declineSwap(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    return this.swapsService.declineSwap(req.user.userId, req.user.orgId, id, body.reason);
  }

  /**
   * PUT /workforce/self/swaps/:id/claim
   * Claim an offered shift
   */
  @Put(':id/claim')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async claimOfferedShift(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.swapsService.claimOfferedShift(req.user.userId, req.user.orgId, id);
  }
}

// ===== MANAGER CONTROLLER =====

@Controller('workforce/swaps')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SwapsController {
  constructor(private readonly swapsService: SwapsService) {}

  /**
   * GET /workforce/swaps
   * Get all swap requests (manager view)
   */
  @Get()
  @Roles('L3', 'L4', 'L5')
  async getSwapRequests(
    @Query('status') status?: ShiftSwapRequestStatus,
    @Query('type') type?: ShiftSwapRequestType,
    @Query('branchId') branchId?: string,
    @Query('requesterId') requesterId?: string,
    @Request() req?: any,
  ) {
    const filters: SwapFilters = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (branchId) filters.branchId = branchId;
    if (requesterId) filters.requesterId = requesterId;
    return this.swapsService.getSwapRequests(req.user.orgId, filters);
  }

  /**
   * GET /workforce/swaps/pending-approval
   * Get swaps pending manager approval
   */
  @Get('pending-approval')
  @Roles('L3', 'L4', 'L5')
  async getPendingApproval(
    @Query('branchId') branchId?: string,
    @Request() req?: any,
  ) {
    // DIRECT_SWAP: status = ACCEPTED (waiting for manager approval)
    // OFFER_SHIFT: status = REQUESTED with claimer set
    const directSwaps = await this.swapsService.getSwapRequests(req.user.orgId, {
      status: 'ACCEPTED',
      branchId,
    });

    const offerSwaps = await this.swapsService.getSwapRequests(req.user.orgId, {
      type: 'OFFER_SHIFT',
      status: 'REQUESTED',
      branchId,
    });

    // Filter offers that have a claimer
    const offersWithClaimer = offerSwaps.filter(s => s.claimer !== null);

    return [...directSwaps, ...offersWithClaimer];
  }

  /**
   * GET /workforce/swaps/:id
   * Get a specific swap request
   */
  @Get(':id')
  @Roles('L3', 'L4', 'L5')
  async getSwapById(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.swapsService.getSwapById(id, req.user.orgId);
  }

  /**
   * PUT /workforce/swaps/:id/approve
   * Approve a swap request
   */
  @Put(':id/approve')
  @Roles('L3', 'L4', 'L5')
  async approveSwap(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.swapsService.approveSwap(req.user.userId, req.user.orgId, id);
  }

  /**
   * PUT /workforce/swaps/:id/reject
   * Reject a swap request
   */
  @Put(':id/reject')
  @Roles('L3', 'L4', 'L5')
  async rejectSwap(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    return this.swapsService.rejectSwap(req.user.userId, req.user.orgId, id, body.reason);
  }
}
