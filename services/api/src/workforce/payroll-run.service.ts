/**
 * M10.6: Payroll Run Service
 * 
 * State machine and computation logic for payroll runs.
 * Workflow: DRAFT → CALCULATED → APPROVED → POSTED → PAID | VOID
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';
import { WorkforceAuditService, WorkforceAuditAction } from './workforce-audit.service';

const Decimal = Prisma.Decimal;

export type PayrollRunStatus = 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'POSTED' | 'PAID' | 'VOID';

export interface CreatePayrollRunDto {
  payPeriodId: string;
  branchId?: string;
}

export interface PayrollRunLine {
  userId: string;
  regularHours: number;
  overtimeHours: number;
  breakHours: number;
  paidHours: number;
  hourlyRate?: number;
  grossAmount?: number;
}

@Injectable()
export class PayrollRunService {
  private readonly logger = new Logger(PayrollRunService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: WorkforceAuditService,
  ) { }

  /**
   * Create a new payroll run for a pay period
   */
  async createPayrollRun(
    orgId: string,
    userId: string,
    dto: CreatePayrollRunDto,
  ): Promise<any> {
    // Validate pay period exists and belongs to org
    const payPeriod = await this.prisma.client.payPeriod.findFirst({
      where: { id: dto.payPeriodId, orgId },
    });

    if (!payPeriod) {
      throw new NotFoundException('Pay period not found');
    }

    // Check pay period is not locked
    if (payPeriod.status === 'CLOSED' || payPeriod.status === 'EXPORTED') {
      throw new ForbiddenException('Cannot create payroll run for closed/exported pay period');
    }

    // Check for existing run for this period/branch
    const existing = await this.prisma.client.payrollRun.findFirst({
      where: {
        payPeriodId: dto.payPeriodId,
        branchId: dto.branchId ?? null,
      },
    });

    if (existing) {
      throw new BadRequestException('Payroll run already exists for this pay period and branch');
    }

    // Create the run
    const run = await this.prisma.client.payrollRun.create({
      data: {
        orgId,
        branchId: dto.branchId ?? null,
        payPeriodId: dto.payPeriodId,
        status: 'DRAFT',
        createdById: userId,
      },
      include: {
        payPeriod: true,
        branch: true,
        createdBy: { select: { id: true, email: true } },
      },
    });

    // Audit log
    await this.auditService.logAction({
      orgId,
      performedById: userId,
      action: WorkforceAuditAction.PAYROLL_RUN_CREATED,
      entityType: 'PayrollRun',
      entityId: run.id,
      payload: { payPeriodId: dto.payPeriodId, branchId: dto.branchId },
    });

    return run;
  }

  /**
   * Calculate payroll run from approved time entries
   */
  async calculatePayrollRun(
    orgId: string,
    userId: string,
    runId: string,
  ): Promise<any> {
    const run = await this.prisma.client.payrollRun.findFirst({
      where: { id: runId, orgId },
      include: { payPeriod: true },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    // Only DRAFT status can be calculated
    if (run.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT payroll runs can be calculated');
    }

    // Check pay period not locked
    if (run.payPeriod.status === 'CLOSED' || run.payPeriod.status === 'EXPORTED') {
      throw new ForbiddenException('Pay period is locked');
    }

    const { startDate, endDate } = run.payPeriod;

    // Get approved time entries for the period
    const timeEntries = await this.prisma.client.timeEntry.findMany({
      where: {
        orgId,
        branchId: run.branchId ?? undefined,
        clockInAt: { gte: startDate },
        clockOutAt: { lte: endDate },
        approved: true,
      },
      include: {
        user: { select: { id: true } },
        breakEntries: true,
      },
      orderBy: { userId: 'asc' },
    });

    // Get workforce policy for OT thresholds
    const policy = await this.prisma.client.workforcePolicy.findUnique({
      where: { orgId },
    });

    const dailyOtMins = policy?.dailyOtThresholdMins ?? 480; // 8 hours
    const weeklyOtMins = policy?.weeklyOtThresholdMins ?? 2400; // 40 hours

    // Group by user and calculate totals
    const userTotals = new Map<string, {
      regularMins: number;
      overtimeMins: number;
      breakMins: number;
    }>();

    for (const entry of timeEntries) {
      if (!entry.clockOutAt) continue;

      const workedMins = Math.floor(
        (entry.clockOutAt.getTime() - entry.clockInAt.getTime()) / 60000
      );
      const breakMins = entry.breakEntries.reduce((sum: number, b: any) => {
        if (b.endAt) {
          return sum + Math.floor((b.endAt.getTime() - b.startAt.getTime()) / 60000);
        }
        return sum;
      }, 0);

      const netWorkedMins = workedMins - breakMins;
      const existing = userTotals.get(entry.userId) ?? { regularMins: 0, overtimeMins: 0, breakMins: 0 };

      // Simple daily OT logic
      const dailyRegular = Math.min(netWorkedMins, dailyOtMins);
      const dailyOt = Math.max(0, netWorkedMins - dailyOtMins);

      userTotals.set(entry.userId, {
        regularMins: existing.regularMins + dailyRegular,
        overtimeMins: existing.overtimeMins + dailyOt,
        breakMins: existing.breakMins + breakMins,
      });
    }

    // Convert to hours and create/update line items
    const lines: PayrollRunLine[] = [];
    let totalRegular = 0;
    let totalOvertime = 0;
    let totalBreak = 0;
    let totalPaid = 0;

    for (const [uid, totals] of userTotals.entries()) {
      // Apply weekly OT cap
      const weeklyRegularMins = Math.min(totals.regularMins, weeklyOtMins);
      const weeklyOtFromRegular = Math.max(0, totals.regularMins - weeklyOtMins);
      const finalOtMins = totals.overtimeMins + weeklyOtFromRegular;

      const regularHours = weeklyRegularMins / 60;
      const overtimeHours = finalOtMins / 60;
      const breakHours = totals.breakMins / 60;
      const paidHours = regularHours + overtimeHours * 1.5; // OT at 1.5x

      lines.push({
        userId: uid,
        regularHours,
        overtimeHours,
        breakHours,
        paidHours,
      });

      totalRegular += regularHours;
      totalOvertime += overtimeHours;
      totalBreak += breakHours;
      totalPaid += paidHours;
    }

    // Transaction: update run + create lines
    const updated = await this.prisma.client.$transaction(async (tx) => {
      // Delete existing lines
      await tx.payrollRunLine.deleteMany({
        where: { payrollRunId: runId },
      });

      // Create new lines (deterministic ordering by userId)
      const sortedLines = lines.sort((a, b) => a.userId.localeCompare(b.userId));
      for (const line of sortedLines) {
        await tx.payrollRunLine.create({
          data: {
            payrollRunId: runId,
            userId: line.userId,
            regularHours: new Decimal(line.regularHours.toFixed(2)),
            overtimeHours: new Decimal(line.overtimeHours.toFixed(2)),
            breakHours: new Decimal(line.breakHours.toFixed(2)),
            paidHours: new Decimal(line.paidHours.toFixed(2)),
          },
        });
      }

      // Update run totals and status
      return tx.payrollRun.update({
        where: { id: runId },
        data: {
          status: 'CALCULATED',
          regularHours: new Decimal(totalRegular.toFixed(2)),
          overtimeHours: new Decimal(totalOvertime.toFixed(2)),
          breakHours: new Decimal(totalBreak.toFixed(2)),
          paidHours: new Decimal(totalPaid.toFixed(2)),
          calculatedAt: new Date(),
        },
        include: {
          payPeriod: true,
          branch: true,
          lines: { orderBy: { userId: 'asc' } },
        },
      });
    });

    // Audit log
    await this.auditService.logAction({
      orgId,
      performedById: userId,
      action: WorkforceAuditAction.PAYROLL_RUN_CALCULATED,
      entityType: 'PayrollRun',
      entityId: runId,
      payload: { lineCount: lines.length, totalPaidHours: totalPaid },
    });

    return updated;
  }

  /**
   * Approve a calculated payroll run
   */
  async approvePayrollRun(
    orgId: string,
    userId: string,
    runId: string,
  ): Promise<any> {
    const run = await this.prisma.client.payrollRun.findFirst({
      where: { id: runId, orgId },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    if (run.status !== 'CALCULATED') {
      throw new BadRequestException('Only CALCULATED payroll runs can be approved');
    }

    const updated = await this.prisma.client.payrollRun.update({
      where: { id: runId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
      },
      include: {
        payPeriod: true,
        branch: true,
        lines: { orderBy: { userId: 'asc' } },
      },
    });

    // Audit log
    await this.auditService.logAction({
      orgId,
      performedById: userId,
      action: WorkforceAuditAction.PAYROLL_RUN_APPROVED,
      entityType: 'PayrollRun',
      entityId: runId,
    });

    return updated;
  }

  /**
   * List payroll runs with filters
   */
  async listPayrollRuns(
    orgId: string,
    filters?: {
      branchId?: string;
      payPeriodId?: string;
      status?: PayrollRunStatus;
    },
  ): Promise<any[]> {
    const where: any = { orgId };

    if (filters?.branchId) {
      where.branchId = filters.branchId;
    }
    if (filters?.payPeriodId) {
      where.payPeriodId = filters.payPeriodId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.client.payrollRun.findMany({
      where,
      include: {
        payPeriod: true,
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, email: true } },
        approvedBy: { select: { id: true, email: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single payroll run with full details
   */
  async getPayrollRun(orgId: string, runId: string): Promise<any> {
    const run = await this.prisma.client.payrollRun.findFirst({
      where: { id: runId, orgId },
      include: {
        payPeriod: true,
        branch: true,
        createdBy: { select: { id: true, email: true } },
        approvedBy: { select: { id: true, email: true } },
        postedBy: { select: { id: true, email: true } },
        paidBy: { select: { id: true, email: true } },
        voidedBy: { select: { id: true, email: true } },
        lines: {
          orderBy: { userId: 'asc' },
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
        journalLinks: {
          include: {
            journalEntry: { select: { id: true, memo: true, status: true } },
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    return run;
  }

  /**
   * Void a payroll run (for POSTED or PAID status)
   */
  async voidPayrollRun(
    orgId: string,
    userId: string,
    runId: string,
  ): Promise<any> {
    const run = await this.prisma.client.payrollRun.findFirst({
      where: { id: runId, orgId },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    if (run.status !== 'POSTED' && run.status !== 'PAID') {
      throw new BadRequestException('Only POSTED or PAID payroll runs can be voided');
    }

    // Note: Actual GL reversal is handled in PayrollPostingService

    const updated = await this.prisma.client.payrollRun.update({
      where: { id: runId },
      data: {
        status: 'VOID',
        voidedById: userId,
        voidedAt: new Date(),
      },
      include: {
        payPeriod: true,
        branch: true,
      },
    });

    // Audit log
    await this.auditService.logAction({
      orgId,
      performedById: userId,
      action: WorkforceAuditAction.PAYROLL_RUN_VOIDED,
      entityType: 'PayrollRun',
      entityId: runId,
    });

    return updated;
  }

  /**
   * Export payroll run lines to CSV
   */
  async exportPayrollRunCsv(orgId: string, runId: string): Promise<string> {
    const run = await this.getPayrollRun(orgId, runId);

    const headers = [
      'User ID',
      'User Email',
      'Regular Hours',
      'Overtime Hours',
      'Break Hours',
      'Paid Hours',
      'Hourly Rate',
      'Gross Amount',
    ];

    const rows = run.lines.map((line: any) => [
      line.userId,
      line.user?.email ?? '',
      Number(line.regularHours).toFixed(2),
      Number(line.overtimeHours).toFixed(2),
      Number(line.breakHours).toFixed(2),
      Number(line.paidHours).toFixed(2),
      line.hourlyRate ? Number(line.hourlyRate).toFixed(2) : '',
      line.grossAmount ? Number(line.grossAmount).toFixed(2) : '',
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}
