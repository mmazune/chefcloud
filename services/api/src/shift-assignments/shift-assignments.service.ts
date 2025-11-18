import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateShiftAssignmentDto } from './dto/create-shift-assignment.dto';

/**
 * M2-SHIFTS: Service for managing shift assignments
 * Assignments link users to shift schedules with their role
 */
@Injectable()
export class ShiftAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Assign a user to a shift schedule
   */
  async create(orgId: string, dto: CreateShiftAssignmentDto) {
    // Validate that schedule exists and belongs to org
    const schedule = await this.prisma.shiftSchedule.findFirst({
      where: { id: dto.scheduleId, orgId },
      include: {
        assignments: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException('Shift schedule not found');
    }

    // Validate that user exists and belongs to org
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, orgId },
    });

    if (!user) {
      throw new NotFoundException('User not found or does not belong to organization');
    }

    // Check for duplicate assignment (same user already assigned to this schedule)
    const existing = schedule.assignments.find((a: any) => a.userId === dto.userId);
    if (existing) {
      throw new ConflictException('User is already assigned to this shift schedule');
    }

    // If marking as manager on duty, ensure only one manager on duty per schedule
    if (dto.isManagerOnDuty) {
      const hasManagerOnDuty = schedule.assignments.some((a: any) => a.isManagerOnDuty);
      if (hasManagerOnDuty) {
        throw new ConflictException('This shift schedule already has a manager on duty');
      }
    }

    return this.prisma.shiftAssignment.create({
      data: {
        scheduleId: dto.scheduleId,
        userId: dto.userId,
        role: dto.role,
        isManagerOnDuty: dto.isManagerOnDuty ?? false,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            roleLevel: true,
          },
        },
        schedule: {
          include: {
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * List all assignments for a schedule
   */
  async findBySchedule(orgId: string, scheduleId: string) {
    // Validate schedule belongs to org
    const schedule = await this.prisma.shiftSchedule.findFirst({
      where: { id: scheduleId, orgId },
    });

    if (!schedule) {
      throw new NotFoundException('Shift schedule not found');
    }

    return this.prisma.shiftAssignment.findMany({
      where: { scheduleId },
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
        { isManagerOnDuty: 'desc' },
        { role: 'asc' },
      ],
    });
  }

  /**
   * List all assignments for a user within a date range
   */
  async findByUser(orgId: string, userId: string, startDate: Date, endDate: Date) {
    // Validate user belongs to org
    const user = await this.prisma.user.findFirst({
      where: { id: userId, orgId },
    });

    if (!user) {
      throw new NotFoundException('User not found or does not belong to organization');
    }

    return this.prisma.shiftAssignment.findMany({
      where: {
        userId,
        schedule: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      include: {
        schedule: {
          include: {
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
            template: true,
          },
        },
      },
      orderBy: [
        { schedule: { date: 'asc' } },
        { schedule: { startTime: 'asc' } },
      ],
    });
  }

  /**
   * Remove an assignment
   */
  async remove(orgId: string, id: string) {
    const assignment = await this.prisma.shiftAssignment.findFirst({
      where: { id },
      include: {
        schedule: {
          select: {
            orgId: true,
          },
        },
      },
    });

    if (!assignment || assignment.schedule.orgId !== orgId) {
      throw new NotFoundException('Shift assignment not found');
    }

    return this.prisma.shiftAssignment.delete({
      where: { id },
    });
  }
}
