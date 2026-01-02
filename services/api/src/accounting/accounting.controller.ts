/**
 * E40-s1: Accounting Controller
 * M8.2b: Enterprise hardening - lifecycle, period lock, exports
 *
 * REST endpoints for accounting operations (L4+).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Controller, Post, Get, Body, Param, Query, UseGuards, Request, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AccountingService } from './accounting.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

interface RequestWithUser extends Request {
  user: {
    sub: string;
    email: string;
    orgId: string;
    role: string;
    id: string;
    branchId?: string;
  };
}

@Controller('accounting')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Post('vendors')
  @Roles('L4', 'L5')
  async createVendor(
    @Request() req: RequestWithUser,
    @Body()
    body: {
      name: string;
      email?: string;
      phone?: string;
      defaultTerms?: 'NET7' | 'NET14' | 'NET30';
      metadata?: any;
    },
  ) {
    return this.accountingService.createVendor(req.user.orgId, body);
  }

  @Get('vendors')
  @Roles('L4', 'L5')
  async getVendors(@Request() req: RequestWithUser) {
    return this.accountingService.getVendors(req.user.orgId);
  }

  @Post('vendor-bills')
  @Roles('L4', 'L5')
  async createVendorBill(
    @Request() req: RequestWithUser,
    @Body()
    body: {
      vendorId: string;
      number?: string;
      billDate?: string;
      dueDate: string;
      subtotal: number;
      tax?: number;
      total: number;
      memo?: string;
    },
  ) {
    return this.accountingService.createVendorBill(req.user.orgId, {
      ...body,
      billDate: body.billDate ? new Date(body.billDate) : undefined,
      dueDate: new Date(body.dueDate),
    });
  }

  @Post('vendor-bills/:billId/open')
  @Roles('L4', 'L5')
  async openVendorBill(
    @Request() req: RequestWithUser,
    @Param('billId') billId: string,
  ) {
    return this.accountingService.openVendorBill(billId, req.user.id);
  }

  @Post('vendor-bills/:billId/void')
  @Roles('L4', 'L5')
  async voidVendorBill(
    @Request() req: RequestWithUser,
    @Param('billId') billId: string,
  ) {
    return this.accountingService.voidVendorBill(billId, req.user.id);
  }

  @Post('vendor-payments')
  @Roles('L4', 'L5')
  async createVendorPayment(
    @Request() req: RequestWithUser,
    @Body()
    body: {
      vendorId: string;
      billId?: string;
      amount: number;
      paidAt?: string;
      method: string;
      ref?: string;
      metadata?: any;
    },
  ) {
    return this.accountingService.createVendorPayment(req.user.orgId, req.user.id, {
      ...body,
      paidAt: body.paidAt ? new Date(body.paidAt) : undefined,
    });
  }

  @Get('ap/aging')
  @Roles('L4', 'L5')
  async getAPAging(@Request() req: RequestWithUser) {
    return this.accountingService.getAPAging(req.user.orgId);
  }

  // ===== M8.3: Customer / AR Endpoints =====

  @Post('customers')
  @Roles('L4', 'L5')
  async createCustomer(
    @Request() req: RequestWithUser,
    @Body()
    body: {
      name: string;
      email?: string;
      phone?: string;
      creditLimit?: number;
      metadata?: any;
    },
  ) {
    return this.accountingService.createCustomer(req.user.orgId, body);
  }

  @Get('customers')
  @Roles('L4', 'L5')
  async getCustomers(@Request() req: RequestWithUser) {
    return this.accountingService.getCustomers(req.user.orgId);
  }

  @Post('customer-invoices')
  @Roles('L4', 'L5')
  async createCustomerInvoice(
    @Request() req: RequestWithUser,
    @Body()
    body: {
      customerId: string;
      number?: string;
      invoiceDate?: string;
      dueDate: string;
      subtotal: number;
      tax?: number;
      total: number;
      memo?: string;
    },
  ) {
    return this.accountingService.createCustomerInvoice(req.user.orgId, {
      ...body,
      invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : undefined,
      dueDate: new Date(body.dueDate),
    });
  }

  @Post('customer-invoices/:invoiceId/open')
  @Roles('L4', 'L5')
  async openCustomerInvoice(
    @Request() req: RequestWithUser,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.accountingService.openCustomerInvoice(invoiceId, req.user.id);
  }

  @Post('customer-invoices/:invoiceId/void')
  @Roles('L4', 'L5')
  async voidCustomerInvoice(
    @Request() req: RequestWithUser,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.accountingService.voidCustomerInvoice(invoiceId, req.user.id);
  }

  @Post('customer-receipts')
  @Roles('L4', 'L5')
  async createCustomerReceipt(
    @Request() req: RequestWithUser,
    @Body()
    body: {
      customerId: string;
      invoiceId?: string;
      amount: number;
      receivedAt?: string;
      method: string;
      ref?: string;
      metadata?: any;
    },
  ) {
    return this.accountingService.createCustomerReceipt(req.user.orgId, req.user.id, {
      ...body,
      receivedAt: body.receivedAt ? new Date(body.receivedAt) : undefined,
    });
  }

  @Get('ar/aging')
  @Roles('L4', 'L5')
  async getARAging(@Request() req: RequestWithUser) {
    return this.accountingService.getARAging(req.user.orgId);
  }

  @Get('trial-balance')
  @Roles('L4', 'L5')
  async getTrialBalance(
    @Request() req: RequestWithUser,
    @Query('asOf') asOf?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.accountingService.getTrialBalance(req.user.orgId, asOf, branchId);
  }

  @Get('pnl')
  @Roles('L4', 'L5')
  async getProfitAndLoss(
    @Request() req: RequestWithUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.accountingService.getProfitAndLoss(req.user.orgId, from, to, branchId);
  }

  @Get('balance-sheet')
  @Roles('L4', 'L5')
  async getBalanceSheet(
    @Request() req: RequestWithUser,
    @Query('asOf') asOf?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.accountingService.getBalanceSheet(req.user.orgId, asOf, branchId);
  }

  // ===== M8.2: Chart of Accounts =====

  @Get('accounts')
  @Roles('L4', 'L5')
  async getAccounts(
    @Request() req: RequestWithUser,
    @Query('type') type?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.accountingService.getAccounts(req.user.orgId, {
      type: type as any,
      isActive: isActive === 'false' ? false : true,
    });
  }

  @Post('accounts')
  @Roles('L5')
  async createAccount(
    @Request() req: RequestWithUser,
    @Body()
    body: {
      code: string;
      name: string;
      type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'COGS' | 'EXPENSE';
      parentId?: string;
    },
  ) {
    return this.accountingService.createAccount(req.user.orgId, body);
  }

  // ===== M8.2: Journal Entries =====

  @Get('journal')
  @Roles('L4', 'L5')
  async getJournalEntries(
    @Request() req: RequestWithUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
    @Query('source') source?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.accountingService.getJournalEntries(req.user.orgId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      branchId,
      source,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('journal/:id')
  @Roles('L4', 'L5')
  async getJournalEntry(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.accountingService.getJournalEntry(req.user.orgId, id);
  }

  @Post('journal')
  @Roles('L4', 'L5')
  async createJournalEntry(
    @Request() req: RequestWithUser,
    @Body()
    body: {
      date?: string;
      memo?: string;
      branchId?: string;
      lines: Array<{
        accountId: string;
        debit: number;
        credit: number;
      }>;
    },
  ) {
    return this.accountingService.createJournalEntry(
      req.user.orgId,
      req.user.id,
      {
        date: body.date ? new Date(body.date) : new Date(),
        memo: body.memo,
        branchId: body.branchId,
        lines: body.lines,
      },
    );
  }

  // ===== M8.2b: Journal Entry Lifecycle =====

  @Post('journal/:id/post')
  @Roles('L4', 'L5')
  async postJournalEntry(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.accountingService.postJournalEntry(req.user.orgId, id, req.user.id);
  }

  @Post('journal/:id/reverse')
  @Roles('L4', 'L5')
  async reverseJournalEntry(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { reversalDate?: string },
  ) {
    return this.accountingService.reverseJournalEntry(
      req.user.orgId,
      id,
      req.user.id,
      body.reversalDate ? new Date(body.reversalDate) : undefined,
    );
  }

  // ===== M8.2b: CSV Exports =====

  @Get('export/accounts')
  @Roles('L4', 'L5')
  async exportAccountsCSV(
    @Request() req: RequestWithUser,
    @Res() res: Response,
  ) {
    const csv = await this.accountingService.exportAccountsCSV(req.user.orgId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=chart-of-accounts.csv');
    res.status(HttpStatus.OK).send(csv);
  }

  @Get('export/journal')
  @Roles('L4', 'L5')
  async exportJournalCSV(
    @Request() req: RequestWithUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const csv = await this.accountingService.exportJournalCSV(
      req.user.orgId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=journal-entries.csv');
    res.status(HttpStatus.OK).send(csv);
  }

  @Get('export/trial-balance')
  @Roles('L4', 'L5')
  async exportTrialBalanceCSV(
    @Request() req: RequestWithUser,
    @Res() res: Response,
    @Query('asOf') asOf?: string,
  ) {
    const csv = await this.accountingService.exportTrialBalanceCSV(req.user.orgId, asOf);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=trial-balance.csv');
    res.status(HttpStatus.OK).send(csv);
  }

  // ===== M8.4: Payment Method Mappings =====

  @Get('payment-methods')
  @Roles('L4', 'L5')
  async getPaymentMethodMappings(@Request() req: RequestWithUser) {
    return this.accountingService.getPaymentMethodMappings(req.user.orgId);
  }

  @Post('payment-methods')
  @Roles('L4', 'L5')
  async upsertPaymentMethodMapping(
    @Request() req: RequestWithUser,
    @Body() body: { method: 'CASH' | 'CARD' | 'MOMO' | 'BANK_TRANSFER'; accountId: string },
  ) {
    return this.accountingService.upsertPaymentMethodMapping(req.user.orgId, body);
  }

  // ===== M8.4: Outstanding Balance =====

  @Get('vendor-bills/:billId/outstanding')
  @Roles('L4', 'L5')
  async getVendorBillOutstanding(@Param('billId') billId: string) {
    return this.accountingService.getVendorBillOutstanding(billId);
  }

  @Get('customer-invoices/:invoiceId/outstanding')
  @Roles('L4', 'L5')
  async getCustomerInvoiceOutstanding(@Param('invoiceId') invoiceId: string) {
    return this.accountingService.getCustomerInvoiceOutstanding(invoiceId);
  }
}
