/**
 * M10.11: Shift Swaps Service
 * 
 * Manages shift swap workflows:
 * - DIRECT_SWAP: Requester proposes to swap with specific target
 * - OFFER_SHIFT: Requester offers shift for anyone to claim
 * 
 * 8-state lifecycle:
 * DRAFT → REQUESTED → [Target: ACCEPTED/DECLINED] → [Manager: APPROVED/REJECTED] → APPLIED
 *                   → CANCELLED (at any point before APPLIED)
 * 
 * Reference: Kimai (AGPL) study-only for approval workflow patterns
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WorkforceConflictsService } from './workforce-conflicts.service';
import { WorkforceNotificationsService } from './workforce-notifications.service';
import type { ShiftSwapRequestStatus, ShiftSwapRequestType } from '@chefcloud/db';

export interface CreateSwapInput {
  type: ShiftSwapRequestType;
  requesterShiftId: string;
  targetUserId?: string; // Required for DIRECT_SWAP
  targetShiftId?: string; // Required for DIRECT_SWAP
  reason?: string;
  submitImmediately?: boolean; // If true, go directly to REQUESTED (skip DRAFT)
}

export interface SwapRequestSummary {
  id: string;
  type: ShiftSwapRequestType;
  status: ShiftSwapRequestStatus;
  requester: { id: string; name: string };
  requesterShift: { id: string; startAt: Date; endAt: Date; role: string | null };
  targetUser?: { id: string; name: string } | null;
  targetShift?: { id: string; startAt: Date; endAt: Date; role: string | null } | null;
  claimer?: { id: string; name: string } | null;
  reason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SwapFilters {
  status?: ShiftSwapRequestStatus | ShiftSwapRequestStatus[];
  type?: ShiftSwapRequestType;
  requesterId?: string;
  targetUserId?: string;
  branchId?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class SwapsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conflicts: WorkforceConflictsService,
    private readonly notifications: WorkforceNotificationsService,
  ) {}

  // ===== REQUESTER ACTIONS =====

  /**
   * Create a new swap request (DRAFT or REQUESTED state)
   */
  async createSwapRequest(
    requesterId: string,
    orgId: string,
    input: CreateSwapInput,
  ): Promise<SwapRequestSummary> {
    // Validate input based on type
    if (input.type === 'DIRECT_SWAP') {
      if (!input.targetUserId || !input.targetShiftId) {
        throw new BadRequestException('DIRECT_SWAP requires targetUserId and targetShiftId');
      }
    }

    // Verify requester owns the shift
    const requesterShift = await this.prisma.client.scheduledShift.findUnique({
      where: { id: input.requesterShiftId },
      include: { branch: true },
    });

    if (!requesterShift) {
      throw new NotFoundException('Requester shift not found');
    }
    if (requesterShift.userId !== requesterId) {
      throw new ForbiddenException('You can only request swaps for your own shifts');
    }
    if (requesterShift.orgId !== orgId) {
      throw new ForbiddenException('Shift does not belong to your organization');
    }

    // For DIRECT_SWAP, validate target
    let targetShift = null;
    if (input.type === 'DIRECT_SWAP' && input.targetShiftId) {
      targetShift = await this.prisma.client.scheduledShift.findUnique({
        where: { id: input.targetShiftId },
      });

      if (!targetShift) {
        throw new NotFoundException('Target shift not found');
      }
      if (targetShift.userId !== input.targetUserId) {
        throw new BadRequestException('Target shift does not belong to target user');
      }
      if (targetShift.orgId !== orgId) {
        throw new ForbiddenException('Target shift does not belong to your organization');
      }

      // Pre-validate swap conflicts (only if submitting immediately)
      if (input.submitImmediately) {
        const validation = await this.conflicts.validateSwap(
          requesterId,
          input.requesterShiftId,
          input.targetUserId!,
          input.targetShiftId,
          orgId,
        );

        if (!validation.valid) {
          throw new ConflictException(`Swap conflicts detected: ${validation.errors.join('; ')}`);
        }
      }
    }

    const initialStatus: ShiftSwapRequestStatus = input.submitImmediately ? 'REQUESTED' : 'DRAFT';

    const swapRequest = await this.prisma.client.shiftSwapRequest.create({
      data: {
        orgId,
        branchId: requesterShift.branchId,
        type: input.type,
        status: initialStatus,
        requesterId,
        requesterShiftId: input.requesterShiftId,
        targetUserId: input.targetUserId ?? null,
        targetShiftId: input.targetShiftId ?? null,
        reason: input.reason ?? null,
        requestedAt: input.submitImmediately ? new Date() : null,
      },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true } },
        requesterShift: { select: { id: true, startAt: true, endAt: true, role: true } },
        targetUser: { select: { id: true, firstName: true, lastName: true } },
        targetShift: { select: { id: true, startAt: true, endAt: true, role: true } },
      },
    });

    // Notify target user if DIRECT_SWAP and submitted
    if (input.type === 'DIRECT_SWAP' && input.submitImmediately && input.targetUserId) {
      await this.notifications.log({
        orgId,
        type: 'SWAP_REQUESTED',
        targetUserId: input.targetUserId,
        performedById: requesterId,
        entityType: 'ShiftSwapRequest',
        entityId: swapRequest.id,
        payload: {
          requesterName: `${swapRequest.requester.firstName} ${swapRequest.requester.lastName}`,
          shiftDate: swapRequest.requesterShift.startAt.toISOString().split('T')[0],
        },
      });
    }

    // For OFFER_SHIFT, notify managers
    if (input.type === 'OFFER_SHIFT' && input.submitImmediately) {
      await this.notifications.notifyManagers(
        orgId,
        requesterShift.branchId,
        'SHIFT_OPENED',
        'ShiftSwapRequest',
        swapRequest.id,
        {
          requesterName: `${swapRequest.requester.firstName} ${swapRequest.requester.lastName}`,
          shiftDate: swapRequest.requesterShift.startAt.toISOString().split('T')[0],
        },
        requesterId,
      );
    }

    return this.mapToSummary(swapRequest);
  }

  /**
   * Submit a draft swap request (DRAFT → REQUESTED)
   */
  async submitSwapRequest(requesterId: string, orgId: string, swapId: string): Promise<SwapRequestSummary> {
    const swap = await this.prisma.client.shiftSwapRequest.findFirst({
      where: { id: swapId, orgId, requesterId },
    });

    if (!swap) {
      throw new NotFoundException('Swap request not found');
    }
    if (swap.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot submit swap in ${swap.status} status`);
    }

    // For DIRECT_SWAP, validate conflicts
    if (swap.type === 'DIRECT_SWAP' && swap.targetUserId && swap.targetShiftId) {
      const validation = await this.conflicts.validateSwap(
        requesterId,
        swap.requesterShiftId,
        swap.targetUserId,
        swap.targetShiftId,
        orgId,
      );

      if (!validation.valid) {
        throw new ConflictException(`Swap conflicts detected: ${validation.errors.join('; ')}`);
      }
    }

    const updated = await this.prisma.client.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status: 'REQUESTED',
        requestedAt: new Date(),
      },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true } },
        requesterShift: { select: { id: true, startAt: true, endAt: true, role: true } },
        targetUser: { select: { id: true, firstName: true, lastName: true } },
        targetShift: { select: { id: true, startAt: true, endAt: true, role: true } },
      },
    });

    // Notify target
    if (swap.type === 'DIRECT_SWAP' && swap.targetUserId) {
      await this.notifications.log({
        orgId,
        type: 'SWAP_REQUESTED',
        targetUserId: swap.targetUserId,
        performedById: requesterId,
        entityType: 'ShiftSwapRequest',
        entityId: swapId,
      });
    }

    return this.mapToSummary(updated);
  }

  /**
   * Cancel a swap request (any state before APPLIED)
   */
  async cancelSwapRequest(requesterId: string, orgId: string, swapId: string): Promise<SwapRequestSummary> {
    const swap = await this.prisma.client.shiftSwapRequest.findFirst({
      where: { id: swapId, orgId, requesterId },
    });

    if (!swap) {
      throw new NotFoundException('Swap request not found');
    }
    if (swap.status === 'APPLIED' || swap.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot cancel swap in ${swap.status} status`);
    }

    const updated = await this.prisma.client.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true } },
        requesterShift: { select: { id: true, startAt: true, endAt: true, role: true } },
        targetUser: { select: { id: true, firstName: true, lastName: true } },
        targetShift: { select: { id: true, startAt: true, endAt: true, role: true } },
      },
    });

    // Notify affected parties
    if (swap.targetUserId) {
      await this.notifications.log({
        orgId,
        type: 'SWAP_CANCELLED',
        targetUserId: swap.targetUserId,
        performedById: requesterId,
        entityType: 'ShiftSwapRequest',
        entityId: swapId,
      });
    }

    return this.mapToSummary(updated);
  }

  // ===== TARGET USER ACTIONS =====

  /**
   * Accept a swap request (REQUESTED → ACCEPTED)
   */
  async acceptSwap(targetUserId: string, orgId: string, swapId: string): Promise<SwapRequestSummary> {
    const swap = await this.prisma.client.shiftSwapRequest.findFirst({
      where: { id: swapId, orgId, targetUserId, type: 'DIRECT_SWAP' },
    });

    if (!swap) {
      throw new NotFoundException('Swap request not found or you are not the target');
    }
    if (swap.status !== 'REQUESTED') {
      throw new BadRequestException(`Cannot accept swap in ${swap.status} status`);
    }

    // Validate conflicts before accepting
    if (swap.targetShiftId) {
      const validation = await this.conflicts.validateSwap(
        swap.requesterId,
        swap.requesterShiftId,
        targetUserId,
        swap.targetShiftId,
        orgId,
      );

      if (!validation.valid) {
        throw new ConflictException(`Swap conflicts detected: ${validation.errors.join('; ')}`);
      }
    }

    const updated = await this.prisma.client.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true } },
        requesterShift: { select: { id: true, startAt: true, endAt: true, role: true } },
        targetUser: { select: { id: true, firstName: true, lastName: true } },
        targetShift: { select: { id: true, startAt: true, endAt: true, role: true } },
        branch: true,
      },
    });

    // Notify requester
    await this.notifications.log({
      orgId,
      type: 'SWAP_ACCEPTED',
      targetUserId: swap.requesterId,
      performedById: targetUserId,
      entityType: 'ShiftSwapRequest',
      entityId: swapId,
    });

    // Notify managers for approval
    await this.notifications.notifyManagers(
      orgId,
      updated.branchId,
      'SWAP_ACCEPTED',
      'ShiftSwapRequest',
      swapId,
      {
        requesterName: `${updated.requester.firstName} ${updated.requester.lastName}`,
        targetName: updated.targetUser ? `${updated.targetUser.firstName} ${updated.targetUser.lastName}` : null,
      },
    );

    return this.mapToSummary(updated);
  }

  /**
   * Decline a swap request (REQUESTED → DECLINED)
   */
  async declineSwap(
    targetUserId: string,
    orgId: string,
    swapId: string,
    reason?: string,
  ): Promise<SwapRequestSummary> {
    const swap = await this.prisma.client.shiftSwapRequest.findFirst({
      where: { id: swapId, orgId, targetUserId, type: 'DIRECT_SWAP' },
    });

    if (!swap) {
      throw new NotFoundException('Swap request not found or you are not the target');
    }
    if (swap.status !== 'REQUESTED') {
      throw new BadRequestException(`Cannot decline swap in ${swap.status} status`);
    }

    const updated = await this.prisma.client.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status: 'DECLINED',
        declinedAt: new Date(),
        declineReason: reason ?? null,
      },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true } },
        requesterShift: { select: { id: true, startAt: true, endAt: true, role: true } },
        targetUser: { select: { id: true, firstName: true, lastName: true } },
        targetShift: { select: { id: true, startAt: true, endAt: true, role: true } },
      },
    });

    // Notify requester
    await this.notifications.log({
      orgId,
      type: 'SWAP_DECLINED',
      targetUserId: swap.requesterId,
      performedById: targetUserId,
      entityType: 'ShiftSwapRequest',
      entityId: swapId,
      payload: { reason },
    });

    return this.mapToSummary(updated);
  }

  // ===== MANAGER ACTIONS =====

  /**
   * Approve a swap request (ACCEPTED → APPROVED → APPLIED)
   * For DIRECT_SWAP: both shifts are reassigned
   * For OFFER_SHIFT with claimer: shift is reassigned to claimer
   */
  async approveSwap(
    managerId: string,
    orgId: string,
    swapId: string,
  ): Promise<SwapRequestSummary> {
    const swap = await this.prisma.client.shiftSwapRequest.findFirst({
      where: { id: swapId, orgId },
      include: {
        requesterShift: true,
        targetShift: true,
      },
    });

    if (!swap) {
      throw new NotFoundException('Swap request not found');
    }

    // For DIRECT_SWAP, must be in ACCEPTED state
    // For OFFER_SHIFT with claimer, must be in REQUESTED state with a claimer
    const validForApproval =
      (swap.type === 'DIRECT_SWAP' && swap.status === 'ACCEPTED') ||
      (swap.type === 'OFFER_SHIFT' && swap.status === 'REQUESTED' && swap.claimerId);

    if (!validForApproval) {
      throw new BadRequestException(`Cannot approve swap in ${swap.status} status`);
    }

    // Final conflict check before approval
    if (swap.type === 'DIRECT_SWAP' && swap.targetUserId && swap.targetShiftId) {
      const validation = await this.conflicts.validateSwap(
        swap.requesterId,
        swap.requesterShiftId,
        swap.targetUserId,
        swap.targetShiftId,
        orgId,
      );

      if (!validation.valid) {
        throw new ConflictException(`Swap conflicts detected: ${validation.errors.join('; ')}`);
      }
    }

    // Apply the swap transactionally
    const result = await this.prisma.client.$transaction(async (tx) => {
      // Update swap status
      const updated = await tx.shiftSwapRequest.update({
        where: { id: swapId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedById: managerId,
        },
      });

      // Apply shift reassignments
      if (swap.type === 'DIRECT_SWAP' && swap.targetUserId && swap.targetShiftId) {
        // Swap shifts between requester and target
        await tx.scheduledShift.update({
          where: { id: swap.requesterShiftId },
          data: { userId: swap.targetUserId },
        });
        await tx.scheduledShift.update({
          where: { id: swap.targetShiftId },
          data: { userId: swap.requesterId },
        });
      } else if (swap.type === 'OFFER_SHIFT' && swap.claimerId) {
        // Assign requester's shift to claimer
        await tx.scheduledShift.update({
          where: { id: swap.requesterShiftId },
          data: { userId: swap.claimerId, isOpen: false },
        });
      }

      // Mark as applied
      return tx.shiftSwapRequest.update({
        where: { id: swapId },
        data: {
          status: 'APPLIED',
          appliedAt: new Date(),
        },
        include: {
          requester: { select: { id: true, firstName: true, lastName: true } },
          requesterShift: { select: { id: true, startAt: true, endAt: true, role: true } },
          targetUser: { select: { id: true, firstName: true, lastName: true } },
          targetShift: { select: { id: true, startAt: true, endAt: true, role: true } },
          claimer: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    });

    // Notify all parties
    await this.notifications.log({
      orgId,
      type: 'SWAP_APPROVED',
      targetUserId: swap.requesterId,
      performedById: managerId,
      entityType: 'ShiftSwapRequest',
      entityId: swapId,
    });

    if (swap.targetUserId) {
      await this.notifications.log({
        orgId,
        type: 'SWAP_APPROVED',
        targetUserId: swap.targetUserId,
        performedById: managerId,
        entityType: 'ShiftSwapRequest',
        entityId: swapId,
      });
    }

    if (swap.claimerId) {
      await this.notifications.log({
        orgId,
        type: 'SWAP_APPROVED',
        targetUserId: swap.claimerId,
        performedById: managerId,
        entityType: 'ShiftSwapRequest',
        entityId: swapId,
      });
    }

    return this.mapToSummary(result);
  }

  /**
   * Reject a swap request (ACCEPTED → REJECTED)
   */
  async rejectSwap(
    managerId: string,
    orgId: string,
    swapId: string,
    reason?: string,
  ): Promise<SwapRequestSummary> {
    const swap = await this.prisma.client.shiftSwapRequest.findFirst({
      where: { id: swapId, orgId },
    });

    if (!swap) {
      throw new NotFoundException('Swap request not found');
    }

    const validForRejection =
      (swap.type === 'DIRECT_SWAP' && swap.status === 'ACCEPTED') ||
      (swap.type === 'OFFER_SHIFT' && swap.status === 'REQUESTED');

    if (!validForRejection) {
      throw new BadRequestException(`Cannot reject swap in ${swap.status} status`);
    }

    const updated = await this.prisma.client.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedById: managerId,
        rejectReason: reason ?? null,
      },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true } },
        requesterShift: { select: { id: true, startAt: true, endAt: true, role: true } },
        targetUser: { select: { id: true, firstName: true, lastName: true } },
        targetShift: { select: { id: true, startAt: true, endAt: true, role: true } },
      },
    });

    // Notify parties
    await this.notifications.log({
      orgId,
      type: 'SWAP_REJECTED',
      targetUserId: swap.requesterId,
      performedById: managerId,
      entityType: 'ShiftSwapRequest',
      entityId: swapId,
      payload: { reason },
    });

    if (swap.targetUserId) {
      await this.notifications.log({
        orgId,
        type: 'SWAP_REJECTED',
        targetUserId: swap.targetUserId,
        performedById: managerId,
        entityType: 'ShiftSwapRequest',
        entityId: swapId,
        payload: { reason },
      });
    }

    return this.mapToSummary(updated);
  }

  // ===== OFFER_SHIFT CLAIMING =====

  /**
   * Claim an offered shift (for OFFER_SHIFT type)
   */
  async claimOfferedShift(
    claimerId: string,
    orgId: string,
    swapId: string,
  ): Promise<SwapRequestSummary> {
    const swap = await this.prisma.client.shiftSwapRequest.findFirst({
      where: { id: swapId, orgId, type: 'OFFER_SHIFT' },
    });

    if (!swap) {
      throw new NotFoundException('Offer not found');
    }
    if (swap.status !== 'REQUESTED') {
      throw new BadRequestException(`Cannot claim offer in ${swap.status} status`);
    }
    if (swap.claimerId) {
      throw new ConflictException('This offer has already been claimed');
    }
    if (swap.requesterId === claimerId) {
      throw new BadRequestException('Cannot claim your own offered shift');
    }

    // Validate claimer can take this shift
    const validation = await this.conflicts.validateOpenShiftClaim(
      claimerId,
      swap.requesterShiftId,
      orgId,
    );

    // Note: For OFFER_SHIFT, the shift is not technically "open" yet
    // We just check for schedule conflicts
    const conflictCheck = await this.conflicts.checkAllConflicts({
      userId: claimerId,
      orgId,
      startAt: (await this.prisma.client.scheduledShift.findUnique({
        where: { id: swap.requesterShiftId },
      }))!.startAt,
      endAt: (await this.prisma.client.scheduledShift.findUnique({
        where: { id: swap.requesterShiftId },
      }))!.endAt,
    });

    if (conflictCheck.hasConflict) {
      throw new ConflictException(conflictCheck.message ?? 'Conflict detected');
    }

    const updated = await this.prisma.client.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        claimerId,
      },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true } },
        requesterShift: { select: { id: true, startAt: true, endAt: true, role: true } },
        targetUser: { select: { id: true, firstName: true, lastName: true } },
        targetShift: { select: { id: true, startAt: true, endAt: true, role: true } },
        claimer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Notify requester
    await this.notifications.log({
      orgId,
      type: 'OPEN_SHIFT_CLAIMED',
      targetUserId: swap.requesterId,
      performedById: claimerId,
      entityType: 'ShiftSwapRequest',
      entityId: swapId,
    });

    // Notify managers for approval
    await this.notifications.notifyManagers(
      orgId,
      swap.branchId,
      'SWAP_ACCEPTED',
      'ShiftSwapRequest',
      swapId,
      { claimerName: `${updated.claimer?.firstName} ${updated.claimer?.lastName}` },
      claimerId,
    );

    return this.mapToSummary(updated);
  }

  // ===== QUERIES =====

  /**
   * Get my swap requests (as requester)
   */
  async getMySwapRequests(userId: string, orgId: string, filters?: SwapFilters) {
    return this.getSwapRequests(orgId, { ...filters, requesterId: userId });
  }

  /**
   * Get swap requests targeting me
   */
  async getSwapRequestsForMe(userId: string, orgId: string, filters?: SwapFilters) {
    return this.getSwapRequests(orgId, { ...filters, targetUserId: userId });
  }

  /**
   * Get all swap requests (manager view)
   */
  async getSwapRequests(orgId: string, filters?: SwapFilters) {
    const where: Record<string, unknown> = { orgId };

    if (filters?.status) {
      where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
    }
    if (filters?.type) {
      where.type = filters.type;
    }
    if (filters?.requesterId) {
      where.requesterId = filters.requesterId;
    }
    if (filters?.targetUserId) {
      where.targetUserId = filters.targetUserId;
    }
    if (filters?.branchId) {
      where.branchId = filters.branchId;
    }

    const swaps = await this.prisma.client.shiftSwapRequest.findMany({
      where,
      include: {
        requester: { select: { id: true, firstName: true, lastName: true } },
        requesterShift: { select: { id: true, startAt: true, endAt: true, role: true } },
        targetUser: { select: { id: true, firstName: true, lastName: true } },
        targetShift: { select: { id: true, startAt: true, endAt: true, role: true } },
        claimer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return swaps.map(s => this.mapToSummary(s));
  }

  /**
   * Get a single swap request by ID
   */
  async getSwapById(swapId: string, orgId: string): Promise<SwapRequestSummary | null> {
    const swap = await this.prisma.client.shiftSwapRequest.findFirst({
      where: { id: swapId, orgId },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true } },
        requesterShift: { select: { id: true, startAt: true, endAt: true, role: true } },
        targetUser: { select: { id: true, firstName: true, lastName: true } },
        targetShift: { select: { id: true, startAt: true, endAt: true, role: true } },
        claimer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return swap ? this.mapToSummary(swap) : null;
  }

  /**
   * Get available offers (OFFER_SHIFT in REQUESTED state without claimer)
   */
  async getAvailableOffers(orgId: string, branchId?: string) {
    const where: Record<string, unknown> = {
      orgId,
      type: 'OFFER_SHIFT',
      status: 'REQUESTED',
      claimerId: null,
    };

    if (branchId) {
      where.branchId = branchId;
    }

    const offers = await this.prisma.client.shiftSwapRequest.findMany({
      where,
      include: {
        requester: { select: { id: true, firstName: true, lastName: true } },
        requesterShift: {
          select: {
            id: true,
            startAt: true,
            endAt: true,
            role: true,
            branch: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return offers.map(o => ({
      id: o.id,
      requester: {
        id: o.requester.id,
        name: `${o.requester.firstName} ${o.requester.lastName}`,
      },
      shift: {
        id: o.requesterShift.id,
        startAt: o.requesterShift.startAt,
        endAt: o.requesterShift.endAt,
        role: o.requesterShift.role,
        branch: o.requesterShift.branch,
      },
      reason: o.reason,
      createdAt: o.createdAt,
    }));
  }

  // ===== HELPERS =====

  private mapToSummary(swap: {
    id: string;
    type: ShiftSwapRequestType;
    status: ShiftSwapRequestStatus;
    requester: { id: string; firstName: string; lastName: string };
    requesterShift: { id: string; startAt: Date; endAt: Date; role: string | null };
    targetUser?: { id: string; firstName: string; lastName: string } | null;
    targetShift?: { id: string; startAt: Date; endAt: Date; role: string | null } | null;
    claimer?: { id: string; firstName: string; lastName: string } | null;
    reason?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): SwapRequestSummary {
    return {
      id: swap.id,
      type: swap.type,
      status: swap.status,
      requester: {
        id: swap.requester.id,
        name: `${swap.requester.firstName} ${swap.requester.lastName}`,
      },
      requesterShift: {
        id: swap.requesterShift.id,
        startAt: swap.requesterShift.startAt,
        endAt: swap.requesterShift.endAt,
        role: swap.requesterShift.role,
      },
      targetUser: swap.targetUser
        ? { id: swap.targetUser.id, name: `${swap.targetUser.firstName} ${swap.targetUser.lastName}` }
        : null,
      targetShift: swap.targetShift
        ? {
            id: swap.targetShift.id,
            startAt: swap.targetShift.startAt,
            endAt: swap.targetShift.endAt,
            role: swap.targetShift.role,
          }
        : null,
      claimer: swap.claimer
        ? { id: swap.claimer.id, name: `${swap.claimer.firstName} ${swap.claimer.lastName}` }
        : null,
      reason: swap.reason,
      createdAt: swap.createdAt,
      updatedAt: swap.updatedAt,
    };
  }
}
