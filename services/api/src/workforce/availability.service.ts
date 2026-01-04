/**
 * M10.11: Workforce Availability Service
 * 
 * Manages employee availability:
 * - Weekly recurring availability (dayOfWeek + time windows)
 * - Date-based exceptions (days off, custom hours)
 * - Self-service and manager override capabilities
 * 
 * Reference: Cal.com (MIT) availability patterns
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WorkforceNotificationsService } from './workforce-notifications.service';

export interface AvailabilitySlot {
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  timezone?: string;
}

export interface AvailabilityExceptionInput {
  date: Date;
  isAvailable: boolean;
  startTime?: string; // HH:MM if available
  endTime?: string; // HH:MM if available
  reason?: string;
}

export interface EffectiveAvailability {
  date: Date;
  isAvailable: boolean;
  slots: Array<{ startTime: string; endTime: string }>;
  isException: boolean;
  exceptionReason?: string;
}

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: WorkforceNotificationsService,
  ) {}

  // ===== SELF-SERVICE AVAILABILITY =====

  /**
   * Get my weekly availability (for self-service)
   */
  async getMyAvailability(userId: string, orgId: string) {
    const slots = await this.prisma.client.workforceAvailability.findMany({
      where: { userId, orgId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return {
      userId,
      slots: slots.map(s => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        timezone: s.timezone,
      })),
    };
  }

  /**
   * Set my weekly availability (for self-service)
   * Replaces all existing slots with new ones
   */
  async setMyAvailability(userId: string, orgId: string, slots: AvailabilitySlot[]) {
    // Validate slots
    this.validateAvailabilitySlots(slots);

    // Transaction: delete old + create new
    const result = await this.prisma.client.$transaction(async (tx) => {
      // Delete existing availability for this user
      await tx.workforceAvailability.deleteMany({
        where: { userId, orgId },
      });

      // Create new slots
      if (slots.length > 0) {
        await tx.workforceAvailability.createMany({
          data: slots.map(s => ({
            orgId,
            userId,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            timezone: s.timezone ?? null,
          })),
        });
      }

      return tx.workforceAvailability.findMany({
        where: { userId, orgId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });
    });

    // Notify about availability update
    await this.notifications.log({
      orgId,
      type: 'AVAILABILITY_UPDATED',
      targetUserId: userId,
      performedById: userId,
      entityType: 'WorkforceAvailability',
      entityId: userId, // userId as entity since it's the user's overall availability
      payload: { slotsCount: slots.length },
    });

    return {
      userId,
      slots: result.map(s => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        timezone: s.timezone,
      })),
    };
  }

  /**
   * Get my availability exceptions (for self-service)
   */
  async getMyExceptions(userId: string, orgId: string, from?: Date, to?: Date) {
    const now = new Date();
    const defaultFrom = from ?? now;
    const defaultTo = to ?? new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days

    const exceptions = await this.prisma.client.workforceAvailabilityException.findMany({
      where: {
        userId,
        orgId,
        date: {
          gte: defaultFrom,
          lte: defaultTo,
        },
      },
      orderBy: { date: 'asc' },
    });

    return exceptions.map(e => ({
      id: e.id,
      date: e.date,
      isAvailable: e.isAvailable,
      startTime: e.startTime,
      endTime: e.endTime,
      reason: e.reason,
    }));
  }

  /**
   * Add an availability exception (day off or custom hours)
   */
  async addMyException(userId: string, orgId: string, input: AvailabilityExceptionInput) {
    // Validate input
    if (input.isAvailable && (!input.startTime || !input.endTime)) {
      throw new BadRequestException('startTime and endTime required when isAvailable=true');
    }

    if (input.startTime && input.endTime) {
      this.validateTimeRange(input.startTime, input.endTime);
    }

    // Check for existing exception on same date
    const existing = await this.prisma.client.workforceAvailabilityException.findFirst({
      where: {
        userId,
        date: input.date,
      },
    });

    if (existing) {
      throw new ConflictException(`Exception already exists for ${input.date.toISOString().split('T')[0]}`);
    }

    const exception = await this.prisma.client.workforceAvailabilityException.create({
      data: {
        orgId,
        userId,
        date: input.date,
        isAvailable: input.isAvailable,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        reason: input.reason ?? null,
      },
    });

    await this.notifications.log({
      orgId,
      type: 'AVAILABILITY_UPDATED',
      targetUserId: userId,
      performedById: userId,
      entityType: 'WorkforceAvailabilityException',
      entityId: exception.id,
      payload: {
        date: input.date.toISOString().split('T')[0],
        isAvailable: input.isAvailable,
      },
    });

    return {
      id: exception.id,
      date: exception.date,
      isAvailable: exception.isAvailable,
      startTime: exception.startTime,
      endTime: exception.endTime,
      reason: exception.reason,
    };
  }

  /**
   * Update an availability exception
   */
  async updateMyException(userId: string, orgId: string, exceptionId: string, input: Partial<AvailabilityExceptionInput>) {
    const exception = await this.prisma.client.workforceAvailabilityException.findFirst({
      where: { id: exceptionId, userId, orgId },
    });

    if (!exception) {
      throw new NotFoundException('Exception not found');
    }

    // Validate if providing times
    const isAvailable = input.isAvailable ?? exception.isAvailable;
    const startTime = input.startTime ?? exception.startTime;
    const endTime = input.endTime ?? exception.endTime;

    if (isAvailable && (!startTime || !endTime)) {
      throw new BadRequestException('startTime and endTime required when isAvailable=true');
    }

    if (startTime && endTime) {
      this.validateTimeRange(startTime, endTime);
    }

    const updated = await this.prisma.client.workforceAvailabilityException.update({
      where: { id: exceptionId },
      data: {
        isAvailable,
        startTime: startTime ?? null,
        endTime: endTime ?? null,
        reason: input.reason ?? exception.reason,
      },
    });

    return {
      id: updated.id,
      date: updated.date,
      isAvailable: updated.isAvailable,
      startTime: updated.startTime,
      endTime: updated.endTime,
      reason: updated.reason,
    };
  }

  /**
   * Delete an availability exception
   */
  async deleteMyException(userId: string, orgId: string, exceptionId: string) {
    const exception = await this.prisma.client.workforceAvailabilityException.findFirst({
      where: { id: exceptionId, userId, orgId },
    });

    if (!exception) {
      throw new NotFoundException('Exception not found');
    }

    await this.prisma.client.workforceAvailabilityException.delete({
      where: { id: exceptionId },
    });

    return { deleted: true };
  }

  // ===== MANAGER VIEW/OVERRIDE =====

  /**
   * Get availability for a specific employee (manager view)
   */
  async getEmployeeAvailability(orgId: string, targetUserId: string) {
    // Verify user exists in org
    const user = await this.prisma.client.user.findFirst({
      where: { id: targetUserId, orgId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('Employee not found');
    }

    const slots = await this.prisma.client.workforceAvailability.findMany({
      where: { userId: targetUserId, orgId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return {
      user: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
      slots: slots.map(s => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        timezone: s.timezone,
      })),
    };
  }

  /**
   * Set availability for an employee (manager override)
   */
  async setEmployeeAvailability(
    orgId: string,
    targetUserId: string,
    slots: AvailabilitySlot[],
    performedById: string,
  ) {
    // Verify user exists in org
    const user = await this.prisma.client.user.findFirst({
      where: { id: targetUserId, orgId },
    });

    if (!user) {
      throw new NotFoundException('Employee not found');
    }

    // Validate slots
    this.validateAvailabilitySlots(slots);

    // Transaction: delete old + create new
    const result = await this.prisma.client.$transaction(async (tx) => {
      await tx.workforceAvailability.deleteMany({
        where: { userId: targetUserId, orgId },
      });

      if (slots.length > 0) {
        await tx.workforceAvailability.createMany({
          data: slots.map(s => ({
            orgId,
            userId: targetUserId,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            timezone: s.timezone ?? null,
          })),
        });
      }

      return tx.workforceAvailability.findMany({
        where: { userId: targetUserId, orgId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });
    });

    // Notify employee about manager override
    await this.notifications.log({
      orgId,
      type: 'AVAILABILITY_UPDATED',
      targetUserId,
      performedById,
      entityType: 'WorkforceAvailability',
      entityId: targetUserId,
      payload: { slotsCount: slots.length, overriddenBy: performedById },
    });

    return {
      userId: targetUserId,
      slots: result.map(s => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        timezone: s.timezone,
      })),
    };
  }

  /**
   * Get availability for multiple employees in a date range (for scheduling view)
   */
  async getTeamAvailability(orgId: string, branchId: string | null, from: Date, to: Date) {
    // Get all users in org/branch
    const users = await this.prisma.client.user.findMany({
      where: {
        orgId,
        isActive: true,
        ...(branchId ? { branchId } : {}),
      },
      select: { id: true, firstName: true, lastName: true },
    });

    const userIds = users.map(u => u.id);

    // Get all weekly availability
    const weeklySlots = await this.prisma.client.workforceAvailability.findMany({
      where: { userId: { in: userIds }, orgId },
    });

    // Get all exceptions in date range
    const exceptions = await this.prisma.client.workforceAvailabilityException.findMany({
      where: {
        userId: { in: userIds },
        orgId,
        date: { gte: from, lte: to },
      },
    });

    // Build availability map per user
    const userAvailabilityMap: Record<string, {
      user: { id: string; name: string };
      weeklySlots: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
      exceptions: Array<{ date: Date; isAvailable: boolean; startTime?: string; endTime?: string; reason?: string }>;
    }> = {};

    for (const user of users) {
      userAvailabilityMap[user.id] = {
        user: { id: user.id, name: `${user.firstName} ${user.lastName}` },
        weeklySlots: weeklySlots
          .filter(s => s.userId === user.id)
          .map(s => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })),
        exceptions: exceptions
          .filter(e => e.userId === user.id)
          .map(e => ({
            date: e.date,
            isAvailable: e.isAvailable,
            startTime: e.startTime ?? undefined,
            endTime: e.endTime ?? undefined,
            reason: e.reason ?? undefined,
          })),
      };
    }

    return Object.values(userAvailabilityMap);
  }

  /**
   * Get effective availability for a user on a specific date
   * Considers weekly slots AND exceptions
   */
  async getEffectiveAvailability(userId: string, orgId: string, date: Date): Promise<EffectiveAvailability> {
    const dayOfWeek = date.getDay();

    // Check for exception first
    const exception = await this.prisma.client.workforceAvailabilityException.findFirst({
      where: {
        userId,
        date: {
          gte: new Date(date.toISOString().split('T')[0]),
          lt: new Date(new Date(date).setDate(date.getDate() + 1)),
        },
      },
    });

    if (exception) {
      return {
        date,
        isAvailable: exception.isAvailable,
        slots: exception.isAvailable && exception.startTime && exception.endTime
          ? [{ startTime: exception.startTime, endTime: exception.endTime }]
          : [],
        isException: true,
        exceptionReason: exception.reason ?? undefined,
      };
    }

    // Fall back to weekly slots
    const weeklySlots = await this.prisma.client.workforceAvailability.findMany({
      where: { userId, orgId, dayOfWeek },
      orderBy: { startTime: 'asc' },
    });

    return {
      date,
      isAvailable: weeklySlots.length > 0,
      slots: weeklySlots.map(s => ({ startTime: s.startTime, endTime: s.endTime })),
      isException: false,
    };
  }

  // ===== VALIDATION HELPERS =====

  private validateAvailabilitySlots(slots: AvailabilitySlot[]) {
    for (const slot of slots) {
      if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
        throw new BadRequestException(`Invalid dayOfWeek: ${slot.dayOfWeek}. Must be 0-6.`);
      }
      this.validateTimeRange(slot.startTime, slot.endTime);
    }

    // Check for overlapping slots on same day
    const slotsByDay = new Map<number, AvailabilitySlot[]>();
    for (const slot of slots) {
      const daySlots = slotsByDay.get(slot.dayOfWeek) ?? [];
      daySlots.push(slot);
      slotsByDay.set(slot.dayOfWeek, daySlots);
    }

    for (const [dayOfWeek, daySlots] of slotsByDay) {
      for (let i = 0; i < daySlots.length; i++) {
        for (let j = i + 1; j < daySlots.length; j++) {
          if (this.timesOverlap(daySlots[i], daySlots[j])) {
            throw new BadRequestException(
              `Overlapping slots on day ${dayOfWeek}: ${daySlots[i].startTime}-${daySlots[i].endTime} and ${daySlots[j].startTime}-${daySlots[j].endTime}`
            );
          }
        }
      }
    }
  }

  private validateTimeRange(startTime: string, endTime: string) {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime)) {
      throw new BadRequestException(`Invalid startTime format: ${startTime}. Use HH:MM.`);
    }
    if (!timeRegex.test(endTime)) {
      throw new BadRequestException(`Invalid endTime format: ${endTime}. Use HH:MM.`);
    }

    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    if (startMinutes >= endMinutes) {
      throw new BadRequestException(`startTime (${startTime}) must be before endTime (${endTime})`);
    }
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private timesOverlap(a: AvailabilitySlot, b: AvailabilitySlot): boolean {
    const aStart = this.timeToMinutes(a.startTime);
    const aEnd = this.timeToMinutes(a.endTime);
    const bStart = this.timeToMinutes(b.startTime);
    const bEnd = this.timeToMinutes(b.endTime);

    return aStart < bEnd && bStart < aEnd;
  }
}
