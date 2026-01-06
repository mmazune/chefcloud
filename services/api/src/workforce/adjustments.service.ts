/**
 * M10.5: Timesheet Adjustments Service
 * 
 * Handles adjustment request workflow: request → approve/reject → apply
 * With full audit trail and pay period lock enforcement.
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WorkforceAuditService, WorkforceAuditAction } from './workforce-audit.service';

export type AdjustmentStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED';

export interface RequestAdjustmentDto {
  timeEntryId: string;
  newClockIn?: string;  // ISO datetime
  newClockOut?: string; // ISO datetime
  reason: string;
}

export interface ApproveAdjustmentDto {
  adjustmentId: string;
}

export interface RejectAdjustmentDto {
  adjustmentId: string;
  rejectionReason?: string;
}

export interface AdjustmentListFilters {
  status?: AdjustmentStatus;
  branchId?: string;
  userId?: string;
}

@Injectable()
export class AdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: WorkforceAuditService,
  ) { }

  /**
   * Staff requests an adjustment for their own time entry
   */
  async requestAdjustment(
    orgId: string,
    requestedById: string,
    dto: RequestAdjustmentDto
  ) {
    // Verify time entry exists and belongs to requester
    const timeEntry = await this.prisma.client.timeEntry.findFirst({
      where: {
        id: dto.timeEntryId,
        orgId,
      },
    });

    if (!timeEntry) {
      throw new NotFoundException('Time entry not found');
    }

    // SECURITY: Staff can only request adjustments for their own entries
    if (timeEntry.userId !== requestedById) {
      throw new ForbiddenException('You can only request adjustments for your own time entries');
    }

    // Check if time entry is within a closed pay period
    const closedPeriod = await this.prisma.client.payPeriod.findFirst({
      where: {
        orgId,
        status: { in: ['CLOSED', 'EXPORTED'] },
        startDate: { lte: timeEntry.clockInAt },
        endDate: { gte: timeEntry.clockInAt },
        OR: [
          { branchId: null },
          { branchId: timeEntry.branchId },
        ],
      },
    });

    if (closedPeriod) {
      throw new ForbiddenException(
        'Cannot request adjustment for time entry in a closed pay period'
      );
    }

    // Validate at least one change is requested
    if (!dto.newClockIn && !dto.newClockOut) {
      throw new BadRequestException('At least one of newClockIn or newClockOut must be provided');
    }

    // Check for existing pending adjustment
    const existingPending = await this.prisma.client.timeEntryAdjustment.findFirst({
      where: {
        timeEntryId: dto.timeEntryId,
        status: 'REQUESTED',
      },
    });

    if (existingPending) {
      throw new ConflictException('A pending adjustment already exists for this time entry');
    }

    // Create adjustment request
    const adjustment = await this.prisma.client.timeEntryAdjustment.create({
      data: {
        orgId,
        timeEntryId: dto.timeEntryId,
        requestedById,
        status: 'REQUESTED',
        originalClockIn: timeEntry.clockInAt,
        originalClockOut: timeEntry.clockOutAt,
        newClockIn: dto.newClockIn ? new Date(dto.newClockIn) : null,
        newClockOut: dto.newClockOut ? new Date(dto.newClockOut) : null,
        reason: dto.reason,
      },
    });

    // Audit log
    await this.auditService.logAction({
      orgId,
      action: WorkforceAuditAction.ADJUSTMENT_REQUESTED,
      entityType: 'TimeEntryAdjustment',
      entityId: adjustment.id,
      performedById: requestedById,
      payload: {
        timeEntryId: dto.timeEntryId,
        newClockIn: dto.newClockIn,
        newClockOut: dto.newClockOut,
        reason: dto.reason,
      },
    });

    return adjustment;
  }

  /**
   * List adjustments for supervisor/manager
   */
  async listAdjustments(orgId: string, filters?: AdjustmentListFilters) {
    const adjustments = await this.prisma.client.timeEntryAdjustment.findMany({
      where: {
        orgId,
        ...(filters?.status && { status: filters.status }),
        timeEntry: {
          ...(filters?.branchId && { branchId: filters.branchId }),
          ...(filters?.userId && { userId: filters.userId }),
        },
      },
      include: {
        timeEntry: {
          select: {
            id: true,
            branchId: true,
            clockInAt: true,
            clockOutAt: true,
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        requestedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        approvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return adjustments;
  }

  /**
   * Get a single adjustment by ID
   */
  async getAdjustment(orgId: string, adjustmentId: string) {
    const adjustment = await this.prisma.client.timeEntryAdjustment.findFirst({
      where: { id: adjustmentId, orgId },
      include: {
        timeEntry: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        requestedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        approvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!adjustment) {
      throw new NotFoundException('Adjustment not found');
    }

    return adjustment;
  }

  /**
   * Supervisor/Manager approves an adjustment
   */
  async approveAdjustment(orgId: string, approvedById: string, dto: ApproveAdjustmentDto) {
    const adjustment = await this.prisma.client.timeEntryAdjustment.findFirst({
      where: { id: dto.adjustmentId, orgId },
      include: { timeEntry: true },
    });

    if (!adjustment) {
      throw new NotFoundException('Adjustment not found');
    }

    if (adjustment.status !== 'REQUESTED') {
      throw new ConflictException(`Adjustment is already ${adjustment.status.toLowerCase()}`);
    }

    // Check pay period lock (again, in case it was closed between request and approval)
    const closedPeriod = await this.prisma.client.payPeriod.findFirst({
      where: {
        orgId,
        status: { in: ['CLOSED', 'EXPORTED'] },
        startDate: { lte: adjustment.timeEntry.clockInAt },
        endDate: { gte: adjustment.timeEntry.clockInAt },
        OR: [
          { branchId: null },
          { branchId: adjustment.timeEntry.branchId },
        ],
      },
    });

    if (closedPeriod) {
      throw new ForbiddenException(
        'Cannot approve adjustment for time entry in a closed pay period'
      );
    }

    // Apply the adjustment to the time entry
    const now = new Date();
    const updateData: { clockInAt?: Date; clockOutAt?: Date } = {};

    if (adjustment.newClockIn) {
      updateData.clockInAt = adjustment.newClockIn;
    }
    if (adjustment.newClockOut) {
      updateData.clockOutAt = adjustment.newClockOut;
    }

    await this.prisma.client.$transaction(async (tx) => {
      // Update time entry
      if (Object.keys(updateData).length > 0) {
        await tx.timeEntry.update({
          where: { id: adjustment.timeEntryId },
          data: updateData,
        });
      }

      // Update adjustment status
      await tx.timeEntryAdjustment.update({
        where: { id: dto.adjustmentId },
        data: {
          status: 'APPROVED',
          approvedById,
          appliedAt: now,
        },
      });
    });

    // Audit logs
    await this.auditService.logAction({
      orgId,
      action: WorkforceAuditAction.ADJUSTMENT_APPROVED,
      entityType: 'TimeEntryAdjustment',
      entityId: dto.adjustmentId,
      performedById: approvedById,
      payload: {
        timeEntryId: adjustment.timeEntryId,
        appliedChanges: updateData,
      },
    });

    await this.auditService.logAction({
      orgId,
      action: WorkforceAuditAction.ADJUSTMENT_APPLIED,
      entityType: 'TimeEntry',
      entityId: adjustment.timeEntryId,
      performedById: approvedById,
      payload: {
        adjustmentId: dto.adjustmentId,
        originalClockIn: adjustment.originalClockIn,
        originalClockOut: adjustment.originalClockOut,
        newClockIn: adjustment.newClockIn,
        newClockOut: adjustment.newClockOut,
      },
    });

    return this.getAdjustment(orgId, dto.adjustmentId);
  }

  /**
   * Supervisor/Manager rejects an adjustment
   */
  async rejectAdjustment(orgId: string, rejectedById: string, dto: RejectAdjustmentDto) {
    const adjustment = await this.prisma.client.timeEntryAdjustment.findFirst({
      where: { id: dto.adjustmentId, orgId },
    });

    if (!adjustment) {
      throw new NotFoundException('Adjustment not found');
    }

    if (adjustment.status !== 'REQUESTED') {
      throw new ConflictException(`Adjustment is already ${adjustment.status.toLowerCase()}`);
    }

    // Update adjustment status
    await this.prisma.client.timeEntryAdjustment.update({
      where: { id: dto.adjustmentId },
      data: {
        status: 'REJECTED',
        approvedById: rejectedById, // Using approvedById for the decision maker
        rejectionReason: dto.rejectionReason ?? 'No reason provided',
      },
    });

    // Audit log
    await this.auditService.logAction({
      orgId,
      action: WorkforceAuditAction.ADJUSTMENT_REJECTED,
      entityType: 'TimeEntryAdjustment',
      entityId: dto.adjustmentId,
      performedById: rejectedById,
      payload: {
        timeEntryId: adjustment.timeEntryId,
        rejectionReason: dto.rejectionReason,
      },
    });

    return this.getAdjustment(orgId, dto.adjustmentId);
  }

  /**
   * Get adjustment counts for reporting
   */
  async getAdjustmentCounts(orgId: string, branchId?: string) {
    const whereClause = {
      orgId,
      ...(branchId && {
        timeEntry: { branchId },
      }),
    };

    const [pending, approved, rejected] = await Promise.all([
      this.prisma.client.timeEntryAdjustment.count({
        where: { ...whereClause, status: 'REQUESTED' },
      }),
      this.prisma.client.timeEntryAdjustment.count({
        where: { ...whereClause, status: 'APPROVED' },
      }),
      this.prisma.client.timeEntryAdjustment.count({
        where: { ...whereClause, status: 'REJECTED' },
      }),
    ]);

    return { pending, approved, rejected, total: pending + approved + rejected };
  }
}
