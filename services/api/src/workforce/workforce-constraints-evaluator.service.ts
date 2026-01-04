/**
 * M10.14: Workforce Constraints Evaluator Service
 *
 * Evaluates scheduling constraints for candidate assignment:
 * - OVERLAP: User already has a shift overlapping the time slot
 * - MIN_REST: Minimum rest hours between shifts violated
 * - MAX_WEEKLY: Maximum weekly hours exceeded
 * - MAX_CONSEC_DAYS: Maximum consecutive work days exceeded
 * - PAY_PERIOD_LOCKED: Pay period is locked for edits
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Constraint violation reasons
export const CONSTRAINT_REASONS = {
  OVERLAP: 'OVERLAP',
  MIN_REST: 'MIN_REST',
  MAX_WEEKLY: 'MAX_WEEKLY',
  MAX_CONSEC_DAYS: 'MAX_CONSEC_DAYS',
  PAY_PERIOD_LOCKED: 'PAY_PERIOD_LOCKED',
} as const;

export type ConstraintReason = (typeof CONSTRAINT_REASONS)[keyof typeof CONSTRAINT_REASONS];

export interface ConstraintViolation {
  reason: ConstraintReason;
  message: string;
}

export interface CandidateEvaluation {
  userId: string;
  isEligible: boolean;
  violations: ConstraintViolation[];
  weeklyHours: number; // Used for tie-breaking
  score: number; // Assignment score
}

export interface WorkforcePolicySettings {
  minRestHoursBetweenShifts: number;
  maxWeeklyHours: number;
  maxConsecutiveDays: number;
}

const DEFAULT_POLICY: WorkforcePolicySettings = {
  minRestHoursBetweenShifts: 10,
  maxWeeklyHours: 48,
  maxConsecutiveDays: 6,
};

@Injectable()
export class WorkforceConstraintsEvaluatorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get workforce policy for org, or defaults if not set.
   */
  async getPolicy(orgId: string): Promise<WorkforcePolicySettings> {
    const policy = await this.prisma.client.workforcePolicy.findUnique({
      where: { orgId },
      select: {
        minRestHoursBetweenShifts: true,
        maxWeeklyHours: true,
        maxConsecutiveDays: true,
      },
    });

    return policy || DEFAULT_POLICY;
  }

  /**
   * Evaluate all candidates for a shift slot and return eligibility results.
   * Returns candidates sorted by assignment priority (lowest weekly hours first, then lexical userId).
   */
  async evaluateCandidates(
    orgId: string,
    branchId: string,
    candidateUserIds: string[],
    shiftStart: Date,
    shiftEnd: Date,
  ): Promise<CandidateEvaluation[]> {
    const policy = await this.getPolicy(orgId);
    const results: CandidateEvaluation[] = [];

    for (const userId of candidateUserIds) {
      const evaluation = await this.evaluateCandidate(
        orgId,
        branchId,
        userId,
        shiftStart,
        shiftEnd,
        policy,
      );
      results.push(evaluation);
    }

    // Sort by: 1) eligibility (eligible first), 2) weekly hours (lowest first), 3) userId (lexical)
    results.sort((a, b) => {
      // Eligible candidates first
      if (a.isEligible !== b.isEligible) {
        return a.isEligible ? -1 : 1;
      }
      // Then by weekly hours (lowest first)
      if (a.weeklyHours !== b.weeklyHours) {
        return a.weeklyHours - b.weeklyHours;
      }
      // Finally by userId (lexical) for determinism
      return a.userId.localeCompare(b.userId);
    });

    return results;
  }

  /**
   * Evaluate a single candidate for constraint violations.
   */
  private async evaluateCandidate(
    orgId: string,
    branchId: string,
    userId: string,
    shiftStart: Date,
    shiftEnd: Date,
    policy: WorkforcePolicySettings,
  ): Promise<CandidateEvaluation> {
    const violations: ConstraintViolation[] = [];

    // 1. Check for overlapping shifts
    const hasOverlap = await this.checkOverlap(userId, shiftStart, shiftEnd);
    if (hasOverlap) {
      violations.push({
        reason: CONSTRAINT_REASONS.OVERLAP,
        message: 'User has an overlapping shift',
      });
    }

    // 2. Check minimum rest hours
    const restViolation = await this.checkMinRest(userId, shiftStart, shiftEnd, policy);
    if (restViolation) {
      violations.push(restViolation);
    }

    // 3. Check max weekly hours
    const weeklyHours = await this.getWeeklyHours(userId, shiftStart, shiftEnd);
    const shiftDurationHours = (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);
    if (weeklyHours + shiftDurationHours > policy.maxWeeklyHours) {
      violations.push({
        reason: CONSTRAINT_REASONS.MAX_WEEKLY,
        message: `Would exceed max weekly hours (${policy.maxWeeklyHours})`,
      });
    }

    // 4. Check max consecutive days
    const consecDays = await this.getConsecutiveDays(userId, shiftStart);
    if (consecDays >= policy.maxConsecutiveDays) {
      violations.push({
        reason: CONSTRAINT_REASONS.MAX_CONSEC_DAYS,
        message: `Would exceed max consecutive days (${policy.maxConsecutiveDays})`,
      });
    }

    // 5. Check pay period lock
    const isLocked = await this.checkPayPeriodLocked(orgId, shiftStart);
    if (isLocked) {
      violations.push({
        reason: CONSTRAINT_REASONS.PAY_PERIOD_LOCKED,
        message: 'Pay period is locked',
      });
    }

    // Calculate assignment score (higher is better):
    // Base score 100, minus penalty for weekly hours (encourages fair distribution)
    const score = Math.max(0, 100 - Math.floor(weeklyHours));

    return {
      userId,
      isEligible: violations.length === 0,
      violations,
      weeklyHours,
      score,
    };
  }

  /**
   * Check if user has any overlapping shifts.
   */
  private async checkOverlap(
    userId: string,
    shiftStart: Date,
    shiftEnd: Date,
  ): Promise<boolean> {
    // Check ScheduledShift for overlaps
    const overlapping = await this.prisma.client.scheduledShift.findFirst({
      where: {
        userId,
        status: { in: ['PUBLISHED', 'APPROVED'] },
        OR: [
          // New shift starts during existing shift
          {
            startAt: { lte: shiftStart },
            endAt: { gt: shiftStart },
          },
          // New shift ends during existing shift
          {
            startAt: { lt: shiftEnd },
            endAt: { gte: shiftEnd },
          },
          // New shift contains existing shift
          {
            startAt: { gte: shiftStart },
            endAt: { lte: shiftEnd },
          },
        ],
      },
    });

    return overlapping !== null;
  }

  /**
   * Check minimum rest hours between shifts.
   */
  private async checkMinRest(
    userId: string,
    shiftStart: Date,
    shiftEnd: Date,
    policy: WorkforcePolicySettings,
  ): Promise<ConstraintViolation | null> {
    const minRestMs = policy.minRestHoursBetweenShifts * 60 * 60 * 1000;

    // Check for shift ending too close before this shift
    const beforeWindow = new Date(shiftStart.getTime() - minRestMs);
    const shiftBefore = await this.prisma.client.scheduledShift.findFirst({
      where: {
        userId,
        status: { in: ['PUBLISHED', 'APPROVED'] },
        endAt: { gt: beforeWindow, lt: shiftStart },
      },
    });

    if (shiftBefore) {
      const restHours = (shiftStart.getTime() - shiftBefore.endAt.getTime()) / (1000 * 60 * 60);
      return {
        reason: CONSTRAINT_REASONS.MIN_REST,
        message: `Only ${restHours.toFixed(1)}h rest (min: ${policy.minRestHoursBetweenShifts}h)`,
      };
    }

    // Check for shift starting too close after this shift
    const afterWindow = new Date(shiftEnd.getTime() + minRestMs);
    const shiftAfter = await this.prisma.client.scheduledShift.findFirst({
      where: {
        userId,
        status: { in: ['PUBLISHED', 'APPROVED'] },
        startAt: { gt: shiftEnd, lt: afterWindow },
      },
    });

    if (shiftAfter) {
      const restHours = (shiftAfter.startAt.getTime() - shiftEnd.getTime()) / (1000 * 60 * 60);
      return {
        reason: CONSTRAINT_REASONS.MIN_REST,
        message: `Only ${restHours.toFixed(1)}h rest before next shift (min: ${policy.minRestHoursBetweenShifts}h)`,
      };
    }

    return null;
  }

  /**
   * Get total scheduled hours for the week containing the shift.
   */
  private async getWeeklyHours(
    userId: string,
    shiftStart: Date,
    shiftEnd: Date,
  ): Promise<number> {
    // Get start of week (Sunday) and end of week (Saturday)
    const weekStart = this.getWeekStart(shiftStart);
    const weekEnd = this.getWeekEnd(shiftStart);

    const shifts = await this.prisma.client.scheduledShift.findMany({
      where: {
        userId,
        status: { in: ['PUBLISHED', 'APPROVED'] },
        startAt: { gte: weekStart },
        endAt: { lte: weekEnd },
      },
      select: {
        startAt: true,
        endAt: true,
      },
    });

    let totalMs = 0;
    for (const shift of shifts) {
      totalMs += shift.endAt.getTime() - shift.startAt.getTime();
    }

    return totalMs / (1000 * 60 * 60); // Convert to hours
  }

  /**
   * Get count of consecutive work days leading up to the shift date.
   */
  private async getConsecutiveDays(userId: string, shiftStart: Date): Promise<number> {
    const shiftDate = new Date(shiftStart);
    shiftDate.setUTCHours(0, 0, 0, 0);

    let consecutiveDays = 0;
    const checkDate = new Date(shiftDate);
    checkDate.setUTCDate(checkDate.getUTCDate() - 1); // Start from yesterday

    // Count backwards up to 7 days
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(checkDate);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(checkDate);
      dayEnd.setUTCHours(23, 59, 59, 999);

      const hasShift = await this.prisma.client.scheduledShift.findFirst({
        where: {
          userId,
          status: { in: ['PUBLISHED', 'APPROVED'] },
          startAt: { gte: dayStart },
          endAt: { lte: dayEnd },
        },
      });

      if (hasShift) {
        consecutiveDays++;
        checkDate.setUTCDate(checkDate.getUTCDate() - 1);
      } else {
        break; // Streak broken
      }
    }

    return consecutiveDays;
  }

  /**
   * Check if the pay period containing the date is locked.
   */
  private async checkPayPeriodLocked(orgId: string, date: Date): Promise<boolean> {
    const period = await this.prisma.client.payPeriod.findFirst({
      where: {
        orgId,
        startDate: { lte: date },
        endDate: { gte: date },
        status: 'CLOSED',
      },
    });

    return period !== null;
  }

  // ===== HELPERS =====

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private getWeekEnd(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() + (6 - day));
    d.setUTCHours(23, 59, 59, 999);
    return d;
  }
}
