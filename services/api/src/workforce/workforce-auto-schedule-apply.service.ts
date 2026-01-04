/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * M10.13: Auto-Schedule Apply Service
 *
 * Applies AutoScheduleSuggestions to create ScheduledShift rows.
 * Transactional, idempotent, and conflict-aware.
 *
 * Key features:
 * - Transactional: all-or-nothing shift creation
 * - Safe: rejects if existing shifts present for date
 * - Audited: writes WorkforceAuditLog entries
 * - Impact reporting: before/after variance calculation
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';

@Injectable()
export class WorkforceAutoScheduleApplyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Apply suggestions from a run to create ScheduledShift rows.
   * Idempotent: returns 409 if already applied.
   */
  async applyRun(
    runId: string,
    orgId: string,
    userId: string,
  ): Promise<any> {
    // Load the run with suggestions
    const run = await this.prisma.client.autoScheduleRun.findFirst({
      where: { id: runId, orgId },
      include: { suggestions: true, branch: true },
    });

    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    if (run.status === 'APPLIED') {
      throw new ConflictException('Run already applied');
    }

    if (run.status === 'VOID') {
      throw new BadRequestException('Cannot apply a voided run');
    }

    // Check for existing shifts on this date for this branch
    const dateStart = new Date(run.date);
    dateStart.setUTCHours(0, 0, 0, 0);
    const dateEnd = new Date(run.date);
    dateEnd.setUTCHours(23, 59, 59, 999);

    const existingShifts = await this.prisma.client.scheduledShift.count({
      where: {
        orgId,
        branchId: run.branchId,
        startAt: { gte: dateStart, lte: dateEnd },
        status: { not: 'CANCELLED' },
      },
    });

    if (existingShifts > 0) {
      throw new ConflictException(
        `Cannot apply: ${existingShifts} existing shifts found for this date. ` +
        'Clear existing shifts or use a different date.',
      );
    }

    // Apply in transaction
    const result = await this.prisma.client.$transaction(async (tx) => {
      const createdShifts: any[] = [];

      for (const suggestion of run.suggestions) {
        // Calculate planned minutes
        const startTime = new Date(suggestion.startAt).getTime();
        const endTime = new Date(suggestion.endAt).getTime();
        const plannedMinutes = Math.round((endTime - startTime) / 60000);

        // Create one shift per headcount
        for (let i = 0; i < suggestion.headcount; i++) {
          // Try to assign a candidate if available and unambiguous
          let assignedUserId: string | null = null;
          const candidates = suggestion.candidateUserIds as string[] | null;

          if (candidates && candidates.length > 0) {
            // Only auto-assign if exactly one candidate
            if (candidates.length === 1) {
              // Check for conflicts
              const hasConflict = await this.checkUserConflict(
                tx,
                candidates[0],
                suggestion.startAt,
                suggestion.endAt,
              );
              if (!hasConflict) {
                assignedUserId = candidates[0];
              }
            }
          }

          const shift = await tx.scheduledShift.create({
            data: {
              orgId,
              branchId: run.branchId,
              userId: assignedUserId,
              role: suggestion.roleKey,
              startAt: suggestion.startAt,
              endAt: suggestion.endAt,
              plannedMinutes,
              status: 'DRAFT',
              isOpen: assignedUserId === null,
              notes: `Auto-generated from run ${runId}`,
            },
          });

          createdShifts.push(shift);
        }
      }

      // Update run status
      const updatedRun = await tx.autoScheduleRun.update({
        where: { id: runId },
        data: {
          status: 'APPLIED',
          appliedAt: new Date(),
          appliedById: userId,
        },
      });

      // Write audit log
      await this.writeAuditLog(tx, {
        orgId,
        branchId: run.branchId,
        actorId: userId,
        action: 'AUTO_SCHEDULE_RUN_APPLIED',
        payload: {
          runId,
          shiftsCreated: createdShifts.length,
          suggestionsCount: run.suggestions.length,
        },
      });

      return {
        run: updatedRun,
        shiftsCreated: createdShifts.length,
        shifts: createdShifts,
      };
    });

    return result;
  }

  /**
   * Calculate impact of applying a run (before/after variance).
   */
  async getImpact(runId: string, orgId: string): Promise<any> {
    const run = await this.prisma.client.autoScheduleRun.findFirst({
      where: { id: runId, orgId },
      include: { suggestions: true, staffingPlan: { include: { lines: true } } },
    });

    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    // Calculate demand from staffing plan
    const demandByHourRole = new Map<string, number>();
    for (const line of run.staffingPlan.lines) {
      const key = `${line.hour}:${line.roleKey}`;
      demandByHourRole.set(key, (demandByHourRole.get(key) || 0) + line.suggestedHeadcount);
    }

    // Calculate coverage from suggestions
    const coverageByHourRole = new Map<string, number>();
    for (const suggestion of run.suggestions) {
      const startHour = new Date(suggestion.startAt).getUTCHours();
      const endHour = new Date(suggestion.endAt).getUTCHours();

      for (let hour = startHour; hour < endHour; hour++) {
        const key = `${hour}:${suggestion.roleKey}`;
        coverageByHourRole.set(key, (coverageByHourRole.get(key) || 0) + suggestion.headcount);
      }
    }

    // Calculate scheduled shifts if run is applied
    let scheduledByHourRole = new Map<string, number>();
    if (run.status === 'APPLIED') {
      const dateStart = new Date(run.date);
      dateStart.setUTCHours(0, 0, 0, 0);
      const dateEnd = new Date(run.date);
      dateEnd.setUTCHours(23, 59, 59, 999);

      const shifts = await this.prisma.client.scheduledShift.findMany({
        where: {
          orgId,
          branchId: run.branchId,
          startAt: { gte: dateStart, lte: dateEnd },
          status: { not: 'CANCELLED' },
        },
      });

      for (const shift of shifts) {
        const startHour = new Date(shift.startAt).getUTCHours();
        const endHour = new Date(shift.endAt).getUTCHours();
        for (let hour = startHour; hour < endHour; hour++) {
          const key = `${hour}:${shift.role}`;
          scheduledByHourRole.set(key, (scheduledByHourRole.get(key) || 0) + 1);
        }
      }
    } else {
      // Before apply, scheduled = 0
      scheduledByHourRole = new Map();
    }

    // Build variance report
    const hourlyVariance: any[] = [];
    let totalDemand = 0;
    let totalCoverageBefore = 0;
    let totalCoverageAfter = 0;

    for (const [key, demand] of demandByHourRole) {
      const [hourStr, roleKey] = key.split(':');
      const hour = parseInt(hourStr, 10);
      const scheduled = scheduledByHourRole.get(key) || 0;
      const suggested = coverageByHourRole.get(key) || 0;

      totalDemand += demand;
      totalCoverageBefore += 0; // Before = no shifts
      totalCoverageAfter += suggested;

      hourlyVariance.push({
        hour,
        roleKey,
        demand,
        scheduledBefore: 0,
        scheduledAfter: run.status === 'APPLIED' ? scheduled : suggested,
        varianceBefore: demand,
        varianceAfter: demand - (run.status === 'APPLIED' ? scheduled : suggested),
      });
    }

    // Sort by hour
    hourlyVariance.sort((a, b) => a.hour - b.hour);

    // Calculate residual (unmet demand)
    const residual = hourlyVariance.filter((v) => v.varianceAfter > 0);

    return {
      runId,
      status: run.status,
      date: run.date,
      summary: {
        totalDemand,
        totalCoverageBefore,
        totalCoverageAfter,
        varianceBefore: totalDemand,
        varianceAfter: totalDemand - totalCoverageAfter,
        improvementPct:
          totalDemand > 0
            ? Math.round(((totalDemand - (totalDemand - totalCoverageAfter)) / totalDemand) * 100)
            : 0,
      },
      hourlyVariance,
      residualGaps: residual,
    };
  }

  /**
   * Generate StaffingAlerts for residual variance after apply.
   */
  async generateResidualAlerts(
    runId: string,
    orgId: string,
    userId: string,
  ): Promise<any> {
    const impact = await this.getImpact(runId, orgId);
    const run = await this.prisma.client.autoScheduleRun.findFirst({
      where: { id: runId, orgId },
    });

    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    const alertsCreated: any[] = [];

    for (const gap of impact.residualGaps) {
      // Use upsert to prevent duplicates
      const alert = await this.prisma.client.staffingAlert.upsert({
        where: {
          orgId_branchId_date_hour_type: {
            orgId,
            branchId: run.branchId,
            date: new Date(run.date),
            hour: gap.hour,
            type: 'UNDERSTAFFED',
          },
        },
        create: {
          orgId,
          branchId: run.branchId,
          date: new Date(run.date),
          hour: gap.hour,
          severity: gap.varianceAfter >= 3 ? 'HIGH' : gap.varianceAfter >= 2 ? 'MEDIUM' : 'LOW',
          type: 'UNDERSTAFFED',
          payloadJson: {
            roleKey: gap.roleKey,
            scheduledCount: gap.scheduledAfter,
            suggestedCount: gap.demand,
            delta: gap.varianceAfter,
            source: 'AUTO_SCHEDULER',
            runId,
          } as Prisma.InputJsonValue,
        },
        update: {
          // Update payload if alert already exists
          payloadJson: {
            roleKey: gap.roleKey,
            scheduledCount: gap.scheduledAfter,
            suggestedCount: gap.demand,
            delta: gap.varianceAfter,
            source: 'AUTO_SCHEDULER',
            runId,
          } as Prisma.InputJsonValue,
        },
      });

      alertsCreated.push(alert);
    }

    return {
      alertsCreated: alertsCreated.length,
      alerts: alertsCreated,
    };
  }

  // ===== PRIVATE HELPERS =====

  private async checkUserConflict(
    tx: Prisma.TransactionClient,
    userId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<boolean> {
    const conflict = await tx.scheduledShift.findFirst({
      where: {
        userId,
        status: { not: 'CANCELLED' },
        OR: [
          // Overlapping shifts
          {
            startAt: { lt: endAt },
            endAt: { gt: startAt },
          },
        ],
      },
    });

    return conflict !== null;
  }

  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    data: {
      orgId: string;
      branchId: string;
      actorId: string;
      action: string;
      payload: any;
    },
  ): Promise<void> {
    // Check if WorkforceAuditLog model exists
    try {
      await (tx as any).workforceAuditLog?.create({
        data: {
          orgId: data.orgId,
          branchId: data.branchId,
          actorId: data.actorId,
          action: data.action,
          payloadJson: data.payload,
        },
      });
    } catch {
      // Model may not exist, log to console for now
      console.log('WorkforceAuditLog:', data.action, JSON.stringify(data.payload));
    }
  }
}
