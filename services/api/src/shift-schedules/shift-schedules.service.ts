import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateShiftScheduleDto } from './dto/create-shift-schedule.dto';

/**
 * M2-SHIFTS: Service for managing shift schedules
 * Schedules are specific instances of shifts for a branch on a date
 */
@Injectable()
export class ShiftSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new shift schedule from a template or manually
   */
  async create(orgId: string, dto: CreateShiftScheduleDto) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    const scheduleDate = new Date(dto.date);

    // Validate times
    if (startTime >= endTime) {
      throw new BadRequestException('endTime must be after startTime');
    }

    // Validate that branch belongs to org
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, orgId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found or does not belong to organization');
    }

    // Check for duplicate schedule (same branch, date, and overlapping times)
    const existing = await this.prisma.shiftSchedule.findFirst({
      where: {
        branchId: dto.branchId,
        date: scheduleDate,
        OR: [
          {
            startTime: { lte: startTime },
            endTime: { gt: startTime },
          },
          {
            startTime: { lt: endTime },
            endTime: { gte: endTime },
          },
        ],
      },
    });

    if (existing) {
      throw new ConflictException('A shift schedule already exists for this branch and time range');
    }

    // If template provided, validate it
    if (dto.templateId) {
      const template = await this.prisma.shiftTemplate.findFirst({
        where: { id: dto.templateId, orgId, isActive: true },
      });

      if (!template) {
        throw new NotFoundException('Shift template not found or inactive');
      }
    }

    return this.prisma.shiftSchedule.create({
      data: {
        orgId,
        branchId: dto.branchId,
        date: scheduleDate,
        templateId: dto.templateId,
        startTime,
        endTime,
        notes: dto.notes,
      },
      include: {
        template: true,
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                roleLevel: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * List schedules for a branch within a date range
   */
  async findByBranchAndDateRange(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
  ) {
    // Validate branch belongs to org
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, orgId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found or does not belong to organization');
    }

    return this.prisma.shiftSchedule.findMany({
      where: {
        branchId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        template: true,
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                roleLevel: true,
              },
            },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  /**
   * Get current active shift schedules for a branch
   * Used for "who is on shift now" API
   */
  async findCurrentSchedules(orgId: string, branchId: string) {
    const now = new Date();
    const today = new Date(now.toISOString().split('T')[0]); // Date only

    // Validate branch belongs to org
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, orgId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found or does not belong to organization');
    }

    return this.prisma.shiftSchedule.findMany({
      where: {
        branchId,
        date: today,
        startTime: { lte: now },
        endTime: { gte: now },
      },
      include: {
        template: true,
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                roleLevel: true,
              },
            },
          },
          orderBy: [
            { isManagerOnDuty: 'desc' }, // Manager on duty first
            { role: 'asc' },
          ],
        },
      },
    });
  }

  /**
   * Get a single schedule by ID
   */
  async findOne(orgId: string, id: string) {
    const schedule = await this.prisma.shiftSchedule.findFirst({
      where: { id, orgId },
      include: {
        template: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                roleLevel: true,
              },
            },
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Shift schedule not found');
    }

    return schedule;
  }

  /**
   * Delete a schedule (only if no assignments exist)
   */
  async remove(orgId: string, id: string) {
    const schedule = await this.prisma.shiftSchedule.findFirst({
      where: { id, orgId },
      include: {
        assignments: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException('Shift schedule not found');
    }

    if (schedule.assignments.length > 0) {
      throw new ConflictException('Cannot delete schedule with existing assignments');
    }

    return this.prisma.shiftSchedule.delete({
      where: { id },
    });
  }
}
