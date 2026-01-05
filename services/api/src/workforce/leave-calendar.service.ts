/**
 * M10.18: Leave Calendar Service
 *
 * Provides team leave calendar views with:
 * - Approved leave requests with conflict summary
 * - Branch and date range filtering
 * - RBAC: L3+ for branch calendar, L1+ for own calendar
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface CalendarFilter {
  branchId?: string;
  from: Date;
  to: Date;
}

export interface CalendarEntry {
  id: string;
  userId: string;
  userName: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  startDate: Date;
  endDate: Date;
  totalHours: number;
  status: string;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  conflictingShiftsCount: number;
}

export interface CalendarSummary {
  date: string;
  counts: { [leaveType: string]: number };
  totalEmployeesOut: number;
}

@Injectable()
export class LeaveCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get team leave calendar for a branch or org
   * RBAC: L3+ required
   */
  async getTeamCalendar(
    orgId: string,
    filter: CalendarFilter,
  ): Promise<CalendarEntry[]> {
    const where: any = {
      orgId,
      status: { in: ['APPROVED', 'APPROVED_STEP1'] },
      OR: [
        { startDate: { gte: filter.from, lte: filter.to } },
        { endDate: { gte: filter.from, lte: filter.to } },
        { AND: [{ startDate: { lte: filter.from } }, { endDate: { gte: filter.to } }] },
      ],
    };

    if (filter.branchId) {
      where.branchId = filter.branchId;
    }

    const requests = await this.prisma.client.leaveRequestV2.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        leaveType: { select: { code: true, name: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    // Fetch conflict counts for each request
    const result: CalendarEntry[] = [];
    for (const req of requests) {
      const conflictCount = await this.getConflictingShiftsCount(
        orgId,
        req.userId,
        req.startDate,
        req.endDate,
      );

      result.push({
        id: req.id,
        userId: req.userId,
        userName: `${req.user.firstName} ${req.user.lastName}`,
        leaveTypeCode: req.leaveType.code,
        leaveTypeName: req.leaveType.name,
        startDate: req.startDate,
        endDate: req.endDate,
        totalHours: Number(req.totalHours),
        status: req.status,
        approvedById: req.approvedById,
        approvedByName: req.approvedBy
          ? `${req.approvedBy.firstName} ${req.approvedBy.lastName}`
          : null,
        approvedAt: req.approvedAt,
        conflictingShiftsCount: conflictCount,
      });
    }

    return result;
  }

  /**
   * Get own calendar (for employee self-service)
   */
  async getMyCalendar(
    orgId: string,
    userId: string,
    from: Date,
    to: Date,
  ): Promise<CalendarEntry[]> {
    const requests = await this.prisma.client.leaveRequestV2.findMany({
      where: {
        orgId,
        userId,
        OR: [
          { startDate: { gte: from, lte: to } },
          { endDate: { gte: from, lte: to } },
          { AND: [{ startDate: { lte: from } }, { endDate: { gte: to } }] },
        ],
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        leaveType: { select: { code: true, name: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    return requests.map((req) => ({
      id: req.id,
      userId: req.userId,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      leaveTypeCode: req.leaveType.code,
      leaveTypeName: req.leaveType.name,
      startDate: req.startDate,
      endDate: req.endDate,
      totalHours: Number(req.totalHours),
      status: req.status,
      approvedById: req.approvedById,
      approvedByName: req.approvedBy
        ? `${req.approvedBy.firstName} ${req.approvedBy.lastName}`
        : null,
      approvedAt: req.approvedAt,
      conflictingShiftsCount: 0, // Not shown for employee self-service
    }));
  }

  /**
   * Get calendar summary by day (counts per leave type)
   */
  async getCalendarSummary(
    orgId: string,
    filter: CalendarFilter,
  ): Promise<CalendarSummary[]> {
    const entries = await this.getTeamCalendar(orgId, filter);
    
    // Build date range
    const summaryMap = new Map<string, { counts: Map<string, number>; userIds: Set<string> }>();
    
    const currentDate = new Date(filter.from);
    while (currentDate <= filter.to) {
      const dateKey = currentDate.toISOString().split('T')[0];
      summaryMap.set(dateKey, { counts: new Map(), userIds: new Set() });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Populate counts
    for (const entry of entries) {
      const entryStart = new Date(entry.startDate);
      const entryEnd = new Date(entry.endDate);
      
      const iterDate = new Date(Math.max(entryStart.getTime(), filter.from.getTime()));
      const endDate = new Date(Math.min(entryEnd.getTime(), filter.to.getTime()));
      
      while (iterDate <= endDate) {
        const dateKey = iterDate.toISOString().split('T')[0];
        const daySummary = summaryMap.get(dateKey);
        if (daySummary) {
          const currentCount = daySummary.counts.get(entry.leaveTypeCode) || 0;
          daySummary.counts.set(entry.leaveTypeCode, currentCount + 1);
          daySummary.userIds.add(entry.userId);
        }
        iterDate.setDate(iterDate.getDate() + 1);
      }
    }

    // Convert to array
    const result: CalendarSummary[] = [];
    for (const [date, data] of summaryMap) {
      const counts: { [leaveType: string]: number } = {};
      for (const [type, count] of data.counts) {
        counts[type] = count;
      }
      result.push({
        date,
        counts,
        totalEmployeesOut: data.userIds.size,
      });
    }

    return result.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Count conflicting scheduled shifts for a leave period
   */
  private async getConflictingShiftsCount(
    orgId: string,
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const count = await this.prisma.client.scheduledShift.count({
      where: {
        orgId,
        userId,
        status: { in: ['DRAFT', 'PUBLISHED'] },
        OR: [
          { startAt: { gte: startDate, lte: endDate } },
          { endAt: { gte: startDate, lte: endDate } },
          { AND: [{ startAt: { lte: startDate } }, { endAt: { gte: endDate } }] },
        ],
      },
    });
    return count;
  }
}
