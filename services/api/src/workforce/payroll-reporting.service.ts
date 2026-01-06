/**
 * M10.6: Payroll Reporting Service
 * 
 * KPIs and CSV exports for payroll runs.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface PayrollSummary {
  totalRuns: number;
  draftRuns: number;
  calculatedRuns: number;
  approvedRuns: number;
  postedRuns: number;
  paidRuns: number;
  voidRuns: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalPaidHours: number;
  totalGrossAmount: number | null;
}

export interface DateRange {
  from: Date;
  to: Date;
}

@Injectable()
export class PayrollReportingService {
  private readonly logger = new Logger(PayrollReportingService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Get payroll summary KPIs
   */
  async getPayrollSummary(
    orgId: string,
    dateRange?: DateRange,
    branchId?: string,
  ): Promise<PayrollSummary> {
    const where: any = { orgId };

    if (branchId) {
      where.branchId = branchId;
    }

    if (dateRange) {
      where.createdAt = {
        gte: dateRange.from,
        lte: dateRange.to,
      };
    }

    const runs = await this.prisma.client.payrollRun.findMany({
      where,
      select: {
        status: true,
        regularHours: true,
        overtimeHours: true,
        paidHours: true,
        grossAmount: true,
      },
    });

    const summary: PayrollSummary = {
      totalRuns: runs.length,
      draftRuns: 0,
      calculatedRuns: 0,
      approvedRuns: 0,
      postedRuns: 0,
      paidRuns: 0,
      voidRuns: 0,
      totalRegularHours: 0,
      totalOvertimeHours: 0,
      totalPaidHours: 0,
      totalGrossAmount: null,
    };

    let hasGrossAmount = false;
    let totalGross = 0;

    for (const run of runs) {
      switch (run.status) {
        case 'DRAFT': summary.draftRuns++; break;
        case 'CALCULATED': summary.calculatedRuns++; break;
        case 'APPROVED': summary.approvedRuns++; break;
        case 'POSTED': summary.postedRuns++; break;
        case 'PAID': summary.paidRuns++; break;
        case 'VOID': summary.voidRuns++; break;
      }

      summary.totalRegularHours += Number(run.regularHours);
      summary.totalOvertimeHours += Number(run.overtimeHours);
      summary.totalPaidHours += Number(run.paidHours);

      if (run.grossAmount != null) {
        hasGrossAmount = true;
        totalGross += Number(run.grossAmount);
      }
    }

    if (hasGrossAmount) {
      summary.totalGrossAmount = totalGross;
    }

    return summary;
  }

  /**
   * Get payroll runs by pay period
   */
  async getPayrollByPeriod(
    orgId: string,
    payPeriodId: string,
  ): Promise<any[]> {
    return this.prisma.client.payrollRun.findMany({
      where: { orgId, payPeriodId },
      include: {
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, email: true } },
        approvedBy: { select: { id: true, email: true } },
        postedBy: { select: { id: true, email: true } },
        paidBy: { select: { id: true, email: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Export payroll summary CSV
   */
  async exportPayrollSummaryCsv(
    orgId: string,
    dateRange?: DateRange,
  ): Promise<string> {
    const where: any = { orgId };

    if (dateRange) {
      where.createdAt = {
        gte: dateRange.from,
        lte: dateRange.to,
      };
    }

    const runs = await this.prisma.client.payrollRun.findMany({
      where,
      include: {
        payPeriod: true,
        branch: { select: { name: true } },
        createdBy: { select: { email: true } },
        approvedBy: { select: { email: true } },
        postedBy: { select: { email: true } },
        paidBy: { select: { email: true } },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'asc' }, // Deterministic secondary sort
      ],
    });

    const headers = [
      'Payroll Run ID',
      'Pay Period Start',
      'Pay Period End',
      'Branch',
      'Status',
      'Regular Hours',
      'Overtime Hours',
      'Break Hours',
      'Paid Hours',
      'Gross Amount',
      'Created By',
      'Created At',
      'Approved By',
      'Approved At',
      'Posted By',
      'Posted At',
      'Paid By',
      'Paid At',
    ];

    const rows = runs.map((run) => [
      run.id,
      run.payPeriod.startDate.toISOString().slice(0, 10),
      run.payPeriod.endDate.toISOString().slice(0, 10),
      run.branch?.name ?? 'Org-Wide',
      run.status,
      Number(run.regularHours).toFixed(2),
      Number(run.overtimeHours).toFixed(2),
      Number(run.breakHours).toFixed(2),
      Number(run.paidHours).toFixed(2),
      run.grossAmount != null ? Number(run.grossAmount).toFixed(2) : '',
      run.createdBy?.email ?? '',
      run.createdAt.toISOString(),
      run.approvedBy?.email ?? '',
      run.approvedAt?.toISOString() ?? '',
      run.postedBy?.email ?? '',
      run.postedAt?.toISOString() ?? '',
      run.paidBy?.email ?? '',
      run.paidAt?.toISOString() ?? '',
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Export payroll lines CSV (all employees across all runs)
   */
  async exportPayrollLinesCsv(
    orgId: string,
    dateRange?: DateRange,
  ): Promise<string> {
    const where: any = { payrollRun: { orgId } };

    if (dateRange) {
      where.payrollRun.createdAt = {
        gte: dateRange.from,
        lte: dateRange.to,
      };
    }

    const lines = await this.prisma.client.payrollRunLine.findMany({
      where,
      include: {
        payrollRun: {
          include: {
            payPeriod: true,
            branch: { select: { name: true } },
          },
        },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: [
        { payrollRunId: 'asc' },
        { userId: 'asc' }, // Deterministic ordering
      ],
    });

    const headers = [
      'Payroll Run ID',
      'Pay Period Start',
      'Pay Period End',
      'Branch',
      'User ID',
      'User Email',
      'User Name',
      'Regular Hours',
      'Overtime Hours',
      'Break Hours',
      'Paid Hours',
      'Hourly Rate',
      'Gross Amount',
    ];

    const rows = lines.map((line) => [
      line.payrollRunId,
      line.payrollRun.payPeriod.startDate.toISOString().slice(0, 10),
      line.payrollRun.payPeriod.endDate.toISOString().slice(0, 10),
      line.payrollRun.branch?.name ?? 'Org-Wide',
      line.userId,
      line.user?.email ?? '',
      [line.user?.firstName, line.user?.lastName].filter(Boolean).join(' '),
      Number(line.regularHours).toFixed(2),
      Number(line.overtimeHours).toFixed(2),
      Number(line.breakHours).toFixed(2),
      Number(line.paidHours).toFixed(2),
      line.hourlyRate != null ? Number(line.hourlyRate).toFixed(2) : '',
      line.grossAmount != null ? Number(line.grossAmount).toFixed(2) : '',
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Export payroll audit trail CSV
   */
  async exportPayrollAuditCsv(
    orgId: string,
    dateRange?: DateRange,
  ): Promise<string> {
    const where: any = {
      orgId,
      action: {
        in: [
          'PAYROLL_RUN_CREATED',
          'PAYROLL_RUN_CALCULATED',
          'PAYROLL_RUN_APPROVED',
          'PAYROLL_RUN_POSTED',
          'PAYROLL_RUN_PAID',
          'PAYROLL_RUN_VOIDED',
        ],
      },
    };

    if (dateRange) {
      where.createdAt = {
        gte: dateRange.from,
        lte: dateRange.to,
      };
    }

    const logs = await this.prisma.client.workforceAuditLog.findMany({
      where,
      include: {
        performedBy: { select: { id: true, email: true } },
      },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' }, // Deterministic
      ],
    });

    const headers = [
      'Audit ID',
      'Timestamp',
      'Action',
      'Entity Type',
      'Entity ID',
      'Performed By ID',
      'Performed By Email',
      'Payload',
    ];

    const rows = logs.map((log) => [
      log.id,
      log.createdAt.toISOString(),
      log.action,
      log.entityType ?? '',
      log.entityId ?? '',
      log.performedById,
      log.performedBy?.email ?? '',
      log.payload ? JSON.stringify(log.payload) : '',
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}
