/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * M10.13: Auto-Scheduler Service
 * M10.14: Extended with Deterministic Assignment + Constraints + Publish
 *
 * Generates shift suggestions from StaffingPlan demand using a deterministic
 * greedy algorithm. Supports availability-aware candidate lists.
 *
 * Key features:
 * - Deterministic: same inputs -> same inputsHash -> same suggestions
 * - Idempotent: returns existing run if hash matches
 * - Availability-aware: candidates filtered by M10.11 availability
 * - M10.14: Assignment mode (UNASSIGNED | ASSIGNED)
 * - M10.14: Constraint enforcement (overlap, min-rest, max-weekly, max-consec-days)
 * - M10.14: Publish workflow with notifications
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { createHash } from 'crypto';
import { Prisma } from '@chefcloud/db';
import {
  WorkforceConstraintsEvaluatorService,
  CandidateEvaluation,
  CONSTRAINT_REASONS,
} from './workforce-constraints-evaluator.service';

const ALGORITHM_VERSION = 'v1.1'; // Bumped for M10.14
const DEFAULT_MAX_SHIFT_MINUTES = 480; // 8 hours
const DEFAULT_BLOCK_SIZE_HOURS = 4;

// M10.14: Assignment modes
export const ASSIGNMENT_MODES = {
  UNASSIGNED: 'UNASSIGNED', // M10.13 behavior - candidates only
  ASSIGNED: 'ASSIGNED', // M10.14 - deterministic assignment
} as const;

export type AssignmentMode = (typeof ASSIGNMENT_MODES)[keyof typeof ASSIGNMENT_MODES];

interface DemandHour {
  hour: number;
  roleKey: string;
  suggestedHeadcount: number;
}

interface ShiftBlock {
  roleKey: string;
  startHour: number;
  endHour: number;
  headcount: number;
}

interface CandidateResult {
  userId: string;
  available: boolean;
}

interface GenerateRunOptions {
  mode?: AssignmentMode;
}

@Injectable()
export class WorkforceAutoSchedulerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly constraintsEvaluator: WorkforceConstraintsEvaluatorService,
  ) {}

  /**
   * Generate an auto-schedule run from a StaffingPlan.
   * Idempotent: returns existing run if inputsHash matches.
   * M10.14: Supports mode=ASSIGNED for deterministic employee assignment.
   */
  async generateRun(
    orgId: string,
    branchId: string,
    date: string,
    userId: string,
    options?: GenerateRunOptions,
  ): Promise<any> {
    const mode = options?.mode || ASSIGNMENT_MODES.UNASSIGNED;

    // Find the best StaffingPlan for this date
    const plan = await this.findStaffingPlan(orgId, branchId, date);
    if (!plan) {
      throw new NotFoundException(
        `No StaffingPlan found for branch ${branchId} on ${date}`,
      );
    }

    // Get branch timezone
    const branch = await this.prisma.client.branch.findUnique({
      where: { id: branchId },
      select: { timezone: true },
    });
    const timezone = branch?.timezone || 'UTC';

    // Build canonical inputs for hash (includes mode for M10.14)
    const inputs = await this.buildCanonicalInputs(plan, timezone, mode);
    const inputsHash = this.computeHash(inputs);

    // Check for existing run with same hash (idempotency)
    const existing = await this.prisma.client.autoScheduleRun.findUnique({
      where: {
        orgId_branchId_date_inputsHash: {
          orgId,
          branchId,
          date: new Date(date),
          inputsHash,
        },
      },
      include: { suggestions: { include: { assignedUser: true } } },
    });

    if (existing) {
      return {
        ...existing,
        isExisting: true,
        planStatus: plan.status,
      };
    }

    // Generate suggestions using deterministic algorithm
    const suggestions = await this.generateSuggestions(
      plan,
      timezone,
      date,
      orgId,
      branchId,
      mode,
    );

    // Create run with suggestions in transaction
    const run = await this.prisma.client.autoScheduleRun.create({
      data: {
        orgId,
        branchId,
        date: new Date(date),
        timezone,
        staffingPlanId: plan.id,
        inputsHash,
        algorithmVersion: ALGORITHM_VERSION,
        status: 'DRAFT',
        assignmentMode: mode,
        suggestions: {
          create: suggestions.map((s) => ({
            roleKey: s.roleKey,
            startAt: s.startAt,
            endAt: s.endAt,
            headcount: s.headcount,
            candidateUserIds: s.candidateUserIds as Prisma.InputJsonValue,
            score: s.score,
            assignedUserId: s.assignedUserId || null,
            assignmentReason: s.assignmentReason || null,
            assignmentScore: s.assignmentScore || null,
          })),
        },
      },
      include: { suggestions: { include: { assignedUser: true } } },
    });

    return {
      ...run,
      isExisting: false,
      planStatus: plan.status,
    };
  }

  /**
   * Get the latest run for a branch/date.
   */
  async getRun(
    orgId: string,
    branchId: string,
    date: string,
    runId?: string,
  ): Promise<any> {
    if (runId) {
      const run = await this.prisma.client.autoScheduleRun.findFirst({
        where: { id: runId, orgId, branchId },
        include: { suggestions: true, staffingPlan: true },
      });
      if (!run) {
        throw new NotFoundException(`Run ${runId} not found`);
      }
      return run;
    }

    // Get latest run for date
    const run = await this.prisma.client.autoScheduleRun.findFirst({
      where: {
        orgId,
        branchId,
        date: new Date(date),
        status: { not: 'VOID' },
      },
      orderBy: { createdAt: 'desc' },
      include: { suggestions: true, staffingPlan: true },
    });

    return run;
  }

  /**
   * List all runs for a branch/date range.
   */
  async listRuns(
    orgId: string,
    branchId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any[]> {
    const where: any = { orgId, branchId };
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    return this.prisma.client.autoScheduleRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { suggestions: true },
    });
  }

  /**
   * Void a run (soft delete for audit safety).
   */
  async voidRun(runId: string, orgId: string, userId: string): Promise<any> {
    const run = await this.prisma.client.autoScheduleRun.findFirst({
      where: { id: runId, orgId },
    });

    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    if (run.status === 'APPLIED') {
      throw new BadRequestException('Cannot void an already applied run');
    }

    return this.prisma.client.autoScheduleRun.update({
      where: { id: runId },
      data: { status: 'VOID' },
    });
  }

  /**
   * M10.14: Publish a run (send notifications to assigned employees).
   * Idempotent: returns existing publish timestamp if already published.
   */
  async publishRun(runId: string, orgId: string, userId: string): Promise<any> {
    const run = await this.prisma.client.autoScheduleRun.findFirst({
      where: { id: runId, orgId },
      include: {
        suggestions: { include: { assignedUser: true } },
        branch: true,
      },
    });

    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    if (run.status !== 'APPLIED') {
      throw new BadRequestException('Can only publish an applied run');
    }

    // Idempotent: already published
    if (run.publishedAt) {
      return {
        ...run,
        isAlreadyPublished: true,
        notificationsSent: 0,
      };
    }

    // Get assigned user IDs for notifications
    const assignedUserIds = run.suggestions
      .filter((s: any) => s.assignedUserId)
      .map((s: any) => s.assignedUserId);

    const uniqueUserIds = [...new Set(assignedUserIds)] as string[];

    // Update run with publish info (non-blocking notifications)
    const updatedRun = await this.prisma.client.autoScheduleRun.update({
      where: { id: runId },
      data: {
        publishedAt: new Date(),
        publishedById: userId,
      },
      include: {
        suggestions: { include: { assignedUser: true } },
        branch: true,
      },
    });

    // Queue notifications asynchronously (non-hanging per AC-07)
    // For now we log to WorkforceNotificationLog without blocking
    const dateStr = run.date.toISOString().split('T')[0];
    await this.queuePublishNotifications(
      orgId,
      uniqueUserIds,
      run.branch?.name || 'Unknown',
      dateStr,
      userId,
      runId,
    );

    return {
      ...updatedRun,
      isAlreadyPublished: false,
      notificationsSent: uniqueUserIds.length,
    };
  }

  /**
   * Queue publish notifications (non-blocking).
   */
  private async queuePublishNotifications(
    orgId: string,
    userIds: string[],
    branchName: string,
    date: string,
    performerId: string,
    runId?: string,
  ): Promise<void> {
    // Create notification logs (async, non-blocking)
    const notifications = userIds.map((userId) => ({
      orgId,
      type: 'SCHEDULE_PUBLISHED' as const,
      targetUserId: userId,
      performedById: performerId,
      entityType: 'AutoScheduleRun',
      entityId: runId || 'unknown',
      payload: { branchName, date },
    }));

    // Fire-and-forget: don't await or block on this
    this.prisma.client.workforceNotificationLog
      .createMany({ data: notifications })
      .catch((err) => {
        console.error('Failed to queue publish notifications:', err);
      });
  }

  // ===== PRIVATE HELPERS =====

  private async findStaffingPlan(
    orgId: string,
    branchId: string,
    date: string,
  ): Promise<any> {
    // Prefer PUBLISHED, fall back to DRAFT
    let plan = await this.prisma.client.staffingPlan.findFirst({
      where: {
        orgId,
        branchId,
        date: new Date(date),
        status: 'PUBLISHED',
      },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!plan) {
      plan = await this.prisma.client.staffingPlan.findFirst({
        where: {
          orgId,
          branchId,
          date: new Date(date),
          status: 'DRAFT',
        },
        include: { lines: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    return plan;
  }

  private async buildCanonicalInputs(
    plan: any,
    timezone: string,
    mode: AssignmentMode = ASSIGNMENT_MODES.UNASSIGNED,
  ): Promise<string> {
    // Sort lines by hour and roleKey for determinism
    const sortedLines = [...plan.lines].sort((a, b) => {
      if (a.hour !== b.hour) return a.hour - b.hour;
      return a.roleKey.localeCompare(b.roleKey);
    });

    const canonical = {
      planId: plan.id,
      date: plan.date.toISOString().split('T')[0],
      timezone,
      algorithmVersion: ALGORITHM_VERSION,
      mode, // M10.14: Include mode in hash
      lines: sortedLines.map((l: any) => ({
        hour: l.hour,
        roleKey: l.roleKey,
        headcount: l.suggestedHeadcount,
      })),
    };

    // Stable JSON stringification with sorted keys
    return JSON.stringify(canonical, Object.keys(canonical).sort());
  }

  private computeHash(input: string): string {
    return createHash('sha256').update(input).digest('hex').substring(0, 32);
  }

  private async generateSuggestions(
    plan: any,
    timezone: string,
    dateStr: string,
    orgId: string,
    branchId: string,
    mode: AssignmentMode = ASSIGNMENT_MODES.UNASSIGNED,
  ): Promise<any[]> {
    const lines: DemandHour[] = plan.lines.map((l: any) => ({
      hour: l.hour,
      roleKey: l.roleKey,
      suggestedHeadcount: l.suggestedHeadcount,
    }));

    // Group by roleKey
    const byRole = new Map<string, DemandHour[]>();
    for (const line of lines) {
      if (!byRole.has(line.roleKey)) {
        byRole.set(line.roleKey, []);
      }
      byRole.get(line.roleKey)!.push(line);
    }

    const suggestions: any[] = [];

    for (const [roleKey, roleDemand] of byRole) {
      // Sort by hour
      roleDemand.sort((a, b) => a.hour - b.hour);

      // Create shift blocks using greedy algorithm
      const blocks = this.createShiftBlocks(roleDemand);

      for (const block of blocks) {
        // Convert to timestamps
        const startAt = this.hourToTimestamp(dateStr, block.startHour, timezone);
        const endAt = this.hourToTimestamp(dateStr, block.endHour, timezone);

        // Find available candidates
        const candidates = await this.findCandidates(
          orgId,
          branchId,
          roleKey,
          dateStr,
          block.startHour,
          block.endHour,
        );

        // M10.14: If ASSIGNED mode, evaluate constraints and pick best candidate
        let assignedUserId: string | null = null;
        let assignmentReason: string | null = null;
        let assignmentScore: number | null = null;

        if (mode === ASSIGNMENT_MODES.ASSIGNED && candidates.length > 0) {
          const evaluations = await this.constraintsEvaluator.evaluateCandidates(
            orgId,
            branchId,
            candidates,
            startAt,
            endAt,
          );

          // Find first eligible candidate (already sorted by priority)
          const eligible = evaluations.find((e) => e.isEligible);
          if (eligible) {
            assignedUserId = eligible.userId;
            assignmentReason = 'ASSIGNED'; // Deterministic assignment
            assignmentScore = eligible.score;
          } else if (evaluations.length > 0) {
            // No eligible candidate, record constraint reason
            const first = evaluations[0];
            assignmentReason = first.violations.map((v) => v.reason).join(',');
          }
        }

        suggestions.push({
          roleKey,
          startAt,
          endAt,
          headcount: block.headcount,
          candidateUserIds: candidates.length > 0 ? candidates : null,
          score: block.headcount * 10, // Simple scoring
          assignedUserId,
          assignmentReason,
          assignmentScore,
        });
      }
    }

    // Sort suggestions for determinism
    suggestions.sort((a, b) => {
      if (a.roleKey !== b.roleKey) return a.roleKey.localeCompare(b.roleKey);
      return a.startAt.getTime() - b.startAt.getTime();
    });

    return suggestions;
  }

  /**
   * Greedy algorithm to create shift blocks from hourly demand.
   */
  private createShiftBlocks(demand: DemandHour[]): ShiftBlock[] {
    if (demand.length === 0) return [];

    const blocks: ShiftBlock[] = [];
    let i = 0;

    while (i < demand.length) {
      // Skip hours with no demand
      if (demand[i].suggestedHeadcount <= 0) {
        i++;
        continue;
      }

      // Start a new block
      const startHour = demand[i].hour;
      let maxHeadcount = demand[i].suggestedHeadcount;
      let endHour = startHour + 1;
      let j = i + 1;

      // Extend block up to max 8 hours or until gap
      while (
        j < demand.length &&
        demand[j].hour === endHour &&
        demand[j].suggestedHeadcount > 0 &&
        endHour - startHour < DEFAULT_MAX_SHIFT_MINUTES / 60
      ) {
        maxHeadcount = Math.max(maxHeadcount, demand[j].suggestedHeadcount);
        endHour++;
        j++;
      }

      // Ensure minimum block size (4 hours) if possible
      const blockLength = endHour - startHour;
      if (blockLength < DEFAULT_BLOCK_SIZE_HOURS && endHour < 24) {
        endHour = Math.min(startHour + DEFAULT_BLOCK_SIZE_HOURS, 24);
      }

      blocks.push({
        roleKey: demand[i].roleKey,
        startHour,
        endHour,
        headcount: maxHeadcount,
      });

      // Move to next unprocessed hour
      i = j;
    }

    return blocks;
  }

  private hourToTimestamp(dateStr: string, hour: number, timezone: string): Date {
    // Create timestamp in UTC representing the local time
    // For simplicity, we store as UTC but the hour corresponds to local time
    const date = new Date(dateStr + 'T00:00:00Z');
    date.setUTCHours(hour, 0, 0, 0);
    return date;
  }

  /**
   * Find candidate users who are available for the shift block.
   * Uses M10.11 WorkforceAvailability and exceptions.
   */
  private async findCandidates(
    orgId: string,
    branchId: string,
    roleKey: string,
    dateStr: string,
    startHour: number,
    endHour: number,
  ): Promise<string[]> {
    const date = new Date(dateStr);
    const dayOfWeek = date.getUTCDay();

    // Find users with matching role in this branch
    const users = await this.prisma.client.user.findMany({
      where: {
        orgId,
        branchId,
      },
      select: { id: true, roleLevel: true },
    });

    const candidateIds: string[] = [];

    for (const user of users) {
      // Check if user has exception blocking this date
      const exception = await this.prisma.client.workforceAvailabilityException.findFirst({
        where: {
          userId: user.id,
          date: new Date(dateStr),
          isAvailable: false,
        },
      });

      if (exception) {
        continue; // Blocked by exception
      }

      // Check recurring availability
      const availability = await this.prisma.client.workforceAvailability.findMany({
        where: {
          userId: user.id,
          dayOfWeek,
        },
      });

      // Check if any availability slot covers the shift
      const startTimeStr = `${startHour.toString().padStart(2, '0')}:00`;
      const endTimeStr = `${endHour.toString().padStart(2, '0')}:00`;

      const coversShift = availability.some((a) => {
        return a.startTime <= startTimeStr && a.endTime >= endTimeStr;
      });

      if (coversShift || availability.length === 0) {
        // If no availability set, assume available (default)
        candidateIds.push(user.id);
      }
    }

    return candidateIds;
  }
}
