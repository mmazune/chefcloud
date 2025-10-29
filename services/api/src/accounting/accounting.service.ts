/**
 * E40-s1: Accounting Service
 * 
 * Business logic for accounting operations.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create vendor
   */
  async createVendor(
    orgId: string,
    data: {
      name: string;
      email?: string;
      phone?: string;
      defaultTerms?: 'NET7' | 'NET14' | 'NET30';
      metadata?: any;
    },
  ): Promise<any> {
    return this.prisma.client.vendor.create({
      data: {
        orgId,
        ...data,
      },
    });
  }

  /**
   * Get all vendors for org
   */
  async getVendors(orgId: string): Promise<any> {
    return this.prisma.client.vendor.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create vendor bill
   */
  async createVendorBill(
    orgId: string,
    data: {
      vendorId: string;
      number?: string;
      billDate?: Date;
      dueDate: Date;
      subtotal: number;
      tax?: number;
      total: number;
      memo?: string;
    },
  ): Promise<any> {
    return this.prisma.client.vendorBill.create({
      data: {
        orgId,
        status: 'DRAFT',
        ...data,
      },
      include: {
        vendor: true,
      },
    });
  }

  /**
   * Mark vendor bill as OPEN (approved and ready for payment)
   */
  async openVendorBill(billId: string): Promise<any> {
    const bill = await this.prisma.client.vendorBill.findUnique({
      where: { id: billId },
    });

    if (!bill) {
      throw new NotFoundException(`Bill ${billId} not found`);
    }

    if (bill.status !== 'DRAFT') {
      throw new Error(`Bill ${billId} is not in DRAFT status`);
    }

    return this.prisma.client.vendorBill.update({
      where: { id: billId },
      data: { status: 'OPEN' },
    });
  }

  /**
   * Create vendor payment
   */
  async createVendorPayment(
    orgId: string,
    data: {
      vendorId: string;
      billId?: string;
      amount: number;
      paidAt?: Date;
      method: string;
      ref?: string;
      metadata?: any;
    },
  ): Promise<any> {
    const payment = await this.prisma.client.vendorPayment.create({
      data: {
        orgId,
        ...data,
      },
      include: {
        vendor: true,
        bill: true,
      },
    });

    // If payment is for a specific bill, check if bill is fully paid
    if (data.billId) {
      const bill = await this.prisma.client.vendorBill.findUnique({
        where: { id: data.billId },
        include: {
          payments: true,
        },
      });

      if (bill) {
        const totalPaid = bill.payments.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        );

        if (totalPaid >= Number(bill.total)) {
          await this.prisma.client.vendorBill.update({
            where: { id: data.billId },
            data: { status: 'PAID' },
          });
          this.logger.log(`Bill ${data.billId} marked as PAID`);
        }
      }
    }

    return payment;
  }

  /**
   * Get AP aging report
   * Buckets: 0-30, 31-60, 61-90, 90+
   */
  async getAPAging(orgId: string) {
    const openBills = await this.prisma.client.vendorBill.findMany({
      where: {
        orgId,
        status: 'OPEN',
      },
      include: {
        vendor: true,
        payments: true,
      },
    });

    const today = new Date();
    const aging = {
      current: 0, // 0-30 days
      thirtyDays: 0, // 31-60
      sixtyDays: 0, // 61-90
      ninetyPlusDays: 0, // 90+
      total: 0,
      bills: [] as any[],
    };

    for (const bill of openBills) {
      const totalPaid = bill.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const balance = Number(bill.total) - totalPaid;

      if (balance <= 0) continue;

      const daysOverdue = Math.floor(
        (today.getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      aging.bills.push({
        billId: bill.id,
        vendorName: bill.vendor.name,
        number: bill.number,
        dueDate: bill.dueDate,
        total: bill.total,
        paid: totalPaid,
        balance,
        daysOverdue,
      });

      if (daysOverdue <= 30) {
        aging.current += balance;
      } else if (daysOverdue <= 60) {
        aging.thirtyDays += balance;
      } else if (daysOverdue <= 90) {
        aging.sixtyDays += balance;
      } else {
        aging.ninetyPlusDays += balance;
      }

      aging.total += balance;
    }

    return aging;
  }

  /**
   * Get AR aging report
   * Buckets: 0-30, 31-60, 61-90, 90+
   */
  async getARAging(orgId: string) {
    const openInvoices = await this.prisma.client.customerInvoice.findMany({
      where: {
        orgId,
        status: 'OPEN',
      },
      include: {
        customer: true,
      },
    });

    const today = new Date();
    const aging = {
      current: 0,
      thirtyDays: 0,
      sixtyDays: 0,
      ninetyPlusDays: 0,
      total: 0,
      invoices: [] as any[],
    };

    for (const invoice of openInvoices) {
      const balance = Number(invoice.total);
      const daysOverdue = Math.floor(
        (today.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      aging.invoices.push({
        invoiceId: invoice.id,
        customerName: invoice.customer.name,
        number: invoice.number,
        dueDate: invoice.dueDate,
        total: invoice.total,
        balance,
        daysOverdue,
      });

      if (daysOverdue <= 30) {
        aging.current += balance;
      } else if (daysOverdue <= 60) {
        aging.thirtyDays += balance;
      } else if (daysOverdue <= 90) {
        aging.sixtyDays += balance;
      } else {
        aging.ninetyPlusDays += balance;
      }

      aging.total += balance;
    }

    return aging;
  }

  /**
   * Get trial balance as of a specific date
   */
  async getTrialBalance(orgId: string, asOf?: string) {
    const asOfDate = asOf ? new Date(asOf) : new Date();

    const accounts = await this.prisma.client.account.findMany({
      where: { orgId, isActive: true },
      orderBy: { code: 'asc' },
    });

    const balances = [];

    for (const account of accounts) {
      // Sum all journal lines for this account up to asOf date
      const lines = await this.prisma.client.journalLine.findMany({
        where: {
          accountId: account.id,
          entry: {
            orgId,
            date: { lte: asOfDate },
          },
        },
      });

      const totalDebit = lines.reduce((sum: number, l: any) => sum + Number(l.debit), 0);
      const totalCredit = lines.reduce((sum: number, l: any) => sum + Number(l.credit), 0);
      const balance = totalDebit - totalCredit;

      balances.push({
        code: account.code,
        name: account.name,
        type: account.type,
        debit: totalDebit,
        credit: totalCredit,
        balance,
      });
    }

    const totalDebits = balances.reduce((sum, b) => sum + b.debit, 0);
    const totalCredits = balances.reduce((sum, b) => sum + b.credit, 0);

    return {
      asOf: asOfDate,
      accounts: balances,
      totalDebits,
      totalCredits,
      balanced: Math.abs(totalDebits - totalCredits) < 0.01,
    };
  }

  /**
   * Get Profit & Loss statement
   */
  async getProfitAndLoss(orgId: string, from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = to ? new Date(to) : new Date();

    const accounts = await this.prisma.client.account.findMany({
      where: {
        orgId,
        isActive: true,
        type: { in: ['REVENUE', 'COGS', 'EXPENSE'] },
      },
      orderBy: { code: 'asc' },
    });

    const pnl = {
      from: fromDate,
      to: toDate,
      revenue: [] as any[],
      cogs: [] as any[],
      expenses: [] as any[],
      totalRevenue: 0,
      totalCOGS: 0,
      totalExpenses: 0,
      grossProfit: 0,
      netProfit: 0,
    };

    for (const account of accounts) {
      const lines = await this.prisma.client.journalLine.findMany({
        where: {
          accountId: account.id,
          entry: {
            orgId,
            date: { gte: fromDate, lte: toDate },
          },
        },
      });

      const totalDebit = lines.reduce((sum: number, l: any) => sum + Number(l.debit), 0);
      const totalCredit = lines.reduce((sum: number, l: any) => sum + Number(l.credit), 0);

      // For revenue: credit balance (normal)
      // For COGS/expenses: debit balance (normal)
      const balance =
        account.type === 'REVENUE' ? totalCredit - totalDebit : totalDebit - totalCredit;

      const accountData = {
        code: account.code,
        name: account.name,
        balance,
      };

      if (account.type === 'REVENUE') {
        pnl.revenue.push(accountData);
        pnl.totalRevenue += balance;
      } else if (account.type === 'COGS') {
        pnl.cogs.push(accountData);
        pnl.totalCOGS += balance;
      } else if (account.type === 'EXPENSE') {
        pnl.expenses.push(accountData);
        pnl.totalExpenses += balance;
      }
    }

    pnl.grossProfit = pnl.totalRevenue - pnl.totalCOGS;
    pnl.netProfit = pnl.grossProfit - pnl.totalExpenses;

    return pnl;
  }

  /**
   * Get Balance Sheet as of a specific date
   */
  async getBalanceSheet(orgId: string, asOf?: string) {
    const asOfDate = asOf ? new Date(asOf) : new Date();

    const accounts = await this.prisma.client.account.findMany({
      where: {
        orgId,
        isActive: true,
        type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] },
      },
      orderBy: { code: 'asc' },
    });

    const bs = {
      asOf: asOfDate,
      assets: [] as any[],
      liabilities: [] as any[],
      equity: [] as any[],
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
    };

    for (const account of accounts) {
      const lines = await this.prisma.client.journalLine.findMany({
        where: {
          accountId: account.id,
          entry: {
            orgId,
            date: { lte: asOfDate },
          },
        },
      });

      const totalDebit = lines.reduce((sum: number, l: any) => sum + Number(l.debit), 0);
      const totalCredit = lines.reduce((sum: number, l: any) => sum + Number(l.credit), 0);

      // Assets: debit balance (normal)
      // Liabilities/Equity: credit balance (normal)
      const balance =
        account.type === 'ASSET' ? totalDebit - totalCredit : totalCredit - totalDebit;

      const accountData = {
        code: account.code,
        name: account.name,
        balance,
      };

      if (account.type === 'ASSET') {
        bs.assets.push(accountData);
        bs.totalAssets += balance;
      } else if (account.type === 'LIABILITY') {
        bs.liabilities.push(accountData);
        bs.totalLiabilities += balance;
      } else if (account.type === 'EQUITY') {
        bs.equity.push(accountData);
        bs.totalEquity += balance;
      }
    }

    return bs;
  }
}
