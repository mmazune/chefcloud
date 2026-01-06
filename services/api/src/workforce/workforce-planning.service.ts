/**
 * M10.12: Workforce Planning Service
 *
 * Provides labor targets, forecast generation, staffing plans,
 * variance analysis, and alert management with idempotency.
 */

import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { createHash } from 'crypto';
import { Prisma } from '@chefcloud/db';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Types for forecast and plan generation
interface ForecastInput {
  branchId: string;
  date: Date;
  reservationsCovers: number[];
  historicalOrders: number[];
}

interface VarianceItem {
  hour: number;
  roleKey: string;
  scheduledCount: number;
  suggestedCount: number;
  delta: number;
}

@Injectable()
export class WorkforcePlanningService {
  private readonly logger = new Logger(WorkforcePlanningService.name);

  constructor(private readonly prisma: PrismaService) { }

  // ===== Labor Targets =====

  /**
   * List labor targets for org/branch
   * Branch-level targets override org-level defaults
   */
  async listTargets(orgId: string, branchId?: string): Promise<any[]> {
    const where = branchId
      ? { orgId, OR: [{ branchId }, { branchId: null }] }
      : { orgId };

    const targets = await this.prisma.client.laborTarget.findMany({
      where,
      orderBy: [{ branchId: 'desc' }, { roleKey: 'asc' }, { dayOfWeek: 'asc' }, { hourStart: 'asc' }],
    });

    // If branchId specified, filter to show branch override OR org default (not both)
    if (branchId) {
      const seen = new Set<string>();
      return targets.filter((t) => {
        const key = `${t.roleKey}-${t.dayOfWeek}-${t.hourStart}`;
        if (t.branchId) {
          seen.add(key);
          return true;
        }
        return !seen.has(key);
      });
    }

    return targets;
  }

  /**
   * Create labor target
   */
  async createTarget(orgId: string, data: {
    branchId?: string;
    roleKey: string;
    dayOfWeek: number;
    hourStart: number;
    hourEnd: number;
    targetCoversPerStaff?: number;
    targetLaborPct?: number;
    enabled?: boolean;
  }): Promise<any> {
    // Validate hour range
    if (data.hourStart < 0 || data.hourStart > 23) {
      throw new BadRequestException('hourStart must be 0-23');
    }
    if (data.hourEnd < 1 || data.hourEnd > 24 || data.hourEnd <= data.hourStart) {
      throw new BadRequestException('hourEnd must be > hourStart and <= 24');
    }
    if (data.dayOfWeek < 0 || data.dayOfWeek > 6) {
      throw new BadRequestException('dayOfWeek must be 0-6');
    }

    return this.prisma.client.laborTarget.create({
      data: {
        orgId,
        branchId: data.branchId || null,
        roleKey: data.roleKey,
        dayOfWeek: data.dayOfWeek,
        hourStart: data.hourStart,
        hourEnd: data.hourEnd,
        targetCoversPerStaff: data.targetCoversPerStaff,
        targetLaborPct: data.targetLaborPct ?? null,
        enabled: data.enabled ?? true,
      },
    });
  }

  /**
   * Update labor target
   */
  async updateTarget(orgId: string, targetId: string, data: {
    targetCoversPerStaff?: number;
    targetLaborPct?: number;
    enabled?: boolean;
  }): Promise<any> {
    const target = await this.prisma.client.laborTarget.findFirst({
      where: { id: targetId, orgId },
    });
    if (!target) {
      throw new NotFoundException('Labor target not found');
    }

    return this.prisma.client.laborTarget.update({
      where: { id: targetId },
      data: {
        targetCoversPerStaff: data.targetCoversPerStaff,
        targetLaborPct: data.targetLaborPct,
        enabled: data.enabled,
      },
    });
  }

  /**
   * Delete labor target
   */
  async deleteTarget(orgId: string, targetId: string) {
    const target = await this.prisma.client.laborTarget.findFirst({
      where: { id: targetId, orgId },
    });
    if (!target) {
      throw new NotFoundException('Labor target not found');
    }

    await this.prisma.client.laborTarget.delete({ where: { id: targetId } });
    return { deleted: true };
  }

  // ===== Forecast Generation =====

  /**
   * Generate forecast snapshot (idempotent by inputsHash)
   */
  async generateForecast(orgId: string, branchId: string, date: Date): Promise<any> {
    // Get branch timezone
    const branch = await this.prisma.client.branch.findFirst({
      where: { id: branchId, orgId },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const dateOnly = new Date(date.toISOString().split('T')[0]);
    const dayStart = new Date(dateOnly);
    const dayEnd = new Date(dateOnly);
    dayEnd.setDate(dayEnd.getDate() + 1);

    // Gather input data for forecast
    const reservations = await this.prisma.client.reservation.findMany({
      where: {
        branchId,
        startAt: { gte: dayStart, lt: dayEnd },
        status: { in: ['CONFIRMED', 'SEATED', 'COMPLETED'] },
      },
      select: { startAt: true, partySize: true },
    });

    // Historical orders (same day of week, last 4 weeks)
    const dayOfWeek = dateOnly.getDay();
    const historicalDates: Date[] = [];
    for (let i = 1; i <= 4; i++) {
      const d = new Date(dateOnly);
      d.setDate(d.getDate() - (i * 7));
      historicalDates.push(d);
    }

    const historicalOrders = await this.prisma.client.order.findMany({
      where: {
        branchId,
        createdAt: {
          gte: historicalDates[3], // oldest
          lt: dayEnd,
        },
        status: { in: ['CLOSED', 'SERVED'] },
      },
      select: { createdAt: true },
    });

    // Build hourly buckets (0-23)
    const coversForecast = new Array(24).fill(0);
    const ordersForecast = new Array(24).fill(0);

    // Aggregate reservation covers by hour
    for (const r of reservations) {
      const hour = r.startAt.getHours();
      if (hour >= 0 && hour < 24) {
        coversForecast[hour] += r.partySize;
      }
    }

    // Aggregate historical orders by hour (average over 4 weeks)
    const orderCounts: number[][] = Array.from({ length: 24 }, () => []);
    for (const o of historicalOrders) {
      const orderDay = o.createdAt.getDay();
      if (orderDay === dayOfWeek) {
        const hour = o.createdAt.getHours();
        if (hour >= 0 && hour < 24) {
          orderCounts[hour].push(1);
        }
      }
    }
    for (let h = 0; h < 24; h++) {
      ordersForecast[h] = orderCounts[h].length > 0
        ? Math.round(orderCounts[h].length / 4)
        : 0;
    }

    // Compute inputsHash for idempotency
    const inputData: ForecastInput = {
      branchId,
      date: dateOnly,
      reservationsCovers: coversForecast,
      historicalOrders: ordersForecast,
    };
    const inputsHash = this.computeInputsHash(inputData);

    // Check for existing snapshot with same inputsHash
    const existing = await this.prisma.client.laborForecastSnapshot.findFirst({
      where: { orgId, branchId, date: dateOnly, inputsHash },
    });
    if (existing) {
      this.logger.log(`Returning existing forecast snapshot ${existing.id} (idempotent)`);
      return existing;
    }

    // Create new snapshot
    const snapshot = await this.prisma.client.laborForecastSnapshot.create({
      data: {
        orgId,
        branchId,
        date: dateOnly,
        timezone: branch.timezone || 'UTC',
        inputsHash,
        totalsJson: {
          coversForecast,
          ordersForecast,
          dataSources: ['reservations', 'historicalOrders'],
        },
      },
    });

    this.logger.log(`Generated forecast snapshot ${snapshot.id}`);
    return snapshot;
  }

  /**
   * Get forecast for date/branch
   */
  async getForecast(orgId: string, branchId: string, date: Date): Promise<any> {
    const dateOnly = new Date(date.toISOString().split('T')[0]);
    const snapshot = await this.prisma.client.laborForecastSnapshot.findFirst({
      where: { orgId, branchId, date: dateOnly },
      orderBy: { generatedAt: 'desc' },
    });
    return snapshot;
  }

  // ===== Staffing Plan Generation =====

  /**
   * Generate staffing plan (idempotent)
   */
  async generatePlan(orgId: string, branchId: string, date: Date): Promise<any> {
    const dateOnly = new Date(date.toISOString().split('T')[0]);
    const dayOfWeek = dateOnly.getDay();

    // Get latest forecast snapshot
    const snapshot = await this.prisma.client.laborForecastSnapshot.findFirst({
      where: { orgId, branchId, date: dateOnly },
      orderBy: { generatedAt: 'desc' },
    });
    if (!snapshot) {
      throw new BadRequestException('No forecast snapshot found. Generate forecast first.');
    }

    // Check for existing PUBLISHED plan (cannot regenerate)
    const publishedPlan = await this.prisma.client.staffingPlan.findFirst({
      where: { orgId, branchId, date: dateOnly, status: 'PUBLISHED' },
    });
    if (publishedPlan) {
      throw new ConflictException('A published plan already exists for this date. Cannot regenerate.');
    }

    // Check for existing DRAFT plan with same forecast
    const existingDraft = await this.prisma.client.staffingPlan.findFirst({
      where: { orgId, branchId, date: dateOnly, forecastSnapshotId: snapshot.id },
      include: { lines: true },
    });
    if (existingDraft) {
      this.logger.log(`Returning existing draft plan ${existingDraft.id} (idempotent)`);
      return existingDraft;
    }

    // Get applicable labor targets
    const targets = await this.listTargets(orgId, branchId);
    const dayTargets = targets.filter((t) => t.enabled && t.dayOfWeek === dayOfWeek);

    // Get branch timezone
    const branch = await this.prisma.client.branch.findFirst({
      where: { id: branchId },
    });

    // Compute suggested headcount per hour per role
    const totals = snapshot.totalsJson as { coversForecast: number[]; ordersForecast: number[] };
    const lines: Array<{ hour: number; roleKey: string; suggestedHeadcount: number; rationale: Prisma.InputJsonValue }> = [];

    // Default roles if no targets defined
    const roles = dayTargets.length > 0
      ? [...new Set(dayTargets.map((t) => t.roleKey))]
      : ['WAITER', 'COOK', 'BARTENDER'];

    for (let hour = 0; hour < 24; hour++) {
      const coversForHour = totals.coversForecast[hour] || 0;

      for (const roleKey of roles) {
        const target = dayTargets.find((t) => t.roleKey === roleKey && t.hourStart <= hour && t.hourEnd > hour);
        const coversPerStaff = target?.targetCoversPerStaff || 20; // default 20 covers/staff

        const suggested = coversForHour > 0
          ? Math.ceil(coversForHour / coversPerStaff)
          : 0;

        lines.push({
          hour,
          roleKey,
          suggestedHeadcount: suggested,
          rationale: {
            basedOn: 'covers',
            targetCoversPerStaff: coversPerStaff,
            forecastedCovers: coversForHour,
          },
        });
      }
    }

    // Create plan with lines
    const plan = await this.prisma.client.staffingPlan.create({
      data: {
        orgId,
        branchId,
        date: dateOnly,
        timezone: branch?.timezone || 'UTC',
        forecastSnapshotId: snapshot.id,
        status: 'DRAFT',
        lines: {
          create: lines,
        },
      },
      include: { lines: true },
    });

    this.logger.log(`Generated staffing plan ${plan.id} with ${lines.length} lines`);
    return plan;
  }

  /**
   * Get staffing plan for date/branch
   */
  async getPlan(orgId: string, branchId: string, date: Date): Promise<any> {
    const dateOnly = new Date(date.toISOString().split('T')[0]);
    return this.prisma.client.staffingPlan.findFirst({
      where: { orgId, branchId, date: dateOnly },
      orderBy: { generatedAt: 'desc' },
      include: { lines: true },
    });
  }

  /**
   * Publish staffing plan
   */
  async publishPlan(orgId: string, planId: string, publishedById: string): Promise<any> {
    const plan = await this.prisma.client.staffingPlan.findFirst({
      where: { id: planId, orgId },
    });
    if (!plan) {
      throw new NotFoundException('Staffing plan not found');
    }
    if (plan.status === 'PUBLISHED') {
      throw new ConflictException('Plan is already published');
    }

    return this.prisma.client.staffingPlan.update({
      where: { id: planId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedById,
      },
      include: { lines: true },
    });
  }

  // ===== Variance Report =====

  /**
   * Compute variance between scheduled shifts and suggested plan
   */
  async getVariance(orgId: string, branchId: string, date: Date): Promise<VarianceItem[]> {
    const dateOnly = new Date(date.toISOString().split('T')[0]);
    const dayStart = new Date(dateOnly);
    const dayEnd = new Date(dateOnly);
    dayEnd.setDate(dayEnd.getDate() + 1);

    // Get staffing plan
    const plan = await this.prisma.client.staffingPlan.findFirst({
      where: { orgId, branchId, date: dateOnly },
      orderBy: { generatedAt: 'desc' },
      include: { lines: true },
    });
    if (!plan) {
      return [];
    }

    // Get scheduled shifts (exclude CANCELLED/VOID)
    const shifts = await this.prisma.client.scheduledShift.findMany({
      where: {
        orgId,
        branchId,
        startAt: { gte: dayStart, lt: dayEnd },
        status: { in: ['DRAFT', 'PUBLISHED', 'APPROVED'] },
      },
      select: { startAt: true, role: true },
    });

    // Build scheduled counts per hour per role
    const scheduledCounts: Map<string, number> = new Map();
    for (const shift of shifts) {
      const hour = shift.startAt.getHours();
      const key = `${hour}-${shift.role}`;
      scheduledCounts.set(key, (scheduledCounts.get(key) || 0) + 1);
    }

    // Compute variance
    const variance: VarianceItem[] = [];
    for (const line of plan.lines) {
      const key = `${line.hour}-${line.roleKey}`;
      const scheduledCount = scheduledCounts.get(key) || 0;
      variance.push({
        hour: line.hour,
        roleKey: line.roleKey,
        scheduledCount,
        suggestedCount: line.suggestedHeadcount,
        delta: scheduledCount - line.suggestedHeadcount,
      });
    }

    return variance;
  }

  // ===== Alerts =====

  /**
   * Generate staffing alerts from variance
   */
  async generateAlerts(orgId: string, branchId: string, date: Date): Promise<any> {
    const variance = await this.getVariance(orgId, branchId, date);
    const dateOnly = new Date(date.toISOString().split('T')[0]);
    const alerts: Array<{ hour: number; severity: string; type: string; payloadJson: Prisma.InputJsonValue }> = [];

    for (const v of variance) {
      if (v.suggestedCount === 0) continue; // Skip hours with no suggested staff

      const deltaPct = Math.abs(v.delta) / v.suggestedCount;

      if (deltaPct < 0.1) continue; // < 10% variance, no alert

      const severity = deltaPct >= 0.4 ? 'HIGH' : deltaPct >= 0.2 ? 'MEDIUM' : 'LOW';
      const type = v.delta < 0 ? 'UNDERSTAFFED' : 'OVERSTAFFED';

      alerts.push({
        hour: v.hour,
        severity,
        type,
        payloadJson: {
          scheduledCount: v.scheduledCount,
          suggestedCount: v.suggestedCount,
          delta: v.delta,
          roleKey: v.roleKey,
        },
      });
    }

    // Upsert alerts (unique constraint handles duplicates)
    const created: unknown[] = [];
    for (const a of alerts) {
      try {
        const alert = await this.prisma.client.staffingAlert.upsert({
          where: {
            orgId_branchId_date_hour_type: {
              orgId,
              branchId,
              date: dateOnly,
              hour: a.hour,
              type: a.type as 'UNDERSTAFFED' | 'OVERSTAFFED',
            },
          },
          create: {
            orgId,
            branchId,
            date: dateOnly,
            hour: a.hour,
            severity: a.severity as 'LOW' | 'MEDIUM' | 'HIGH',
            type: a.type as 'UNDERSTAFFED' | 'OVERSTAFFED',
            payloadJson: a.payloadJson,
          },
          update: {
            severity: a.severity as 'LOW' | 'MEDIUM' | 'HIGH',
            payloadJson: a.payloadJson,
          },
        });
        created.push(alert);
      } catch (e) {
        this.logger.warn(`Failed to upsert alert: ${e}`);
      }
    }

    this.logger.log(`Generated ${created.length} alerts for ${branchId} on ${dateOnly.toISOString()}`);
    return { count: created.length, alerts: created };
  }

  /**
   * List alerts for date/branch
   */
  async listAlerts(orgId: string, branchId: string, date?: Date, includeResolved = false): Promise<any[]> {
    const where: Record<string, unknown> = { orgId, branchId };
    if (date) {
      where.date = new Date(date.toISOString().split('T')[0]);
    }
    if (!includeResolved) {
      where.resolvedAt = null;
    }

    return this.prisma.client.staffingAlert.findMany({
      where,
      orderBy: [{ date: 'desc' }, { hour: 'asc' }],
    });
  }

  /**
   * Resolve alert
   */
  async resolveAlert(orgId: string, alertId: string, resolvedById: string): Promise<any> {
    const alert = await this.prisma.client.staffingAlert.findFirst({
      where: { id: alertId, orgId },
    });
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    if (alert.resolvedAt) {
      throw new ConflictException('Alert is already resolved');
    }

    return this.prisma.client.staffingAlert.update({
      where: { id: alertId },
      data: {
        resolvedAt: new Date(),
        resolvedById,
      },
    });
  }

  // ===== Helpers =====

  private computeInputsHash(input: ForecastInput): string {
    const sorted = JSON.stringify(input, Object.keys(input).sort());
    return createHash('sha256').update(sorted).digest('hex').substring(0, 32);
  }
}
