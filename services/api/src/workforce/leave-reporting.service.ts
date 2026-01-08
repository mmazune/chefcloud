/**
 * M10.17: Leave Reporting Service
 *
 * Provides reporting and export functionality:
 * - Summary reports (balances, usage)
 * - CSV exports with UTF-8 BOM
 * - Team calendars
 * - Audit logs
 *
 * Security: All queries scoped by orgId to prevent data leakage
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';

export interface LeaveReportFilter {
  orgId: string;
  branchIds?: string[];
  startDate?: Date;
  endDate?: Date;
  leaveTypeId?: string;
  userId?: string;
}

export interface BalanceSummary {
  userId: string;
  userName: string;
  branchId: string | null;
  branchName: string | null;
  leaveTypeId: string;
  leaveTypeName: string;
  balanceHours: number;
  usedThisYear: number;
  pendingHours: number;
}

@Injectable()
export class LeaveReportingService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Get balance summary report
   */
  async getBalanceSummary(filter: LeaveReportFilter): Promise<BalanceSummary[]> {
    const users = await this.prisma.client.user.findMany({
      where: {
        orgId: filter.orgId,
        ...(filter.branchIds?.length ? { branchId: { in: filter.branchIds } } : {}),
        isActive: true,
      },
      include: {
        branch: true,
      },
    });

    const leaveTypes = await this.prisma.client.leaveTypeDefinition.findMany({
      where: {
        orgId: filter.orgId,
        isActive: true,
        ...(filter.leaveTypeId ? { id: filter.leaveTypeId } : {}),
      },
    });

    const summaries: BalanceSummary[] = [];

    for (const user of users) {
      for (const lt of leaveTypes) {
        // Get current balance
        const lastEntry = await this.prisma.client.leaveBalanceLedger.findFirst({
          where: { userId: user.id, leaveTypeId: lt.id },
          orderBy: { createdAt: 'desc' },
        });

        // Get used this year
        const yearStart = new Date(new Date().getFullYear(), 0, 1);
        const usedAgg = await this.prisma.client.leaveRequestV2.aggregate({
          where: {
            userId: user.id,
            leaveTypeId: lt.id,
            status: 'APPROVED',
            startDate: { gte: yearStart },
          },
          _sum: { totalHours: true },
        });

        // Get pending hours
        const pendingAgg = await this.prisma.client.leaveRequestV2.aggregate({
          where: {
            userId: user.id,
            leaveTypeId: lt.id,
            status: 'SUBMITTED',
          },
          _sum: { totalHours: true },
        });

        summaries.push({
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          branchId: user.branchId || null,
          branchName: user.branch?.name || null,
          leaveTypeId: lt.id,
          leaveTypeName: lt.name,
          balanceHours: lastEntry?.balanceAfter?.toNumber() || 0,
          usedThisYear: usedAgg._sum.totalHours?.toNumber() || 0,
          pendingHours: pendingAgg._sum.totalHours?.toNumber() || 0,
        });
      }
    }

    return summaries;
  }

  /**
   * Get leave usage report
   */
  async getUsageReport(filter: LeaveReportFilter) {
    const where: Prisma.LeaveRequestV2WhereInput = {
      orgId: filter.orgId,
      ...(filter.branchIds?.length ? { branchId: { in: filter.branchIds } } : {}),
      ...(filter.startDate ? { startDate: { gte: filter.startDate } } : {}),
      ...(filter.endDate ? { endDate: { lte: filter.endDate } } : {}),
      ...(filter.leaveTypeId ? { leaveTypeId: filter.leaveTypeId } : {}),
      ...(filter.userId ? { userId: filter.userId } : {}),
    };

    const requests = await this.prisma.client.leaveRequestV2.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        leaveType: true,
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    return requests.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: `${r.user.firstName} ${r.user.lastName}`,
      leaveTypeName: r.leaveType.name,
      startDate: r.startDate,
      endDate: r.endDate,
      totalHours: r.totalHours.toNumber(),
      status: r.status,
      reason: r.reason,
      approvedBy: r.approvedBy
        ? `${r.approvedBy.firstName} ${r.approvedBy.lastName}`
        : null,
      approvedAt: r.approvedAt,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Get team calendar view (leaves for a date range)
   */
  async getTeamCalendar(
    orgId: string,
    branchIds: string[],
    startDate: Date,
    endDate: Date,
  ) {
    const leaves = await this.prisma.client.leaveRequestV2.findMany({
      where: {
        orgId,
        branchId: { in: branchIds },
        status: 'APPROVED',
        OR: [
          { startDate: { gte: startDate, lte: endDate } },
          { endDate: { gte: startDate, lte: endDate } },
          { startDate: { lte: startDate }, endDate: { gte: endDate } },
        ],
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        leaveType: { select: { name: true, code: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    return leaves.map((l) => ({
      userId: l.userId,
      userName: `${l.user.firstName} ${l.user.lastName}`,
      leaveType: l.leaveType.name,
      leaveTypeCode: l.leaveType.code,
      startDate: l.startDate,
      endDate: l.endDate,
    }));
  }

  /**
   * Export balance summary as CSV
   */
  async exportBalanceSummaryCsv(filter: LeaveReportFilter): Promise<string> {
    const data = await this.getBalanceSummary(filter);

    const headers = [
      'Employee Name',
      'Branch',
      'Leave Type',
      'Current Balance (hrs)',
      'Used This Year (hrs)',
      'Pending (hrs)',
    ];

    const rows = data.map((d) => [
      d.userName,
      d.branchName || 'N/A',
      d.leaveTypeName,
      d.balanceHours.toFixed(2),
      d.usedThisYear.toFixed(2),
      d.pendingHours.toFixed(2),
    ]);

    return this.toCsv(headers, rows);
  }

  /**
   * Export usage report as CSV
   */
  async exportUsageReportCsv(filter: LeaveReportFilter): Promise<string> {
    const data = await this.getUsageReport(filter);

    const headers = [
      'Employee Name',
      'Leave Type',
      'Start Date',
      'End Date',
      'Total Hours',
      'Status',
      'Reason',
      'Approved By',
      'Approved At',
    ];

    const rows = data.map((d) => [
      d.userName,
      d.leaveTypeName,
      d.startDate.toISOString().split('T')[0],
      d.endDate.toISOString().split('T')[0],
      d.totalHours.toFixed(2),
      d.status,
      d.reason || '',
      d.approvedBy || '',
      d.approvedAt?.toISOString().split('T')[0] || '',
    ]);

    return this.toCsv(headers, rows);
  }

  /**
   * Export ledger history as CSV
   */
  async exportLedgerHistoryCsv(
    orgId: string,
    userId?: string,
    leaveTypeId?: string,
  ): Promise<string> {
    const where: Prisma.LeaveBalanceLedgerWhereInput = {
      orgId,
      ...(userId ? { userId } : {}),
      ...(leaveTypeId ? { leaveTypeId } : {}),
    };

    const entries = await this.prisma.client.leaveBalanceLedger.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true } },
        leaveType: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'Date',
      'Employee',
      'Leave Type',
      'Entry Type',
      'Change (hrs)',
      'Balance After (hrs)',
      'Reason',
    ];

    const rows = entries.map((e) => [
      e.createdAt.toISOString().split('T')[0],
      `${e.user.firstName} ${e.user.lastName}`,
      e.leaveType.name,
      e.entryType,
      e.deltaHours.toNumber().toFixed(4),
      e.balanceAfter.toNumber().toFixed(4),
      e.reason || '',
    ]);

    return this.toCsv(headers, rows);
  }

  /**
   * Convert data to CSV with UTF-8 BOM
   */
  private toCsv(headers: string[], rows: string[][]): string {
    const BOM = '\uFEFF';
    const escape = (s: string) => {
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const headerLine = headers.map(escape).join(',');
    const dataLines = rows.map((row) => row.map(escape).join(','));

    return BOM + [headerLine, ...dataLines].join('\n');
  }

  /**
   * Get aggregate stats for dashboard
   */
  async getDashboardStats(orgId: string, branchIds?: string[]) {
    const branchFilter = branchIds?.length ? { branchId: { in: branchIds } } : {};

    // Pending approvals count
    const pendingCount = await this.prisma.client.leaveRequestV2.count({
      where: {
        orgId,
        ...branchFilter,
        status: 'SUBMITTED',
      },
    });

    // Leaves today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const onLeaveToday = await this.prisma.client.leaveRequestV2.count({
      where: {
        orgId,
        ...branchFilter,
        status: 'APPROVED',
        startDate: { lte: today },
        endDate: { gte: today },
      },
    });

    // Approved this month
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const approvedThisMonth = await this.prisma.client.leaveRequestV2.count({
      where: {
        orgId,
        ...branchFilter,
        status: 'APPROVED',
        approvedAt: { gte: monthStart },
      },
    });

    // Upcoming leave (next 7 days)
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcomingLeave = await this.prisma.client.leaveRequestV2.count({
      where: {
        orgId,
        ...branchFilter,
        status: 'APPROVED',
        startDate: { gt: today, lte: nextWeek },
      },
    });

    return {
      pendingApprovals: pendingCount,
      onLeaveToday,
      approvedThisMonth,
      upcomingLeave,
    };
  }

  // ===== M10.18: Extended Reporting =====

  /**
   * Get approval stats report (counts by status, branch, date range)
   */
  async getApprovalStats(
    orgId: string,
    branchIds?: string[],
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    const branchFilter = branchIds?.length ? { branchId: { in: branchIds } } : {};
    const dateFilter: any = {};
    if (startDate) dateFilter.createdAt = { ...(dateFilter.createdAt || {}), gte: startDate };
    if (endDate) dateFilter.createdAt = { ...(dateFilter.createdAt || {}), lte: endDate };

    const [submitted, step1, approved, rejected] = await Promise.all([
      this.prisma.client.leaveRequestV2.count({
        where: { orgId, ...branchFilter, ...dateFilter, status: 'SUBMITTED' },
      }),
      this.prisma.client.leaveRequestV2.count({
        where: { orgId, ...branchFilter, ...dateFilter, status: 'APPROVED_STEP1' },
      }),
      this.prisma.client.leaveRequestV2.count({
        where: { orgId, ...branchFilter, ...dateFilter, status: 'APPROVED' },
      }),
      this.prisma.client.leaveRequestV2.count({
        where: { orgId, ...branchFilter, ...dateFilter, status: 'REJECTED' },
      }),
    ]);

    // By branch breakdown
    const byBranch = await this.prisma.client.leaveRequestV2.groupBy({
      by: ['branchId', 'status'],
      where: { orgId, ...branchFilter, ...dateFilter },
      _count: true,
    });

    return {
      totals: { submitted, step1, approved, rejected },
      byBranch: byBranch.map((b) => ({
        branchId: b.branchId,
        status: b.status,
        count: b._count,
      })),
    };
  }

  /**
   * Export calendar as CSV
   */
  async exportCalendarCsv(
    orgId: string,
    branchIds?: string[],
    startDate?: Date,
    endDate?: Date,
  ): Promise<string> {
    const branchFilter = branchIds?.length ? { branchId: { in: branchIds } } : {};
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.OR = [
        { startDate: { gte: startDate, lte: endDate || new Date('2099-12-31') } },
        { endDate: { gte: startDate, lte: endDate || new Date('2099-12-31') } },
      ];
    }

    const requests = await this.prisma.client.leaveRequestV2.findMany({
      where: {
        orgId,
        ...branchFilter,
        ...dateFilter,
        status: { in: ['APPROVED', 'APPROVED_STEP1'] },
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        leaveType: { select: { name: true, code: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    const rows = [
      ['Employee', 'Leave Type', 'Start Date', 'End Date', 'Hours', 'Status'],
      ...requests.map((r) => [
        `${r.user.firstName} ${r.user.lastName}`,
        r.leaveType.name,
        r.startDate.toISOString().split('T')[0],
        r.endDate.toISOString().split('T')[0],
        r.totalHours.toString(),
        r.status,
      ]),
    ];

    // Add UTF-8 BOM for Excel
    const BOM = '\uFEFF';
    return BOM + rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  }

  /**
   * Export approvals report as CSV
   */
  async exportApprovalsCsv(
    orgId: string,
    branchIds?: string[],
    startDate?: Date,
    endDate?: Date,
  ): Promise<string> {
    const branchFilter = branchIds?.length ? { branchId: { in: branchIds } } : {};
    const dateFilter: any = {};
    if (startDate) dateFilter.createdAt = { ...(dateFilter.createdAt || {}), gte: startDate };
    if (endDate) dateFilter.createdAt = { ...(dateFilter.createdAt || {}), lte: endDate };

    const requests = await this.prisma.client.leaveRequestV2.findMany({
      where: { orgId, ...branchFilter, ...dateFilter },
      include: {
        user: { select: { firstName: true, lastName: true } },
        leaveType: { select: { name: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
        approvedStep1By: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = [
      ['Employee', 'Leave Type', 'Start', 'End', 'Hours', 'Status', 'Step1 By', 'Step1 At', 'Final By', 'Final At', 'Rejected Reason'],
      ...requests.map((r) => [
        `${r.user.firstName} ${r.user.lastName}`,
        r.leaveType.name,
        r.startDate.toISOString().split('T')[0],
        r.endDate.toISOString().split('T')[0],
        r.totalHours.toString(),
        r.status,
        r.approvedStep1By ? `${r.approvedStep1By.firstName} ${r.approvedStep1By.lastName}` : '',
        r.approvedStep1At?.toISOString() || '',
        r.approvedBy ? `${r.approvedBy.firstName} ${r.approvedBy.lastName}` : '',
        r.approvedAt?.toISOString() || '',
        r.rejectionReason || '',
      ]),
    ];

    const BOM = '\uFEFF';
    return BOM + rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  }
}
