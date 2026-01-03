/**
 * M9.3: Host Operations Service
 * 
 * Handles:
 * - AC-07: Today board view (HELD/CONFIRMED/SEATED + waitlist)
 * - AC-08: Host actions (hold/confirm/seat/complete/no-show/cancel)
 * - AC-09: Calendar refresh coordination
 * 
 * All actions are RBAC-gated at controller level (L2+)
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

interface TodayBoardFilters {
  branchId?: string;
  status?: string[];
  includeWaitlist?: boolean;
}

interface TodayBoardResult {
  date: string;
  branchId?: string;
  reservations: Array<{
    id: string;
    name: string;
    phone: string | null;
    partySize: number;
    startAt: string;
    endAt: string;
    status: string;
    table: { id: string; label: string } | null;
    depositStatus: string;
    source: string;
  }>;
  waitlist: Array<{
    id: string;
    name: string;
    phone: string | null;
    partySize: number;
    waitingMinutes: number;
    quotedWaitMinutes: number | null;
    status: string;
  }>;
  stats: {
    totalReservations: number;
    held: number;
    confirmed: number;
    seated: number;
    completed: number;
    noShow: number;
    cancelled: number;
    waitlistCount: number;
  };
}

@Injectable()
export class HostOpsService {
  private readonly logger = new Logger(HostOpsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * AC-07: Get Today Board for host view
   * Returns all reservations for today + active waitlist
   */
  async getTodayBoard(
    orgId: string,
    filters: TodayBoardFilters = {},
  ): Promise<TodayBoardResult> {
    const today = new Date();
    const dayStart = new Date(today);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(today);
    dayEnd.setHours(23, 59, 59, 999);

    // Build reservation query
    const resWhere: Record<string, unknown> = {
      orgId,
      startAt: { gte: dayStart, lte: dayEnd },
    };

    if (filters.branchId) {
      resWhere.branchId = filters.branchId;
    }

    if (filters.status && filters.status.length > 0) {
      resWhere.status = { in: filters.status };
    }

    // Fetch reservations
    const reservations = await this.prisma.reservation.findMany({
      where: resWhere,
      include: {
        table: { select: { id: true, label: true } },
      },
      orderBy: { startAt: 'asc' },
    });

    // Fetch waitlist if requested
    let waitlistEntries: Array<{
      id: string;
      name: string;
      phone: string | null;
      partySize: number;
      createdAt: Date;
      quotedWaitMinutes: number | null;
      status: string;
    }> = [];

    if (filters.includeWaitlist !== false) {
      const waitWhere: Record<string, unknown> = {
        orgId,
        status: 'WAITING',
      };

      if (filters.branchId) {
        waitWhere.branchId = filters.branchId;
      }

      waitlistEntries = await this.prisma.waitlistEntry.findMany({
        where: waitWhere,
        orderBy: { createdAt: 'asc' },
      });
    }

    // Calculate stats
    const stats = {
      totalReservations: reservations.length,
      held: reservations.filter((r) => r.status === 'HELD').length,
      confirmed: reservations.filter((r) => r.status === 'CONFIRMED').length,
      seated: reservations.filter((r) => r.status === 'SEATED').length,
      completed: reservations.filter((r) => r.status === 'COMPLETED').length,
      noShow: reservations.filter((r) => r.status === 'NO_SHOW').length,
      cancelled: reservations.filter((r) => r.status === 'CANCELLED').length,
      waitlistCount: waitlistEntries.length,
    };

    const now = Date.now();

    return {
      date: today.toISOString().split('T')[0],
      branchId: filters.branchId,
      reservations: reservations.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        partySize: r.partySize,
        startAt: r.startAt.toISOString(),
        endAt: r.endAt.toISOString(),
        status: r.status,
        table: r.table,
        depositStatus: r.depositStatus,
        source: r.source,
      })),
      waitlist: waitlistEntries.map((w) => ({
        id: w.id,
        name: w.name,
        phone: w.phone,
        partySize: w.partySize,
        waitingMinutes: Math.round((now - w.createdAt.getTime()) / 60000),
        quotedWaitMinutes: w.quotedWaitMinutes,
        status: w.status,
      })),
      stats,
    };
  }

  /**
   * Get upcoming reservations (next N hours)
   */
  async getUpcoming(
    orgId: string,
    branchId: string,
    hoursAhead: number = 2,
  ): Promise<unknown[]> {
    const now = new Date();
    const until = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    return this.prisma.reservation.findMany({
      where: {
        orgId,
        branchId,
        startAt: { gte: now, lte: until },
        status: { in: ['HELD', 'CONFIRMED'] },
      },
      include: {
        table: { select: { id: true, label: true } },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  /**
   * Get table statuses for floor plan view
   */
  async getTableStatuses(
    orgId: string,
    branchId: string,
  ): Promise<
    Array<{
      tableId: string;
      label: string;
      capacity: number;
      status: 'available' | 'reserved' | 'occupied';
      currentReservation?: {
        id: string;
        name: string;
        partySize: number;
        status: string;
      };
    }>
  > {
    const now = new Date();
    const twoHoursAhead = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // Get all tables for branch
    const tables = await this.prisma.client.table.findMany({
      where: { branchId, isActive: true },
    });

    if (tables.length === 0) return [];

    // Get current/upcoming reservations
    const reservations = await this.prisma.reservation.findMany({
      where: {
        orgId,
        branchId,
        tableId: { not: null },
        status: { in: ['HELD', 'CONFIRMED', 'SEATED'] },
        OR: [
          // Currently active
          { AND: [{ startAt: { lte: now } }, { endAt: { gte: now } }] },
          // Upcoming in next 2 hours
          { AND: [{ startAt: { gt: now } }, { startAt: { lte: twoHoursAhead } }] },
        ],
      },
      select: {
        id: true,
        tableId: true,
        name: true,
        partySize: true,
        status: true,
        startAt: true,
      },
    });

    // Build table status map
    const tableReservations = new Map<string, typeof reservations[0]>();
    for (const res of reservations) {
      if (res.tableId) {
        const existing = tableReservations.get(res.tableId);
        // Prefer SEATED over CONFIRMED over HELD
        if (!existing || 
            res.status === 'SEATED' || 
            (res.status === 'CONFIRMED' && existing.status === 'HELD')) {
          tableReservations.set(res.tableId, res);
        }
      }
    }

    return tables.map((table) => {
      const res = tableReservations.get(table.id);
      let status: 'available' | 'reserved' | 'occupied' = 'available';
      
      if (res) {
        status = res.status === 'SEATED' ? 'occupied' : 'reserved';
      }

      return {
        tableId: table.id,
        label: table.label,
        capacity: table.capacity,
        status,
        currentReservation: res
          ? {
              id: res.id,
              name: res.name,
              partySize: res.partySize,
              status: res.status,
            }
          : undefined,
      };
    });
  }

  /**
   * AC-09: Generate refresh key for calendar invalidation
   * Returns a hash that changes when any reservation data changes
   */
  async getCalendarRefreshKey(
    orgId: string,
    branchId: string,
    date: string,
  ): Promise<string> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    // Get latest update timestamp
    const latest = await this.prisma.reservation.findFirst({
      where: {
        orgId,
        branchId,
        startAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    // Also check waitlist
    const latestWaitlist = await this.prisma.waitlistEntry.findFirst({
      where: {
        orgId,
        branchId,
      },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    const resTime = latest?.updatedAt?.getTime() || 0;
    const waitTime = latestWaitlist?.updatedAt?.getTime() || 0;
    const maxTime = Math.max(resTime, waitTime);

    return `${date}-${branchId}-${maxTime}`;
  }
}
