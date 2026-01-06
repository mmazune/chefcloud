/**
 * M10.19: Workforce Compliance Service
 *
 * Evaluates time entries for break/meal compliance violations and creates
 * idempotent incident records. Supports policy-based rules for:
 * - Meal breaks (required after X hours, minimum duration)
 * - Rest breaks (required after X hours, minimum duration)
 *
 * Idempotency: Uses unique constraint (orgId, timeEntryId, type) to prevent duplicates.
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { TimeEntry, WorkforcePolicy, OpsIncident, BreakEntry } from '@chefcloud/db';

// Compliance incident types
export const COMPLIANCE_INCIDENT_TYPES = {
  MEAL_BREAK_MISSED: 'MEAL_BREAK_MISSED',
  MEAL_BREAK_SHORT: 'MEAL_BREAK_SHORT',
  REST_BREAK_MISSED: 'REST_BREAK_MISSED',
  REST_BREAK_SHORT: 'REST_BREAK_SHORT',
} as const;

export type ComplianceIncidentType = (typeof COMPLIANCE_INCIDENT_TYPES)[keyof typeof COMPLIANCE_INCIDENT_TYPES];

// Default policy values (used if no org policy exists)
const DEFAULT_POLICY = {
  mealBreakRequiredAfterHours: 6,
  mealBreakMinimumMinutes: 30,
  restBreakRequiredAfterHours: 4,
  restBreakMinimumMinutes: 10,
  allowWaiveMealBreak: false,
};

export interface EvaluationResult {
  evaluated: number;
  incidentsCreated: number;
  incidentsSkipped: number; // Already existed (idempotent)
  errors: number;
}

export interface ComplianceIncidentDto {
  id: string;
  orgId: string;
  branchId: string | null;
  userId: string | null;
  timeEntryId: string | null;
  type: string;
  severity: string;
  title: string;
  incidentDate: Date | null;
  penaltyMinutes: number | null;
  penaltyAmountCents: number | null;
  currency: string | null;
  resolved: boolean;
  resolvedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class WorkforceComplianceService {
  private readonly logger = new Logger(WorkforceComplianceService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Get org policy with M10.19 break rules, or defaults
   */
  private async getPolicy(orgId: string): Promise<typeof DEFAULT_POLICY> {
    const policy = await this.prisma.client.workforcePolicy.findUnique({
      where: { orgId },
    });

    if (!policy) {
      return DEFAULT_POLICY;
    }

    return {
      mealBreakRequiredAfterHours: policy.mealBreakRequiredAfterHours ?? DEFAULT_POLICY.mealBreakRequiredAfterHours,
      mealBreakMinimumMinutes: policy.mealBreakMinimumMinutes ?? DEFAULT_POLICY.mealBreakMinimumMinutes,
      restBreakRequiredAfterHours: policy.restBreakRequiredAfterHours ?? DEFAULT_POLICY.restBreakRequiredAfterHours,
      restBreakMinimumMinutes: policy.restBreakMinimumMinutes ?? DEFAULT_POLICY.restBreakMinimumMinutes,
      allowWaiveMealBreak: policy.allowWaiveMealBreak ?? DEFAULT_POLICY.allowWaiveMealBreak,
    };
  }

  /**
   * Evaluate time entries for break compliance violations.
   * Creates OpsIncident records for violations (idempotent).
   *
   * @param orgId Organization ID
   * @param from Start of date range
   * @param to End of date range
   * @param branchId Optional branch filter
   */
  async evaluateCompliance(
    orgId: string,
    from: Date,
    to: Date,
    branchId?: string,
  ): Promise<EvaluationResult> {
    // H6: Limit date range to prevent performance issues
    const maxRangeDays = 90;
    const rangeDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    if (rangeDays > maxRangeDays) {
      throw new BadRequestException(`Date range cannot exceed ${maxRangeDays} days`);
    }

    const policy = await this.getPolicy(orgId);

    const result: EvaluationResult = {
      evaluated: 0,
      incidentsCreated: 0,
      incidentsSkipped: 0,
      errors: 0,
    };

    // Fetch all completed time entries in range
    const timeEntries = await this.prisma.client.timeEntry.findMany({
      where: {
        orgId,
        ...(branchId ? { branchId } : {}),
        clockInAt: { gte: from },
        clockOutAt: { lte: to, not: null },
      },
      include: {
        breakEntries: true,
      },
      orderBy: { clockInAt: 'asc' },
    });

    for (const entry of timeEntries) {
      result.evaluated++;
      try {
        await this.evaluateTimeEntry(entry, policy, result);
      } catch (err) {
        this.logger.error(`Error evaluating entry ${entry.id}:`, err);
        result.errors++;
      }
    }

    this.logger.log(
      `Compliance evaluation: ${result.evaluated} entries, ` +
      `${result.incidentsCreated} new incidents, ${result.incidentsSkipped} skipped`,
    );

    return result;
  }

  /**
   * Evaluate a single time entry for compliance violations.
   */
  private async evaluateTimeEntry(
    entry: TimeEntry & { breakEntries: BreakEntry[] },
    policy: typeof DEFAULT_POLICY,
    result: EvaluationResult,
  ): Promise<void> {
    if (!entry.clockOutAt) return;

    const shiftDurationMins = Math.floor(
      (entry.clockOutAt.getTime() - entry.clockInAt.getTime()) / (1000 * 60),
    );

    // Categorize breaks
    const mealBreaks = entry.breakEntries.filter((b) => this.isMealBreak(b));
    const restBreaks = entry.breakEntries.filter((b) => !this.isMealBreak(b));

    // Check meal break compliance
    const mealThresholdMins = policy.mealBreakRequiredAfterHours * 60;
    if (shiftDurationMins >= mealThresholdMins) {
      await this.checkMealBreakCompliance(entry, mealBreaks, policy, result);
    }

    // Check rest break compliance
    const restThresholdMins = policy.restBreakRequiredAfterHours * 60;
    if (shiftDurationMins >= restThresholdMins) {
      await this.checkRestBreakCompliance(entry, restBreaks, policy, result);
    }
  }

  /**
   * Check if a break qualifies as a meal break (>= 20 min or explicitly tagged)
   */
  private isMealBreak(breakEntry: BreakEntry): boolean {
    if (!breakEntry.endedAt) return false;
    const durationMins = Math.floor(
      (breakEntry.endedAt.getTime() - breakEntry.startedAt.getTime()) / (1000 * 60),
    );
    // Heuristic: breaks >= 20 min are considered meal breaks
    return durationMins >= 20;
  }

  /**
   * Check meal break compliance for a time entry.
   */
  private async checkMealBreakCompliance(
    entry: TimeEntry & { breakEntries: BreakEntry[] },
    mealBreaks: BreakEntry[],
    policy: typeof DEFAULT_POLICY,
    result: EvaluationResult,
  ): Promise<void> {
    const totalMealBreakMins = mealBreaks.reduce((sum, b) => {
      if (!b.endedAt) return sum;
      return sum + Math.floor((b.endedAt.getTime() - b.startedAt.getTime()) / (1000 * 60));
    }, 0);

    if (mealBreaks.length === 0 || totalMealBreakMins === 0) {
      // No meal break taken
      await this.createIncidentIfNotExists(entry, {
        type: COMPLIANCE_INCIDENT_TYPES.MEAL_BREAK_MISSED,
        severity: 'HIGH',
        title: 'Meal break not taken',
        penaltyMinutes: policy.mealBreakMinimumMinutes,
      }, result);
    } else if (totalMealBreakMins < policy.mealBreakMinimumMinutes) {
      // Meal break too short
      const deficit = policy.mealBreakMinimumMinutes - totalMealBreakMins;
      await this.createIncidentIfNotExists(entry, {
        type: COMPLIANCE_INCIDENT_TYPES.MEAL_BREAK_SHORT,
        severity: 'MEDIUM',
        title: `Meal break too short (${totalMealBreakMins}/${policy.mealBreakMinimumMinutes} min)`,
        penaltyMinutes: deficit,
      }, result);
    }
  }

  /**
   * Check rest break compliance for a time entry.
   */
  private async checkRestBreakCompliance(
    entry: TimeEntry & { breakEntries: BreakEntry[] },
    restBreaks: BreakEntry[],
    policy: typeof DEFAULT_POLICY,
    result: EvaluationResult,
  ): Promise<void> {
    const totalRestBreakMins = restBreaks.reduce((sum, b) => {
      if (!b.endedAt) return sum;
      return sum + Math.floor((b.endedAt.getTime() - b.startedAt.getTime()) / (1000 * 60));
    }, 0);

    // Only check if no meal break counts as rest
    // Rest breaks are shorter, typically < 20 min
    if (restBreaks.length === 0 || totalRestBreakMins === 0) {
      await this.createIncidentIfNotExists(entry, {
        type: COMPLIANCE_INCIDENT_TYPES.REST_BREAK_MISSED,
        severity: 'LOW',
        title: 'Rest break not taken',
        penaltyMinutes: policy.restBreakMinimumMinutes,
      }, result);
    } else if (totalRestBreakMins < policy.restBreakMinimumMinutes) {
      const deficit = policy.restBreakMinimumMinutes - totalRestBreakMins;
      await this.createIncidentIfNotExists(entry, {
        type: COMPLIANCE_INCIDENT_TYPES.REST_BREAK_SHORT,
        severity: 'LOW',
        title: `Rest break too short (${totalRestBreakMins}/${policy.restBreakMinimumMinutes} min)`,
        penaltyMinutes: deficit,
      }, result);
    }
  }

  /**
   * Create an OpsIncident if it doesn't already exist (idempotent).
   * Uses unique constraint on (orgId, timeEntryId, type).
   */
  private async createIncidentIfNotExists(
    entry: TimeEntry,
    data: {
      type: ComplianceIncidentType;
      severity: string;
      title: string;
      penaltyMinutes: number;
    },
    result: EvaluationResult,
  ): Promise<void> {
    try {
      await this.prisma.client.opsIncident.create({
        data: {
          orgId: entry.orgId,
          branchId: entry.branchId,
          userId: entry.userId,
          timeEntryId: entry.id,
          type: data.type,
          severity: data.severity,
          title: data.title,
          incidentDate: entry.clockInAt,
          penaltyMinutes: data.penaltyMinutes,
          currency: 'USD',
          payload: {
            clockInAt: entry.clockInAt.toISOString(),
            clockOutAt: entry.clockOutAt?.toISOString(),
          },
        },
      });
      result.incidentsCreated++;
    } catch (err: unknown) {
      // Check for unique constraint violation (P2002)
      if ((err as { code?: string }).code === 'P2002') {
        result.incidentsSkipped++;
      } else {
        throw err;
      }
    }
  }

  /**
   * List compliance incidents with filtering.
   */
  async listIncidents(
    orgId: string,
    options: {
      from?: Date;
      to?: Date;
      branchId?: string;
      userId?: string;
      type?: string;
      resolved?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ incidents: ComplianceIncidentDto[]; total: number }> {
    const where = {
      orgId,
      ...(options.branchId ? { branchId: options.branchId } : {}),
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.type ? { type: options.type } : {}),
      ...(options.resolved !== undefined ? { resolved: options.resolved } : {}),
      ...(options.from || options.to
        ? {
          createdAt: {
            ...(options.from ? { gte: options.from } : {}),
            ...(options.to ? { lte: options.to } : {}),
          },
        }
        : {}),
    };

    const [incidents, total] = await Promise.all([
      this.prisma.client.opsIncident.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: options.limit || 100,
        skip: options.offset || 0,
      }),
      this.prisma.client.opsIncident.count({ where }),
    ]);

    return {
      incidents: incidents.map((i) => ({
        id: i.id,
        orgId: i.orgId,
        branchId: i.branchId,
        userId: i.userId,
        timeEntryId: i.timeEntryId,
        type: i.type,
        severity: i.severity,
        title: i.title,
        incidentDate: i.incidentDate,
        penaltyMinutes: i.penaltyMinutes,
        penaltyAmountCents: i.penaltyAmountCents,
        currency: i.currency,
        resolved: i.resolved,
        resolvedAt: i.resolvedAt,
        createdAt: i.createdAt,
      })),
      total,
    };
  }

  /**
   * Get incidents for a specific user (for self-service /my-compliance).
   */
  async getMyIncidents(
    orgId: string,
    userId: string,
    options: { from?: Date; to?: Date; limit?: number; offset?: number } = {},
  ): Promise<{ incidents: ComplianceIncidentDto[]; total: number }> {
    return this.listIncidents(orgId, { ...options, userId });
  }

  /**
   * Resolve an incident.
   */
  async resolveIncident(
    orgId: string,
    incidentId: string,
    resolvedBy: string,
  ): Promise<OpsIncident> {
    return this.prisma.client.opsIncident.update({
      where: { id: incidentId, orgId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
      },
    });
  }

  /**
   * Get penalty summary by user for a date range.
   */
  async getPenaltySummary(
    orgId: string,
    from: Date,
    to: Date,
    branchId?: string,
  ): Promise<
    Array<{
      userId: string;
      userName: string | null;
      totalPenaltyMinutes: number;
      incidentCount: number;
    }>
  > {
    const incidents = await this.prisma.client.opsIncident.findMany({
      where: {
        orgId,
        ...(branchId ? { branchId } : {}),
        createdAt: { gte: from, lte: to },
        penaltyMinutes: { not: null },
        userId: { not: null },
      },
    });

    // Get user names separately
    const userIds = [...new Set(incidents.map((i) => i.userId).filter(Boolean))] as string[];
    const users = await this.prisma.client.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

    // Aggregate by user
    const byUser = new Map<string, { userName: string | null; totalPenaltyMinutes: number; incidentCount: number }>();

    for (const incident of incidents) {
      if (!incident.userId) continue;
      const existing = byUser.get(incident.userId);
      if (existing) {
        existing.totalPenaltyMinutes += incident.penaltyMinutes || 0;
        existing.incidentCount++;
      } else {
        byUser.set(incident.userId, {
          userName: userMap.get(incident.userId) || null,
          totalPenaltyMinutes: incident.penaltyMinutes || 0,
          incidentCount: 1,
        });
      }
    }

    return Array.from(byUser.entries())
      .map(([userId, data]) => ({
        userId,
        ...data,
      }))
      .sort((a, b) => b.totalPenaltyMinutes - a.totalPenaltyMinutes);
  }
}
