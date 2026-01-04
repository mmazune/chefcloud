/**
 * M10.7: Payslip Service
 * 
 * Generate, read, and list payslips from payroll runs.
 * RBAC: L4+ for admin, employee can view own.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';
import { PayrollCalculationService, GrossToNetResult } from './payroll-calculation.service';

const Decimal = Prisma.Decimal;

export interface GeneratePayslipsResult {
  payslipsGenerated: number;
  payrollRunId: string;
}

@Injectable()
export class PayslipService {
  private readonly logger = new Logger(PayslipService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculationService: PayrollCalculationService,
  ) {}

  /**
   * Generate payslips for all lines in a payroll run
   * Called after payroll run is CALCULATED
   */
  async generatePayslipsForRun(
    orgId: string,
    payrollRunId: string,
  ): Promise<GeneratePayslipsResult> {
    // Get payroll run with lines and pay period
    const run = await this.prisma.client.payrollRun.findFirst({
      where: { id: payrollRunId, orgId },
      include: {
        payPeriod: true,
        lines: {
          orderBy: { userId: 'asc' },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    if (run.status !== 'CALCULATED' && run.status !== 'APPROVED') {
      throw new BadRequestException('Payroll run must be CALCULATED or APPROVED to generate payslips');
    }

    // Delete existing payslips for this run
    await this.prisma.client.payslipLineItem.deleteMany({
      where: { payslip: { payrollRunId } },
    });
    await this.prisma.client.payslip.deleteMany({
      where: { payrollRunId },
    });

    let payslipsGenerated = 0;

    for (const line of run.lines) {
      // Calculate gross-to-net for this employee
      const result = await this.calculationService.calculateGrossToNet(
        orgId,
        line.userId,
        line.paidHours.toNumber(),
        run.payPeriod.endDate,
        run.branchId ?? undefined,
        line.hourlyRate?.toNumber(),
      );

      // Create payslip
      const payslip = await this.prisma.client.payslip.create({
        data: {
          orgId,
          payrollRunId,
          payrollRunLineId: line.id,
          userId: line.userId,
          payPeriodStart: run.payPeriod.startDate,
          payPeriodEnd: run.payPeriod.endDate,
          grossEarnings: result.grossEarnings,
          preTaxDeductions: result.preTaxDeductions,
          taxableWages: result.taxableWages,
          taxesWithheld: result.taxesWithheld,
          postTaxDeductions: result.postTaxDeductions,
          netPay: result.netPay,
          employerContribTotal: result.employerContribTotal,
          totalEmployerCost: result.totalEmployerCost,
        },
      });

      // Create line items
      for (const item of result.breakdown) {
        await this.prisma.client.payslipLineItem.create({
          data: {
            payslipId: payslip.id,
            componentId: item.componentId,
            componentCode: item.componentCode,
            componentName: item.componentName,
            type: item.type,
            amount: item.amount,
          },
        });
      }

      payslipsGenerated++;
    }

    this.logger.log(`Generated ${payslipsGenerated} payslips for run ${payrollRunId}`);

    return {
      payslipsGenerated,
      payrollRunId,
    };
  }

  /**
   * List payslips for a payroll run (admin)
   */
  async listPayslipsForRun(orgId: string, payrollRunId: string): Promise<any[]> {
    return this.prisma.client.payslip.findMany({
      where: { orgId, payrollRunId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        payrollRunLine: {
          select: { regularHours: true, overtimeHours: true, paidHours: true },
        },
      },
    });
  }

  /**
   * List all payslips with filters (admin)
   */
  async listPayslips(
    orgId: string,
    options?: {
      payrollRunId?: string;
      userId?: string;
      branchId?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<any[]> {
    const where: any = { orgId };

    if (options?.payrollRunId) {
      where.payrollRunId = options.payrollRunId;
    }

    if (options?.userId) {
      where.userId = options.userId;
    }

    if (options?.startDate || options?.endDate) {
      where.payPeriodStart = {};
      if (options?.startDate) {
        where.payPeriodStart.gte = options.startDate;
      }
      if (options?.endDate) {
        where.payPeriodEnd = { lte: options.endDate };
      }
    }

    // Branch filter requires join through payroll run
    let payslips = await this.prisma.client.payslip.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        payrollRun: { select: { id: true, branchId: true, status: true } },
        payrollRunLine: {
          select: { regularHours: true, overtimeHours: true, paidHours: true },
        },
      },
    });

    // Apply branch filter if specified
    if (options?.branchId) {
      payslips = payslips.filter(p => p.payrollRun.branchId === options.branchId);
    }

    return payslips;
  }

  /**
   * Get a single payslip by ID (with line items)
   */
  async getPayslip(orgId: string, payslipId: string, requestingUserId?: string, isAdmin = false): Promise<any> {
    const payslip = await this.prisma.client.payslip.findFirst({
      where: { id: payslipId, orgId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        payrollRun: { 
          select: { id: true, branchId: true, status: true },
          include: { payPeriod: true },
        },
        payrollRunLine: {
          select: { regularHours: true, overtimeHours: true, breakHours: true, paidHours: true },
        },
        lineItems: {
          orderBy: [{ type: 'asc' }, { componentCode: 'asc' }],
        },
      },
    });

    if (!payslip) {
      throw new NotFoundException('Payslip not found');
    }

    // Check access: admin can view all, employee can view own
    if (!isAdmin && requestingUserId && payslip.userId !== requestingUserId) {
      throw new ForbiddenException('You can only view your own payslips');
    }

    return payslip;
  }

  /**
   * List payslips for the requesting employee (self-service)
   */
  async listMyPayslips(orgId: string, userId: string): Promise<any[]> {
    return this.prisma.client.payslip.findMany({
      where: { orgId, userId },
      orderBy: { payPeriodEnd: 'desc' },
      include: {
        payrollRun: { select: { id: true, status: true } },
        payrollRunLine: {
          select: { regularHours: true, overtimeHours: true, paidHours: true },
        },
      },
    });
  }

  /**
   * Get payslip summary statistics for a run
   */
  async getPayslipSummaryForRun(orgId: string, payrollRunId: string): Promise<{
    totalGross: string;
    totalNet: string;
    totalTaxes: string;
    totalEmployerCost: string;
    payslipCount: number;
  }> {
    const payslips = await this.prisma.client.payslip.findMany({
      where: { orgId, payrollRunId },
    });

    let totalGross = new Decimal(0);
    let totalNet = new Decimal(0);
    let totalTaxes = new Decimal(0);
    let totalEmployerCost = new Decimal(0);

    for (const p of payslips) {
      totalGross = totalGross.add(p.grossEarnings);
      totalNet = totalNet.add(p.netPay);
      totalTaxes = totalTaxes.add(p.taxesWithheld);
      totalEmployerCost = totalEmployerCost.add(p.totalEmployerCost);
    }

    return {
      totalGross: totalGross.toFixed(2),
      totalNet: totalNet.toFixed(2),
      totalTaxes: totalTaxes.toFixed(2),
      totalEmployerCost: totalEmployerCost.toFixed(2),
      payslipCount: payslips.length,
    };
  }
}
