/**
 * E43-s2: Payroll Service
 * 
 * Computes payroll from time entries + policies; generates payslips; posts summary to GL.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

const ACCOUNT_PAYROLL_EXPENSE = '6000'; // Payroll Expense (DR on payment)
const ACCOUNT_PAYROLL_PAYABLE = '2000'; // Payroll Payable (CR on payment)

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * E43-s2: Build draft payrun from time entries
   * Aggregates time entries → regular/overtime by user
   */
  async buildDraftRun(orgId: string, periodStart: Date, periodEnd: Date, _userId: string): Promise<any> {
    // Get org settings for overtime rate
    const settings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId },
      select: { attendance: true },
    });

    const attendance = (settings?.attendance as any) || {};
    const overtimeRate = attendance.overtimeRate || 1.5;

    // Get all time entries in period
    const timeEntries = await this.prisma.client.timeEntry.findMany({
      where: {
        orgId,
        clockInAt: { gte: periodStart, lte: periodEnd },
        approved: true, // Use approved boolean field
      },
      include: {
        user: {
          include: {
            employeeProfile: true,
          },
        },
      },
    });

    // Group by user
    const userMap = new Map<string, any>();
    for (const entry of timeEntries) {
      if (!userMap.has(entry.userId)) {
        userMap.set(entry.userId, {
          userId: entry.userId,
          user: entry.user,
          regularMinutes: 0,
          overtimeMinutes: 0,
        });
      }
      const userData = userMap.get(entry.userId)!;
      const totalMinutes = entry.overtimeMinutes + (entry.clockOutAt ? Math.floor((entry.clockOutAt.getTime() - entry.clockInAt.getTime()) / 60000) - entry.overtimeMinutes : 0);
      userData.regularMinutes += totalMinutes - entry.overtimeMinutes;
      userData.overtimeMinutes += entry.overtimeMinutes;
    }

    // Create pay run
    const payRun = await this.prisma.client.payRun.create({
      data: {
        orgId,
        periodStart,
        periodEnd,
        status: 'DRAFT',
      },
    });

    // Create payslips for each user
    const slips = [];
    for (const [userId, userData] of userMap) {
      const gross = await this.calculateGross(orgId, userId, userData.regularMinutes, userData.overtimeMinutes, overtimeRate);
      const { tax, deductions } = await this.calculateDeductions(orgId, userId, gross);
      const net = gross - tax - deductions;

      const slip = await this.prisma.client.paySlip.create({
        data: {
          payRunId: payRun.id,
          userId,
          regularMinutes: userData.regularMinutes,
          overtimeMinutes: userData.overtimeMinutes,
          gross,
          tax,
          deductions,
          net,
        },
      });
      slips.push(slip);
    }

    this.logger.log(`Created draft pay run ${payRun.id} for ${slips.length} employees`);

    return { payRun, slips };
  }

  /**
   * Calculate gross pay: apply pay components (EARNING types)
   */
  private async calculateGross(orgId: string, userId: string, regularMinutes: number, overtimeMinutes: number, overtimeRate: number): Promise<number> {
    // Get hourly rate from employee profile metadata
    const profile = await this.prisma.client.employeeProfile.findUnique({
      where: { userId },
      select: { metadata: true },
    });

    const metadata = (profile?.metadata as any) || {};
    const hourlyRate = metadata.hourlyRate || 0;

    // Base pay = (regularMinutes / 60) * hourlyRate + (overtimeMinutes / 60) * hourlyRate * overtimeRate
    let gross = (regularMinutes / 60) * hourlyRate + (overtimeMinutes / 60) * hourlyRate * overtimeRate;

    // Apply pay components (EARNING type)
    const components = await this.prisma.client.payComponent.findMany({
      where: { orgId, active: true, type: 'EARNING' },
    });

    for (const component of components) {
      gross += await this.applyComponent(component, userId, gross, hourlyRate);
    }

    return Math.round(gross * 100) / 100; // Round to 2 decimals
  }

  /**
   * Apply a single pay component
   */
  private async applyComponent(component: any, _userId: string, gross: number, hourlyRate: number): Promise<number> {
    const value = Number(component.value);

    switch (component.calc) {
      case 'FIXED':
        return value;
      case 'RATE':
        // For RATE type, multiply value by hourlyRate (e.g., bonus hours)
        return value * hourlyRate;
      case 'PERCENT':
        // For PERCENT type earnings, apply on current gross
        return (gross * value) / 100;
      default:
        return 0;
    }
  }

  /**
   * Calculate tax and deductions
   */
  private async calculateDeductions(orgId: string, _userId: string, gross: number): Promise<{ tax: number; deductions: number }> {
    // Get tax rate from org settings
    const settings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId },
      select: { metadata: true },
    });

    const metadata = (settings?.metadata as any) || {};
    const taxPct = metadata.payrollTaxPct || 0;

    const tax = Math.round((gross * taxPct) / 100 * 100) / 100;

    // Apply deduction components
    const components = await this.prisma.client.payComponent.findMany({
      where: { orgId, active: true, type: 'DEDUCTION' },
    });

    let deductions = 0;
    for (const component of components) {
      const value = Number(component.value);
      if (component.calc === 'FIXED') {
        deductions += value;
      } else if (component.calc === 'PERCENT') {
        deductions += (gross * value) / 100;
      }
    }

    return { tax: Math.round(tax * 100) / 100, deductions: Math.round(deductions * 100) / 100 };
  }

  /**
   * Approve pay run (L4+)
   */
  async approveRun(payRunId: string, userId: string): Promise<any> {
    const payRun = await this.prisma.client.payRun.findUnique({
      where: { id: payRunId },
      include: { slips: true },
    });

    if (!payRun) {
      throw new NotFoundException('Pay run not found');
    }

    if (payRun.status !== 'DRAFT') {
      throw new BadRequestException(`Pay run status is ${payRun.status}, must be DRAFT`);
    }

    // Update pay run status
    const updated = await this.prisma.client.payRun.update({
      where: { id: payRunId },
      data: { status: 'APPROVED' },
      include: { slips: true },
    });

    // Mark all slips as approved
    await this.prisma.client.paySlip.updateMany({
      where: { payRunId },
      data: { approvedById: userId, approvedAt: new Date() },
    });

    this.logger.log(`Approved pay run ${payRunId} with ${updated.slips.length} slips`);

    return updated;
  }

  /**
   * E43-s2: Post payrun to GL
   * Creates journal entry: DR Payroll Expense / CR Payroll Payable (net)
   */
  async postToGL(payRunId: string, userId: string): Promise<any> {
    const payRun = await this.prisma.client.payRun.findUnique({
      where: { id: payRunId },
      include: { slips: true },
    });

    if (!payRun) {
      throw new NotFoundException('Pay run not found');
    }

    if (payRun.status !== 'APPROVED') {
      throw new BadRequestException(`Pay run status is ${payRun.status}, must be APPROVED`);
    }

    // Summarize totals
    let totalGross = 0;
    let totalTax = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    for (const slip of payRun.slips) {
      totalGross += Number(slip.gross);
      totalTax += Number(slip.tax);
      totalDeductions += Number(slip.deductions);
      totalNet += Number(slip.net);
    }

    // Get accounts
    const [expenseAccount, payableAccount] = await Promise.all([
      this.prisma.client.account.findFirst({
        where: { orgId: payRun.orgId, code: ACCOUNT_PAYROLL_EXPENSE },
      }),
      this.prisma.client.account.findFirst({
        where: { orgId: payRun.orgId, code: ACCOUNT_PAYROLL_PAYABLE },
      }),
    ]);

    if (!expenseAccount || !payableAccount) {
      throw new BadRequestException('Payroll accounts not found in chart of accounts');
    }

    // Create journal entry
    const entry = await this.prisma.client.journalEntry.create({
      data: {
        orgId: payRun.orgId,
        date: new Date(),
        memo: `Payroll ${payRun.periodStart.toISOString().split('T')[0]} to ${payRun.periodEnd.toISOString().split('T')[0]}`,
        source: 'PAYROLL',
        sourceId: payRunId,
        postedById: userId,
        lines: {
          create: [
            {
              accountId: expenseAccount.id,
              debit: totalGross,
              credit: 0,
              meta: { payRunId, type: 'expense' },
            },
            {
              accountId: payableAccount.id,
              debit: 0,
              credit: totalNet,
              meta: { payRunId, type: 'payable' },
            },
          ],
        },
      },
      include: { lines: true },
    });

    // Mark pay run as POSTED
    await this.prisma.client.payRun.update({
      where: { id: payRunId },
      data: { status: 'POSTED' },
    });

    this.logger.log(`Posted pay run ${payRunId} to GL → JE ${entry.id} (Gross: ${totalGross}, Net: ${totalNet})`);

    return { entry, totalGross, totalTax, totalDeductions, totalNet };
  }

  /**
   * Get payslips for a pay run
   */
  async getSlips(payRunId: string): Promise<any> {
    const slips = await this.prisma.client.paySlip.findMany({
      where: { payRunId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return slips;
  }

  /**
   * Upsert pay component
   */
  async upsertComponent(data: {
    id?: string;
    orgId: string;
    name: string;
    type: 'EARNING' | 'DEDUCTION';
    calc: 'FIXED' | 'RATE' | 'PERCENT';
    value: number;
    taxable?: boolean;
    active?: boolean;
  }): Promise<any> {
    if (data.id) {
      return this.prisma.client.payComponent.update({
        where: { id: data.id },
        data: {
          name: data.name,
          type: data.type,
          calc: data.calc,
          value: data.value,
          taxable: data.taxable ?? true,
          active: data.active ?? true,
        },
      });
    }

    return this.prisma.client.payComponent.create({
      data: {
        orgId: data.orgId,
        name: data.name,
        type: data.type,
        calc: data.calc,
        value: data.value,
        taxable: data.taxable ?? true,
        active: data.active ?? true,
      },
    });
  }
}
