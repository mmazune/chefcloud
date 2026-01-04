/**
 * M10.8: Payroll Posting Service (Full Gross-to-Net)
 * 
 * GL integration for payroll runs: posting, payment, and reversal.
 * Uses PayrollPostingMapping for configurable GL accounts.
 * Posts full breakdown: gross, taxes, pre/post-tax deductions, employer contributions.
 * 
 * GL Entry Pattern:
 * - On APPROVED → POSTED (Accrual):
 *   Dr Labor Expense (gross earnings)
 *   Dr Employer Contrib Expense (employer contributions)
 *   Cr Wages Payable (net pay = what employees get)
 *   Cr Taxes Payable (tax withholdings)
 *   Cr Deductions Payable (pre + post tax deductions)
 *   Cr Employer Contrib Payable (employer contributions)
 * 
 * - On POSTED → PAID (Payment):
 *   Dr Wages Payable (net pay)
 *   Cr Cash (net pay = actual payment to employees)
 * 
 * - On VOID (Reversal):
 *   Flip all debits ↔ credits from all linked journals
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';
import { WorkforceAuditService, WorkforceAuditAction } from './workforce-audit.service';
import { PayrollMappingService, PayrollMappingPreview } from './payroll-mapping.service';

const Decimal = Prisma.Decimal;

export interface PostPayrollDto {
  runId: string;
}

export interface PayPayrollDto {
  runId: string;
  paymentMethod?: string;
  bankAccountCode?: string;
}

/**
 * Aggregated payroll totals from payslips
 */
export interface PayrollTotals {
  grossEarnings: Prisma.Decimal;
  preTaxDeductions: Prisma.Decimal;
  taxesWithheld: Prisma.Decimal;
  postTaxDeductions: Prisma.Decimal;
  netPay: Prisma.Decimal;
  employerContribTotal: Prisma.Decimal;
  totalDeductions: Prisma.Decimal; // pre + post tax deductions
}

/**
 * GL posting preview showing how entries will be created
 */
export interface PostingPreview {
  runId: string;
  status: string;
  payPeriod: { start: string; end: string };
  totals: PayrollTotals;
  entries: Array<{
    accountCode: string;
    accountName: string;
    debit: string;
    credit: string;
  }>;
  mapping: PayrollMappingPreview;
}

@Injectable()
export class PayrollPostingService {
  private readonly logger = new Logger(PayrollPostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: WorkforceAuditService,
    private readonly mappingService: PayrollMappingService,
  ) {}

  /**
   * Get posting preview (what journal entries will be created)
   */
  async getPostingPreview(orgId: string, runId: string): Promise<PostingPreview> {
    const run = await this.prisma.client.payrollRun.findFirst({
      where: { id: runId, orgId },
      include: { payPeriod: true, payslips: true },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    const mapping = await this.mappingService.getEffectiveMapping(orgId, run.branchId);
    const totals = this.aggregatePayslipTotals(run.payslips);

    const entries: PostingPreview['entries'] = [];

    // Debit entries
    if (totals.grossEarnings.gt(0)) {
      entries.push({
        accountCode: mapping.laborExpenseAccount.code,
        accountName: mapping.laborExpenseAccount.name,
        debit: totals.grossEarnings.toString(),
        credit: '0',
      });
    }

    if (totals.employerContribTotal.gt(0)) {
      entries.push({
        accountCode: mapping.employerContribExpenseAccount.code,
        accountName: mapping.employerContribExpenseAccount.name,
        debit: totals.employerContribTotal.toString(),
        credit: '0',
      });
    }

    // Credit entries
    if (totals.netPay.gt(0)) {
      entries.push({
        accountCode: mapping.wagesPayableAccount.code,
        accountName: mapping.wagesPayableAccount.name,
        debit: '0',
        credit: totals.netPay.toString(),
      });
    }

    if (totals.taxesWithheld.gt(0)) {
      entries.push({
        accountCode: mapping.taxesPayableAccount.code,
        accountName: mapping.taxesPayableAccount.name,
        debit: '0',
        credit: totals.taxesWithheld.toString(),
      });
    }

    if (totals.totalDeductions.gt(0)) {
      entries.push({
        accountCode: mapping.deductionsPayableAccount.code,
        accountName: mapping.deductionsPayableAccount.name,
        debit: '0',
        credit: totals.totalDeductions.toString(),
      });
    }

    if (totals.employerContribTotal.gt(0)) {
      entries.push({
        accountCode: mapping.employerContribPayableAccount.code,
        accountName: mapping.employerContribPayableAccount.name,
        debit: '0',
        credit: totals.employerContribTotal.toString(),
      });
    }

    return {
      runId: run.id,
      status: run.status,
      payPeriod: {
        start: run.payPeriod.startDate.toISOString().slice(0, 10),
        end: run.payPeriod.endDate.toISOString().slice(0, 10),
      },
      totals,
      entries,
      mapping,
    };
  }

  /**
   * Post payroll run to GL (Full Accrual entry with breakdown)
   * 
   * Dr Labor Expense (gross)
   * Dr Employer Contrib Expense (employer contributions)
   * Cr Wages Payable (net pay)
   * Cr Taxes Payable (taxes withheld)
   * Cr Deductions Payable (pre + post tax deductions)
   * Cr Employer Contrib Payable (employer contributions)
   */
  async postPayrollRun(
    orgId: string,
    userId: string,
    dto: PostPayrollDto,
  ): Promise<any> {
    const run = await this.prisma.client.payrollRun.findFirst({
      where: { id: dto.runId, orgId },
      include: {
        payPeriod: true,
        journalLinks: true,
        payslips: true,
      },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    // Status check - only APPROVED can be posted
    if (run.status !== 'APPROVED') {
      throw new BadRequestException('Only APPROVED payroll runs can be posted');
    }

    // Idempotency - check if already has ACCRUAL journal
    const existingAccrual = run.journalLinks.find((l: any) => l.type === 'ACCRUAL');
    if (existingAccrual) {
      throw new BadRequestException('Payroll run already has an accrual posting');
    }

    // Validate payslips exist (M10.7 requirement)
    if (run.payslips.length === 0) {
      throw new BadRequestException('No payslips found. Generate payslips before posting.');
    }

    // Get effective mapping (validates exists and enabled)
    const mapping = await this.mappingService.getEffectiveMapping(orgId, run.branchId);

    // Aggregate totals from payslips
    const totals = this.aggregatePayslipTotals(run.payslips);

    // Validate net pay invariant: net = gross - preTax - taxes - postTax
    const expectedNet = totals.grossEarnings
      .sub(totals.preTaxDeductions)
      .sub(totals.taxesWithheld)
      .sub(totals.postTaxDeductions);
    
    if (!totals.netPay.eq(expectedNet)) {
      this.logger.warn(`Net pay invariant failed: expected=${expectedNet}, actual=${totals.netPay}`);
      // Don't throw - allow small rounding differences
    }

    // Build journal lines
    const lines: Array<{
      accountId: string;
      branchId: string | null;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
      meta: object;
    }> = [];

    // Dr Labor Expense (gross earnings)
    if (totals.grossEarnings.gt(0)) {
      lines.push({
        accountId: mapping.laborExpenseAccount.id,
        branchId: run.branchId,
        debit: totals.grossEarnings,
        credit: new Decimal(0),
        meta: { payrollRunId: run.id, component: 'GROSS_EARNINGS' },
      });
    }

    // Dr Employer Contrib Expense
    if (totals.employerContribTotal.gt(0)) {
      lines.push({
        accountId: mapping.employerContribExpenseAccount.id,
        branchId: run.branchId,
        debit: totals.employerContribTotal,
        credit: new Decimal(0),
        meta: { payrollRunId: run.id, component: 'EMPLOYER_CONTRIB_EXPENSE' },
      });
    }

    // Cr Wages Payable (net pay)
    if (totals.netPay.gt(0)) {
      lines.push({
        accountId: mapping.wagesPayableAccount.id,
        branchId: run.branchId,
        debit: new Decimal(0),
        credit: totals.netPay,
        meta: { payrollRunId: run.id, component: 'NET_PAY' },
      });
    }

    // Cr Taxes Payable
    if (totals.taxesWithheld.gt(0)) {
      lines.push({
        accountId: mapping.taxesPayableAccount.id,
        branchId: run.branchId,
        debit: new Decimal(0),
        credit: totals.taxesWithheld,
        meta: { payrollRunId: run.id, component: 'TAXES_WITHHELD' },
      });
    }

    // Cr Deductions Payable (pre + post)
    if (totals.totalDeductions.gt(0)) {
      lines.push({
        accountId: mapping.deductionsPayableAccount.id,
        branchId: run.branchId,
        debit: new Decimal(0),
        credit: totals.totalDeductions,
        meta: { payrollRunId: run.id, component: 'DEDUCTIONS' },
      });
    }

    // Cr Employer Contrib Payable
    if (totals.employerContribTotal.gt(0)) {
      lines.push({
        accountId: mapping.employerContribPayableAccount.id,
        branchId: run.branchId,
        debit: new Decimal(0),
        credit: totals.employerContribTotal,
        meta: { payrollRunId: run.id, component: 'EMPLOYER_CONTRIB_PAYABLE' },
      });
    }

    // Verify balanced: sum(debits) = sum(credits)
    const totalDebits = lines.reduce((sum, l) => sum.add(l.debit), new Decimal(0));
    const totalCredits = lines.reduce((sum, l) => sum.add(l.credit), new Decimal(0));
    
    if (!totalDebits.eq(totalCredits)) {
      throw new BadRequestException(
        `Journal entry unbalanced: debits=${totalDebits}, credits=${totalCredits}`,
      );
    }

    // Create journal entry
    const result = await this.prisma.client.$transaction(async (tx) => {
      const journalEntry = await tx.journalEntry.create({
        data: {
          orgId,
          branchId: run.branchId,
          date: new Date(),
          memo: `Payroll Accrual - Pay Period ${run.payPeriod.startDate.toISOString().slice(0, 10)} to ${run.payPeriod.endDate.toISOString().slice(0, 10)}`,
          source: 'PAYROLL',
          sourceId: run.id,
          status: 'POSTED',
          postedById: userId,
          postedAt: new Date(),
          lines: { create: lines },
        },
      });

      // Create journal link
      await tx.payrollRunJournalLink.create({
        data: {
          payrollRunId: run.id,
          journalEntryId: journalEntry.id,
          type: 'ACCRUAL',
        },
      });

      // Update payroll run status
      const updated = await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: 'POSTED',
          postedById: userId,
          postedAt: new Date(),
        },
        include: {
          payPeriod: true,
          branch: true,
          lines: { orderBy: { userId: 'asc' } },
          journalLinks: {
            include: { journalEntry: true },
          },
        },
      });

      return { run: updated, journalEntry };
    });

    // Audit log
    await this.auditService.logAction({
      orgId,
      performedById: userId,
      action: WorkforceAuditAction.PAYROLL_RUN_POSTED,
      entityType: 'PayrollRun',
      entityId: run.id,
      payload: {
        journalEntryId: result.journalEntry.id,
        grossEarnings: totals.grossEarnings.toString(),
        netPay: totals.netPay.toString(),
        taxesWithheld: totals.taxesWithheld.toString(),
        totalDeductions: totals.totalDeductions.toString(),
        employerContribTotal: totals.employerContribTotal.toString(),
      },
    });

    this.logger.log(`Posted payroll run ${run.id}: gross=${totals.grossEarnings}, net=${totals.netPay}`);

    return result.run;
  }

  /**
   * Mark payroll run as paid (Payment entry)
   * Dr Wages Payable / Cr Cash (NET PAY ONLY)
   * 
   * This pays out the net wages to employees.
   * Taxes and deductions are settled separately.
   */
  async payPayrollRun(
    orgId: string,
    userId: string,
    dto: PayPayrollDto,
  ): Promise<any> {
    const run = await this.prisma.client.payrollRun.findFirst({
      where: { id: dto.runId, orgId },
      include: {
        payPeriod: true,
        journalLinks: true,
        payslips: true,
      },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    // Status check - only POSTED can be paid
    if (run.status !== 'POSTED') {
      throw new BadRequestException('Only POSTED payroll runs can be paid');
    }

    // Idempotency - check if already has PAYMENT journal
    const existingPayment = run.journalLinks.find((l: any) => l.type === 'PAYMENT');
    if (existingPayment) {
      throw new BadRequestException('Payroll run already has a payment posting');
    }

    // Get effective mapping
    const mapping = await this.mappingService.getEffectiveMapping(orgId, run.branchId);

    // Calculate NET pay from payslips (what employees actually receive)
    const totals = this.aggregatePayslipTotals(run.payslips);
    const netPay = totals.netPay;

    if (netPay.lte(0)) {
      throw new BadRequestException('Net pay must be greater than zero');
    }

    // Create journal entry
    const result = await this.prisma.client.$transaction(async (tx) => {
      const journalEntry = await tx.journalEntry.create({
        data: {
          orgId,
          branchId: run.branchId,
          date: new Date(),
          memo: `Payroll Payment - Pay Period ${run.payPeriod.startDate.toISOString().slice(0, 10)} to ${run.payPeriod.endDate.toISOString().slice(0, 10)}`,
          source: 'PAYROLL_PAYMENT',
          sourceId: run.id,
          status: 'POSTED',
          postedById: userId,
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: mapping.wagesPayableAccount.id,
                branchId: run.branchId,
                debit: netPay,
                credit: new Decimal(0),
                meta: { payrollRunId: run.id, component: 'NET_PAY_SETTLEMENT' },
              },
              {
                accountId: mapping.cashAccount.id,
                branchId: run.branchId,
                debit: new Decimal(0),
                credit: netPay,
                meta: { payrollRunId: run.id, component: 'CASH_DISBURSEMENT' },
              },
            ],
          },
        },
      });

      // Create journal link
      await tx.payrollRunJournalLink.create({
        data: {
          payrollRunId: run.id,
          journalEntryId: journalEntry.id,
          type: 'PAYMENT',
        },
      });

      // Update payroll run status
      const updated = await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: 'PAID',
          paidById: userId,
          paidAt: new Date(),
        },
        include: {
          payPeriod: true,
          branch: true,
          lines: { orderBy: { userId: 'asc' } },
          journalLinks: {
            include: { journalEntry: true },
          },
        },
      });

      return { run: updated, journalEntry };
    });

    // Audit log
    await this.auditService.logAction({
      orgId,
      performedById: userId,
      action: WorkforceAuditAction.PAYROLL_RUN_PAID,
      entityType: 'PayrollRun',
      entityId: run.id,
      payload: { journalEntryId: result.journalEntry.id, netPay: netPay.toString() },
    });

    this.logger.log(`Paid payroll run ${run.id}: netPay=${netPay}`);

    return result.run;
  }

  /**
   * Void a payroll run (create reversal journal entries)
   */
  async voidPayrollRun(
    orgId: string,
    userId: string,
    runId: string,
  ): Promise<any> {
    const run = await this.prisma.client.payrollRun.findFirst({
      where: { id: runId, orgId },
      include: {
        payPeriod: true,
        journalLinks: {
          include: {
            journalEntry: {
              include: { lines: true },
            },
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    if (run.status !== 'POSTED' && run.status !== 'PAID') {
      throw new BadRequestException('Only POSTED or PAID payroll runs can be voided');
    }

    // Create reversal entries for all linked journals
    const result = await this.prisma.client.$transaction(async (tx) => {
      const reversalIds: string[] = [];

      for (const link of run.journalLinks) {
        const original = link.journalEntry;
        if (!original) continue;

        // Create reversal entry (flip debits and credits)
        const reversalEntry = await tx.journalEntry.create({
          data: {
            orgId,
            branchId: run.branchId,
            date: new Date(),
            memo: `REVERSAL: ${original.memo}`,
            source: 'PAYROLL_REVERSAL',
            sourceId: run.id,
            status: 'POSTED',
            postedById: userId,
            postedAt: new Date(),
            reversesEntryId: original.id,
            lines: {
              create: original.lines.map((line: any) => ({
                accountId: line.accountId,
                branchId: line.branchId,
                debit: line.credit, // Flip
                credit: line.debit, // Flip
                meta: { payrollRunId: run.id, reversal: true },
              })),
            },
          },
        });

        // Link reversal to payroll run
        await tx.payrollRunJournalLink.create({
          data: {
            payrollRunId: run.id,
            journalEntryId: reversalEntry.id,
            type: link.type === 'ACCRUAL' ? 'ACCRUAL_REVERSAL' : 'PAYMENT_REVERSAL',
          },
        });

        // Mark original as reversed
        await tx.journalEntry.update({
          where: { id: original.id },
          data: {
            status: 'REVERSED',
            reversedById: userId,
            reversedAt: new Date(),
          },
        });

        reversalIds.push(reversalEntry.id);
      }

      // Update payroll run status
      const updated = await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: 'VOID',
          voidedById: userId,
          voidedAt: new Date(),
        },
        include: {
          payPeriod: true,
          branch: true,
          journalLinks: {
            include: { journalEntry: true },
          },
        },
      });

      return { run: updated, reversalIds };
    });

    // Audit log
    await this.auditService.logAction({
      orgId,
      performedById: userId,
      action: WorkforceAuditAction.PAYROLL_RUN_VOIDED,
      entityType: 'PayrollRun',
      entityId: runId,
      payload: { reversalCount: result.reversalIds.length },
    });

    this.logger.log(`Voided payroll run ${runId}: ${result.reversalIds.length} reversals created`);

    return result.run;
  }

  /**
   * Aggregate payslip totals for GL posting.
   * All amounts use Prisma.Decimal for precision.
   */
  private aggregatePayslipTotals(payslips: any[]): PayrollTotals {
    const zero = new Decimal(0);

    if (payslips.length === 0) {
      return {
        grossEarnings: zero,
        preTaxDeductions: zero,
        taxesWithheld: zero,
        postTaxDeductions: zero,
        netPay: zero,
        employerContribTotal: zero,
        totalDeductions: zero,
      };
    }

    let grossEarnings = zero;
    let preTaxDeductions = zero;
    let taxesWithheld = zero;
    let postTaxDeductions = zero;
    let netPay = zero;
    let employerContribTotal = zero;

    for (const payslip of payslips) {
      grossEarnings = grossEarnings.add(new Decimal(payslip.grossEarnings));
      preTaxDeductions = preTaxDeductions.add(new Decimal(payslip.preTaxDeductions));
      taxesWithheld = taxesWithheld.add(new Decimal(payslip.taxesWithheld));
      postTaxDeductions = postTaxDeductions.add(new Decimal(payslip.postTaxDeductions));
      netPay = netPay.add(new Decimal(payslip.netPay));
      employerContribTotal = employerContribTotal.add(new Decimal(payslip.employerContribTotal));
    }

    return {
      grossEarnings,
      preTaxDeductions,
      taxesWithheld,
      postTaxDeductions,
      netPay,
      employerContribTotal,
      totalDeductions: preTaxDeductions.add(postTaxDeductions),
    };
  }
}
