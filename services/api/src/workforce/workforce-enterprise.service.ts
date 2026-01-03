/**
 * M10.3: Workforce Enterprise Service
 *
 * Policy management, pay periods, timesheet approvals, and payroll export.
 */

import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WorkforceAuditService, WorkforceAuditAction } from './workforce-audit.service';

// Type aliases since we can't import enums directly from @prisma/client in the API package
export type RoundingMode = 'NEAREST' | 'UP' | 'DOWN';
export type PayPeriodStatus = 'OPEN' | 'CLOSED' | 'EXPORTED';
export type TimesheetApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PolicyDto {
  dailyOtThresholdMins?: number;
  weeklyOtThresholdMins?: number;
  roundingIntervalMins?: number;
  roundingMode?: RoundingMode;
  requireApproval?: boolean;
  autoLockDays?: number;
}

export interface GeneratePayPeriodsDto {
  periodType: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  startDate: string;
  endDate: string;
  branchId?: string;
}

export interface BulkApprovalDto {
  timeEntryIds: string[];
  rejectionReason?: string;
}

export interface PayrollExportDto {
  payPeriodId?: string;
  startDate?: string;
  endDate?: string;
  branchId?: string;
  format?: 'CSV' | 'JSON';
}

@Injectable()
export class WorkforceEnterpriseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: WorkforceAuditService,
  ) {}

  // ===== Policy Management =====

  async getPolicy(orgId: string) {
    const policy = await this.prisma.client.workforcePolicy.findUnique({
      where: { orgId },
    });

    if (!policy) {
      // Return default policy values
      return {
        orgId,
        dailyOtThresholdMins: 480,
        weeklyOtThresholdMins: 2400,
        roundingIntervalMins: 15,
        roundingMode: 'NEAREST' as RoundingMode,
        requireApproval: true,
        autoLockDays: 7,
      };
    }

    return policy;
  }

  async upsertPolicy(orgId: string, dto: PolicyDto, userId: string) {
    const policy = await this.prisma.client.workforcePolicy.upsert({
      where: { orgId },
      create: {
        orgId,
        dailyOtThresholdMins: dto.dailyOtThresholdMins ?? 480,
        weeklyOtThresholdMins: dto.weeklyOtThresholdMins ?? 2400,
        roundingIntervalMins: dto.roundingIntervalMins ?? 15,
        roundingMode: dto.roundingMode ?? 'NEAREST',
        requireApproval: dto.requireApproval ?? true,
        autoLockDays: dto.autoLockDays ?? 7,
      },
      update: {
        ...(dto.dailyOtThresholdMins !== undefined && { dailyOtThresholdMins: dto.dailyOtThresholdMins }),
        ...(dto.weeklyOtThresholdMins !== undefined && { weeklyOtThresholdMins: dto.weeklyOtThresholdMins }),
        ...(dto.roundingIntervalMins !== undefined && { roundingIntervalMins: dto.roundingIntervalMins }),
        ...(dto.roundingMode !== undefined && { roundingMode: dto.roundingMode }),
        ...(dto.requireApproval !== undefined && { requireApproval: dto.requireApproval }),
        ...(dto.autoLockDays !== undefined && { autoLockDays: dto.autoLockDays }),
      },
    });

    await this.auditService.logAction({
      orgId,
      action: WorkforceAuditAction.POLICY_UPDATED,
      entityType: 'WorkforcePolicy',
      entityId: policy.id,
      performedById: userId,
      payload: dto as unknown as Record<string, unknown>,
    });

    return policy;
  }

  // ===== Pay Period Management =====

  async generatePayPeriods(orgId: string, dto: GeneratePayPeriodsDto, userId: string) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const periods: { startDate: Date; endDate: Date }[] = [];
    let current = new Date(startDate);

    while (current < endDate) {
      let periodEnd: Date;

      switch (dto.periodType) {
        case 'WEEKLY':
          periodEnd = new Date(current);
          periodEnd.setDate(periodEnd.getDate() + 6);
          break;
        case 'BIWEEKLY':
          periodEnd = new Date(current);
          periodEnd.setDate(periodEnd.getDate() + 13);
          break;
        case 'MONTHLY':
          periodEnd = new Date(current);
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          periodEnd.setDate(periodEnd.getDate() - 1);
          break;
      }

      if (periodEnd > endDate) {
        periodEnd = new Date(endDate);
      }

      periods.push({ startDate: new Date(current), endDate: periodEnd });

      // Move to next period
      current = new Date(periodEnd);
      current.setDate(current.getDate() + 1);
    }

    // Use findFirst + create to handle nullable branchId (Prisma doesn't support null in compound unique where)
    const created: typeof periods = [];
    for (const p of periods) {
      try {
        // Check if period already exists
        const existing = await this.prisma.client.payPeriod.findFirst({
          where: {
            orgId,
            branchId: dto.branchId ?? null,
            startDate: p.startDate,
            endDate: p.endDate,
          },
        });

        if (!existing) {
          await this.prisma.client.payPeriod.create({
            data: {
              orgId,
              branchId: dto.branchId ?? null,
              periodType: dto.periodType,
              startDate: p.startDate,
              endDate: p.endDate,
              status: 'OPEN',
            },
          });
          created.push(p);
        }
      } catch {
        // Skip if constraint fails
      }
    }

    await this.auditService.logAction({
      orgId,
      action: WorkforceAuditAction.PAY_PERIODS_GENERATED,
      entityType: 'PayPeriod',
      entityId: 'batch',
      performedById: userId,
      payload: { count: created.length, periodType: dto.periodType },
    });

    return { generated: created.length, periods: created };
  }

  async listPayPeriods(orgId: string, options?: { branchId?: string; status?: PayPeriodStatus }) {
    return this.prisma.client.payPeriod.findMany({
      where: {
        orgId,
        ...(options?.branchId && { branchId: options.branchId }),
        ...(options?.status && { status: options.status }),
      },
      orderBy: { startDate: 'desc' },
      include: {
        branch: { select: { id: true, name: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true } },
        exportedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async closePayPeriod(orgId: string, payPeriodId: string, userId: string) {
    const period = await this.prisma.client.payPeriod.findFirst({
      where: { id: payPeriodId, orgId },
    });

    if (!period) {
      throw new NotFoundException('Pay period not found');
    }

    if (period.status !== 'OPEN') {
      throw new ConflictException('Pay period is not open');
    }

    // Lock all pending timesheet approvals for this period
    const timeEntries = await this.prisma.client.timeEntry.findMany({
      where: {
        orgId,
        clockInAt: { gte: period.startDate, lte: period.endDate },
        ...(period.branchId && { branchId: period.branchId }),
      },
      select: { id: true },
    });

    const now = new Date();
    
    // Lock all timesheet approvals
    await this.prisma.client.timesheetApproval.updateMany({
      where: {
        timeEntryId: { in: timeEntries.map(e => e.id) },
        orgId,
        lockedAt: null,
      },
      data: { lockedAt: now },
    });

    // Close the period
    const updated = await this.prisma.client.payPeriod.update({
      where: { id: payPeriodId },
      data: {
        status: 'CLOSED',
        closedAt: now,
        closedById: userId,
      },
    });

    await this.auditService.logAction({
      orgId,
      action: WorkforceAuditAction.PAY_PERIOD_CLOSED,
      entityType: 'PayPeriod',
      entityId: payPeriodId,
      performedById: userId,
      payload: { lockedEntries: timeEntries.length },
    });

    return updated;
  }

  // ===== Timesheet Approvals =====

  async getPendingApprovals(orgId: string, options?: { branchId?: string; userId?: string }) {
    return this.prisma.client.timesheetApproval.findMany({
      where: {
        orgId,
        status: 'PENDING',
        lockedAt: null,
        timeEntry: {
          ...(options?.branchId && { branchId: options.branchId }),
          ...(options?.userId && { userId: options.userId }),
        },
      },
      include: {
        timeEntry: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async bulkApprove(orgId: string, dto: BulkApprovalDto, userId: string) {
    const now = new Date();

    // Check all entries are valid
    const entries = await this.prisma.client.timeEntry.findMany({
      where: {
        id: { in: dto.timeEntryIds },
        orgId,
      },
      include: {
        timesheetApproval: true,
      },
    });

    // Verify none are locked
    const locked = entries.filter(e => e.timesheetApproval?.lockedAt);
    if (locked.length > 0) {
      throw new ConflictException(`${locked.length} entries are locked and cannot be modified`);
    }

    // Create or update approvals
    const results = await Promise.all(
      dto.timeEntryIds.map(async (timeEntryId) => {
        return this.prisma.client.timesheetApproval.upsert({
          where: { timeEntryId },
          create: {
            timeEntryId,
            orgId,
            status: 'APPROVED',
            approvedById: userId,
            approvedAt: now,
          },
          update: {
            status: 'APPROVED',
            approvedById: userId,
            approvedAt: now,
            rejectedById: null,
            rejectedAt: null,
            rejectionReason: null,
          },
        });
      }),
    );

    // Also update the legacy approved field on TimeEntry
    await this.prisma.client.timeEntry.updateMany({
      where: { id: { in: dto.timeEntryIds } },
      data: { approved: true, approvedById: userId },
    });

    await this.auditService.logAction({
      orgId,
      action: WorkforceAuditAction.TIMESHEETS_APPROVED,
      entityType: 'TimesheetApproval',
      entityId: 'batch',
      performedById: userId,
      payload: { count: results.length },
    });

    return { approved: results.length };
  }

  async bulkReject(orgId: string, dto: BulkApprovalDto, userId: string) {
    const now = new Date();

    // Check all entries are valid
    const entries = await this.prisma.client.timeEntry.findMany({
      where: {
        id: { in: dto.timeEntryIds },
        orgId,
      },
      include: {
        timesheetApproval: true,
      },
    });

    // Verify none are locked
    const locked = entries.filter(e => e.timesheetApproval?.lockedAt);
    if (locked.length > 0) {
      throw new ConflictException(`${locked.length} entries are locked and cannot be modified`);
    }

    // Create or update rejections
    const results = await Promise.all(
      dto.timeEntryIds.map(async (timeEntryId) => {
        return this.prisma.client.timesheetApproval.upsert({
          where: { timeEntryId },
          create: {
            timeEntryId,
            orgId,
            status: 'REJECTED',
            rejectedById: userId,
            rejectedAt: now,
            rejectionReason: dto.rejectionReason,
          },
          update: {
            status: 'REJECTED',
            rejectedById: userId,
            rejectedAt: now,
            rejectionReason: dto.rejectionReason,
            approvedById: null,
            approvedAt: null,
          },
        });
      }),
    );

    // Update the legacy approved field on TimeEntry
    await this.prisma.client.timeEntry.updateMany({
      where: { id: { in: dto.timeEntryIds } },
      data: { approved: false, approvedById: null },
    });

    await this.auditService.logAction({
      orgId,
      action: WorkforceAuditAction.TIMESHEETS_REJECTED,
      entityType: 'TimesheetApproval',
      entityId: 'batch',
      performedById: userId,
      payload: { count: results.length, reason: dto.rejectionReason },
    });

    return { rejected: results.length };
  }

  // ===== Payroll Export =====

  async exportPayroll(orgId: string, dto: PayrollExportDto, userId: string) {
    let startDate: Date;
    let endDate: Date;

    if (dto.payPeriodId) {
      const period = await this.prisma.client.payPeriod.findFirst({
        where: { id: dto.payPeriodId, orgId },
      });
      if (!period) {
        throw new NotFoundException('Pay period not found');
      }
      startDate = period.startDate;
      endDate = period.endDate;
    } else if (dto.startDate && dto.endDate) {
      startDate = new Date(dto.startDate);
      endDate = new Date(dto.endDate);
    } else {
      throw new BadRequestException('Either payPeriodId or startDate/endDate required');
    }

    // Get policy for rounding
    const policy = await this.getPolicy(orgId);

    // Get all approved time entries
    const entries = await this.prisma.client.timeEntry.findMany({
      where: {
        orgId,
        clockInAt: { gte: startDate },
        clockOutAt: { lte: endDate },
        ...(dto.branchId && { branchId: dto.branchId }),
        timesheetApproval: {
          status: 'APPROVED',
        },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        scheduledShift: { select: { id: true, role: true } },
      },
      orderBy: [{ userId: 'asc' }, { clockInAt: 'asc' }],
    });

    // Calculate hours with rounding
    const rows = entries.map((entry) => {
      const clockIn = new Date(entry.clockInAt);
      const clockOut = entry.clockOutAt ? new Date(entry.clockOutAt) : new Date();

      // Apply rounding
      const roundedClockIn = this.roundTime(clockIn, policy.roundingIntervalMins, policy.roundingMode as RoundingMode);
      const roundedClockOut = this.roundTime(clockOut, policy.roundingIntervalMins, policy.roundingMode as RoundingMode);

      const rawMinutes = Math.floor((clockOut.getTime() - clockIn.getTime()) / 60000);
      const roundedMinutes = Math.floor((roundedClockOut.getTime() - roundedClockIn.getTime()) / 60000);

      return {
        employeeId: entry.userId,
        employeeName: `${entry.user.firstName} ${entry.user.lastName}`,
        email: entry.user.email,
        date: entry.clockInAt.toISOString().split('T')[0],
        clockIn: entry.clockInAt.toISOString(),
        clockOut: entry.clockOutAt?.toISOString() ?? null,
        roundedClockIn: roundedClockIn.toISOString(),
        roundedClockOut: roundedClockOut.toISOString(),
        rawMinutes,
        roundedMinutes,
        regularMinutes: Math.min(roundedMinutes, policy.dailyOtThresholdMins),
        overtimeMinutes: Math.max(0, roundedMinutes - policy.dailyOtThresholdMins),
        role: entry.scheduledShift?.role ?? 'UNSPECIFIED',
      };
    });

    await this.auditService.logAction({
      orgId,
      action: WorkforceAuditAction.PAYROLL_EXPORTED,
      entityType: 'PayrollExport',
      entityId: 'batch',
      performedById: userId,
      payload: { rowCount: rows.length, startDate, endDate },
    });

    // Mark period as exported if using payPeriodId
    if (dto.payPeriodId) {
      await this.prisma.client.payPeriod.update({
        where: { id: dto.payPeriodId },
        data: {
          status: 'EXPORTED',
          exportedAt: new Date(),
          exportedById: userId,
        },
      });
    }

    if (dto.format === 'CSV') {
      return this.generateCsv(rows);
    }

    return { data: rows, summary: this.summarizePayroll(rows) };
  }

  private roundTime(date: Date, intervalMins: number, mode: RoundingMode): Date {
    const ms = intervalMins * 60 * 1000;
    const timestamp = date.getTime();

    switch (mode) {
      case 'UP':
        return new Date(Math.ceil(timestamp / ms) * ms);
      case 'DOWN':
        return new Date(Math.floor(timestamp / ms) * ms);
      case 'NEAREST':
      default:
        return new Date(Math.round(timestamp / ms) * ms);
    }
  }

  private generateCsv(rows: Array<Record<string, unknown>>): { csv: string; filename: string } {
    if (rows.length === 0) {
      return { csv: '', filename: `payroll_export_${Date.now()}.csv` };
    }

    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
          return String(val);
        }).join(','),
      ),
    ];

    return {
      csv: csvLines.join('\n'),
      filename: `payroll_export_${Date.now()}.csv`,
    };
  }

  private summarizePayroll(rows: Array<{ employeeId: string; regularMinutes: number; overtimeMinutes: number }>) {
    const byEmployee = new Map<string, { regular: number; overtime: number }>();

    for (const row of rows) {
      const existing = byEmployee.get(row.employeeId) ?? { regular: 0, overtime: 0 };
      existing.regular += row.regularMinutes;
      existing.overtime += row.overtimeMinutes;
      byEmployee.set(row.employeeId, existing);
    }

    return {
      totalEmployees: byEmployee.size,
      totalRegularMinutes: Array.from(byEmployee.values()).reduce((s, e) => s + e.regular, 0),
      totalOvertimeMinutes: Array.from(byEmployee.values()).reduce((s, e) => s + e.overtime, 0),
    };
  }

  // ===== Auto-create TimesheetApproval records =====

  async ensureApprovalRecord(orgId: string, timeEntryId: string) {
    const existing = await this.prisma.client.timesheetApproval.findUnique({
      where: { timeEntryId },
    });

    if (!existing) {
      await this.prisma.client.timesheetApproval.create({
        data: {
          timeEntryId,
          orgId,
          status: 'PENDING',
        },
      });
    }
  }
}
