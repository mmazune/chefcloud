/**
 * M9.6: Scheduling Constraints Service
 *
 * Evaluates branch operating hours, blackouts, and capacity rules.
 * Used by public booking and internal reservation endpoints.
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { Branch, BranchOperatingHours, BranchBlackout, BranchCapacityRule } from '@chefcloud/db';

export interface SchedulingConstraintsResult {
  allowed: boolean;
  reason?: string;
  code?: 'OUTSIDE_HOURS' | 'BLACKOUT' | 'CAPACITY_PARTIES' | 'CAPACITY_COVERS' | 'BRANCH_CLOSED';
}

export interface OperatingHoursDto {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  enabled?: boolean;
}

export interface BlackoutDto {
  title: string;
  startAt: Date;
  endAt: Date;
  reason?: string;
}

export interface CapacityRuleDto {
  maxPartiesPerHour?: number | null;
  maxCoversPerHour?: number | null;
  enabled?: boolean;
}

@Injectable()
export class SchedulingConstraintsService {
  private readonly logger = new Logger(SchedulingConstraintsService.name);

  constructor(private prisma: PrismaService) { }

  // ===== Operating Hours CRUD =====

  async getOperatingHours(branchId: string): Promise<BranchOperatingHours[]> {
    return this.prisma.client.branchOperatingHours.findMany({
      where: { branchId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async setOperatingHours(
    orgId: string,
    branchId: string,
    hours: OperatingHoursDto[],
  ): Promise<BranchOperatingHours[]> {
    // Validate day of week values
    for (const h of hours) {
      if (h.dayOfWeek < 0 || h.dayOfWeek > 6) {
        throw new BadRequestException(`Invalid dayOfWeek: ${h.dayOfWeek}`);
      }
      if (!this.isValidTimeFormat(h.openTime) || !this.isValidTimeFormat(h.closeTime)) {
        throw new BadRequestException(`Invalid time format for day ${h.dayOfWeek}`);
      }
    }

    // Upsert each day's hours
    const results: BranchOperatingHours[] = [];
    for (const h of hours) {
      const result = await this.prisma.client.branchOperatingHours.upsert({
        where: { branchId_dayOfWeek: { branchId, dayOfWeek: h.dayOfWeek } },
        update: {
          openTime: h.openTime,
          closeTime: h.closeTime,
          enabled: h.enabled ?? true,
        },
        create: {
          orgId,
          branchId,
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime,
          closeTime: h.closeTime,
          enabled: h.enabled ?? true,
        },
      });
      results.push(result);
    }

    return results;
  }

  async deleteOperatingHours(branchId: string, dayOfWeek: number): Promise<void> {
    await this.prisma.client.branchOperatingHours.delete({
      where: { branchId_dayOfWeek: { branchId, dayOfWeek } },
    });
  }

  // ===== Blackouts CRUD =====

  async getBlackouts(
    branchId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<BranchBlackout[]> {
    const where: Record<string, unknown> = { branchId };
    if (startDate && endDate) {
      where.OR = [
        { startAt: { gte: startDate, lte: endDate } },
        { endAt: { gte: startDate, lte: endDate } },
        { startAt: { lte: startDate }, endAt: { gte: endDate } },
      ];
    }

    return this.prisma.client.branchBlackout.findMany({
      where,
      orderBy: { startAt: 'asc' },
    });
  }

  async createBlackout(
    orgId: string,
    branchId: string,
    dto: BlackoutDto,
    createdBy?: string,
  ): Promise<BranchBlackout> {
    if (dto.startAt >= dto.endAt) {
      throw new BadRequestException('startAt must be before endAt');
    }

    return this.prisma.client.branchBlackout.create({
      data: {
        orgId,
        branchId,
        title: dto.title,
        startAt: dto.startAt,
        endAt: dto.endAt,
        reason: dto.reason,
        createdBy,
      },
    });
  }

  async updateBlackout(
    orgId: string,
    blackoutId: string,
    dto: Partial<BlackoutDto>,
  ): Promise<BranchBlackout> {
    const existing = await this.prisma.client.branchBlackout.findFirst({
      where: { id: blackoutId, orgId },
    });
    if (!existing) {
      throw new BadRequestException('Blackout not found');
    }

    const startAt = dto.startAt ?? existing.startAt;
    const endAt = dto.endAt ?? existing.endAt;
    if (startAt >= endAt) {
      throw new BadRequestException('startAt must be before endAt');
    }

    return this.prisma.client.branchBlackout.update({
      where: { id: blackoutId },
      data: {
        title: dto.title,
        startAt: dto.startAt,
        endAt: dto.endAt,
        reason: dto.reason,
      },
    });
  }

  async deleteBlackout(orgId: string, blackoutId: string): Promise<void> {
    const existing = await this.prisma.client.branchBlackout.findFirst({
      where: { id: blackoutId, orgId },
    });
    if (!existing) {
      throw new BadRequestException('Blackout not found');
    }

    await this.prisma.client.branchBlackout.delete({
      where: { id: blackoutId },
    });
  }

  // ===== Capacity Rules CRUD =====

  async getCapacityRule(branchId: string): Promise<BranchCapacityRule | null> {
    return this.prisma.client.branchCapacityRule.findUnique({
      where: { branchId },
    });
  }

  async setCapacityRule(
    orgId: string,
    branchId: string,
    dto: CapacityRuleDto,
  ): Promise<BranchCapacityRule> {
    return this.prisma.client.branchCapacityRule.upsert({
      where: { branchId },
      update: {
        maxPartiesPerHour: dto.maxPartiesPerHour,
        maxCoversPerHour: dto.maxCoversPerHour,
        enabled: dto.enabled ?? true,
      },
      create: {
        orgId,
        branchId,
        maxPartiesPerHour: dto.maxPartiesPerHour,
        maxCoversPerHour: dto.maxCoversPerHour,
        enabled: dto.enabled ?? true,
      },
    });
  }

  // ===== Constraint Evaluation =====

  /**
   * Check if a reservation can be booked at the given time
   */
  async checkConstraints(
    branchId: string,
    startAt: Date,
    endAt: Date,
    partySize: number,
  ): Promise<SchedulingConstraintsResult> {
    const branch = await this.prisma.client.branch.findUnique({
      where: { id: branchId },
      select: { timezone: true },
    });

    // 1. Check operating hours
    const hoursCheck = await this.checkOperatingHours(branchId, startAt, branch?.timezone);
    if (!hoursCheck.allowed) {
      return hoursCheck;
    }

    // 2. Check blackouts
    const blackoutCheck = await this.checkBlackouts(branchId, startAt, endAt);
    if (!blackoutCheck.allowed) {
      return blackoutCheck;
    }

    // 3. Check capacity
    const capacityCheck = await this.checkCapacity(branchId, startAt, partySize);
    if (!capacityCheck.allowed) {
      return capacityCheck;
    }

    return { allowed: true };
  }

  private async checkOperatingHours(
    branchId: string,
    startAt: Date,
    timezone?: string,
  ): Promise<SchedulingConstraintsResult> {
    const hours = await this.prisma.client.branchOperatingHours.findMany({
      where: { branchId, enabled: true },
    });

    if (hours.length === 0) {
      // No hours defined = always open
      return { allowed: true };
    }

    // Convert to branch timezone for day-of-week calculation
    const tz = timezone || 'UTC';
    const localDate = new Date(startAt.toLocaleString('en-US', { timeZone: tz }));
    const dayOfWeek = localDate.getDay();
    const timeString = localDate.toTimeString().slice(0, 5); // "HH:MM"

    const dayHours = hours.find(h => h.dayOfWeek === dayOfWeek);
    if (!dayHours) {
      return {
        allowed: false,
        reason: 'Branch is closed on this day',
        code: 'BRANCH_CLOSED',
      };
    }

    if (timeString < dayHours.openTime || timeString >= dayHours.closeTime) {
      return {
        allowed: false,
        reason: `Reservation must be between ${dayHours.openTime} and ${dayHours.closeTime}`,
        code: 'OUTSIDE_HOURS',
      };
    }

    return { allowed: true };
  }

  private async checkBlackouts(
    branchId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<SchedulingConstraintsResult> {
    // Find any blackout that overlaps with the reservation
    const overlapping = await this.prisma.client.branchBlackout.findFirst({
      where: {
        branchId,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });

    if (overlapping) {
      return {
        allowed: false,
        reason: `Blocked: ${overlapping.title}`,
        code: 'BLACKOUT',
      };
    }

    return { allowed: true };
  }

  private async checkCapacity(
    branchId: string,
    startAt: Date,
    partySize: number,
  ): Promise<SchedulingConstraintsResult> {
    const rule = await this.prisma.client.branchCapacityRule.findUnique({
      where: { branchId },
    });

    if (!rule || !rule.enabled) {
      return { allowed: true };
    }

    // Calculate hour window
    const hourStart = new Date(startAt);
    hourStart.setMinutes(0, 0, 0);
    const hourEnd = new Date(hourStart);
    hourEnd.setHours(hourEnd.getHours() + 1);

    // Count existing reservations in this hour
    const existing = await this.prisma.client.reservation.findMany({
      where: {
        branchId,
        status: { in: ['HELD', 'CONFIRMED'] },
        startAt: { gte: hourStart, lt: hourEnd },
      },
      select: { partySize: true },
    });

    const currentParties = existing.length;
    const currentCovers = existing.reduce((sum, r) => sum + r.partySize, 0);

    // Check parties limit
    if (rule.maxPartiesPerHour !== null && currentParties >= rule.maxPartiesPerHour) {
      return {
        allowed: false,
        reason: 'Maximum parties per hour reached',
        code: 'CAPACITY_PARTIES',
      };
    }

    // Check covers limit
    if (rule.maxCoversPerHour !== null && currentCovers + partySize > rule.maxCoversPerHour) {
      return {
        allowed: false,
        reason: 'Maximum covers per hour would be exceeded',
        code: 'CAPACITY_COVERS',
      };
    }

    return { allowed: true };
  }

  // ===== Helpers =====

  private isValidTimeFormat(time: string): boolean {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  }
}
