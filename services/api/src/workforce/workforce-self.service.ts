/**
 * M10.5: Workforce Self-Service
 * 
 * Allows staff to view their own schedules, time entries, and timesheet totals.
 * Security: All queries filter by req.user.userId - never accepts userId as parameter.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WorkforceEnterpriseService, RoundingMode } from './workforce-enterprise.service';

export interface SelfScheduleFilters {
  from?: Date;
  to?: Date;
}

export interface SelfTimeFilters {
  payPeriodId?: string;
  from?: Date;
  to?: Date;
}

export interface ClockStatusResult {
  isClockedIn: boolean;
  isOnBreak: boolean;
  currentEntryId: string | null;
  clockedInAt: Date | null;
  breakStartedAt: Date | null;
}

export interface TimesheetTotals {
  payPeriodId: string | null;
  periodStart: Date;
  periodEnd: Date;
  regularMinutes: number;
  overtimeMinutes: number;
  breakMinutes: number;
  paidMinutes: number;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MIXED' | 'NONE';
  isLocked: boolean;
  entries: number;
}

@Injectable()
export class WorkforceSelfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enterpriseService: WorkforceEnterpriseService,
  ) { }

  /**
   * Get upcoming shifts for the authenticated user
   * Default: next 14-30 days
   */
  async getMySchedule(userId: string, orgId: string, filters?: SelfScheduleFilters) {
    const now = new Date();
    const from = filters?.from ?? now;
    const to = filters?.to ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const shifts = await this.prisma.client.scheduledShift.findMany({
      where: {
        userId,
        orgId,
        startAt: {
          gte: from,
          lte: to,
        },
      },
      include: {
        branch: {
          select: { id: true, name: true },
        },
      },
      orderBy: { startAt: 'asc' },
    });

    return shifts.map(shift => ({
      id: shift.id,
      branchId: shift.branchId,
      branchName: shift.branch?.name ?? null,
      role: shift.role,
      startAt: shift.startAt,
      endAt: shift.endAt,
      plannedMinutes: shift.plannedMinutes,
      status: shift.status,
      notes: shift.notes,
    }));
  }

  /**
   * Get time entries for the authenticated user
   * Can filter by payPeriodId or date range
   */
  async getMyTimeEntries(userId: string, orgId: string, filters?: SelfTimeFilters) {
    let dateFilter: { clockInAt?: { gte: Date; lte: Date } } = {};

    if (filters?.payPeriodId) {
      // Find the pay period
      const period = await this.prisma.client.payPeriod.findFirst({
        where: { id: filters.payPeriodId, orgId },
      });
      if (!period) {
        throw new NotFoundException('Pay period not found');
      }
      dateFilter = {
        clockInAt: {
          gte: period.startDate,
          lte: period.endDate,
        },
      };
    } else if (filters?.from && filters?.to) {
      dateFilter = {
        clockInAt: {
          gte: filters.from,
          lte: filters.to,
        },
      };
    }

    const entries = await this.prisma.client.timeEntry.findMany({
      where: {
        userId,
        orgId,
        ...dateFilter,
      },
      include: {
        breakEntries: true,
        timesheetApproval: {
          select: {
            status: true,
            lockedAt: true,
          },
        },
        scheduledShift: {
          select: {
            role: true,
          },
        },
      },
      orderBy: { clockInAt: 'desc' },
    });

    return entries.map(entry => {
      const breakMinutes = entry.breakEntries.reduce((sum, b) => sum + (b.minutes ?? 0), 0);
      const workedMinutes = entry.clockOutAt
        ? Math.floor((entry.clockOutAt.getTime() - entry.clockInAt.getTime()) / 60000) - breakMinutes
        : null;

      return {
        id: entry.id,
        branchId: entry.branchId,
        shiftId: entry.shiftId,
        role: entry.scheduledShift?.role ?? null,
        clockInAt: entry.clockInAt,
        clockOutAt: entry.clockOutAt,
        method: entry.method,
        workedMinutes,
        breakMinutes,
        overtimeMinutes: entry.overtimeMinutes,
        approved: entry.approved,
        approvalStatus: entry.timesheetApproval?.status ?? null,
        isLocked: !!entry.timesheetApproval?.lockedAt,
        breakEntries: entry.breakEntries.map(b => ({
          id: b.id,
          startedAt: b.startedAt,
          endedAt: b.endedAt,
          minutes: b.minutes,
        })),
      };
    });
  }

  /**
   * Get current clock status for the authenticated user
   */
  async getMyClockStatus(userId: string, orgId: string): Promise<ClockStatusResult> {
    const activeEntry = await this.prisma.client.timeEntry.findFirst({
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

    if (!activeEntry) {
      return {
        isClockedIn: false,
        isOnBreak: false,
        currentEntryId: null,
        clockedInAt: null,
        breakStartedAt: null,
      };
    }

    const activeBreak = activeEntry.breakEntries[0] ?? null;

    return {
      isClockedIn: true,
      isOnBreak: !!activeBreak,
      currentEntryId: activeEntry.id,
      clockedInAt: activeEntry.clockInAt,
      breakStartedAt: activeBreak?.startedAt ?? null,
    };
  }

  /**
   * Get computed timesheet totals for the authenticated user
   * For a specific pay period or date range
   */
  async getMyTimesheet(userId: string, orgId: string, filters?: SelfTimeFilters): Promise<TimesheetTotals> {
    // Get policy for rounding/OT rules
    const policy = await this.enterpriseService.getPolicy(orgId);

    let periodStart: Date;
    let periodEnd: Date;
    let payPeriodId: string | null = null;

    if (filters?.payPeriodId) {
      const period = await this.prisma.client.payPeriod.findFirst({
        where: { id: filters.payPeriodId, orgId },
      });
      if (!period) {
        throw new NotFoundException('Pay period not found');
      }
      periodStart = period.startDate;
      periodEnd = period.endDate;
      payPeriodId = period.id;
    } else if (filters?.from && filters?.to) {
      periodStart = filters.from;
      periodEnd = filters.to;
    } else {
      // Default to current week
      const now = new Date();
      const dayOfWeek = now.getDay();
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - dayOfWeek);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodStart.getDate() + 6);
      periodEnd.setHours(23, 59, 59, 999);
    }

    // Get all entries in the period
    const entries = await this.prisma.client.timeEntry.findMany({
      where: {
        userId,
        orgId,
        clockInAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        clockOutAt: { not: null }, // Only completed entries
      },
      include: {
        breakEntries: true,
        timesheetApproval: true,
      },
      orderBy: { clockInAt: 'asc' },
    });

    // Compute totals
    let totalWorkedMinutes = 0;
    let totalBreakMinutes = 0;
    let totalOvertimeMinutes = 0;
    const approvalStatuses = new Set<string>();
    let isLocked = false;

    for (const entry of entries) {
      const breakMins = entry.breakEntries.reduce((sum, b) => sum + (b.minutes ?? 0), 0);
      const workedMins = entry.clockOutAt
        ? Math.floor((entry.clockOutAt.getTime() - entry.clockInAt.getTime()) / 60000)
        : 0;

      // Apply rounding
      const roundedWorked = this.applyRounding(
        workedMins - breakMins,
        policy.roundingIntervalMins,
        policy.roundingMode as RoundingMode
      );

      totalWorkedMinutes += roundedWorked;
      totalBreakMinutes += breakMins;
      totalOvertimeMinutes += entry.overtimeMinutes;

      if (entry.timesheetApproval) {
        approvalStatuses.add(entry.timesheetApproval.status);
        if (entry.timesheetApproval.lockedAt) {
          isLocked = true;
        }
      }
    }

    // Compute overtime based on policy
    const dailyOT = Math.max(0, totalWorkedMinutes - policy.dailyOtThresholdMins);
    const weeklyOT = Math.max(0, totalWorkedMinutes - policy.weeklyOtThresholdMins);
    const computedOT = Math.max(dailyOT, weeklyOT, totalOvertimeMinutes);

    const regularMinutes = totalWorkedMinutes - computedOT;
    const paidMinutes = regularMinutes + computedOT;

    // Determine approval status
    let approvalStatus: TimesheetTotals['approvalStatus'] = 'NONE';
    if (approvalStatuses.size === 1) {
      approvalStatus = Array.from(approvalStatuses)[0] as 'PENDING' | 'APPROVED' | 'REJECTED';
    } else if (approvalStatuses.size > 1) {
      approvalStatus = 'MIXED';
    }

    return {
      payPeriodId,
      periodStart,
      periodEnd,
      regularMinutes,
      overtimeMinutes: computedOT,
      breakMinutes: totalBreakMinutes,
      paidMinutes,
      approvalStatus,
      isLocked,
      entries: entries.length,
    };
  }

  /**
   * Apply rounding based on policy
   */
  private applyRounding(minutes: number, interval: number, mode: RoundingMode): number {
    if (interval <= 0) return minutes;

    switch (mode) {
      case 'NEAREST':
        return Math.round(minutes / interval) * interval;
      case 'UP':
        return Math.ceil(minutes / interval) * interval;
      case 'DOWN':
        return Math.floor(minutes / interval) * interval;
      default:
        return minutes;
    }
  }
}
