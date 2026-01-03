/**
 * M10.1: Workforce Scheduling Service
 *
 * Handles shift templates and scheduled shifts CRUD, publishing, and conflict detection.
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Define ShiftStatus values locally to avoid @prisma/client import issues
type ShiftStatus = 'DRAFT' | 'PUBLISHED' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'CANCELLED';

@Injectable()
export class WorkforceSchedulingService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== Shift Templates =====

  async getTemplates(filters: { orgId: string; branchId?: string; isActive?: boolean }) {
    return this.prisma.client.shiftTemplate.findMany({
      where: {
        orgId: filters.orgId,
        ...(filters.branchId !== undefined && { branchId: filters.branchId }),
        ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      },
      orderBy: { name: 'asc' },
    });
  }

  async getTemplate(id: string) {
    const template = await this.prisma.client.shiftTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException('Shift template not found');
    }
    return template;
  }

  async createTemplate(data: {
    orgId: string;
    branchId?: string;
    name: string;
    role?: string;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
    description?: string;
  }) {
    return this.prisma.client.shiftTemplate.create({
      data: {
        orgId: data.orgId,
        branchId: data.branchId,
        name: data.name,
        role: data.role,
        startTime: data.startTime,
        endTime: data.endTime,
        breakMinutes: data.breakMinutes,
        description: data.description,
        isActive: true,
      },
    });
  }

  async updateTemplate(
    id: string,
    data: Partial<{
      name: string;
      role: string;
      startTime: string;
      endTime: string;
      breakMinutes: number;
      description: string;
      isActive: boolean;
    }>,
  ) {
    await this.getTemplate(id); // Verify exists
    return this.prisma.client.shiftTemplate.update({
      where: { id },
      data,
    });
  }

  async deleteTemplate(id: string) {
    await this.getTemplate(id); // Verify exists
    return this.prisma.client.shiftTemplate.delete({
      where: { id },
    });
  }

  // ===== Scheduled Shifts =====

  async getShifts(filters: {
    orgId: string;
    branchId?: string;
    userId?: string;
    from?: Date;
    to?: Date;
    status?: ShiftStatus;
  }) {
    return this.prisma.client.scheduledShift.findMany({
      where: {
        orgId: filters.orgId,
        ...(filters.branchId && { branchId: filters.branchId }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.from && filters.to && {
          startAt: {
            gte: filters.from,
            lte: filters.to,
          },
        }),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            jobRole: true,
          },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async getShift(id: string) {
    const shift = await this.prisma.client.scheduledShift.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
    });
    if (!shift) {
      throw new NotFoundException('Shift not found');
    }
    return shift;
  }

  async createShift(data: {
    orgId: string;
    branchId: string;
    userId: string;
    role: string;
    startAt: Date;
    endAt: Date;
    notes?: string;
  }) {
    // Validate start < end
    if (data.startAt >= data.endAt) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Calculate planned minutes
    const plannedMinutes = Math.floor(
      (data.endAt.getTime() - data.startAt.getTime()) / (1000 * 60),
    );

    // Validate duration (1-16 hours = 60-960 minutes)
    if (plannedMinutes < 60 || plannedMinutes > 960) {
      throw new BadRequestException('Shift duration must be between 1 and 16 hours');
    }

    // Check for conflicts (overlapping shifts for same user, excluding CANCELLED)
    const conflicts = await this.checkConflicts(data.userId, data.startAt, data.endAt);
    if (conflicts.length > 0) {
      throw new BadRequestException(
        `User has overlapping shift: ${conflicts[0].startAt.toISOString()} - ${conflicts[0].endAt.toISOString()}`,
      );
    }

    return this.prisma.client.scheduledShift.create({
      data: {
        orgId: data.orgId,
        branchId: data.branchId,
        userId: data.userId,
        role: data.role,
        startAt: data.startAt,
        endAt: data.endAt,
        plannedMinutes,
        notes: data.notes,
        status: 'DRAFT',
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async updateShift(
    id: string,
    data: Partial<{
      startAt: Date;
      endAt: Date;
      role: string;
      notes: string;
    }>,
  ) {
    const shift = await this.getShift(id);

    // Only DRAFT shifts can be edited
    if (shift.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot edit shift in ${shift.status} status`);
    }

    const startAt = data.startAt ?? shift.startAt;
    const endAt = data.endAt ?? shift.endAt;

    if (startAt >= endAt) {
      throw new BadRequestException('Start time must be before end time');
    }

    const plannedMinutes = Math.floor(
      (endAt.getTime() - startAt.getTime()) / (1000 * 60),
    );

    if (plannedMinutes < 60 || plannedMinutes > 960) {
      throw new BadRequestException('Shift duration must be between 1 and 16 hours');
    }

    // Check conflicts if time changed
    if (data.startAt || data.endAt) {
      const conflicts = await this.checkConflicts(shift.userId, startAt, endAt, id);
      if (conflicts.length > 0) {
        throw new BadRequestException('Updated time conflicts with another shift');
      }
    }

    return this.prisma.client.scheduledShift.update({
      where: { id },
      data: {
        ...data,
        plannedMinutes,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async deleteShift(id: string) {
    const shift = await this.getShift(id);

    // Only DRAFT shifts can be deleted
    if (shift.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot delete shift in ${shift.status} status`);
    }

    return this.prisma.client.scheduledShift.delete({
      where: { id },
    });
  }

  async cancelShift(id: string, cancelledById: string, reason?: string) {
    const shift = await this.getShift(id);

    // Only DRAFT or PUBLISHED shifts can be cancelled
    if (shift.status !== 'DRAFT' && shift.status !== 'PUBLISHED') {
      throw new BadRequestException(`Cannot cancel shift in ${shift.status} status`);
    }

    return this.prisma.client.scheduledShift.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledById,
        cancelReason: reason,
      },
    });
  }

  // ===== Publishing =====

  async publishShifts(filters: {
    orgId: string;
    branchId: string;
    from: Date;
    to: Date;
    publishedById: string;
  }) {
    // Get all DRAFT shifts in the range
    const draftShifts = await this.prisma.client.scheduledShift.findMany({
      where: {
        orgId: filters.orgId,
        branchId: filters.branchId,
        status: 'DRAFT',
        startAt: {
          gte: filters.from,
          lte: filters.to,
        },
      },
    });

    if (draftShifts.length === 0) {
      return { published: 0, shifts: [] };
    }

    // Validate no conflicts among all shifts being published
    for (const shift of draftShifts) {
      const conflicts = await this.checkConflicts(
        shift.userId,
        shift.startAt,
        shift.endAt,
        shift.id,
        true, // include already-published shifts
      );
      if (conflicts.length > 0) {
        throw new BadRequestException(
          `Shift for user ${shift.userId} conflicts with existing published shift`,
        );
      }
    }

    // Publish all
    const publishedAt = new Date();
    await this.prisma.client.scheduledShift.updateMany({
      where: {
        id: { in: draftShifts.map((s) => s.id) },
      },
      data: {
        status: 'PUBLISHED',
        publishedAt,
        publishedById: filters.publishedById,
      },
    });

    return {
      published: draftShifts.length,
      shifts: draftShifts.map((s) => s.id),
    };
  }

  // ===== Conflict Detection =====

  async checkConflicts(
    userId: string,
    startAt: Date,
    endAt: Date,
    excludeShiftId?: string,
    includePublished = false,
  ) {
    const statusFilter = includePublished
      ? { notIn: ['CANCELLED' as ShiftStatus] }
      : { notIn: ['CANCELLED' as ShiftStatus, 'PUBLISHED' as ShiftStatus] };

    return this.prisma.client.scheduledShift.findMany({
      where: {
        userId,
        status: excludeShiftId ? statusFilter : { notIn: ['CANCELLED' as ShiftStatus] },
        ...(excludeShiftId && { id: { not: excludeShiftId } }),
        OR: [
          // New shift starts during existing shift
          {
            startAt: { lte: startAt },
            endAt: { gt: startAt },
          },
          // New shift ends during existing shift
          {
            startAt: { lt: endAt },
            endAt: { gte: endAt },
          },
          // New shift completely contains existing shift
          {
            startAt: { gte: startAt },
            endAt: { lte: endAt },
          },
        ],
      },
    });
  }

  async getShiftConflicts(id: string) {
    const shift = await this.getShift(id);
    return this.checkConflicts(shift.userId, shift.startAt, shift.endAt, shift.id);
  }

  // ===== Status Transitions =====

  async startShift(id: string) {
    const shift = await this.getShift(id);
    if (shift.status !== 'PUBLISHED') {
      throw new BadRequestException(`Cannot start shift in ${shift.status} status`);
    }
    return this.prisma.client.scheduledShift.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
    });
  }

  async completeShift(id: string, actualMinutes: number, breakMinutes?: number) {
    const shift = await this.getShift(id);
    if (shift.status !== 'IN_PROGRESS') {
      throw new BadRequestException(`Cannot complete shift in ${shift.status} status`);
    }

    const overtimeMinutes = Math.max(0, actualMinutes - shift.plannedMinutes);

    return this.prisma.client.scheduledShift.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        actualMinutes,
        breakMinutes,
        overtimeMinutes,
      },
    });
  }

  async approveShift(id: string, approvedById: string) {
    const shift = await this.getShift(id);
    if (shift.status !== 'COMPLETED') {
      throw new BadRequestException(`Cannot approve shift in ${shift.status} status`);
    }

    return this.prisma.client.scheduledShift.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById,
      },
    });
  }
}
