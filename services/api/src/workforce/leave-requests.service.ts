/**
 * M10.17: Leave Requests Service
 *
 * Handles leave request workflow:
 * - DRAFT → SUBMITTED → APPROVED | REJECTED | CANCELLED
 *
 * Features:
 * - Self-service create/submit/cancel
 * - Manager approval with branch scoping
 * - Overlap detection (leave + shifts)
 * - Policy validation (notice, max consecutive)
 * - Conflict override with audit logging
 * - Balance ledger integration
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LeavePolicyService } from './leave-policy.service';
import { WorkforceAuditService, WorkforceAuditAction } from './workforce-audit.service';
import { Prisma } from '@chefcloud/db';

export interface CreateLeaveRequestDto {
  orgId: string;
  branchId: string;
  userId: string;
  leaveTypeId: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
}

export interface ApproveLeaveRequestDto {
  approverId: string;
  approverBranchIds: string[];
  overrideConflict?: boolean;
}

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: LeavePolicyService,
    private readonly auditService: WorkforceAuditService,
  ) { }

  /**
   * Create a new leave request (DRAFT status)
   */
  async create(dto: CreateLeaveRequestDto): Promise<any> {
    // Validate dates
    if (dto.startDate >= dto.endDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Calculate total hours (assuming 8-hour work days)
    const days = Math.ceil(
      (dto.endDate.getTime() - dto.startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const totalHours = days * 8;

    // Validate leave type exists
    const leaveType = await this.prisma.client.leaveTypeDefinition.findUnique({
      where: { id: dto.leaveTypeId },
    });

    if (!leaveType || leaveType.orgId !== dto.orgId) {
      throw new NotFoundException('Leave type not found');
    }

    // Check for overlapping approved leave requests
    const overlapping = await this.checkLeaveOverlap(
      dto.userId,
      dto.startDate,
      dto.endDate,
    );

    if (overlapping) {
      throw new ConflictException('Overlapping leave request already exists');
    }

    return this.prisma.client.leaveRequestV2.create({
      data: {
        orgId: dto.orgId,
        branchId: dto.branchId,
        userId: dto.userId,
        leaveTypeId: dto.leaveTypeId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        totalHours: new Prisma.Decimal(totalHours),
        reason: dto.reason,
        status: 'DRAFT',
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        leaveType: true,
      },
    });
  }

  /**
   * Submit a draft leave request for approval
   */
  async submit(id: string, userId: string, orgId: string): Promise<any> {
    const request = await this.findOne(id, orgId);

    if (request.userId !== userId) {
      throw new ForbiddenException('You can only submit your own leave requests');
    }

    if (request.status !== 'DRAFT') {
      throw new BadRequestException('Only draft requests can be submitted');
    }

    // Validate against policy
    await this.validateAgainstPolicy(request);

    return this.prisma.client.leaveRequestV2.update({
      where: { id },
      data: { status: 'SUBMITTED' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        leaveType: true,
      },
    });
  }

  /**
   * Cancel a leave request (by employee)
   */
  async cancel(id: string, userId: string, orgId: string): Promise<any> {
    const request = await this.findOne(id, orgId);

    if (request.userId !== userId) {
      throw new ForbiddenException('You can only cancel your own leave requests');
    }

    if (!['DRAFT', 'SUBMITTED'].includes(request.status)) {
      throw new BadRequestException('Cannot cancel a request that is already processed');
    }

    return this.prisma.client.leaveRequestV2.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        leaveType: true,
      },
    });
  }

  /**
   * Approve a leave request (manager action)
   */
  async approve(id: string, orgId: string, dto: ApproveLeaveRequestDto): Promise<any> {
    const request = await this.findOne(id, orgId);

    if (request.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted requests can be approved');
    }

    // RBAC: Check manager has access to the branch
    if (!dto.approverBranchIds.includes(request.branchId)) {
      throw new ForbiddenException('You do not have access to approve requests for this branch');
    }

    // Check for shift conflicts
    const conflicts = await this.checkShiftConflicts(
      request.userId,
      request.startDate,
      request.endDate,
    );

    if (conflicts.length > 0 && !dto.overrideConflict) {
      throw new ConflictException({
        message: 'Leave overlaps with scheduled shifts',
        conflicts: conflicts.map((s) => ({
          shiftId: s.id,
          startAt: s.startAt,
          endAt: s.endAt,
        })),
      });
    }

    // Use transaction for approval + balance debit + conflict handling
    return this.prisma.client.$transaction(async (tx) => {
      // If override, cancel conflicting shifts and log audit
      if (conflicts.length > 0 && dto.overrideConflict) {
        for (const shift of conflicts) {
          await tx.scheduledShift.update({
            where: { id: shift.id },
            data: { status: 'CANCELLED' },
          });
        }

        // Log audit for conflict override
        await this.auditService.logAction({
          orgId,
          action: WorkforceAuditAction.LEAVE_CONFLICT_OVERRIDE,
          performedById: dto.approverId,
          entityType: 'LeaveRequest',
          entityId: id,
          payload: {
            cancelledShifts: conflicts.map((s) => s.id),
            leaveRequestId: id,
            userId: request.userId,
          },
        });
      }

      // Approve the request
      const approved = await tx.leaveRequestV2.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: dto.approverId,
          approvedAt: new Date(),
          overrideConflict: dto.overrideConflict ?? false,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          leaveType: true,
        },
      });

      // Get current balance
      const currentBalance = await this.getCurrentBalance(
        request.userId,
        request.leaveTypeId,
        tx,
      );

      // Create ledger DEBIT entry
      await tx.leaveBalanceLedger.create({
        data: {
          orgId,
          userId: request.userId,
          leaveTypeId: request.leaveTypeId,
          entryType: 'DEBIT',
          deltaHours: new Prisma.Decimal(request.totalHours).negated(),
          balanceAfter: currentBalance.sub(request.totalHours),
          reason: `Leave approved: ${request.startDate.toISOString().split('T')[0]} to ${request.endDate.toISOString().split('T')[0]}`,
          referenceId: id,
          referenceType: 'LEAVE_REQUEST',
        },
      });

      return approved;
    });
  }

  /**
   * Reject a leave request (manager action)
   */
  async reject(id: string, orgId: string, approverId: string, approverBranchIds: string[], reason?: string): Promise<any> {
    const request = await this.findOne(id, orgId);

    if (request.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted requests can be rejected');
    }

    // RBAC: Check manager has access to the branch
    if (!approverBranchIds.includes(request.branchId)) {
      throw new ForbiddenException('You do not have access to reject requests for this branch');
    }

    return this.prisma.client.leaveRequestV2.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedById: approverId,
        approvedAt: new Date(),
        rejectionReason: reason,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        leaveType: true,
      },
    });
  }

  /**
   * List leave requests for approval (manager view)
   */
  async findPendingApprovals(orgId: string, branchIds: string[]): Promise<any[]> {
    return this.prisma.client.leaveRequestV2.findMany({
      where: {
        orgId,
        branchId: { in: branchIds },
        status: 'SUBMITTED',
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        leaveType: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * List leave requests for a user (self-service)
   */
  async findByUser(userId: string, orgId: string): Promise<any[]> {
    return this.prisma.client.leaveRequestV2.findMany({
      where: { userId, orgId },
      include: { leaveType: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single request by ID
   */
  async findOne(id: string, orgId: string): Promise<any> {
    const request = await this.prisma.client.leaveRequestV2.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        leaveType: true,
      },
    });

    if (!request || request.orgId !== orgId) {
      throw new NotFoundException('Leave request not found');
    }

    return request;
  }

  /**
   * Check for overlapping approved leave
   */
  private async checkLeaveOverlap(
    userId: string,
    startDate: Date,
    endDate: Date,
    excludeId?: string,
  ): Promise<boolean> {
    const overlapping = await this.prisma.client.leaveRequestV2.findFirst({
      where: {
        userId,
        status: 'APPROVED',
        id: excludeId ? { not: excludeId } : undefined,
        OR: [
          { startDate: { lte: startDate }, endDate: { gt: startDate } },
          { startDate: { lt: endDate }, endDate: { gte: endDate } },
          { startDate: { gte: startDate }, endDate: { lte: endDate } },
        ],
      },
    });

    return overlapping !== null;
  }

  /**
   * Check for overlapping scheduled shifts
   */
  private async checkShiftConflicts(userId: string, startDate: Date, endDate: Date) {
    return this.prisma.client.scheduledShift.findMany({
      where: {
        userId,
        status: { in: ['PUBLISHED', 'APPROVED'] },
        OR: [
          { startAt: { lte: startDate }, endAt: { gt: startDate } },
          { startAt: { lt: endDate }, endAt: { gte: endDate } },
          { startAt: { gte: startDate }, endAt: { lte: endDate } },
        ],
      },
    });
  }

  /**
   * Validate request against policy rules
   */
  private async validateAgainstPolicy(request: any) {
    const policy = await this.policyService.getEffectivePolicy(
      request.orgId,
      request.branchId,
      request.leaveTypeId,
    );

    if (!policy) {
      // No policy = no restrictions
      return;
    }

    const leaveType = policy.leaveType;

    // Check minimum notice
    if (leaveType.minNoticeHours > 0) {
      const hoursUntilStart = (request.startDate.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilStart < leaveType.minNoticeHours) {
        throw new BadRequestException(
          `Minimum notice of ${leaveType.minNoticeHours} hours required`,
        );
      }
    }

    // Check max consecutive days
    if (leaveType.maxConsecutiveDays > 0) {
      const days = Math.ceil(
        (request.endDate.getTime() - request.startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (days > leaveType.maxConsecutiveDays) {
        throw new BadRequestException(
          `Maximum of ${leaveType.maxConsecutiveDays} consecutive days allowed`,
        );
      }
    }
  }

  /**
   * Get current balance for user+leaveType
   */
  private async getCurrentBalance(
    userId: string,
    leaveTypeId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.Decimal> {
    const client = tx || this.prisma.client;

    const lastEntry = await client.leaveBalanceLedger.findFirst({
      where: { userId, leaveTypeId },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfter: true },
    });

    return lastEntry?.balanceAfter ?? new Prisma.Decimal(0);
  }

  /**
   * Get user balances for all leave types
   */
  async getUserBalances(userId: string, orgId: string) {
    const leaveTypes = await this.prisma.client.leaveTypeDefinition.findMany({
      where: { orgId, isActive: true },
    });

    const balances = await Promise.all(
      leaveTypes.map(async (lt) => {
        const balance = await this.getCurrentBalance(userId, lt.id);
        return {
          leaveTypeId: lt.id,
          leaveTypeName: lt.name,
          leaveTypeCode: lt.code,
          balanceHours: balance.toNumber(),
        };
      }),
    );

    return balances;
  }

  // ===== M10.18: Two-Step Approval Methods =====

  /**
   * Approve Step 1 (Supervisor approval for TWO_STEP policies)
   * RBAC: L2/L3 (Supervisor)
   */
  async approveStep1(
    id: string,
    orgId: string,
    approverId: string,
    approverBranchIds: string[],
  ): Promise<any> {
    const request = await this.findOne(id, orgId);

    if (request.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted requests can be approved');
    }

    // RBAC: Check approver has access to the branch
    if (!approverBranchIds.includes(request.branchId)) {
      throw new ForbiddenException('You do not have access to approve requests for this branch');
    }

    // Get policy to check if TWO_STEP is required
    const policy = await this.policyService.getEffectivePolicy(
      orgId,
      request.leaveTypeId,
      request.branchId,
    );

    if (!policy || policy.approvalMode !== 'TWO_STEP') {
      throw new BadRequestException('This leave type does not require two-step approval');
    }

    return this.prisma.client.leaveRequestV2.update({
      where: { id },
      data: {
        status: 'APPROVED_STEP1',
        approvedStep1ById: approverId,
        approvedStep1At: new Date(),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        leaveType: true,
      },
    });
  }

  /**
   * Final approval (Step 2 for TWO_STEP, or single-step for SINGLE policies)
   * RBAC: L4/L5 for TWO_STEP step2, L3+ for SINGLE
   */
  async approveWithStep(
    id: string,
    orgId: string,
    dto: ApproveLeaveRequestDto,
    approverRoleLevel: number,
  ): Promise<any> {
    const request = await this.findOne(id, orgId);

    // Get policy to check approval mode
    const policy = await this.policyService.getEffectivePolicy(
      orgId,
      request.leaveTypeId,
      request.branchId,
    );

    const approvalMode = policy?.approvalMode || 'SINGLE';

    // Validate status based on approval mode
    if (approvalMode === 'TWO_STEP') {
      if (request.status !== 'APPROVED_STEP1') {
        throw new BadRequestException('Two-step approval requires step 1 to be completed first');
      }
      // Step 2 requires L4+
      if (approverRoleLevel < 4) {
        throw new ForbiddenException('Step 2 approval requires Manager (L4) or Owner (L5) role');
      }
      // Prevent same person from approving both steps (H8)
      if (request.approvedStep1ById === dto.approverId) {
        throw new ForbiddenException('Same person cannot approve both steps');
      }
    } else {
      if (request.status !== 'SUBMITTED') {
        throw new BadRequestException('Only submitted requests can be approved');
      }
    }

    // RBAC: Check manager has access to the branch
    if (!dto.approverBranchIds.includes(request.branchId)) {
      throw new ForbiddenException('You do not have access to approve requests for this branch');
    }

    // Use existing approve logic for the actual approval
    return this.approve(id, orgId, dto);
  }

  /**
   * Reject at any step (with step context)
   */
  async rejectWithStep(
    id: string,
    orgId: string,
    approverId: string,
    approverBranchIds: string[],
    reason?: string,
  ): Promise<any> {
    const request = await this.findOne(id, orgId);

    // Determine which step is being rejected
    let rejectedStep: number | null = null;
    if (request.status === 'SUBMITTED') {
      rejectedStep = 1;
    } else if (request.status === 'APPROVED_STEP1') {
      rejectedStep = 2;
    } else {
      throw new BadRequestException('Request cannot be rejected in its current status');
    }

    // RBAC: Check approver has access to the branch
    if (!approverBranchIds.includes(request.branchId)) {
      throw new ForbiddenException('You do not have access to reject requests for this branch');
    }

    return this.prisma.client.leaveRequestV2.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        rejectedStep,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        leaveType: true,
      },
    });
  }

  /**
   * Find pending approvals (including step1 pending for L4+)
   */
  async findPendingApprovalsWithSteps(
    orgId: string,
    branchIds: string[],
    roleLevel: number,
  ): Promise<any[]> {
    const statusFilter: string[] = ['SUBMITTED'];

    // L4+ can also see APPROVED_STEP1 for step 2 approval
    if (roleLevel >= 4) {
      statusFilter.push('APPROVED_STEP1');
    }

    return this.prisma.client.leaveRequestV2.findMany({
      where: {
        orgId,
        branchId: { in: branchIds },
        status: { in: statusFilter as any },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        leaveType: true,
        approvedStep1By: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
