/**
 * M10.11: Open Shifts Service
 * 
 * Manages open (unassigned) shifts:
 * - Publishing shifts as open for claiming
 * - Processing claims with optional approval workflow
 * - Auto-assignment when approval not required
 * 
 * Open shift claims use the OpenShiftClaim model for tracking.
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WorkforceConflictsService } from './workforce-conflicts.service';
import { WorkforceNotificationsService } from './workforce-notifications.service';

export interface OpenShiftSummary {
  id: string;
  branchId: string;
  branchName: string;
  startAt: Date;
  endAt: Date;
  role: string | null;
  plannedMinutes: number | null;
  notes: string | null;
  claimCount: number;
  myClaim?: { id: string; status: string } | null;
}

export interface ClaimSummary {
  id: string;
  shiftId: string;
  shift: { startAt: Date; endAt: Date; role: string | null; branch: { id: string; name: string } };
  claimer: { id: string; name: string };
  status: string;
  createdAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectReason: string | null;
}

export interface OpenShiftFilters {
  branchId?: string;
  from?: Date;
  to?: Date;
  role?: string;
}

@Injectable()
export class OpenShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conflicts: WorkforceConflictsService,
    private readonly notifications: WorkforceNotificationsService,
  ) { }

  // ===== MANAGER ACTIONS =====

  /**
   * Create an open shift (unassigned shift available for claiming)
   */
  async createOpenShift(
    managerId: string,
    orgId: string,
    branchId: string,
    data: {
      startAt: Date;
      endAt: Date;
      role?: string;
      notes?: string;
    },
  ) {
    // Verify branch exists in org
    const branch = await this.prisma.client.branch.findFirst({
      where: { id: branchId, orgId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const plannedMinutes = Math.floor((data.endAt.getTime() - data.startAt.getTime()) / 60000);

    const shift = await this.prisma.client.scheduledShift.create({
      data: {
        orgId,
        branchId,
        userId: null, // Open shift has no assigned user
        isOpen: true,
        startAt: data.startAt,
        endAt: data.endAt,
        plannedMinutes,
        role: data.role ?? null,
        notes: data.notes ?? null,
        status: 'PUBLISHED',
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    // Notify team about new open shift
    await this.notifications.log({
      orgId,
      type: 'SHIFT_OPENED',
      targetUserId: managerId, // Self-log for audit
      performedById: managerId,
      entityType: 'ScheduledShift',
      entityId: shift.id,
      payload: {
        branchName: shift.branch.name,
        startAt: shift.startAt.toISOString(),
      },
    });

    return {
      id: shift.id,
      branchId: shift.branchId,
      branchName: shift.branch.name,
      startAt: shift.startAt,
      endAt: shift.endAt,
      role: shift.role,
      plannedMinutes: shift.plannedMinutes,
      notes: shift.notes,
      isOpen: shift.isOpen,
    };
  }

  /**
   * Mark an existing assigned shift as open (unassign and publish)
   */
  async publishAsOpen(managerId: string, orgId: string, shiftId: string) {
    const shift = await this.prisma.client.scheduledShift.findFirst({
      where: { id: shiftId, orgId },
      include: { branch: true },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    if (shift.isOpen) {
      throw new BadRequestException('Shift is already open');
    }

    const originalUserId = shift.userId;

    const updated = await this.prisma.client.scheduledShift.update({
      where: { id: shiftId },
      data: {
        userId: null,
        isOpen: true,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    // Notify original assignee if any
    if (originalUserId) {
      await this.notifications.log({
        orgId,
        type: 'SHIFT_OPENED',
        targetUserId: originalUserId,
        performedById: managerId,
        entityType: 'ScheduledShift',
        entityId: shiftId,
        payload: { shiftDate: shift.startAt.toISOString().split('T')[0] },
      });
    }

    return {
      id: updated.id,
      branchId: updated.branchId,
      branchName: updated.branch.name,
      startAt: updated.startAt,
      endAt: updated.endAt,
      role: updated.role,
      isOpen: updated.isOpen,
    };
  }

  /**
   * Close an open shift (remove from available pool)
   */
  async closeOpenShift(managerId: string, orgId: string, shiftId: string) {
    const shift = await this.prisma.client.scheduledShift.findFirst({
      where: { id: shiftId, orgId, isOpen: true },
    });

    if (!shift) {
      throw new NotFoundException('Open shift not found');
    }

    // Cancel any pending claims
    await this.prisma.client.openShiftClaim.updateMany({
      where: { shiftId, status: 'PENDING' },
      data: { status: 'WITHDRAWN' },
    });

    // Mark shift as closed (not open, still no user = effectively cancelled)
    await this.prisma.client.scheduledShift.update({
      where: { id: shiftId },
      data: {
        isOpen: false,
        status: 'CANCELLED',
      },
    });

    return { closed: true };
  }

  // ===== EMPLOYEE ACTIONS =====

  /**
   * Claim an open shift
   */
  async claimShift(claimerId: string, orgId: string, shiftId: string) {
    const shift = await this.prisma.client.scheduledShift.findFirst({
      where: { id: shiftId, orgId, isOpen: true },
      include: { branch: true },
    });

    if (!shift) {
      throw new NotFoundException('Open shift not found');
    }

    // Check for existing claim by this user
    const existingClaim = await this.prisma.client.openShiftClaim.findFirst({
      where: { shiftId, claimerId, status: 'PENDING' },
    });

    if (existingClaim) {
      throw new ConflictException('You have already claimed this shift');
    }

    // Validate conflicts
    const validation = await this.conflicts.validateOpenShiftClaim(claimerId, shiftId, orgId);
    if (!validation.valid) {
      throw new ConflictException(validation.errors.join('; '));
    }

    // Check if org requires approval for open shift claims
    const policy = await this.prisma.client.workforcePolicy.findFirst({
      where: { orgId },
    });

    const requiresApproval = policy?.openShiftRequiresApproval ?? true;

    // Create claim
    const claim = await this.prisma.client.openShiftClaim.create({
      data: {
        orgId,
        shiftId,
        claimerId,
        status: requiresApproval ? 'PENDING' : 'APPROVED',
        approvedAt: requiresApproval ? null : new Date(),
      },
      include: {
        shift: {
          select: {
            startAt: true,
            endAt: true,
            role: true,
            branch: { select: { id: true, name: true } },
          },
        },
        claimer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (requiresApproval) {
      // Notify managers
      await this.notifications.notifyManagers(
        orgId,
        shift.branchId,
        'OPEN_SHIFT_CLAIMED',
        'OpenShiftClaim',
        claim.id,
        {
          claimerName: `${claim.claimer.firstName} ${claim.claimer.lastName}`,
          shiftDate: shift.startAt.toISOString().split('T')[0],
        },
        claimerId,
      );
    } else {
      // Auto-approve: assign shift to claimer
      await this.prisma.client.scheduledShift.update({
        where: { id: shiftId },
        data: { userId: claimerId, isOpen: false },
      });

      // Reject other pending claims
      await this.prisma.client.openShiftClaim.updateMany({
        where: {
          shiftId,
          status: 'PENDING',
          id: { not: claim.id },
        },
        data: {
          status: 'REJECTED',
          rejectReason: 'Shift was claimed by another user',
          rejectedAt: new Date(),
        },
      });

      // Notify claimer of assignment
      await this.notifications.log({
        orgId,
        type: 'OPEN_SHIFT_CLAIM_APPROVED',
        targetUserId: claimerId,
        entityType: 'ScheduledShift',
        entityId: shiftId,
      });
    }

    return {
      id: claim.id,
      shiftId: claim.shiftId,
      status: claim.status,
      requiresApproval,
      shift: {
        startAt: claim.shift.startAt,
        endAt: claim.shift.endAt,
        role: claim.shift.role,
        branch: claim.shift.branch,
      },
    };
  }

  /**
   * Withdraw my claim on an open shift
   */
  async withdrawClaim(claimerId: string, orgId: string, claimId: string) {
    const claim = await this.prisma.client.openShiftClaim.findFirst({
      where: { id: claimId, claimerId, orgId, status: 'PENDING' },
    });

    if (!claim) {
      throw new NotFoundException('Pending claim not found');
    }

    await this.prisma.client.openShiftClaim.update({
      where: { id: claimId },
      data: { status: 'WITHDRAWN' },
    });

    return { withdrawn: true };
  }

  // ===== MANAGER CLAIM ACTIONS =====

  /**
   * Approve a claim (assign shift to claimer)
   */
  async approveClaim(managerId: string, orgId: string, claimId: string) {
    const claim = await this.prisma.client.openShiftClaim.findFirst({
      where: { id: claimId, orgId, status: 'PENDING' },
      include: {
        shift: true,
        claimer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!claim) {
      throw new NotFoundException('Pending claim not found');
    }

    // Final conflict check
    const validation = await this.conflicts.validateOpenShiftClaim(claim.claimerId, claim.shiftId, orgId);
    if (!validation.valid) {
      throw new ConflictException(validation.errors.join('; '));
    }

    // Approve and assign
    await this.prisma.client.$transaction(async (tx) => {
      // Update claim
      await tx.openShiftClaim.update({
        where: { id: claimId },
        data: {
          status: 'APPROVED',
          approvedById: managerId,
          approvedAt: new Date(),
        },
      });

      // Assign shift
      await tx.scheduledShift.update({
        where: { id: claim.shiftId },
        data: { userId: claim.claimerId, isOpen: false },
      });

      // Reject other pending claims
      await tx.openShiftClaim.updateMany({
        where: {
          shiftId: claim.shiftId,
          status: 'PENDING',
          id: { not: claimId },
        },
        data: {
          status: 'REJECTED',
          rejectReason: 'Another claim was approved',
          rejectedById: managerId,
          rejectedAt: new Date(),
        },
      });
    });

    // Notify claimer
    await this.notifications.log({
      orgId,
      type: 'OPEN_SHIFT_CLAIM_APPROVED',
      targetUserId: claim.claimerId,
      performedById: managerId,
      entityType: 'OpenShiftClaim',
      entityId: claimId,
    });

    return { approved: true };
  }

  /**
   * Reject a claim
   */
  async rejectClaim(managerId: string, orgId: string, claimId: string, reason?: string) {
    const claim = await this.prisma.client.openShiftClaim.findFirst({
      where: { id: claimId, orgId, status: 'PENDING' },
    });

    if (!claim) {
      throw new NotFoundException('Pending claim not found');
    }

    await this.prisma.client.openShiftClaim.update({
      where: { id: claimId },
      data: {
        status: 'REJECTED',
        rejectedById: managerId,
        rejectedAt: new Date(),
        rejectReason: reason ?? null,
      },
    });

    // Notify claimer
    await this.notifications.log({
      orgId,
      type: 'SWAP_REJECTED',
      targetUserId: claim.claimerId,
      performedById: managerId,
      entityType: 'OpenShiftClaim',
      entityId: claimId,
      payload: { reason },
    });

    return { rejected: true };
  }

  // ===== QUERIES =====

  /**
   * Get all open shifts (for employees to browse)
   */
  async getOpenShifts(userId: string, orgId: string, filters?: OpenShiftFilters): Promise<OpenShiftSummary[]> {
    const where: Record<string, unknown> = {
      orgId,
      isOpen: true,
      status: 'PUBLISHED',
    };

    if (filters?.branchId) {
      where.branchId = filters.branchId;
    }
    if (filters?.from) {
      where.startAt = { ...(where.startAt as object ?? {}), gte: filters.from };
    }
    if (filters?.to) {
      where.startAt = { ...(where.startAt as object ?? {}), lte: filters.to };
    }
    if (filters?.role) {
      where.role = filters.role;
    }

    const shifts = await this.prisma.client.scheduledShift.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        openShiftClaims: {
          select: { id: true, claimerId: true, status: true },
        },
      },
      orderBy: { startAt: 'asc' },
    });

    return shifts.map(s => ({
      id: s.id,
      branchId: s.branchId,
      branchName: s.branch.name,
      startAt: s.startAt,
      endAt: s.endAt,
      role: s.role,
      plannedMinutes: s.plannedMinutes,
      notes: s.notes,
      claimCount: s.openShiftClaims.filter(c => c.status === 'PENDING').length,
      myClaim: s.openShiftClaims.find(c => c.claimerId === userId) ?? null,
    }));
  }

  /**
   * Get my claims (employee view)
   */
  async getMyClaims(userId: string, orgId: string): Promise<ClaimSummary[]> {
    const claims = await this.prisma.client.openShiftClaim.findMany({
      where: { claimerId: userId, orgId },
      include: {
        shift: {
          select: {
            startAt: true,
            endAt: true,
            role: true,
            branch: { select: { id: true, name: true } },
          },
        },
        claimer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return claims.map(c => ({
      id: c.id,
      shiftId: c.shiftId,
      shift: c.shift,
      claimer: { id: c.claimer.id, name: `${c.claimer.firstName} ${c.claimer.lastName}` },
      status: c.status,
      createdAt: c.createdAt,
      approvedAt: c.approvedAt,
      rejectedAt: c.rejectedAt,
      rejectReason: c.rejectReason,
    }));
  }

  /**
   * Get pending claims for a branch (manager view)
   */
  async getPendingClaims(orgId: string, branchId?: string): Promise<ClaimSummary[]> {
    const where: Record<string, unknown> = {
      orgId,
      status: 'PENDING',
    };

    if (branchId) {
      where.shift = { branchId };
    }

    const claims = await this.prisma.client.openShiftClaim.findMany({
      where,
      include: {
        shift: {
          select: {
            startAt: true,
            endAt: true,
            role: true,
            branch: { select: { id: true, name: true } },
          },
        },
        claimer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return claims.map(c => ({
      id: c.id,
      shiftId: c.shiftId,
      shift: c.shift,
      claimer: { id: c.claimer.id, name: `${c.claimer.firstName} ${c.claimer.lastName}` },
      status: c.status,
      createdAt: c.createdAt,
      approvedAt: c.approvedAt,
      rejectedAt: c.rejectedAt,
      rejectReason: c.rejectReason,
    }));
  }

  /**
   * Get all claims for a specific shift (manager view)
   */
  async getClaimsForShift(orgId: string, shiftId: string): Promise<ClaimSummary[]> {
    const claims = await this.prisma.client.openShiftClaim.findMany({
      where: { orgId, shiftId },
      include: {
        shift: {
          select: {
            startAt: true,
            endAt: true,
            role: true,
            branch: { select: { id: true, name: true } },
          },
        },
        claimer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return claims.map(c => ({
      id: c.id,
      shiftId: c.shiftId,
      shift: c.shift,
      claimer: { id: c.claimer.id, name: `${c.claimer.firstName} ${c.claimer.lastName}` },
      status: c.status,
      createdAt: c.createdAt,
      approvedAt: c.approvedAt,
      rejectedAt: c.rejectedAt,
      rejectReason: c.rejectReason,
    }));
  }
}
