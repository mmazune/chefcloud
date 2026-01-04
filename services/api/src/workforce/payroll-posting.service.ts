/**
 * M10.6: Payroll Posting Service
 * 
 * GL integration for payroll runs: posting, payment, and reversal.
 * Follows M8.2b lifecycle patterns.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { WorkforceAuditService, WorkforceAuditAction } from './workforce-audit.service';

const Decimal = Prisma.Decimal;

// Default account codes (should be configurable per org in production)
const ACCOUNT_LABOR_EXPENSE = '6000'; // Labor Expense
const ACCOUNT_WAGES_PAYABLE = '2105'; // Wages Payable
const ACCOUNT_CASH = '1000'; // Cash

export interface PostPayrollDto {
  runId: string;
}

export interface PayPayrollDto {
  runId: string;
  paymentMethod?: string;
  bankAccountCode?: string;
}

@Injectable()
export class PayrollPostingService {
  private readonly logger = new Logger(PayrollPostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: WorkforceAuditService,
  ) {}

  /**
   * Post payroll run to GL (Accrual entry)
   * Dr Labor Expense / Cr Wages Payable
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

    // Check fiscal period is not locked
    // Note: In production, check FiscalPeriod.status for the posting date
    // For now, we just proceed

    // Get accounts
    const accounts = await this.prisma.client.account.findMany({
      where: {
        orgId,
        code: { in: [ACCOUNT_LABOR_EXPENSE, ACCOUNT_WAGES_PAYABLE] },
      },
    });

    const laborExpenseAccount = accounts.find((a: any) => a.code === ACCOUNT_LABOR_EXPENSE);
    const wagesPayableAccount = accounts.find((a: any) => a.code === ACCOUNT_WAGES_PAYABLE);

    if (!laborExpenseAccount || !wagesPayableAccount) {
      throw new BadRequestException('Required GL accounts not configured (6000 Labor Expense, 2105 Wages Payable)');
    }

    // Calculate total payable (use paidHours as proxy, or grossAmount if available)
    const amount = run.grossAmount 
      ? new Decimal(run.grossAmount) 
      : new Decimal(run.paidHours).mul(15); // Default $15/hr if no grossAmount

    // Create journal entry
    const result = await this.prisma.client.$transaction(async (tx) => {
      // Create journal entry
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
          lines: {
            create: [
              {
                accountId: laborExpenseAccount.id,
                branchId: run.branchId,
                debit: amount,
                credit: new Decimal(0),
                meta: { payrollRunId: run.id },
              },
              {
                accountId: wagesPayableAccount.id,
                branchId: run.branchId,
                debit: new Decimal(0),
                credit: amount,
                meta: { payrollRunId: run.id },
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
      payload: { journalEntryId: result.journalEntry.id, amount: amount.toString() },
    });

    return result.run;
  }

  /**
   * Mark payroll run as paid (Payment entry)
   * Dr Wages Payable / Cr Cash/Bank
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

    // Get accounts
    const bankAccountCode = dto.bankAccountCode ?? ACCOUNT_CASH;
    const accounts = await this.prisma.client.account.findMany({
      where: {
        orgId,
        code: { in: [ACCOUNT_WAGES_PAYABLE, bankAccountCode] },
      },
    });

    const wagesPayableAccount = accounts.find((a: any) => a.code === ACCOUNT_WAGES_PAYABLE);
    const cashAccount = accounts.find((a: any) => a.code === bankAccountCode);

    if (!wagesPayableAccount || !cashAccount) {
      throw new BadRequestException(`Required GL accounts not configured (2105 Wages Payable, ${bankAccountCode})`);
    }

    // Calculate total payable
    const amount = run.grossAmount 
      ? new Decimal(run.grossAmount) 
      : new Decimal(run.paidHours).mul(15);

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
                accountId: wagesPayableAccount.id,
                branchId: run.branchId,
                debit: amount,
                credit: new Decimal(0),
                meta: { payrollRunId: run.id },
              },
              {
                accountId: cashAccount.id,
                branchId: run.branchId,
                debit: new Decimal(0),
                credit: amount,
                meta: { payrollRunId: run.id },
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
      payload: { journalEntryId: result.journalEntry.id, amount: amount.toString() },
    });

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

    return result.run;
  }
}
