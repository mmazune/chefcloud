/**
 * M10.11: Workforce Conflicts Service
 * 
 * Centralized conflict detection for:
 * - Shift scheduling conflicts (double-booking)
 * - Availability conflicts (scheduling outside available hours)
 * - Pay period lock enforcement
 * - Overtime threshold warnings
 * 
 * This service is used by scheduling, swaps, and open shift claiming.
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface ConflictCheckInput {
  userId: string;
  orgId: string;
  branchId?: string;
  startAt: Date;
  endAt: Date;
  excludeShiftIds?: string[]; // Exclude these shifts from conflict check (for swaps)
}

export interface ConflictResult {
  hasConflict: boolean;
  conflictType?: 'SCHEDULE_OVERLAP' | 'AVAILABILITY' | 'PAY_PERIOD_LOCKED' | 'OVERTIME_WARNING';
  message?: string;
  conflictingShiftId?: string;
  details?: Record<string, unknown>;
}

export interface AvailabilityCheckResult {
  isAvailable: boolean;
  availableSlots: Array<{ startTime: string; endTime: string }>;
  requestedWindow: { startTime: string; endTime: string };
  message?: string;
}

@Injectable()
export class WorkforceConflictsService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Check for all types of conflicts
   * Returns first conflict found (fail-fast)
   */
  async checkAllConflicts(input: ConflictCheckInput): Promise<ConflictResult> {
    // 1. Check pay period lock
    const lockConflict = await this.checkPayPeriodLock(input);
    if (lockConflict.hasConflict) return lockConflict;

    // 2. Check schedule overlap
    const scheduleConflict = await this.checkScheduleOverlap(input);
    if (scheduleConflict.hasConflict) return scheduleConflict;

    // 3. Check availability (soft check - warning only)
    const availabilityConflict = await this.checkAvailabilityConflict(input);
    if (availabilityConflict.hasConflict) return availabilityConflict;

    return { hasConflict: false };
  }

  /**
   * Check for schedule overlap conflicts (double-booking)
   */
  async checkScheduleOverlap(input: ConflictCheckInput): Promise<ConflictResult> {
    const { userId, orgId, startAt, endAt, excludeShiftIds = [] } = input;

    // Find overlapping shifts for this user
    const overlappingShifts = await this.prisma.client.scheduledShift.findMany({
      where: {
        userId,
        orgId,
        id: { notIn: excludeShiftIds },
        status: { in: ['PUBLISHED', 'IN_PROGRESS'] },
        // Overlap condition: shift.startAt < endAt AND shift.endAt > startAt
        AND: [
          { startAt: { lt: endAt } },
          { endAt: { gt: startAt } },
        ],
      },
      include: {
        branch: { select: { name: true } },
      },
    });

    if (overlappingShifts.length > 0) {
      const first = overlappingShifts[0];
      return {
        hasConflict: true,
        conflictType: 'SCHEDULE_OVERLAP',
        message: `User already has a shift from ${first.startAt.toISOString()} to ${first.endAt.toISOString()} at ${first.branch?.name ?? 'unknown branch'}`,
        conflictingShiftId: first.id,
        details: {
          conflictingShifts: overlappingShifts.map(s => ({
            id: s.id,
            startAt: s.startAt,
            endAt: s.endAt,
            role: s.role,
            branch: s.branch?.name,
          })),
        },
      };
    }

    return { hasConflict: false };
  }

  /**
   * Check if shift falls within pay period lock
   */
  async checkPayPeriodLock(input: ConflictCheckInput): Promise<ConflictResult> {
    const { orgId, branchId, startAt } = input;

    // Find pay period that contains this shift's start date
    const payPeriod = await this.prisma.client.payPeriod.findFirst({
      where: {
        orgId,
        ...(branchId ? { branchId } : {}),
        startDate: { lte: startAt },
        endDate: { gte: startAt },
      },
    });

    // Pay period is locked if status is CLOSED or EXPORTED
    if (payPeriod && (payPeriod.status === 'CLOSED' || payPeriod.status === 'EXPORTED')) {
      return {
        hasConflict: true,
        conflictType: 'PAY_PERIOD_LOCKED',
        message: `Cannot modify shifts in ${payPeriod.status.toLowerCase()} pay period (${payPeriod.startDate.toISOString().split('T')[0]} to ${payPeriod.endDate.toISOString().split('T')[0]})`,
        details: {
          payPeriodId: payPeriod.id,
          status: payPeriod.status,
          closedAt: payPeriod.closedAt,
        },
      };
    }

    return { hasConflict: false };
  }

  /**
   * Check if shift falls within user's availability
   * Note: This is a soft check - returns conflict but scheduling may still be allowed
   */
  async checkAvailabilityConflict(input: ConflictCheckInput): Promise<ConflictResult> {
    const { userId, orgId, startAt, endAt } = input;

    // Get day of week for the shift date
    const shiftDate = new Date(startAt);
    const dayOfWeek = shiftDate.getDay();

    // Check for exception first
    const dateString = shiftDate.toISOString().split('T')[0];
    const exception = await this.prisma.client.workforceAvailabilityException.findFirst({
      where: {
        userId,
        orgId,
        date: {
          gte: new Date(dateString),
          lt: new Date(new Date(shiftDate).setDate(shiftDate.getDate() + 1)),
        },
      },
    });

    if (exception) {
      if (!exception.isAvailable) {
        return {
          hasConflict: true,
          conflictType: 'AVAILABILITY',
          message: `User has marked ${dateString} as unavailable${exception.reason ? `: ${exception.reason}` : ''}`,
          details: {
            exceptionId: exception.id,
            reason: exception.reason,
          },
        };
      }

      // Check if shift falls within exception availability window
      if (exception.startTime && exception.endTime) {
        const shiftStart = this.extractTime(startAt);
        const shiftEnd = this.extractTime(endAt);

        if (!this.isWithinWindow(shiftStart, shiftEnd, exception.startTime, exception.endTime)) {
          return {
            hasConflict: true,
            conflictType: 'AVAILABILITY',
            message: `Shift (${shiftStart}-${shiftEnd}) falls outside available window (${exception.startTime}-${exception.endTime}) for ${dateString}`,
            details: {
              availableWindow: { startTime: exception.startTime, endTime: exception.endTime },
              requestedWindow: { startTime: shiftStart, endTime: shiftEnd },
            },
          };
        }
      }

      // Exception is available and shift fits - no conflict
      return { hasConflict: false };
    }

    // Check weekly availability
    const weeklySlots = await this.prisma.client.workforceAvailability.findMany({
      where: { userId, orgId, dayOfWeek },
      orderBy: { startTime: 'asc' },
    });

    if (weeklySlots.length === 0) {
      // No availability set - allow by default (user hasn't configured availability)
      return { hasConflict: false };
    }

    // Check if shift falls within any availability slot
    const shiftStart = this.extractTime(startAt);
    const shiftEnd = this.extractTime(endAt);

    const fitsSlot = weeklySlots.some(slot =>
      this.isWithinWindow(shiftStart, shiftEnd, slot.startTime, slot.endTime)
    );

    if (!fitsSlot) {
      return {
        hasConflict: true,
        conflictType: 'AVAILABILITY',
        message: `Shift (${shiftStart}-${shiftEnd}) falls outside available hours for ${this.dayName(dayOfWeek)}`,
        details: {
          dayOfWeek,
          availableSlots: weeklySlots.map(s => ({ startTime: s.startTime, endTime: s.endTime })),
          requestedWindow: { startTime: shiftStart, endTime: shiftEnd },
        },
      };
    }

    return { hasConflict: false };
  }

  /**
   * Check for overtime threshold (warning only)
   */
  async checkOvertimeWarning(
    userId: string,
    orgId: string,
    branchId: string | null,
    weekStart: Date,
    additionalMinutes: number,
  ): Promise<{ hasWarning: boolean; message?: string; currentMinutes: number; thresholdMinutes: number }> {
    // Get org/branch policy for overtime threshold
    const policy = await this.prisma.client.workforcePolicy.findFirst({
      where: { orgId },
    });

    const overtimeThreshold = policy?.weeklyOtThresholdMins ?? 40 * 60; // Default 40 hours

    // Get current week's scheduled minutes for this user
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const shifts = await this.prisma.client.scheduledShift.findMany({
      where: {
        userId,
        orgId,
        ...(branchId ? { branchId } : {}),
        startAt: { gte: weekStart, lt: weekEnd },
        status: { in: ['PUBLISHED', 'IN_PROGRESS'] },
      },
    });

    const currentMinutes = shifts.reduce((sum, s) => sum + (s.plannedMinutes ?? 0), 0);
    const projectedMinutes = currentMinutes + additionalMinutes;

    if (projectedMinutes > overtimeThreshold) {
      return {
        hasWarning: true,
        message: `Adding this shift would result in ${Math.floor(projectedMinutes / 60)} hours for the week, exceeding overtime threshold of ${Math.floor(overtimeThreshold / 60)} hours`,
        currentMinutes,
        thresholdMinutes: overtimeThreshold,
      };
    }

    return {
      hasWarning: false,
      currentMinutes,
      thresholdMinutes: overtimeThreshold,
    };
  }

  /**
   * Validate a shift swap won't create conflicts for either party
   */
  async validateSwap(
    requesterId: string,
    requesterShiftId: string,
    targetUserId: string,
    targetShiftId: string,
    orgId: string,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Get both shifts
    const [requesterShift, targetShift] = await Promise.all([
      this.prisma.client.scheduledShift.findUnique({ where: { id: requesterShiftId } }),
      this.prisma.client.scheduledShift.findUnique({ where: { id: targetShiftId } }),
    ]);

    if (!requesterShift || !targetShift) {
      errors.push('One or both shifts not found');
      return { valid: false, errors };
    }

    // Check if requester can take target's shift
    const requesterConflict = await this.checkAllConflicts({
      userId: requesterId,
      orgId,
      branchId: targetShift.branchId,
      startAt: targetShift.startAt,
      endAt: targetShift.endAt,
      excludeShiftIds: [requesterShiftId], // Exclude the shift being swapped away
    });

    if (requesterConflict.hasConflict) {
      errors.push(`Requester conflict: ${requesterConflict.message}`);
    }

    // Check if target can take requester's shift
    const targetConflict = await this.checkAllConflicts({
      userId: targetUserId,
      orgId,
      branchId: requesterShift.branchId,
      startAt: requesterShift.startAt,
      endAt: requesterShift.endAt,
      excludeShiftIds: [targetShiftId], // Exclude the shift being swapped away
    });

    if (targetConflict.hasConflict) {
      errors.push(`Target conflict: ${targetConflict.message}`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate open shift claim won't create conflicts
   */
  async validateOpenShiftClaim(
    claimerId: string,
    shiftId: string,
    orgId: string,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    const shift = await this.prisma.client.scheduledShift.findUnique({
      where: { id: shiftId },
    });

    if (!shift) {
      errors.push('Shift not found');
      return { valid: false, errors };
    }

    if (!shift.isOpen) {
      errors.push('Shift is not open for claiming');
      return { valid: false, errors };
    }

    const conflict = await this.checkAllConflicts({
      userId: claimerId,
      orgId,
      branchId: shift.branchId,
      startAt: shift.startAt,
      endAt: shift.endAt,
    });

    if (conflict.hasConflict) {
      errors.push(conflict.message ?? 'Conflict detected');
    }

    return { valid: errors.length === 0, errors };
  }

  // ===== HELPERS =====

  private extractTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private isWithinWindow(
    shiftStart: string,
    shiftEnd: string,
    windowStart: string,
    windowEnd: string,
  ): boolean {
    const sStart = this.timeToMinutes(shiftStart);
    const sEnd = this.timeToMinutes(shiftEnd);
    const wStart = this.timeToMinutes(windowStart);
    const wEnd = this.timeToMinutes(windowEnd);

    return sStart >= wStart && sEnd <= wEnd;
  }

  private dayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] ?? 'Unknown';
  }
}
