/**
 * M10.1: Workforce Reporting Service
 *
 * Labor metrics, scheduled vs. actual analysis, and CSV exports.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

interface LaborMetrics {
  totalScheduledMinutes: number;
  totalActualMinutes: number;
  totalOvertimeMinutes: number;
  totalBreakMinutes: number;
  shiftsCompleted: number;
  shiftsPending: number;
  shiftsApproved: number;
  adherenceRate: number;
  employeeBreakdown: {
    userId: string;
    userName: string;
    scheduledMinutes: number;
    actualMinutes: number;
    overtimeMinutes: number;
    breakMinutes: number;
    shifts: number;
  }[];
}

interface DateRange {
  from: Date;
  to: Date;
}

@Injectable()
export class WorkforceReportingService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== Labor Metrics =====

  async getLaborMetrics(filters: {
    orgId: string;
    branchId?: string;
    dateRange: DateRange;
  }): Promise<LaborMetrics> {
    // Get all shifts in date range
    const shifts = await this.prisma.client.scheduledShift.findMany({
      where: {
        orgId: filters.orgId,
        ...(filters.branchId && { branchId: filters.branchId }),
        startAt: {
          gte: filters.dateRange.from,
          lte: filters.dateRange.to,
        },
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Get all time entries in date range
    const timeEntries = await this.prisma.client.timeEntry.findMany({
      where: {
        orgId: filters.orgId,
        ...(filters.branchId && { branchId: filters.branchId }),
        clockInAt: {
          gte: filters.dateRange.from,
          lte: filters.dateRange.to,
        },
      },
      include: {
        breakEntries: true,
      },
    });

    // Calculate totals
    let totalScheduledMinutes = 0;
    let totalActualMinutes = 0;
    let totalOvertimeMinutes = 0;
    let totalBreakMinutes = 0;
    let shiftsCompleted = 0;
    let shiftsPending = 0;
    let shiftsApproved = 0;

    // Employee breakdown map
    const employeeMap = new Map<
      string,
      {
        userId: string;
        userName: string;
        scheduledMinutes: number;
        actualMinutes: number;
        overtimeMinutes: number;
        breakMinutes: number;
        shifts: number;
      }
    >();

    // Process shifts
    for (const shift of shifts) {
      totalScheduledMinutes += shift.plannedMinutes;

      if (shift.actualMinutes !== null) {
        totalActualMinutes += shift.actualMinutes;
      }
      if (shift.overtimeMinutes !== null) {
        totalOvertimeMinutes += shift.overtimeMinutes;
      }
      if (shift.breakMinutes !== null) {
        totalBreakMinutes += shift.breakMinutes;
      }

      if (shift.status === 'COMPLETED') {
        shiftsCompleted++;
      } else if (shift.status === 'APPROVED') {
        shiftsApproved++;
      } else if (['DRAFT', 'PUBLISHED', 'IN_PROGRESS'].includes(shift.status)) {
        shiftsPending++;
      }

      // Employee breakdown
      if (!employeeMap.has(shift.userId)) {
        employeeMap.set(shift.userId, {
          userId: shift.userId,
          userName: `${shift.user.firstName ?? ''} ${shift.user.lastName ?? ''}`.trim(),
          scheduledMinutes: 0,
          actualMinutes: 0,
          overtimeMinutes: 0,
          breakMinutes: 0,
          shifts: 0,
        });
      }

      const emp = employeeMap.get(shift.userId)!;
      emp.scheduledMinutes += shift.plannedMinutes;
      emp.actualMinutes += shift.actualMinutes ?? 0;
      emp.overtimeMinutes += shift.overtimeMinutes ?? 0;
      emp.breakMinutes += shift.breakMinutes ?? 0;
      emp.shifts++;
    }

    // Calculate adherence rate (actual / scheduled)
    const adherenceRate =
      totalScheduledMinutes > 0
        ? Math.round((totalActualMinutes / totalScheduledMinutes) * 100)
        : 0;

    return {
      totalScheduledMinutes,
      totalActualMinutes,
      totalOvertimeMinutes,
      totalBreakMinutes,
      shiftsCompleted,
      shiftsPending,
      shiftsApproved,
      adherenceRate,
      employeeBreakdown: Array.from(employeeMap.values()),
    };
  }

  // ===== Daily Summary =====

  async getDailySummary(filters: {
    orgId: string;
    branchId?: string;
    date: Date;
  }) {
    const startOfDay = new Date(filters.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Shifts for the day
    const shifts = await this.prisma.client.scheduledShift.findMany({
      where: {
        orgId: filters.orgId,
        ...(filters.branchId && { branchId: filters.branchId }),
        startAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
      orderBy: { startAt: 'asc' },
    });

    // Time entries for the day
    const timeEntries = await this.prisma.client.timeEntry.findMany({
      where: {
        orgId: filters.orgId,
        ...(filters.branchId && { branchId: filters.branchId }),
        clockInAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        breakEntries: true,
      },
      orderBy: { clockInAt: 'asc' },
    });

    return {
      date: startOfDay.toISOString().split('T')[0],
      shifts,
      timeEntries,
      summary: {
        totalShifts: shifts.length,
        shiftsByStatus: {
          draft: shifts.filter((s) => s.status === 'DRAFT').length,
          published: shifts.filter((s) => s.status === 'PUBLISHED').length,
          inProgress: shifts.filter((s) => s.status === 'IN_PROGRESS').length,
          completed: shifts.filter((s) => s.status === 'COMPLETED').length,
          approved: shifts.filter((s) => s.status === 'APPROVED').length,
          cancelled: shifts.filter((s) => s.status === 'CANCELLED').length,
        },
        totalTimeEntries: timeEntries.length,
        clockedIn: timeEntries.filter((e) => !e.clockOutAt).length,
      },
    };
  }

  // ===== CSV Exports =====

  async exportShiftsCsv(filters: {
    orgId: string;
    branchId?: string;
    dateRange: DateRange;
  }): Promise<string> {
    const shifts = await this.prisma.client.scheduledShift.findMany({
      where: {
        orgId: filters.orgId,
        ...(filters.branchId && { branchId: filters.branchId }),
        startAt: {
          gte: filters.dateRange.from,
          lte: filters.dateRange.to,
        },
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ startAt: 'asc' }],
    });

    // CSV header
    const headers = [
      'Shift ID',
      'Date',
      'Start Time',
      'End Time',
      'Employee Name',
      'Employee Email',
      'Branch',
      'Role',
      'Status',
      'Planned Minutes',
      'Actual Minutes',
      'Overtime Minutes',
      'Break Minutes',
      'Notes',
    ];

    const rows = shifts.map((shift) => [
      shift.id,
      shift.startAt.toISOString().split('T')[0],
      shift.startAt.toISOString().split('T')[1]?.slice(0, 5) ?? '',
      shift.endAt.toISOString().split('T')[1]?.slice(0, 5) ?? '',
      `${shift.user.firstName ?? ''} ${shift.user.lastName ?? ''}`.trim(),
      shift.user.email,
      shift.branch?.name ?? '',
      shift.role ?? '',
      shift.status,
      shift.plannedMinutes.toString(),
      shift.actualMinutes?.toString() ?? '',
      shift.overtimeMinutes?.toString() ?? '',
      shift.breakMinutes?.toString() ?? '',
      shift.notes ?? '',
    ]);

    return this.toCsv(headers, rows);
  }

  async exportTimeEntriesCsv(filters: {
    orgId: string;
    branchId?: string;
    dateRange: DateRange;
  }): Promise<string> {
    const entries = await this.prisma.client.timeEntry.findMany({
      where: {
        orgId: filters.orgId,
        ...(filters.branchId && { branchId: filters.branchId }),
        clockInAt: {
          gte: filters.dateRange.from,
          lte: filters.dateRange.to,
        },
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        scheduledShift: {
          select: { id: true },
        },
        breakEntries: true,
      },
      orderBy: [{ clockInAt: 'asc' }],
    });

    // CSV header
    const headers = [
      'Entry ID',
      'Date',
      'Clock In',
      'Clock Out',
      'Employee Name',
      'Employee Email',
      'Branch ID',
      'Method',
      'Total Minutes',
      'Break Minutes',
      'Overtime Minutes',
      'Linked Shift ID',
      'Breaks Count',
    ];

    const rows = entries.map((entry) => {
      const breakMinutes = entry.breakEntries.reduce(
        (sum, b) => sum + (b.minutes ?? 0),
        0,
      );
      const totalMinutes = entry.clockOutAt
        ? Math.floor(
            (entry.clockOutAt.getTime() - entry.clockInAt.getTime()) / (1000 * 60),
          )
        : 0;

      return [
        entry.id,
        entry.clockInAt.toISOString().split('T')[0],
        entry.clockInAt.toISOString().split('T')[1]?.slice(0, 8) ?? '',
        entry.clockOutAt?.toISOString().split('T')[1]?.slice(0, 8) ?? '',
        `${entry.user.firstName ?? ''} ${entry.user.lastName ?? ''}`.trim(),
        entry.user.email,
        entry.branchId,
        entry.method,
        totalMinutes.toString(),
        breakMinutes.toString(),
        entry.overtimeMinutes?.toString() ?? '',
        entry.scheduledShift?.id ?? '',
        entry.breakEntries.length.toString(),
      ];
    });

    return this.toCsv(headers, rows);
  }

  async exportLaborSummaryCsv(filters: {
    orgId: string;
    branchId?: string;
    dateRange: DateRange;
  }): Promise<string> {
    const metrics = await this.getLaborMetrics(filters);

    // CSV header
    const headers = [
      'Employee ID',
      'Employee Name',
      'Scheduled Hours',
      'Actual Hours',
      'Overtime Hours',
      'Break Hours',
      'Total Shifts',
      'Adherence %',
    ];

    const rows = metrics.employeeBreakdown.map((emp) => {
      const adherence =
        emp.scheduledMinutes > 0
          ? Math.round((emp.actualMinutes / emp.scheduledMinutes) * 100)
          : 0;

      return [
        emp.userId,
        emp.userName,
        (emp.scheduledMinutes / 60).toFixed(2),
        (emp.actualMinutes / 60).toFixed(2),
        (emp.overtimeMinutes / 60).toFixed(2),
        (emp.breakMinutes / 60).toFixed(2),
        emp.shifts.toString(),
        `${adherence}%`,
      ];
    });

    return this.toCsv(headers, rows);
  }

  // ===== Helpers =====

  private toCsv(headers: string[], rows: string[][]): string {
    const escape = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvRows = [
      headers.map(escape).join(','),
      ...rows.map((row) => row.map(escape).join(',')),
    ];

    return csvRows.join('\n');
  }
}
