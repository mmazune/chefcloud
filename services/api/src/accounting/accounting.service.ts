/**
 * E40-s1: Accounting Service
 * 
 * Business logic for accounting operations.
 * M8.2b: Enterprise hardening - lifecycle, period lock, exports
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
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
   * M8.3: Creates GL entry and enforces period lock
   */
  async openVendorBill(billId: string, userId: string): Promise<any> {
    const bill = await this.prisma.client.vendorBill.findUnique({
      where: { id: billId },
      include: { vendor: true },
    });

    if (!bill) {
      throw new NotFoundException(`Bill ${billId} not found`);
    }

    if (bill.status !== 'DRAFT') {
      throw new BadRequestException(`Bill ${billId} is not in DRAFT status. Current status: ${bill.status}`);
    }

    // M8.3: Check fiscal period lock
    const period = await this.prisma.client.fiscalPeriod.findFirst({
      where: {
        orgId: bill.orgId,
        startsAt: { lte: bill.billDate },
        endsAt: { gte: bill.billDate },
      },
    });

    if (period?.status === 'LOCKED') {
      throw new ForbiddenException(`Cannot open bill in locked fiscal period: ${period.name}`);
    }

    // M8.3: Find required accounts for GL entry
    const apAccount = await this.prisma.client.account.findFirst({
      where: { orgId: bill.orgId, name: { contains: 'Accounts Payable' }, type: 'LIABILITY' },
    });

    const expenseAccount = await this.prisma.client.account.findFirst({
      where: { orgId: bill.orgId, type: 'EXPENSE' },
      orderBy: { code: 'asc' },
    });

    if (!apAccount || !expenseAccount) {
      throw new BadRequestException('Required accounts (AP, Expense) not found. Please set up chart of accounts.');
    }

    // M8.3: Create POSTED journal entry in transaction
    const result = await this.prisma.client.$transaction(async (tx) => {
      // Create journal entry (auto-POSTED)
      const journalEntry = await tx.journalEntry.create({
        data: {
          orgId: bill.orgId,
          date: bill.billDate,
          memo: `Vendor Bill: ${bill.number || billId} - ${bill.vendor.name}`,
          source: 'VENDOR_BILL',
          sourceId: billId,
          status: 'POSTED',
          postedById: userId,
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: expenseAccount.id,
                debit: Number(bill.total),
                credit: 0,
              },
              {
                accountId: apAccount.id,
                debit: 0,
                credit: Number(bill.total),
              },
            ],
          },
        },
      });

      // Update bill to OPEN with journal link
      const updatedBill = await tx.vendorBill.update({
        where: { id: billId },
        data: {
          status: 'OPEN',
          journalEntryId: journalEntry.id,
          openedAt: new Date(),
          openedById: userId,
        },
        include: { vendor: true, journalEntry: true },
      });

      return updatedBill;
    });

    this.logger.log(`Opened bill ${billId} with journal entry ${result.journalEntryId}`);
    return result;
  }

  /**
   * Void a vendor bill
   * M8.3: Creates reversal GL entry
   * M8.4: Also supports PARTIALLY_PAID bills
   */
  async voidVendorBill(billId: string, userId: string): Promise<any> {
    const bill = await this.prisma.client.vendorBill.findUnique({
      where: { id: billId },
      include: { journalEntry: { include: { lines: true } } },
    });

    if (!bill) {
      throw new NotFoundException(`Bill ${billId} not found`);
    }

    // M8.4: Allow voiding OPEN, PARTIALLY_PAID, or PAID bills
    if (bill.status !== 'OPEN' && bill.status !== 'PARTIALLY_PAID' && bill.status !== 'PAID') {
      throw new BadRequestException(`Cannot void bill with status ${bill.status}. Only OPEN, PARTIALLY_PAID, or PAID bills can be voided.`);
    }

    // Check period lock
    const period = await this.prisma.client.fiscalPeriod.findFirst({
      where: {
        orgId: bill.orgId,
        startsAt: { lte: new Date() },
        endsAt: { gte: new Date() },
      },
    });

    if (period?.status === 'LOCKED') {
      throw new ForbiddenException(`Cannot void bill in locked fiscal period: ${period.name}`);
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      // Create reversal journal entry if original exists
      if (bill.journalEntry) {
        await tx.journalEntry.create({
          data: {
            orgId: bill.orgId,
            date: new Date(),
            memo: `Void Vendor Bill: ${bill.number || billId}`,
            source: 'VENDOR_BILL_VOID',
            sourceId: billId,
            status: 'POSTED',
            postedById: userId,
            postedAt: new Date(),
            reversesEntryId: bill.journalEntry.id,
            lines: {
              create: bill.journalEntry.lines.map((line) => ({
                accountId: line.accountId,
                debit: Number(line.credit), // Swap
                credit: Number(line.debit),
              })),
            },
          },
        });

        // Mark original entry as reversed
        await tx.journalEntry.update({
          where: { id: bill.journalEntry.id },
          data: {
            status: 'REVERSED',
            reversedById: userId,
            reversedAt: new Date(),
          },
        });
      }

      // Mark bill as VOID
      return tx.vendorBill.update({
        where: { id: billId },
        data: { status: 'VOID' },
        include: { vendor: true },
      });
    });

    this.logger.log(`Voided bill ${billId}`);
    return result;
  }

  /**
   * Create vendor payment
   * M8.3: Creates GL entry (Debit AP, Credit Cash/Bank)
   * M8.4: Supports partial payments, uses PaymentMethodMapping
   */
  async createVendorPayment(
    orgId: string,
    userId: string,
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
    // M8.4: Validate payment amount is positive
    if (data.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    // Validate bill if provided
    let bill: any = null;
    if (data.billId) {
      bill = await this.prisma.client.vendorBill.findUnique({
        where: { id: data.billId },
      });

      if (!bill) {
        throw new NotFoundException(`Bill ${data.billId} not found`);
      }

      // M8.4: Allow OPEN or PARTIALLY_PAID bills
      if (bill.status !== 'OPEN' && bill.status !== 'PARTIALLY_PAID') {
        throw new BadRequestException(`Bill ${data.billId} is not in OPEN or PARTIALLY_PAID status. Current status: ${bill.status}`);
      }

      // M8.4: Check outstanding amount using paidAmount field
      const outstanding = Number(bill.total) - Number(bill.paidAmount);

      if (data.amount > outstanding + 0.01) {
        throw new BadRequestException(`Payment amount ${data.amount.toFixed(2)} exceeds outstanding balance ${outstanding.toFixed(2)}`);
      }
    }

    // M8.4: Use PaymentMethodMapping to resolve cash/bank account
    const mapping = await this.prisma.client.paymentMethodMapping.findUnique({
      where: { orgId_method: { orgId, method: data.method as any } },
      include: { account: true },
    });

    let cashAccount: any;
    if (mapping) {
      cashAccount = mapping.account;
    } else {
      // Fallback to name-based search for backwards compatibility
      cashAccount = await this.prisma.client.account.findFirst({
        where: { orgId, name: { contains: 'Cash' }, type: 'ASSET' },
        orderBy: { code: 'asc' },
      });
    }

    // M8.3: Find required accounts
    const apAccount = await this.prisma.client.account.findFirst({
      where: { orgId, name: { contains: 'Accounts Payable' }, type: 'LIABILITY' },
    });

    if (!apAccount || !cashAccount) {
      throw new BadRequestException('Required accounts (AP, Cash) not found. Please set up chart of accounts.');
    }

    // Check period lock
    const paymentDate = data.paidAt || new Date();
    const period = await this.prisma.client.fiscalPeriod.findFirst({
      where: {
        orgId,
        startsAt: { lte: paymentDate },
        endsAt: { gte: paymentDate },
      },
    });

    if (period?.status === 'LOCKED') {
      throw new ForbiddenException(`Cannot create payment in locked fiscal period: ${period.name}`);
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      // Create journal entry
      const journalEntry = await tx.journalEntry.create({
        data: {
          orgId,
          date: paymentDate,
          memo: `Vendor Payment: ${data.ref || 'No ref'} - ${data.method}`,
          source: 'VENDOR_PAYMENT',
          status: 'POSTED',
          postedById: userId,
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: apAccount.id,
                debit: data.amount,
                credit: 0,
              },
              {
                accountId: cashAccount.id,
                debit: 0,
                credit: data.amount,
              },
            ],
          },
        },
      });

      // Create payment with journal link
      const payment = await tx.vendorPayment.create({
        data: {
          orgId,
          vendorId: data.vendorId,
          billId: data.billId,
          amount: data.amount,
          paidAt: paymentDate,
          method: data.method,
          ref: data.ref,
          metadata: data.metadata,
          journalEntryId: journalEntry.id,
        },
        include: {
          vendor: true,
          bill: true,
          journalEntry: true,
        },
      });

      // M8.4: If payment is for a specific bill, update paidAmount and status
      if (data.billId) {
        const currentBill = await tx.vendorBill.findUnique({
          where: { id: data.billId },
        });

        if (currentBill) {
          const newPaidAmount = Number(currentBill.paidAmount) + data.amount;
          const total = Number(currentBill.total);
          
          // Determine new status
          let newStatus: 'OPEN' | 'PARTIALLY_PAID' | 'PAID' = currentBill.status as any;
          if (newPaidAmount >= total - 0.01) {
            newStatus = 'PAID';
          } else if (newPaidAmount > 0) {
            newStatus = 'PARTIALLY_PAID';
          }

          await tx.vendorBill.update({
            where: { id: data.billId },
            data: { 
              paidAmount: newPaidAmount,
              status: newStatus,
            },
          });
          this.logger.log(`Bill ${data.billId} updated: paidAmount=${newPaidAmount.toFixed(2)}, status=${newStatus}`);
        }
      }

      return payment;
    });

    this.logger.log(`Created vendor payment ${result.id} with journal entry ${result.journalEntryId}`);
    return result;
  }

  /**
   * Get AP aging report
   * Buckets: 0-30, 31-60, 61-90, 90+
   * M8.4: Now includes PARTIALLY_PAID bills
   */
  async getAPAging(orgId: string) {
    // M8.4: Include both OPEN and PARTIALLY_PAID bills
    const openBills = await this.prisma.client.vendorBill.findMany({
      where: {
        orgId,
        status: { in: ['OPEN', 'PARTIALLY_PAID'] },
      },
      include: {
        vendor: true,
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
      // M8.4: Use paidAmount field directly
      const balance = Number(bill.total) - Number(bill.paidAmount);

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
        paid: Number(bill.paidAmount), // M8.4: Use paidAmount field
        balance,
        daysOverdue,
        status: bill.status, // M8.4: Include status
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
   * M8.4: Now includes PARTIALLY_PAID invoices
   */
  async getARAging(orgId: string) {
    // M8.4: Include both OPEN and PARTIALLY_PAID invoices
    const openInvoices = await this.prisma.client.customerInvoice.findMany({
      where: {
        orgId,
        status: { in: ['OPEN', 'PARTIALLY_PAID'] },
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
      // M8.4: Use paidAmount field for balance calculation
      const balance = Number(invoice.total) - Number(invoice.paidAmount);
      
      if (balance <= 0) continue;
      
      const daysOverdue = Math.floor(
        (today.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      aging.invoices.push({
        invoiceId: invoice.id,
        customerName: invoice.customer.name,
        number: invoice.number,
        dueDate: invoice.dueDate,
        total: invoice.total,
        paid: Number(invoice.paidAmount), // M8.4
        balance,
        daysOverdue,
        status: invoice.status, // M8.4
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

  // ===== M8.3: Customer / AR Lifecycle =====

  /**
   * Create customer account
   */
  async createCustomer(
    orgId: string,
    data: {
      name: string;
      email?: string;
      phone?: string;
      creditLimit?: number;
      metadata?: any;
    },
  ): Promise<any> {
    return this.prisma.client.customerAccount.create({
      data: {
        orgId,
        ...data,
      },
    });
  }

  /**
   * Get all customers for org
   */
  async getCustomers(orgId: string): Promise<any> {
    return this.prisma.client.customerAccount.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create customer invoice
   */
  async createCustomerInvoice(
    orgId: string,
    data: {
      customerId: string;
      number?: string;
      invoiceDate?: Date;
      dueDate: Date;
      subtotal: number;
      tax?: number;
      total: number;
      memo?: string;
    },
  ): Promise<any> {
    return this.prisma.client.customerInvoice.create({
      data: {
        orgId,
        status: 'DRAFT',
        ...data,
      },
      include: {
        customer: true,
      },
    });
  }

  /**
   * Open customer invoice (DRAFT → OPEN)
   * M8.3: Creates GL entry (Debit AR, Credit Revenue)
   */
  async openCustomerInvoice(invoiceId: string, userId: string): Promise<any> {
    const invoice = await this.prisma.client.customerInvoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException(`Invoice ${invoiceId} is not in DRAFT status. Current status: ${invoice.status}`);
    }

    // Check fiscal period lock
    const period = await this.prisma.client.fiscalPeriod.findFirst({
      where: {
        orgId: invoice.orgId,
        startsAt: { lte: invoice.invoiceDate },
        endsAt: { gte: invoice.invoiceDate },
      },
    });

    if (period?.status === 'LOCKED') {
      throw new ForbiddenException(`Cannot open invoice in locked fiscal period: ${period.name}`);
    }

    // Find required accounts
    const arAccount = await this.prisma.client.account.findFirst({
      where: { orgId: invoice.orgId, name: { contains: 'Accounts Receivable' }, type: 'ASSET' },
    });

    const revenueAccount = await this.prisma.client.account.findFirst({
      where: { orgId: invoice.orgId, type: 'REVENUE' },
      orderBy: { code: 'asc' },
    });

    if (!arAccount || !revenueAccount) {
      throw new BadRequestException('Required accounts (AR, Revenue) not found. Please set up chart of accounts.');
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      // Create journal entry (auto-POSTED)
      const journalEntry = await tx.journalEntry.create({
        data: {
          orgId: invoice.orgId,
          date: invoice.invoiceDate,
          memo: `Customer Invoice: ${invoice.number || invoiceId} - ${invoice.customer.name}`,
          source: 'CUSTOMER_INVOICE',
          sourceId: invoiceId,
          status: 'POSTED',
          postedById: userId,
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: arAccount.id,
                debit: Number(invoice.total),
                credit: 0,
              },
              {
                accountId: revenueAccount.id,
                debit: 0,
                credit: Number(invoice.total),
              },
            ],
          },
        },
      });

      // Update invoice to OPEN
      const updatedInvoice = await tx.customerInvoice.update({
        where: { id: invoiceId },
        data: {
          status: 'OPEN',
          journalEntryId: journalEntry.id,
          openedAt: new Date(),
          openedById: userId,
        },
        include: { customer: true, journalEntry: true },
      });

      return updatedInvoice;
    });

    this.logger.log(`Opened invoice ${invoiceId} with journal entry ${result.journalEntryId}`);
    return result;
  }

  /**
   * Void a customer invoice
   * M8.3: Creates reversal GL entry
   * M8.4: Also supports PARTIALLY_PAID invoices
   */
  async voidCustomerInvoice(invoiceId: string, userId: string): Promise<any> {
    const invoice = await this.prisma.client.customerInvoice.findUnique({
      where: { id: invoiceId },
      include: { journalEntry: { include: { lines: true } } },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    // M8.4: Allow voiding OPEN, PARTIALLY_PAID, or PAID invoices
    if (invoice.status !== 'OPEN' && invoice.status !== 'PARTIALLY_PAID' && invoice.status !== 'PAID') {
      throw new BadRequestException(`Cannot void invoice with status ${invoice.status}. Only OPEN, PARTIALLY_PAID, or PAID invoices can be voided.`);
    }

    // Check period lock
    const period = await this.prisma.client.fiscalPeriod.findFirst({
      where: {
        orgId: invoice.orgId,
        startsAt: { lte: new Date() },
        endsAt: { gte: new Date() },
      },
    });

    if (period?.status === 'LOCKED') {
      throw new ForbiddenException(`Cannot void invoice in locked fiscal period: ${period.name}`);
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      if (invoice.journalEntry) {
        await tx.journalEntry.create({
          data: {
            orgId: invoice.orgId,
            date: new Date(),
            memo: `Void Customer Invoice: ${invoice.number || invoiceId}`,
            source: 'CUSTOMER_INVOICE_VOID',
            sourceId: invoiceId,
            status: 'POSTED',
            postedById: userId,
            postedAt: new Date(),
            reversesEntryId: invoice.journalEntry.id,
            lines: {
              create: invoice.journalEntry.lines.map((line) => ({
                accountId: line.accountId,
                debit: Number(line.credit),
                credit: Number(line.debit),
              })),
            },
          },
        });

        await tx.journalEntry.update({
          where: { id: invoice.journalEntry.id },
          data: {
            status: 'REVERSED',
            reversedById: userId,
            reversedAt: new Date(),
          },
        });
      }

      return tx.customerInvoice.update({
        where: { id: invoiceId },
        data: { status: 'VOID' },
        include: { customer: true },
      });
    });

    this.logger.log(`Voided invoice ${invoiceId}`);
    return result;
  }

  /**
   * Create customer receipt (payment)
   * M8.3: Creates GL entry (Debit Cash, Credit AR)
   * M8.4: Supports partial payments, uses PaymentMethodMapping
   */
  async createCustomerReceipt(
    orgId: string,
    userId: string,
    data: {
      customerId: string;
      invoiceId?: string;
      amount: number;
      receivedAt?: Date;
      method: string;
      ref?: string;
      metadata?: any;
    },
  ): Promise<any> {
    // M8.4: Validate receipt amount is positive
    if (data.amount <= 0) {
      throw new BadRequestException('Receipt amount must be greater than zero');
    }

    // Validate invoice if provided
    let invoice: any = null;
    if (data.invoiceId) {
      invoice = await this.prisma.client.customerInvoice.findUnique({
        where: { id: data.invoiceId },
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice ${data.invoiceId} not found`);
      }

      // M8.4: Allow OPEN or PARTIALLY_PAID invoices
      if (invoice.status !== 'OPEN' && invoice.status !== 'PARTIALLY_PAID') {
        throw new BadRequestException(`Invoice ${data.invoiceId} is not in OPEN or PARTIALLY_PAID status. Current status: ${invoice.status}`);
      }

      // M8.4: Check outstanding amount using paidAmount field
      const outstanding = Number(invoice.total) - Number(invoice.paidAmount);

      if (data.amount > outstanding + 0.01) {
        throw new BadRequestException(`Receipt amount ${data.amount.toFixed(2)} exceeds outstanding balance ${outstanding.toFixed(2)}`);
      }
    }

    // M8.4: Use PaymentMethodMapping to resolve cash/bank account
    const mapping = await this.prisma.client.paymentMethodMapping.findUnique({
      where: { orgId_method: { orgId, method: data.method as any } },
      include: { account: true },
    });

    let cashAccount: any;
    if (mapping) {
      cashAccount = mapping.account;
    } else {
      // Fallback to name-based search for backwards compatibility
      cashAccount = await this.prisma.client.account.findFirst({
        where: { orgId, name: { contains: 'Cash' }, type: 'ASSET' },
        orderBy: { code: 'asc' },
      });
    }

    // Find required accounts
    const arAccount = await this.prisma.client.account.findFirst({
      where: { orgId, name: { contains: 'Accounts Receivable' }, type: 'ASSET' },
    });

    if (!arAccount || !cashAccount) {
      throw new BadRequestException('Required accounts (AR, Cash) not found. Please set up chart of accounts.');
    }

    const receiptDate = data.receivedAt || new Date();

    // Check period lock
    const period = await this.prisma.client.fiscalPeriod.findFirst({
      where: {
        orgId,
        startsAt: { lte: receiptDate },
        endsAt: { gte: receiptDate },
      },
    });

    if (period?.status === 'LOCKED') {
      throw new ForbiddenException(`Cannot create receipt in locked fiscal period: ${period.name}`);
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      // Create journal entry
      const journalEntry = await tx.journalEntry.create({
        data: {
          orgId,
          date: receiptDate,
          memo: `Customer Receipt: ${data.ref || 'No ref'} - ${data.method}`,
          source: 'CUSTOMER_RECEIPT',
          status: 'POSTED',
          postedById: userId,
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: cashAccount.id,
                debit: data.amount,
                credit: 0,
              },
              {
                accountId: arAccount.id,
                debit: 0,
                credit: data.amount,
              },
            ],
          },
        },
      });

      // Create receipt
      const receipt = await tx.customerReceipt.create({
        data: {
          orgId,
          customerId: data.customerId,
          invoiceId: data.invoiceId,
          amount: data.amount,
          receivedAt: receiptDate,
          method: data.method,
          ref: data.ref,
          metadata: data.metadata,
          journalEntryId: journalEntry.id,
        },
        include: {
          customer: true,
          invoice: true,
          journalEntry: true,
        },
      });

      // M8.4: If receipt is for a specific invoice, update paidAmount and status
      if (data.invoiceId) {
        const currentInvoice = await tx.customerInvoice.findUnique({
          where: { id: data.invoiceId },
        });

        if (currentInvoice) {
          const newPaidAmount = Number(currentInvoice.paidAmount) + data.amount;
          const total = Number(currentInvoice.total);
          
          // Determine new status
          let newStatus: 'OPEN' | 'PARTIALLY_PAID' | 'PAID' = currentInvoice.status as any;
          if (newPaidAmount >= total - 0.01) {
            newStatus = 'PAID';
          } else if (newPaidAmount > 0) {
            newStatus = 'PARTIALLY_PAID';
          }

          await tx.customerInvoice.update({
            where: { id: data.invoiceId },
            data: { 
              paidAmount: newPaidAmount,
              status: newStatus,
            },
          });
          this.logger.log(`Invoice ${data.invoiceId} updated: paidAmount=${newPaidAmount.toFixed(2)}, status=${newStatus}`);
        }
      }

      return receipt;
    });

    this.logger.log(`Created customer receipt ${result.id} with journal entry ${result.journalEntryId}`);
    return result;
  }

  /**
   * Get trial balance as of a specific date
   * M8.2b: Only includes POSTED entries
   */
  async getTrialBalance(orgId: string, asOf?: string, branchId?: string) {
    const asOfDate = asOf ? new Date(asOf) : new Date();

    const accounts = await this.prisma.client.account.findMany({
      where: { orgId, isActive: true },
      orderBy: { code: 'asc' },
    });

    const balances = [];

    for (const account of accounts) {
      // Sum all POSTED journal lines for this account up to asOf date
      const lines = await this.prisma.client.journalLine.findMany({
        where: {
          accountId: account.id,
          ...(branchId && { branchId }),
          entry: {
            orgId,
            status: 'POSTED', // M8.2b: Only POSTED entries
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
   * M8.2b: Only includes POSTED entries
   */
  async getProfitAndLoss(orgId: string, from?: string, to?: string, branchId?: string) {
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
          ...(branchId && { branchId }),
          entry: {
            orgId,
            status: 'POSTED', // M8.2b: Only POSTED entries
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
   * M8.2b: Only includes POSTED entries
   */
  async getBalanceSheet(orgId: string, asOf?: string, branchId?: string) {
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
          ...(branchId && { branchId }),
          entry: {
            orgId,
            status: 'POSTED', // M8.2b: Only POSTED entries
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

  // ===== M8.2: Chart of Accounts =====

  /**
   * Get chart of accounts for org
   */
  async getAccounts(
    orgId: string,
    filters: { type?: string; isActive?: boolean },
  ): Promise<any> {
    const where: any = { orgId };
    
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const accounts = await this.prisma.client.account.findMany({
      where,
      orderBy: { code: 'asc' },
    });

    return { accounts, total: accounts.length };
  }

  /**
   * Create a new account in chart of accounts
   */
  async createAccount(
    orgId: string,
    data: {
      code: string;
      name: string;
      type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'COGS' | 'EXPENSE';
      parentId?: string;
    },
  ): Promise<any> {
    // Check for duplicate code
    const existing = await this.prisma.client.account.findFirst({
      where: { orgId, code: data.code },
    });

    if (existing) {
      throw new Error(`Account code ${data.code} already exists`);
    }

    return this.prisma.client.account.create({
      data: {
        orgId,
        ...data,
        isActive: true,
      },
    });
  }

  // ===== M8.2: Journal Entries =====

  /**
   * Get journal entries with filters
   */
  async getJournalEntries(
    orgId: string,
    filters: {
      from?: Date;
      to?: Date;
      branchId?: string;
      source?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<any> {
    const where: any = { orgId };

    if (filters.from || filters.to) {
      where.date = {};
      if (filters.from) where.date.gte = filters.from;
      if (filters.to) where.date.lte = filters.to;
    }

    if (filters.branchId) {
      where.branchId = filters.branchId;
    }

    if (filters.source) {
      where.source = filters.source;
    }

    const [entries, total] = await Promise.all([
      this.prisma.client.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              account: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      this.prisma.client.journalEntry.count({ where }),
    ]);

    return { entries, total, limit: filters.limit, offset: filters.offset };
  }

  /**
   * Get single journal entry by ID
   */
  async getJournalEntry(orgId: string, id: string): Promise<any> {
    const entry = await this.prisma.client.journalEntry.findFirst({
      where: { id, orgId },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }

    return entry;
  }

  /**
   * Create manual journal entry as DRAFT
   * M8.2b: Creates as DRAFT - must be posted to affect reports
   * Validates that entry is balanced (debits == credits)
   */
  async createJournalEntry(
    orgId: string,
    userId: string,
    data: {
      date: Date;
      memo?: string;
      branchId?: string;
      lines: Array<{
        accountId: string;
        debit: number;
        credit: number;
      }>;
    },
  ): Promise<any> {
    // Validate balance
    const totalDebit = data.lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = data.lines.reduce((sum, l) => sum + l.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new BadRequestException(
        `Journal entry is not balanced. Debits: ${totalDebit}, Credits: ${totalCredit}`,
      );
    }

    // Validate accounts exist and belong to org
    const accountIds = data.lines.map((l) => l.accountId);
    const accounts = await this.prisma.client.account.findMany({
      where: { id: { in: accountIds }, orgId },
    });

    if (accounts.length !== accountIds.length) {
      throw new BadRequestException('One or more accounts not found or do not belong to this organization');
    }

    // Create journal entry as DRAFT (M8.2b: explicit lifecycle)
    const entry = await this.prisma.client.journalEntry.create({
      data: {
        orgId,
        branchId: data.branchId,
        date: data.date,
        memo: data.memo,
        source: 'MANUAL',
        status: 'DRAFT', // M8.2b: Explicit DRAFT status
        lines: {
          create: data.lines.map((line) => ({
            accountId: line.accountId,
            branchId: data.branchId,
            debit: line.debit,
            credit: line.credit,
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    this.logger.log(`Created DRAFT journal entry ${entry.id} with ${data.lines.length} lines`);

    return entry;
  }

  // ===== M8.2b: Journal Entry Lifecycle =====

  /**
   * Post a draft journal entry
   * M8.2b: Transitions DRAFT → POSTED, enforces period lock
   */
  async postJournalEntry(orgId: string, entryId: string, userId: string): Promise<any> {
    const entry = await this.prisma.client.journalEntry.findFirst({
      where: { id: entryId, orgId },
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry ${entryId} not found`);
    }

    if (entry.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot post entry with status ${entry.status}. Only DRAFT entries can be posted.`);
    }

    // Check fiscal period lock
    const period = await this.prisma.client.fiscalPeriod.findFirst({
      where: {
        orgId,
        startsAt: { lte: entry.date },
        endsAt: { gte: entry.date },
      },
    });

    if (period?.status === 'LOCKED') {
      throw new ForbiddenException(`Cannot post to locked fiscal period: ${period.name}`);
    }

    const updated = await this.prisma.client.journalEntry.update({
      where: { id: entryId },
      data: {
        status: 'POSTED',
        postedById: userId,
        postedAt: new Date(),
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    this.logger.log(`Posted journal entry ${entryId}`);
    return updated;
  }

  /**
   * Reverse a posted journal entry
   * M8.2b: Creates opposite entry, marks original as REVERSED
   */
  async reverseJournalEntry(
    orgId: string,
    entryId: string,
    userId: string,
    reversalDate?: Date,
  ): Promise<any> {
    const entry = await this.prisma.client.journalEntry.findFirst({
      where: { id: entryId, orgId },
      include: { lines: true },
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry ${entryId} not found`);
    }

    if (entry.status !== 'POSTED') {
      throw new BadRequestException(`Cannot reverse entry with status ${entry.status}. Only POSTED entries can be reversed.`);
    }

    const revDate = reversalDate || new Date();

    // Check fiscal period lock for reversal date
    const period = await this.prisma.client.fiscalPeriod.findFirst({
      where: {
        orgId,
        startsAt: { lte: revDate },
        endsAt: { gte: revDate },
      },
    });

    if (period?.status === 'LOCKED') {
      throw new ForbiddenException(`Cannot reverse in locked fiscal period: ${period.name}`);
    }

    // Create reversal entry with opposite debits/credits
    const reversalEntry = await this.prisma.client.journalEntry.create({
      data: {
        orgId,
        branchId: entry.branchId,
        date: revDate,
        memo: `Reversal of: ${entry.memo || entry.id}`,
        source: 'REVERSAL',
        sourceId: entry.id,
        status: 'POSTED',
        postedById: userId,
        postedAt: new Date(),
        reversesEntryId: entry.id,
        lines: {
          create: entry.lines.map((line) => ({
            accountId: line.accountId,
            branchId: line.branchId,
            debit: Number(line.credit), // Swap debit/credit
            credit: Number(line.debit),
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    // Mark original as REVERSED
    await this.prisma.client.journalEntry.update({
      where: { id: entryId },
      data: {
        status: 'REVERSED',
        reversedById: userId,
        reversedAt: new Date(),
      },
    });

    this.logger.log(`Reversed journal entry ${entryId} with new entry ${reversalEntry.id}`);
    return reversalEntry;
  }

  // ===== M8.2b: CSV Exports =====

  /**
   * Export chart of accounts to CSV
   */
  async exportAccountsCSV(orgId: string): Promise<string> {
    const accounts = await this.prisma.client.account.findMany({
      where: { orgId },
      orderBy: { code: 'asc' },
    });

    const headers = ['Code', 'Name', 'Type', 'Active', 'Parent ID'];
    const rows = accounts.map((a) => [
      a.code,
      `"${a.name.replace(/"/g, '""')}"`,
      a.type,
      a.isActive ? 'Yes' : 'No',
      a.parentId || '',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Export journal entries to CSV
   */
  async exportJournalCSV(orgId: string, from?: Date, to?: Date): Promise<string> {
    const where: any = { orgId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }

    const entries = await this.prisma.client.journalEntry.findMany({
      where,
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    const headers = ['Entry ID', 'Date', 'Status', 'Memo', 'Account Code', 'Account Name', 'Debit', 'Credit'];
    const rows: string[][] = [];

    for (const entry of entries) {
      for (const line of entry.lines) {
        rows.push([
          entry.id,
          entry.date.toISOString().split('T')[0],
          entry.status,
          `"${(entry.memo || '').replace(/"/g, '""')}"`,
          line.account.code,
          `"${line.account.name.replace(/"/g, '""')}"`,
          Number(line.debit).toFixed(2),
          Number(line.credit).toFixed(2),
        ]);
      }
    }

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Export trial balance to CSV
   */
  async exportTrialBalanceCSV(orgId: string, asOf?: string): Promise<string> {
    const tb = await this.getTrialBalance(orgId, asOf);

    const headers = ['Code', 'Name', 'Type', 'Debit', 'Credit', 'Balance'];
    const rows = tb.accounts.map((a: any) => [
      a.code,
      `"${a.name.replace(/"/g, '""')}"`,
      a.type,
      a.debit.toFixed(2),
      a.credit.toFixed(2),
      a.balance.toFixed(2),
    ]);

    // Add totals row
    rows.push([
      '',
      'TOTALS',
      '',
      tb.totalDebits.toFixed(2),
      tb.totalCredits.toFixed(2),
      (tb.totalDebits - tb.totalCredits).toFixed(2),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  // ===== M8.4: Payment Method Mapping =====

  /**
   * Get all payment method mappings for org
   */
  async getPaymentMethodMappings(orgId: string): Promise<any[]> {
    return this.prisma.client.paymentMethodMapping.findMany({
      where: { orgId },
      include: { account: true },
      orderBy: { method: 'asc' },
    });
  }

  /**
   * Create or update payment method mapping
   */
  async upsertPaymentMethodMapping(
    orgId: string,
    data: {
      method: 'CASH' | 'CARD' | 'MOMO' | 'BANK_TRANSFER';
      accountId: string;
    },
  ): Promise<any> {
    // Validate account exists and belongs to org
    const account = await this.prisma.client.account.findFirst({
      where: { id: data.accountId, orgId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${data.accountId} not found in org`);
    }

    // Validate account is an asset type (for cash/bank accounts)
    if (account.type !== 'ASSET') {
      throw new BadRequestException(`Payment method accounts should be ASSET type. Got: ${account.type}`);
    }

    return this.prisma.client.paymentMethodMapping.upsert({
      where: { orgId_method: { orgId, method: data.method } },
      update: { accountId: data.accountId },
      create: { orgId, method: data.method, accountId: data.accountId },
      include: { account: true },
    });
  }

  /**
   * Delete payment method mapping
   */
  async deletePaymentMethodMapping(orgId: string, method: string): Promise<any> {
    return this.prisma.client.paymentMethodMapping.delete({
      where: { orgId_method: { orgId, method: method as any } },
    });
  }

  // ===== M8.4: Outstanding Balance Helpers =====

  /**
   * Get outstanding balance for a vendor bill
   */
  async getVendorBillOutstanding(billId: string): Promise<{ total: number; paid: number; outstanding: number; status: string }> {
    const bill = await this.prisma.client.vendorBill.findUnique({
      where: { id: billId },
    });

    if (!bill) {
      throw new NotFoundException(`Bill ${billId} not found`);
    }

    const total = Number(bill.total);
    const paid = Number(bill.paidAmount);
    const outstanding = total - paid;

    return { total, paid, outstanding, status: bill.status };
  }

  /**
   * Get outstanding balance for a customer invoice
   */
  async getCustomerInvoiceOutstanding(invoiceId: string): Promise<{ total: number; paid: number; outstanding: number; status: string }> {
    const invoice = await this.prisma.client.customerInvoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    const total = Number(invoice.total);
    const paid = Number(invoice.paidAmount);
    const outstanding = total - paid;

    return { total, paid, outstanding, status: invoice.status };
  }

  // ===== M8.5: Customer Credit Notes =====

  /**
   * Create a customer credit note (DRAFT)
   */
  async createCustomerCreditNote(
    orgId: string,
    data: {
      customerId: string;
      number?: string;
      creditDate?: Date;
      amount: number;
      reason?: string;
      memo?: string;
    },
  ): Promise<any> {
    if (data.amount <= 0) {
      throw new BadRequestException('Credit note amount must be greater than zero');
    }

    const customer = await this.prisma.client.customerAccount.findUnique({
      where: { id: data.customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${data.customerId} not found`);
    }

    return this.prisma.client.customerCreditNote.create({
      data: {
        orgId,
        customerId: data.customerId,
        number: data.number,
        creditDate: data.creditDate || new Date(),
        amount: data.amount,
        reason: data.reason,
        memo: data.memo,
        status: 'DRAFT',
      },
      include: { customer: true },
    });
  }

  /**
   * Get customer credit notes for org
   */
  async getCustomerCreditNotes(orgId: string, status?: string): Promise<any[]> {
    return this.prisma.client.customerCreditNote.findMany({
      where: {
        orgId,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        customer: true,
        allocations: { include: { invoice: true } },
        refunds: true,
      },
      orderBy: { creditDate: 'desc' },
    });
  }

  /**
   * Get single customer credit note by ID
   */
  async getCustomerCreditNote(creditNoteId: string): Promise<any> {
    const creditNote = await this.prisma.client.customerCreditNote.findUnique({
      where: { id: creditNoteId },
      include: {
        customer: true,
        allocations: { include: { invoice: true } },
        refunds: true,
        journalEntry: { include: { lines: true } },
      },
    });

    if (!creditNote) {
      throw new NotFoundException(`Credit note ${creditNoteId} not found`);
    }

    return creditNote;
  }

  /**
   * Open customer credit note (DRAFT → OPEN)
   * Creates GL entry: Dr Revenue/Adjustment, Cr AR
   */
  async openCustomerCreditNote(creditNoteId: string, userId: string): Promise<any> {
    const creditNote = await this.prisma.client.customerCreditNote.findUnique({
      where: { id: creditNoteId },
      include: { customer: true },
    });

    if (!creditNote) {
      throw new NotFoundException(`Credit note ${creditNoteId} not found`);
    }

    if (creditNote.status !== 'DRAFT') {
      throw new BadRequestException(`Credit note is not in DRAFT status. Current: ${creditNote.status}`);
    }

    // Check period lock
    const period = await this.prisma.client.fiscalPeriod.findFirst({
      where: {
        orgId: creditNote.orgId,
        startsAt: { lte: creditNote.creditDate },
        endsAt: { gte: creditNote.creditDate },
      },
    });

    if (period?.status === 'LOCKED') {
      throw new ForbiddenException(`Cannot open credit note in locked fiscal period: ${period.name}`);
    }

    // Find required accounts
    const arAccount = await this.prisma.client.account.findFirst({
      where: { orgId: creditNote.orgId, name: { contains: 'Accounts Receivable' }, type: 'ASSET' },
    });

    const revenueAccount = await this.prisma.client.account.findFirst({
      where: { orgId: creditNote.orgId, type: 'REVENUE' },
      orderBy: { code: 'asc' },
    });

    if (!arAccount || !revenueAccount) {
      throw new BadRequestException('Required accounts (AR, Revenue) not found');
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      // Create journal entry: Dr Revenue, Cr AR (reducing AR)
      const journalEntry = await tx.journalEntry.create({
        data: {
          orgId: creditNote.orgId,
          date: creditNote.creditDate,
          memo: `Customer Credit Note: ${creditNote.number || creditNoteId} - ${creditNote.customer.name}`,
          source: 'CUSTOMER_CREDIT_NOTE',
          sourceId: creditNoteId,
          status: 'POSTED',
          postedById: userId,
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: revenueAccount.id,
                debit: Number(creditNote.amount),
                credit: 0,
              },
              {
                accountId: arAccount.id,
                debit: 0,
                credit: Number(creditNote.amount),
              },
            ],
          },
        },
      });

      return tx.customerCreditNote.update({
        where: { id: creditNoteId },
        data: {
          status: 'OPEN',
          journalEntryId: journalEntry.id,
          openedAt: new Date(),
          openedById: userId,
        },
        include: { customer: true, journalEntry: true },
      });
    });

    this.logger.log(`Opened customer credit note ${creditNoteId}`);
    return result;
  }

  /**
   * Void customer credit note
   * Creates reversal GL entry
   */
  async voidCustomerCreditNote(creditNoteId: string, userId: string): Promise<any> {
    const creditNote = await this.prisma.client.customerCreditNote.findUnique({
      where: { id: creditNoteId },
      include: {
        allocations: true,
        refunds: true,
        journalEntry: { include: { lines: true } },
      },
    });

    if (!creditNote) {
      throw new NotFoundException(`Credit note ${creditNoteId} not found`);
    }

    if (creditNote.status !== 'OPEN' && creditNote.status !== 'PARTIALLY_APPLIED') {
      throw new BadRequestException(`Cannot void credit note with status ${creditNote.status}`);
    }

    if (creditNote.allocations.length > 0) {
      throw new BadRequestException('Cannot void credit note with existing allocations. Delete allocations first.');
    }

    if (creditNote.refunds.length > 0) {
      throw new BadRequestException('Cannot void credit note with existing refunds. Delete refunds first.');
    }

    // Check period lock
    const period = await this.prisma.client.fiscalPeriod.findFirst({
      where: {
        orgId: creditNote.orgId,
        startsAt: { lte: new Date() },
        endsAt: { gte: new Date() },
      },
    });

    if (period?.status === 'LOCKED') {
      throw new ForbiddenException(`Cannot void in locked fiscal period: ${period.name}`);
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      if (creditNote.journalEntry) {
        // Create reversal entry
        await tx.journalEntry.create({
          data: {
            orgId: creditNote.orgId,
            date: new Date(),
            memo: `Void Customer Credit Note: ${creditNote.number || creditNoteId}`,
            source: 'CUSTOMER_CREDIT_NOTE_VOID',
            sourceId: creditNoteId,
            status: 'POSTED',
            postedById: userId,
            postedAt: new Date(),
            reversesEntryId: creditNote.journalEntry.id,
            lines: {
              create: creditNote.journalEntry.lines.map((line) => ({
                accountId: line.accountId,
                debit: Number(line.credit),
                credit: Number(line.debit),
              })),
            },
          },
        });

        await tx.journalEntry.update({
          where: { id: creditNote.journalEntry.id },
          data: {
            status: 'REVERSED',
            reversedById: userId,
            reversedAt: new Date(),
          },
        });
      }

      return tx.customerCreditNote.update({
        where: { id: creditNoteId },
        data: { status: 'VOID' },
        include: { customer: true },
      });
    });

    this.logger.log(`Voided customer credit note ${creditNoteId}`);
    return result;
  }

  /**
   * Allocate customer credit to invoice(s)
   */
  async allocateCustomerCredit(
    creditNoteId: string,
    userId: string,
    allocations: Array<{ invoiceId: string; amount: number }>,
  ): Promise<any> {
    const creditNote = await this.prisma.client.customerCreditNote.findUnique({
      where: { id: creditNoteId },
    });

    if (!creditNote) {
      throw new NotFoundException(`Credit note ${creditNoteId} not found`);
    }

    if (creditNote.status !== 'OPEN' && creditNote.status !== 'PARTIALLY_APPLIED') {
      throw new BadRequestException(`Credit note is not allocatable. Status: ${creditNote.status}`);
    }

    const creditsRemaining = Number(creditNote.amount) - Number(creditNote.allocatedAmount) - Number(creditNote.refundedAmount);
    const totalToAllocate = allocations.reduce((sum, a) => sum + a.amount, 0);

    if (totalToAllocate > creditsRemaining + 0.01) {
      throw new BadRequestException(`Cannot allocate ${totalToAllocate.toFixed(2)}. Only ${creditsRemaining.toFixed(2)} remaining.`);
    }

    // Validate each invoice
    for (const alloc of allocations) {
      if (alloc.amount <= 0) {
        throw new BadRequestException('Allocation amount must be greater than zero');
      }

      const invoice = await this.prisma.client.customerInvoice.findUnique({
        where: { id: alloc.invoiceId },
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice ${alloc.invoiceId} not found`);
      }

      if (invoice.status !== 'OPEN' && invoice.status !== 'PARTIALLY_PAID') {
        throw new BadRequestException(`Invoice ${alloc.invoiceId} is not in OPEN or PARTIALLY_PAID status`);
      }

      const outstanding = Number(invoice.total) - Number(invoice.paidAmount);
      if (alloc.amount > outstanding + 0.01) {
        throw new BadRequestException(`Allocation ${alloc.amount.toFixed(2)} exceeds invoice outstanding ${outstanding.toFixed(2)}`);
      }
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      const createdAllocations = [];

      for (const alloc of allocations) {
        // Create allocation record
        const allocation = await tx.customerCreditNoteAllocation.create({
          data: {
            creditNoteId,
            invoiceId: alloc.invoiceId,
            amount: alloc.amount,
            appliedById: userId,
          },
          include: { invoice: true },
        });
        createdAllocations.push(allocation);

        // Update invoice paidAmount
        const invoice = await tx.customerInvoice.findUnique({ where: { id: alloc.invoiceId } });
        if (invoice) {
          const newPaidAmount = Number(invoice.paidAmount) + alloc.amount;
          const total = Number(invoice.total);
          let newStatus = invoice.status;

          if (newPaidAmount >= total - 0.01) {
            newStatus = 'PAID';
          } else if (newPaidAmount > 0) {
            newStatus = 'PARTIALLY_PAID';
          }

          await tx.customerInvoice.update({
            where: { id: alloc.invoiceId },
            data: { paidAmount: newPaidAmount, status: newStatus },
          });
        }
      }

      // Update credit note allocatedAmount and status
      const newAllocatedAmount = Number(creditNote.allocatedAmount) + totalToAllocate;
      const totalUsed = newAllocatedAmount + Number(creditNote.refundedAmount);
      let newStatus: 'OPEN' | 'PARTIALLY_APPLIED' | 'APPLIED' = 'OPEN';

      if (totalUsed >= Number(creditNote.amount) - 0.01) {
        newStatus = 'APPLIED';
      } else if (totalUsed > 0) {
        newStatus = 'PARTIALLY_APPLIED';
      }

      const updatedCreditNote = await tx.customerCreditNote.update({
        where: { id: creditNoteId },
        data: { allocatedAmount: newAllocatedAmount, status: newStatus },
        include: { customer: true, allocations: true },
      });

      return { creditNote: updatedCreditNote, allocations: createdAllocations };
    });

    this.logger.log(`Allocated ${totalToAllocate} from credit note ${creditNoteId}`);
    return result;
  }

  /**
   * Delete customer credit allocation
   */
  async deleteCustomerCreditAllocation(allocationId: string, userId: string): Promise<void> {
    const allocation = await this.prisma.client.customerCreditNoteAllocation.findUnique({
      where: { id: allocationId },
      include: { creditNote: true, invoice: true },
    });

    if (!allocation) {
      throw new NotFoundException(`Allocation ${allocationId} not found`);
    }

    await this.prisma.client.$transaction(async (tx) => {
      // Reverse invoice paidAmount
      const invoice = allocation.invoice;
      const newPaidAmount = Math.max(0, Number(invoice.paidAmount) - Number(allocation.amount));
      const total = Number(invoice.total);
      let newInvoiceStatus = invoice.status;

      if (newPaidAmount <= 0.01) {
        newInvoiceStatus = 'OPEN';
      } else if (newPaidAmount < total - 0.01) {
        newInvoiceStatus = 'PARTIALLY_PAID';
      }

      await tx.customerInvoice.update({
        where: { id: invoice.id },
        data: { paidAmount: newPaidAmount, status: newInvoiceStatus },
      });

      // Reverse credit note allocatedAmount
      const creditNote = allocation.creditNote;
      const newAllocatedAmount = Math.max(0, Number(creditNote.allocatedAmount) - Number(allocation.amount));
      const totalUsed = newAllocatedAmount + Number(creditNote.refundedAmount);
      let newCreditNoteStatus: 'OPEN' | 'PARTIALLY_APPLIED' | 'APPLIED' = 'APPLIED';

      if (totalUsed <= 0.01) {
        newCreditNoteStatus = 'OPEN';
      } else if (totalUsed < Number(creditNote.amount) - 0.01) {
        newCreditNoteStatus = 'PARTIALLY_APPLIED';
      }

      await tx.customerCreditNote.update({
        where: { id: creditNote.id },
        data: { allocatedAmount: newAllocatedAmount, status: newCreditNoteStatus },
      });

      // Delete the allocation
      await tx.customerCreditNoteAllocation.delete({ where: { id: allocationId } });
    });

    this.logger.log(`Deleted credit allocation ${allocationId}`);
  }

  /**
   * Create customer credit refund (cash back to customer)
   * GL: Dr AR, Cr Cash/Bank
   */
  async createCustomerCreditRefund(
    creditNoteId: string,
    userId: string,
    data: {
      amount: number;
      refundDate?: Date;
      method: string;
      ref?: string;
      memo?: string;
    },
  ): Promise<any> {
    if (data.amount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }

    const creditNote = await this.prisma.client.customerCreditNote.findUnique({
      where: { id: creditNoteId },
      include: { customer: true },
    });

    if (!creditNote) {
      throw new NotFoundException(`Credit note ${creditNoteId} not found`);
    }

    if (creditNote.status !== 'OPEN' && creditNote.status !== 'PARTIALLY_APPLIED') {
      throw new BadRequestException(`Cannot refund credit note with status ${creditNote.status}`);
    }

    const creditsRemaining = Number(creditNote.amount) - Number(creditNote.allocatedAmount) - Number(creditNote.refundedAmount);
    if (data.amount > creditsRemaining + 0.01) {
      throw new BadRequestException(`Refund amount ${data.amount.toFixed(2)} exceeds remaining ${creditsRemaining.toFixed(2)}`);
    }

    // Check period lock
    const refundDate = data.refundDate || new Date();
    const period = await this.prisma.client.fiscalPeriod.findFirst({
      where: {
        orgId: creditNote.orgId,
        startsAt: { lte: refundDate },
        endsAt: { gte: refundDate },
      },
    });

    if (period?.status === 'LOCKED') {
      throw new ForbiddenException(`Cannot create refund in locked fiscal period: ${period.name}`);
    }

    // Find accounts
    const arAccount = await this.prisma.client.account.findFirst({
      where: { orgId: creditNote.orgId, name: { contains: 'Accounts Receivable' }, type: 'ASSET' },
    });

    // Use PaymentMethodMapping or fallback
    const mapping = await this.prisma.client.paymentMethodMapping.findUnique({
      where: { orgId_method: { orgId: creditNote.orgId, method: data.method as any } },
      include: { account: true },
    });

    let cashAccount: any;
    if (mapping) {
      cashAccount = mapping.account;
    } else {
      cashAccount = await this.prisma.client.account.findFirst({
        where: { orgId: creditNote.orgId, name: { contains: 'Cash' }, type: 'ASSET' },
      });
    }

    if (!arAccount || !cashAccount) {
      throw new BadRequestException('Required accounts (AR, Cash) not found');
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      // Create journal entry: Dr AR (restoring), Cr Cash (paying out)
      const journalEntry = await tx.journalEntry.create({
        data: {
          orgId: creditNote.orgId,
          date: refundDate,
          memo: `Customer Credit Refund: ${creditNote.number || creditNoteId} - ${data.ref || 'No ref'}`,
          source: 'CUSTOMER_CREDIT_REFUND',
          sourceId: creditNoteId,
          status: 'POSTED',
          postedById: userId,
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: arAccount.id,
                debit: data.amount,
                credit: 0,
              },
              {
                accountId: cashAccount.id,
                debit: 0,
                credit: data.amount,
              },
            ],
          },
        },
      });

      // Create refund record
      const refund = await tx.customerCreditNoteRefund.create({
        data: {
          creditNoteId,
          amount: data.amount,
          refundDate,
          method: data.method,
          ref: data.ref,
          memo: data.memo,
          journalEntryId: journalEntry.id,
        },
        include: { journalEntry: true },
      });

      // Update credit note refundedAmount and status
      const newRefundedAmount = Number(creditNote.refundedAmount) + data.amount;
      const totalUsed = Number(creditNote.allocatedAmount) + newRefundedAmount;
      let newStatus: 'OPEN' | 'PARTIALLY_APPLIED' | 'APPLIED' = 'OPEN';

      if (totalUsed >= Number(creditNote.amount) - 0.01) {
        newStatus = 'APPLIED';
      } else if (totalUsed > 0) {
        newStatus = 'PARTIALLY_APPLIED';
      }

      await tx.customerCreditNote.update({
        where: { id: creditNoteId },
        data: { refundedAmount: newRefundedAmount, status: newStatus },
      });

      return refund;
    });

    this.logger.log(`Created customer credit refund for ${creditNoteId}`);
    return result;
  }

  // ===== M8.5: Vendor Credit Notes =====

  /**
   * Create a vendor credit note (DRAFT)
   */
  async createVendorCreditNote(
    orgId: string,
    data: {
      vendorId: string;
      number?: string;
      creditDate?: Date;
      amount: number;
      reason?: string;
      memo?: string;
    },
  ): Promise<any> {
    if (data.amount <= 0) {
      throw new BadRequestException('Credit note amount must be greater than zero');
    }

    const vendor = await this.prisma.client.vendor.findUnique({
      where: { id: data.vendorId },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor ${data.vendorId} not found`);
    }

    return this.prisma.client.vendorCreditNote.create({
      data: {
        orgId,
        vendorId: data.vendorId,
        number: data.number,
        creditDate: data.creditDate || new Date(),
        amount: data.amount,
        reason: data.reason,
        memo: data.memo,
        status: 'DRAFT',
      },
      include: { vendor: true },
    });
  }

  /**
   * Get vendor credit notes for org
   */
  async getVendorCreditNotes(orgId: string, status?: string): Promise<any[]> {
    return this.prisma.client.vendorCreditNote.findMany({
      where: {
        orgId,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        vendor: true,
        allocations: { include: { bill: true } },
        refunds: true,
      },
      orderBy: { creditDate: 'desc' },
    });
  }

  /**
   * Get single vendor credit note by ID
   */
  async getVendorCreditNote(creditNoteId: string): Promise<any> {
    const creditNote = await this.prisma.client.vendorCreditNote.findUnique({
      where: { id: creditNoteId },
      include: {
        vendor: true,
        allocations: { include: { bill: true } },
        refunds: true,
        journalEntry: { include: { lines: true } },
      },
    });

    if (!creditNote) {
      throw new NotFoundException(`Credit note ${creditNoteId} not found`);
    }

    return creditNote;
  }

  /**
   * Open vendor credit note (DRAFT → OPEN)
   * Creates GL entry: Dr AP, Cr Expense/Adjustment
   */
  async openVendorCreditNote(creditNoteId: string, userId: string): Promise<any> {
    const creditNote = await this.prisma.client.vendorCreditNote.findUnique({
      where: { id: creditNoteId },
      include: { vendor: true },
    });

    if (!creditNote) {
      throw new NotFoundException(`Credit note ${creditNoteId} not found`);
    }

    if (creditNote.status !== 'DRAFT') {
      throw new BadRequestException(`Credit note is not in DRAFT status. Current: ${creditNote.status}`);
    }

    // Check period lock
    const period = await this.prisma.client.fiscalPeriod.findFirst({
      where: {
        orgId: creditNote.orgId,
        startsAt: { lte: creditNote.creditDate },
        endsAt: { gte: creditNote.creditDate },
      },
    });

    if (period?.status === 'LOCKED') {
      throw new ForbiddenException(`Cannot open credit note in locked fiscal period: ${period.name}`);
    }

    // Find required accounts
    const apAccount = await this.prisma.client.account.findFirst({
      where: { orgId: creditNote.orgId, name: { contains: 'Accounts Payable' }, type: 'LIABILITY' },
    });

    const expenseAccount = await this.prisma.client.account.findFirst({
      where: { orgId: creditNote.orgId, type: 'EXPENSE' },
      orderBy: { code: 'asc' },
    });

    if (!apAccount || !expenseAccount) {
      throw new BadRequestException('Required accounts (AP, Expense) not found');
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      // Create journal entry: Dr AP (reducing), Cr Expense (reducing)
      const journalEntry = await tx.journalEntry.create({
        data: {
          orgId: creditNote.orgId,
          date: creditNote.creditDate,
          memo: `Vendor Credit Note: ${creditNote.number || creditNoteId} - ${creditNote.vendor.name}`,
          source: 'VENDOR_CREDIT_NOTE',
          sourceId: creditNoteId,
          status: 'POSTED',
          postedById: userId,
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: apAccount.id,
                debit: Number(creditNote.amount),
                credit: 0,
              },
              {
                accountId: expenseAccount.id,
                debit: 0,
                credit: Number(creditNote.amount),
              },
            ],
          },
        },
      });

      return tx.vendorCreditNote.update({
        where: { id: creditNoteId },
        data: {
          status: 'OPEN',
          journalEntryId: journalEntry.id,
          openedAt: new Date(),
          openedById: userId,
        },
        include: { vendor: true, journalEntry: true },
      });
    });

    this.logger.log(`Opened vendor credit note ${creditNoteId}`);
    return result;
  }

  /**
   * Void vendor credit note
   */
  async voidVendorCreditNote(creditNoteId: string, userId: string): Promise<any> {
    const creditNote = await this.prisma.client.vendorCreditNote.findUnique({
      where: { id: creditNoteId },
      include: {
        allocations: true,
        refunds: true,
        journalEntry: { include: { lines: true } },
      },
    });

    if (!creditNote) {
      throw new NotFoundException(`Credit note ${creditNoteId} not found`);
    }

    if (creditNote.status !== 'OPEN' && creditNote.status !== 'PARTIALLY_APPLIED') {
      throw new BadRequestException(`Cannot void credit note with status ${creditNote.status}`);
    }

    if (creditNote.allocations.length > 0) {
      throw new BadRequestException('Cannot void credit note with existing allocations');
    }

    if (creditNote.refunds.length > 0) {
      throw new BadRequestException('Cannot void credit note with existing refunds');
    }

    const period = await this.prisma.client.fiscalPeriod.findFirst({
      where: {
        orgId: creditNote.orgId,
        startsAt: { lte: new Date() },
        endsAt: { gte: new Date() },
      },
    });

    if (period?.status === 'LOCKED') {
      throw new ForbiddenException(`Cannot void in locked fiscal period: ${period.name}`);
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      if (creditNote.journalEntry) {
        await tx.journalEntry.create({
          data: {
            orgId: creditNote.orgId,
            date: new Date(),
            memo: `Void Vendor Credit Note: ${creditNote.number || creditNoteId}`,
            source: 'VENDOR_CREDIT_NOTE_VOID',
            sourceId: creditNoteId,
            status: 'POSTED',
            postedById: userId,
            postedAt: new Date(),
            reversesEntryId: creditNote.journalEntry.id,
            lines: {
              create: creditNote.journalEntry.lines.map((line) => ({
                accountId: line.accountId,
                debit: Number(line.credit),
                credit: Number(line.debit),
              })),
            },
          },
        });

        await tx.journalEntry.update({
          where: { id: creditNote.journalEntry.id },
          data: {
            status: 'REVERSED',
            reversedById: userId,
            reversedAt: new Date(),
          },
        });
      }

      return tx.vendorCreditNote.update({
        where: { id: creditNoteId },
        data: { status: 'VOID' },
        include: { vendor: true },
      });
    });

    this.logger.log(`Voided vendor credit note ${creditNoteId}`);
    return result;
  }

  /**
   * Allocate vendor credit to bill(s)
   */
  async allocateVendorCredit(
    creditNoteId: string,
    userId: string,
    allocations: Array<{ billId: string; amount: number }>,
  ): Promise<any> {
    const creditNote = await this.prisma.client.vendorCreditNote.findUnique({
      where: { id: creditNoteId },
    });

    if (!creditNote) {
      throw new NotFoundException(`Credit note ${creditNoteId} not found`);
    }

    if (creditNote.status !== 'OPEN' && creditNote.status !== 'PARTIALLY_APPLIED') {
      throw new BadRequestException(`Credit note is not allocatable. Status: ${creditNote.status}`);
    }

    const creditsRemaining = Number(creditNote.amount) - Number(creditNote.allocatedAmount) - Number(creditNote.refundedAmount);
    const totalToAllocate = allocations.reduce((sum, a) => sum + a.amount, 0);

    if (totalToAllocate > creditsRemaining + 0.01) {
      throw new BadRequestException(`Cannot allocate ${totalToAllocate.toFixed(2)}. Only ${creditsRemaining.toFixed(2)} remaining.`);
    }

    // Validate each bill
    for (const alloc of allocations) {
      if (alloc.amount <= 0) {
        throw new BadRequestException('Allocation amount must be greater than zero');
      }

      const bill = await this.prisma.client.vendorBill.findUnique({
        where: { id: alloc.billId },
      });

      if (!bill) {
        throw new NotFoundException(`Bill ${alloc.billId} not found`);
      }

      if (bill.status !== 'OPEN' && bill.status !== 'PARTIALLY_PAID') {
        throw new BadRequestException(`Bill ${alloc.billId} is not in OPEN or PARTIALLY_PAID status`);
      }

      const outstanding = Number(bill.total) - Number(bill.paidAmount);
      if (alloc.amount > outstanding + 0.01) {
        throw new BadRequestException(`Allocation ${alloc.amount.toFixed(2)} exceeds bill outstanding ${outstanding.toFixed(2)}`);
      }
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      const createdAllocations = [];

      for (const alloc of allocations) {
        const allocation = await tx.vendorCreditNoteAllocation.create({
          data: {
            creditNoteId,
            billId: alloc.billId,
            amount: alloc.amount,
            appliedById: userId,
          },
          include: { bill: true },
        });
        createdAllocations.push(allocation);

        // Update bill paidAmount
        const bill = await tx.vendorBill.findUnique({ where: { id: alloc.billId } });
        if (bill) {
          const newPaidAmount = Number(bill.paidAmount) + alloc.amount;
          const total = Number(bill.total);
          let newStatus = bill.status;

          if (newPaidAmount >= total - 0.01) {
            newStatus = 'PAID';
          } else if (newPaidAmount > 0) {
            newStatus = 'PARTIALLY_PAID';
          }

          await tx.vendorBill.update({
            where: { id: alloc.billId },
            data: { paidAmount: newPaidAmount, status: newStatus },
          });
        }
      }

      // Update credit note
      const newAllocatedAmount = Number(creditNote.allocatedAmount) + totalToAllocate;
      const totalUsed = newAllocatedAmount + Number(creditNote.refundedAmount);
      let newStatus: 'OPEN' | 'PARTIALLY_APPLIED' | 'APPLIED' = 'OPEN';

      if (totalUsed >= Number(creditNote.amount) - 0.01) {
        newStatus = 'APPLIED';
      } else if (totalUsed > 0) {
        newStatus = 'PARTIALLY_APPLIED';
      }

      const updatedCreditNote = await tx.vendorCreditNote.update({
        where: { id: creditNoteId },
        data: { allocatedAmount: newAllocatedAmount, status: newStatus },
        include: { vendor: true, allocations: true },
      });

      return { creditNote: updatedCreditNote, allocations: createdAllocations };
    });

    this.logger.log(`Allocated ${totalToAllocate} from vendor credit note ${creditNoteId}`);
    return result;
  }

  /**
   * Delete vendor credit allocation
   */
  async deleteVendorCreditAllocation(allocationId: string, userId: string): Promise<void> {
    const allocation = await this.prisma.client.vendorCreditNoteAllocation.findUnique({
      where: { id: allocationId },
      include: { creditNote: true, bill: true },
    });

    if (!allocation) {
      throw new NotFoundException(`Allocation ${allocationId} not found`);
    }

    await this.prisma.client.$transaction(async (tx) => {
      // Reverse bill paidAmount
      const bill = allocation.bill;
      const newPaidAmount = Math.max(0, Number(bill.paidAmount) - Number(allocation.amount));
      const total = Number(bill.total);
      let newBillStatus = bill.status;

      if (newPaidAmount <= 0.01) {
        newBillStatus = 'OPEN';
      } else if (newPaidAmount < total - 0.01) {
        newBillStatus = 'PARTIALLY_PAID';
      }

      await tx.vendorBill.update({
        where: { id: bill.id },
        data: { paidAmount: newPaidAmount, status: newBillStatus },
      });

      // Reverse credit note
      const creditNote = allocation.creditNote;
      const newAllocatedAmount = Math.max(0, Number(creditNote.allocatedAmount) - Number(allocation.amount));
      const totalUsed = newAllocatedAmount + Number(creditNote.refundedAmount);
      let newCreditNoteStatus: 'OPEN' | 'PARTIALLY_APPLIED' | 'APPLIED' = 'APPLIED';

      if (totalUsed <= 0.01) {
        newCreditNoteStatus = 'OPEN';
      } else if (totalUsed < Number(creditNote.amount) - 0.01) {
        newCreditNoteStatus = 'PARTIALLY_APPLIED';
      }

      await tx.vendorCreditNote.update({
        where: { id: creditNote.id },
        data: { allocatedAmount: newAllocatedAmount, status: newCreditNoteStatus },
      });

      await tx.vendorCreditNoteAllocation.delete({ where: { id: allocationId } });
    });

    this.logger.log(`Deleted vendor credit allocation ${allocationId}`);
  }

  /**
   * Create vendor credit refund (receive cash from vendor)
   * GL: Dr Cash/Bank, Cr AP
   */
  async createVendorCreditRefund(
    creditNoteId: string,
    userId: string,
    data: {
      amount: number;
      refundDate?: Date;
      method: string;
      ref?: string;
      memo?: string;
    },
  ): Promise<any> {
    if (data.amount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }

    const creditNote = await this.prisma.client.vendorCreditNote.findUnique({
      where: { id: creditNoteId },
      include: { vendor: true },
    });

    if (!creditNote) {
      throw new NotFoundException(`Credit note ${creditNoteId} not found`);
    }

    if (creditNote.status !== 'OPEN' && creditNote.status !== 'PARTIALLY_APPLIED') {
      throw new BadRequestException(`Cannot refund credit note with status ${creditNote.status}`);
    }

    const creditsRemaining = Number(creditNote.amount) - Number(creditNote.allocatedAmount) - Number(creditNote.refundedAmount);
    if (data.amount > creditsRemaining + 0.01) {
      throw new BadRequestException(`Refund amount ${data.amount.toFixed(2)} exceeds remaining ${creditsRemaining.toFixed(2)}`);
    }

    const refundDate = data.refundDate || new Date();
    const period = await this.prisma.client.fiscalPeriod.findFirst({
      where: {
        orgId: creditNote.orgId,
        startsAt: { lte: refundDate },
        endsAt: { gte: refundDate },
      },
    });

    if (period?.status === 'LOCKED') {
      throw new ForbiddenException(`Cannot create refund in locked fiscal period: ${period.name}`);
    }

    // Find accounts
    const apAccount = await this.prisma.client.account.findFirst({
      where: { orgId: creditNote.orgId, name: { contains: 'Accounts Payable' }, type: 'LIABILITY' },
    });

    const mapping = await this.prisma.client.paymentMethodMapping.findUnique({
      where: { orgId_method: { orgId: creditNote.orgId, method: data.method as any } },
      include: { account: true },
    });

    let cashAccount: any;
    if (mapping) {
      cashAccount = mapping.account;
    } else {
      cashAccount = await this.prisma.client.account.findFirst({
        where: { orgId: creditNote.orgId, name: { contains: 'Cash' }, type: 'ASSET' },
      });
    }

    if (!apAccount || !cashAccount) {
      throw new BadRequestException('Required accounts (AP, Cash) not found');
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      // GL: Dr Cash (receiving), Cr AP (reducing)
      const journalEntry = await tx.journalEntry.create({
        data: {
          orgId: creditNote.orgId,
          date: refundDate,
          memo: `Vendor Credit Refund: ${creditNote.number || creditNoteId} - ${data.ref || 'No ref'}`,
          source: 'VENDOR_CREDIT_REFUND',
          sourceId: creditNoteId,
          status: 'POSTED',
          postedById: userId,
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: cashAccount.id,
                debit: data.amount,
                credit: 0,
              },
              {
                accountId: apAccount.id,
                debit: 0,
                credit: data.amount,
              },
            ],
          },
        },
      });

      const refund = await tx.vendorCreditNoteRefund.create({
        data: {
          creditNoteId,
          amount: data.amount,
          refundDate,
          method: data.method,
          ref: data.ref,
          memo: data.memo,
          journalEntryId: journalEntry.id,
        },
        include: { journalEntry: true },
      });

      // Update credit note
      const newRefundedAmount = Number(creditNote.refundedAmount) + data.amount;
      const totalUsed = Number(creditNote.allocatedAmount) + newRefundedAmount;
      let newStatus: 'OPEN' | 'PARTIALLY_APPLIED' | 'APPLIED' = 'OPEN';

      if (totalUsed >= Number(creditNote.amount) - 0.01) {
        newStatus = 'APPLIED';
      } else if (totalUsed > 0) {
        newStatus = 'PARTIALLY_APPLIED';
      }

      await tx.vendorCreditNote.update({
        where: { id: creditNoteId },
        data: { refundedAmount: newRefundedAmount, status: newStatus },
      });

      return refund;
    });

    this.logger.log(`Created vendor credit refund for ${creditNoteId}`);
    return result;
  }

  /**
   * Get credits remaining for a customer credit note
   */
  getCustomerCreditRemaining(creditNote: any): number {
    return Number(creditNote.amount) - Number(creditNote.allocatedAmount) - Number(creditNote.refundedAmount);
  }

  /**
   * Get credits remaining for a vendor credit note
   */
  getVendorCreditRemaining(creditNote: any): number {
    return Number(creditNote.amount) - Number(creditNote.allocatedAmount) - Number(creditNote.refundedAmount);
  }
}
