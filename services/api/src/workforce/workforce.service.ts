/**
 * E43-s1: Workforce Service
 * 
 * Handles leave requests, shift swaps, time clock, and payroll export.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class WorkforceService {
  constructor(public readonly prisma: PrismaService) {}

  // ===== Leave Management =====

  /**
   * Create leave request
   */
  async createLeaveRequest(data: {
    orgId: string;
    userId: string;
    type: 'ANNUAL' | 'SICK' | 'UNPAID' | 'OTHER';
    startDate: Date;
    endDate: Date;
    reason?: string;
  }): Promise<any> {
    return this.prisma.client.leaveRequest.create({
      data: {
        orgId: data.orgId,
        userId: data.userId,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason,
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Approve or reject leave request (L3+)
   */
  async approveLeaveRequest(
    id: string,
    approverId: string,
    action: 'APPROVED' | 'REJECTED',
  ): Promise<any> {
    const leaveRequest = await this.prisma.client.leaveRequest.findUnique({
      where: { id },
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    if (leaveRequest.status !== 'PENDING') {
      throw new BadRequestException(`Leave request already ${leaveRequest.status.toLowerCase()}`);
    }

    return this.prisma.client.leaveRequest.update({
      where: { id },
      data: {
        status: action,
        approvedById: approverId,
        approvedAt: new Date(),
      },
      include: {
        user: true,
        approvedBy: true,
      },
    });
  }

  // ===== Roster Management =====

  /**
   * Create duty shift (L3+)
   */
  async createDutyShift(data: {
    orgId: string;
    branchId: string;
    userId: string;
    startsAt: Date;
    endsAt: Date;
    roleSlug: string;
    assignedById?: string;
    notes?: string;
  }): Promise<any> {
    return this.prisma.client.dutyShift.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Propose shift swap (L2+)
   */
  async proposeShiftSwap(data: {
    orgId: string;
    fromUserId: string;
    toUserId: string;
    dutyShiftId: string;
  }): Promise<any> {
    // Verify shift exists and belongs to fromUser
    const shift = await this.prisma.client.dutyShift.findUnique({
      where: { id: data.dutyShiftId },
    });

    if (!shift) {
      throw new NotFoundException('Duty shift not found');
    }

    if (shift.userId !== data.fromUserId) {
      throw new ForbiddenException('You can only swap your own shifts');
    }

    return this.prisma.client.shiftSwap.create({
      data: {
        orgId: data.orgId,
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        dutyShiftId: data.dutyShiftId,
        status: 'PENDING',
      },
      include: {
        fromUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        toUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        dutyShift: true,
      },
    });
  }

  /**
   * Approve or reject shift swap (L3+)
   */
  async approveShiftSwap(
    id: string,
    approverId: string,
    action: 'APPROVED' | 'REJECTED',
  ): Promise<any> {
    const swap = await this.prisma.client.shiftSwap.findUnique({
      where: { id },
      include: { dutyShift: true },
    });

    if (!swap) {
      throw new NotFoundException('Shift swap not found');
    }

    if (swap.status !== 'PENDING') {
      throw new BadRequestException(`Shift swap already ${swap.status.toLowerCase()}`);
    }

    // If approved, update the duty shift
    if (action === 'APPROVED') {
      await this.prisma.client.dutyShift.update({
        where: { id: swap.dutyShiftId },
        data: { userId: swap.toUserId },
      });
    }

    return this.prisma.client.shiftSwap.update({
      where: { id },
      data: {
        status: action,
        approvedById: approverId,
        decidedAt: new Date(),
      },
      include: {
        fromUser: true,
        toUser: true,
        dutyShift: true,
        approvedBy: true,
      },
    });
  }

  // ===== Time Clock =====

  /**
   * Clock in (creates new TimeEntry)
   */
  async clockIn(data: {
    orgId: string;
    branchId: string;
    userId: string;
    method: 'MSR' | 'PASSKEY' | 'PASSWORD';
  }): Promise<any> {
    // Check for existing open time entry
    const openEntry = await this.prisma.client.timeEntry.findFirst({
      where: {
        userId: data.userId,
        clockOutAt: null,
      },
    });

    if (openEntry) {
      throw new BadRequestException('You already have an active clock-in. Please clock out first.');
    }

    return this.prisma.client.timeEntry.create({
      data: {
        orgId: data.orgId,
        branchId: data.branchId,
        userId: data.userId,
        clockInAt: new Date(),
        method: data.method,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * Clock out (closes TimeEntry and calculates overtime)
   */
  async clockOut(userId: string, orgId: string): Promise<any> {
    const openEntry = await this.prisma.client.timeEntry.findFirst({
      where: {
        userId,
        orgId,
        clockOutAt: null,
      },
      orderBy: { clockInAt: 'desc' },
    });

    if (!openEntry) {
      throw new BadRequestException('No active clock-in found');
    }

    const clockOutAt = new Date();
    const totalMinutes = Math.floor(
      (clockOutAt.getTime() - openEntry.clockInAt.getTime()) / (1000 * 60),
    );

    // Get org settings for overtime threshold
    const settings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId },
    });

    const overtimeAfterMinutes =
      (settings?.attendance as any)?.overtimeAfterMinutes ?? 480; // Default 8 hours

    const overtimeMinutes = Math.max(0, totalMinutes - overtimeAfterMinutes);

    return this.prisma.client.timeEntry.update({
      where: { id: openEntry.id },
      data: {
        clockOutAt,
        overtimeMinutes,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * Get time entries for a user or branch (L3+)
   */
  async getTimeEntries(filters: {
    orgId: string;
    branchId?: string;
    userId?: string;
    from: Date;
    to: Date;
  }): Promise<any> {
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
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { clockInAt: 'desc' },
    });
  }

  // ===== Payroll Export =====

  /**
   * Export payroll data (L4+)
   * Returns aggregated hours per employee for a date range
   */
  async exportPayroll(filters: {
    orgId: string;
    branchId?: string;
    from: Date;
    to: Date;
  }): Promise<any> {
    const timeEntries = await this.prisma.client.timeEntry.findMany({
      where: {
        orgId: filters.orgId,
        ...(filters.branchId && { branchId: filters.branchId }),
        clockInAt: {
          gte: filters.from,
          lte: filters.to,
        },
        clockOutAt: { not: null }, // Only completed entries
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Get leave requests in the same period (for future integration)
    await this.prisma.client.leaveRequest.findMany({
      where: {
        orgId: filters.orgId,
        status: 'APPROVED',
        startDate: { lte: filters.to },
        endDate: { gte: filters.from },
      },
    });

    // Get all duty shifts in the period
    const dutyShifts = await this.prisma.client.dutyShift.findMany({
      where: {
        orgId: filters.orgId,
        ...(filters.branchId && { branchId: filters.branchId }),
        startsAt: {
          gte: filters.from,
          lte: filters.to,
        },
      },
    });

    // Aggregate by user
    const userMap = new Map<string, any>();

    for (const entry of timeEntries) {
      if (!userMap.has(entry.userId)) {
        userMap.set(entry.userId, {
          userId: entry.userId,
          firstName: entry.user.firstName,
          lastName: entry.user.lastName,
          email: entry.user.email,
          regularMinutes: 0,
          overtimeMinutes: 0,
          daysPresent: 0,
          daysMissed: 0,
        });
      }

      const user = userMap.get(entry.userId);
      
      // Skip if clockOutAt is missing (should not happen due to filter, but be safe)
      if (!entry.clockOutAt) continue;
      
      const totalMinutes = Math.floor(
        (entry.clockOutAt.getTime() - entry.clockInAt.getTime()) / (1000 * 60),
      );
      user.regularMinutes += totalMinutes - entry.overtimeMinutes;
      user.overtimeMinutes += entry.overtimeMinutes;

      // Count unique days present
      const dayKey = entry.clockInAt.toISOString().split('T')[0];
      if (!user.presentDays) user.presentDays = new Set();
      user.presentDays.add(dayKey);
    }

    // Calculate days missed (scheduled shifts but no time entry)
    for (const shift of dutyShifts) {
      if (!userMap.has(shift.userId)) {
        userMap.set(shift.userId, {
          userId: shift.userId,
          firstName: '',
          lastName: '',
          email: '',
          regularMinutes: 0,
          overtimeMinutes: 0,
          daysPresent: 0,
          daysMissed: 0,
        });
      }

      const user = userMap.get(shift.userId);
      const shiftDayKey = shift.startsAt.toISOString().split('T')[0];

      if (!user.scheduledDays) user.scheduledDays = new Set();
      user.scheduledDays.add(shiftDayKey);
    }

    // Calculate final stats
    const results: any[] = [];
    for (const [_userId, data] of userMap.entries()) {
      const presentDays = data.presentDays ? data.presentDays.size : 0;
      const scheduledDays = data.scheduledDays ? data.scheduledDays.size : 0;
      const daysMissed = Math.max(0, scheduledDays - presentDays);

      results.push({
        userId: data.userId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        regularMinutes: data.regularMinutes,
        overtimeMinutes: data.overtimeMinutes,
        daysPresent: presentDays,
        daysMissed,
      });
    }

    return results;
  }

  /**
   * Check absence cap violations (stub for anomaly flagging)
   */
  async checkAbsenceCaps(orgId: string): Promise<any[]> {
    const settings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId },
    });

    const hardCap = (settings?.attendance as any)?.hardCapAbsences ?? 3;

    // Get all users with leave/absence issues
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const leaveRequests = await this.prisma.client.leaveRequest.findMany({
      where: {
        orgId,
        startDate: { gte: thirtyDaysAgo },
        type: 'UNPAID', // Focus on uninformed absences
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    const userAbsenceCounts = new Map<string, number>();
    for (const req of leaveRequests) {
      const count = userAbsenceCounts.get(req.userId) ?? 0;
      userAbsenceCounts.set(req.userId, count + 1);
    }

    const violations: any[] = [];
    for (const [userId, count] of userAbsenceCounts.entries()) {
      if (count > hardCap) {
        const user = leaveRequests.find((r) => r.userId === userId)?.user;
        violations.push({
          userId,
          firstName: user?.firstName,
          lastName: user?.lastName,
          uninformedAbsences: count,
          hardCap,
        });
      }
    }

    return violations;
  }
}
