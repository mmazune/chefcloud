/**
 * M10.1: Workforce Timeclock Service
 *
 * Handles clock-in/out operations with shift attachment and break tracking.
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Grace window for early clock-in (minutes)
const CLOCK_IN_GRACE_MINUTES = 15;

@Injectable()
export class WorkforceTimeclockService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== Clock Status =====

  async getClockStatus(userId: string, orgId: string) {
    // Get current active time entry
    const activeEntry = await this.prisma.client.timeEntry.findFirst({
      where: {
        userId,
        orgId,
        clockOutAt: null,
      },
      include: {
        scheduledShift: true,
        breakEntries: {
          where: { endedAt: null },
        },
      },
    });

    // Get today's published shift
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayShift = await this.prisma.client.scheduledShift.findFirst({
      where: {
        userId,
        orgId,
        status: { in: ['PUBLISHED', 'IN_PROGRESS'] },
        startAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    return {
      isClockedIn: !!activeEntry,
      activeEntry,
      activeBreak: activeEntry?.breakEntries?.[0] ?? null,
      todayShift,
    };
  }

  // ===== Clock In =====

  async clockIn(data: {
    userId: string;
    orgId: string;
    branchId: string;
    shiftId?: string;
    method?: 'MSR' | 'PASSKEY' | 'PASSWORD';
  }) {
    // Check for existing open time entry
    const existingEntry = await this.prisma.client.timeEntry.findFirst({
      where: {
        userId: data.userId,
        orgId: data.orgId,
        clockOutAt: null,
      },
    });

    if (existingEntry) {
      throw new BadRequestException('Already clocked in. Please clock out first.');
    }

    // If shiftId provided, validate it
    let shift = null;
    if (data.shiftId) {
      shift = await this.prisma.client.scheduledShift.findUnique({
        where: { id: data.shiftId },
      });

      if (!shift) {
        throw new NotFoundException('Shift not found');
      }

      if (shift.userId !== data.userId) {
        throw new ForbiddenException('Shift belongs to another user');
      }

      if (shift.status !== 'PUBLISHED') {
        throw new BadRequestException(`Cannot clock into shift in ${shift.status} status`);
      }

      // Check grace window (allow clock-in up to 15 minutes early)
      const now = new Date();
      const earliestClockIn = new Date(shift.startAt);
      earliestClockIn.setMinutes(earliestClockIn.getMinutes() - CLOCK_IN_GRACE_MINUTES);

      if (now < earliestClockIn) {
        throw new BadRequestException(
          `Cannot clock in more than ${CLOCK_IN_GRACE_MINUTES} minutes before shift start`,
        );
      }

      // Transition shift to IN_PROGRESS
      await this.prisma.client.scheduledShift.update({
        where: { id: shift.id },
        data: { status: 'IN_PROGRESS' },
      });
    } else {
      // No shift provided - find a matching published shift for today
      const now = new Date();
      const graceWindow = new Date(now);
      graceWindow.setMinutes(graceWindow.getMinutes() + CLOCK_IN_GRACE_MINUTES);

      shift = await this.prisma.client.scheduledShift.findFirst({
        where: {
          userId: data.userId,
          orgId: data.orgId,
          branchId: data.branchId,
          status: 'PUBLISHED',
          startAt: { lte: graceWindow },
          endAt: { gt: now },
        },
      });

      if (!shift) {
        // Unscheduled clock-in not allowed by default
        throw new BadRequestException(
          'No published shift found for current time. Contact a manager to create a shift.',
        );
      }

      // Transition shift to IN_PROGRESS
      await this.prisma.client.scheduledShift.update({
        where: { id: shift.id },
        data: { status: 'IN_PROGRESS' },
      });
    }

    // Create time entry
    const entry = await this.prisma.client.timeEntry.create({
      data: {
        orgId: data.orgId,
        branchId: data.branchId,
        userId: data.userId,
        shiftId: shift?.id,
        clockInAt: new Date(),
        method: data.method ?? 'PASSWORD',
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        scheduledShift: true,
      },
    });

    return entry;
  }

  // ===== Clock Out =====

  async clockOut(userId: string, orgId: string) {
    // Find active entry
    const entry = await this.prisma.client.timeEntry.findFirst({
      where: {
        userId,
        orgId,
        clockOutAt: null,
      },
      include: {
        breakEntries: true,
        scheduledShift: true,
      },
    });

    if (!entry) {
      throw new BadRequestException('No active clock-in found');
    }

    // End any active break first
    const activeBreak = entry.breakEntries.find((b) => !b.endedAt);
    if (activeBreak) {
      await this.endBreak(activeBreak.id);
    }

    const clockOutAt = new Date();
    const totalMinutes = Math.floor(
      (clockOutAt.getTime() - entry.clockInAt.getTime()) / (1000 * 60),
    );

    // Calculate break minutes
    const breakMinutes = entry.breakEntries.reduce((sum, b) => {
      if (b.minutes) return sum + b.minutes;
      if (b.endedAt) {
        return sum + Math.floor((b.endedAt.getTime() - b.startedAt.getTime()) / (1000 * 60));
      }
      return sum;
    }, 0);

    // Get org settings for overtime threshold
    const settings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId },
    });

    const overtimeAfterMinutes =
      (settings?.attendance as { overtimeAfterMinutes?: number })?.overtimeAfterMinutes ?? 480;

    const workMinutes = totalMinutes - breakMinutes;
    const overtimeMinutes = Math.max(0, workMinutes - overtimeAfterMinutes);

    // Update time entry
    const updatedEntry = await this.prisma.client.timeEntry.update({
      where: { id: entry.id },
      data: {
        clockOutAt,
        overtimeMinutes,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        scheduledShift: true,
      },
    });

    // If linked to a shift, complete it
    if (entry.scheduledShift && entry.scheduledShift.status === 'IN_PROGRESS') {
      await this.prisma.client.scheduledShift.update({
        where: { id: entry.scheduledShift.id },
        data: {
          status: 'COMPLETED',
          actualMinutes: workMinutes,
          breakMinutes,
          overtimeMinutes,
        },
      });
    }

    return updatedEntry;
  }

  // ===== Break Management =====

  async startBreak(userId: string, orgId: string) {
    // Find active time entry
    const entry = await this.prisma.client.timeEntry.findFirst({
      where: {
        userId,
        orgId,
        clockOutAt: null,
      },
      include: {
        breakEntries: {
          where: { endedAt: null },
        },
      },
    });

    if (!entry) {
      throw new BadRequestException('Must be clocked in to start a break');
    }

    // Check for existing active break
    if (entry.breakEntries.length > 0) {
      throw new BadRequestException('Already on a break. End current break first.');
    }

    return this.prisma.client.breakEntry.create({
      data: {
        timeEntryId: entry.id,
        startedAt: new Date(),
      },
    });
  }

  async endBreak(breakId: string) {
    const breakEntry = await this.prisma.client.breakEntry.findUnique({
      where: { id: breakId },
    });

    if (!breakEntry) {
      throw new NotFoundException('Break entry not found');
    }

    if (breakEntry.endedAt) {
      throw new BadRequestException('Break already ended');
    }

    const endedAt = new Date();
    const minutes = Math.floor(
      (endedAt.getTime() - breakEntry.startedAt.getTime()) / (1000 * 60),
    );

    return this.prisma.client.breakEntry.update({
      where: { id: breakId },
      data: {
        endedAt,
        minutes,
      },
    });
  }

  async endActiveBreak(userId: string, orgId: string) {
    // Find active time entry
    const entry = await this.prisma.client.timeEntry.findFirst({
      where: {
        userId,
        orgId,
        clockOutAt: null,
      },
      include: {
        breakEntries: {
          where: { endedAt: null },
        },
      },
    });

    if (!entry) {
      throw new BadRequestException('Must be clocked in to end a break');
    }

    const activeBreak = entry.breakEntries[0];
    if (!activeBreak) {
      throw new BadRequestException('No active break to end');
    }

    return this.endBreak(activeBreak.id);
  }

  // ===== Time Entry Queries =====

  async getTimeEntries(filters: {
    orgId: string;
    branchId?: string;
    userId?: string;
    from: Date;
    to: Date;
  }) {
    return this.prisma.client.timeEntry.findMany({
      where: {
        orgId: filters.orgId,
        ...(filters.branchId && { branchId: filters.branchId }),
        ...(filters.userId && { userId: filters.userId }),
        clockInAt: {
          gte: filters.from,
          lte: filters.to,
        },
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        scheduledShift: true,
        breakEntries: true,
      },
      orderBy: { clockInAt: 'desc' },
    });
  }
}
