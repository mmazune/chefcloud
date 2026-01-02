/**
 * M8.3: AP/AR Document Lifecycle + GL Posting E2E Tests
 * 
 * Tests for:
 * - VendorBill lifecycle (DRAFT → OPEN with GL → PAID with GL → VOID with reversal)
 * - CustomerInvoice lifecycle (DRAFT → OPEN with GL → PAID with GL → VOID with reversal)
 * - Period lock enforcement on AP/AR
 */

import { createE2EApp } from '../helpers/e2e-bootstrap';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { createOrgWithUsers, createChartOfAccounts } from './factory';
import { cleanup } from '../helpers/cleanup';
import { withTimeout } from '../helpers/with-timeout';

describe('M8.3 AP/AR Lifecycle + GL Posting E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let orgId: string;

  beforeAll(async () => {
    app = await createE2EApp({ imports: [AppModule] });

    prisma = app.get(PrismaService);
    const prismaClient = prisma.client;
    
    const factory = await withTimeout(createOrgWithUsers(prismaClient, 'e2e-m83-ap-ar'), {
      label: 'createOrgWithUsers factory',
      ms: 30000,
    });
    await withTimeout(createChartOfAccounts(prismaClient, factory.orgId), {
      label: 'createChartOfAccounts',
      ms: 15000,
    });

    orgId = factory.orgId;

    // Create OPEN fiscal period for current quarter
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    const currQStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
    const currQEnd = new Date(now.getFullYear(), currentQuarter * 3, 0);

    await prismaClient.fiscalPeriod.create({
      data: {
        orgId,
        name: `Q${currentQuarter} ${now.getFullYear()}`,
        startsAt: currQStart,
        endsAt: currQEnd,
        status: 'OPEN',
      },
    });

    // Login as owner
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: factory.users.owner.email,
        password: 'Test#123',
      });

    authToken = loginResponse.body.access_token;
  }, 60000);

  afterAll(async () => {
    await cleanup(app);
  });

  // ===== AP (Vendor Bill) Tests =====
  
  describe('AP: VendorBill Lifecycle', () => {
    let vendorId: string;
    let billId: string;

    beforeAll(async () => {
      // Create vendor
      const vendorRes = await request(app.getHttpServer())
        .post('/accounting/vendors')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Vendor M83',
          email: 'test@vendor-m83.com',
          defaultTerms: 'NET30',
        })
        .expect(201);

      vendorId = vendorRes.body.id;
    });

    it('AC-01: should create vendor bill as DRAFT', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const response = await request(app.getHttpServer())
        .post('/accounting/vendor-bills')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vendorId,
          number: 'VB-M83-001',
          dueDate: dueDate.toISOString(),
          subtotal: 100000,
          tax: 18000,
          total: 118000,
          memo: 'Test bill for M8.3',
        })
        .expect(201);

      expect(response.body.status).toBe('DRAFT');
      expect(response.body.journalEntryId).toBeNull();
      billId = response.body.id;
    });

    it('AC-01: opening DRAFT bill creates POSTED journal entry', async () => {
      expect(billId).toBeDefined(); // Ensure previous test passed
      const response = await request(app.getHttpServer())
        .post(`/accounting/vendor-bills/${billId}/open`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.status).toBe('OPEN');
      expect(response.body.journalEntryId).toBeDefined();
      expect(response.body.openedAt).toBeDefined();
      expect(response.body.journalEntry.status).toBe('POSTED');

      // Verify journal entry has correct lines (Debit Expense, Credit AP)
      const journalEntry = await request(app.getHttpServer())
        .get(`/accounting/journal/${response.body.journalEntryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(journalEntry.body.source).toBe('VENDOR_BILL');
      expect(journalEntry.body.lines.length).toBe(2);
      
      const totalDebit = journalEntry.body.lines.reduce((sum: number, l: any) => sum + Number(l.debit), 0);
      const totalCredit = journalEntry.body.lines.reduce((sum: number, l: any) => sum + Number(l.credit), 0);
      expect(totalDebit).toBe(118000);
      expect(totalCredit).toBe(118000);
    });

    it('AC-03: vendor payment creates POSTED journal entry', async () => {
      expect(billId).toBeDefined(); // Ensure bill was created and opened
      const response = await request(app.getHttpServer())
        .post('/accounting/vendor-payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vendorId,
          billId,
          amount: 118000,
          method: 'BANK_TRANSFER',
          ref: 'CHK-001',
          paidAt: new Date().toISOString(),
        })
        .expect(201);

      expect(response.body.journalEntryId).toBeDefined();
      expect(response.body.journalEntry.status).toBe('POSTED');
      expect(response.body.journalEntry.source).toBe('VENDOR_PAYMENT');

      // Verify bill is now PAID
      const billRes = await prisma.client.vendorBill.findUnique({
        where: { id: billId },
      });
      expect(billRes?.status).toBe('PAID');
    });

    it('AC-04: voiding bill creates reversal journal entry', async () => {
      // Create and open a new bill for voiding
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const createRes = await request(app.getHttpServer())
        .post('/accounting/vendor-bills')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vendorId,
          number: 'VB-M83-VOID',
          dueDate: dueDate.toISOString(),
          subtotal: 50000,
          tax: 9000,
          total: 59000,
        })
        .expect(201);

      const openRes = await request(app.getHttpServer())
        .post(`/accounting/vendor-bills/${createRes.body.id}/open`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      const originalJournalId = openRes.body.journalEntryId;

      // Void the bill
      const voidRes = await request(app.getHttpServer())
        .post(`/accounting/vendor-bills/${createRes.body.id}/void`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(voidRes.body.status).toBe('VOID');

      // Verify original journal entry is REVERSED
      const originalJournal = await prisma.client.journalEntry.findUnique({
        where: { id: originalJournalId },
      });
      expect(originalJournal?.status).toBe('REVERSED');
    });
  });

  describe('AP: Period Lock Enforcement', () => {
    let vendorId: string;
    let lockedBillId: string;

    beforeAll(async () => {
      const vendorRes = await request(app.getHttpServer())
        .post('/accounting/vendors')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Period Lock Test Vendor',
          email: 'lock@vendor.com',
        })
        .expect(201);

      vendorId = vendorRes.body.id;

      // Create a LOCKED fiscal period for last month
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lockStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
      const lockEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);

      await prisma.client.fiscalPeriod.create({
        data: {
          orgId,
          name: `Locked Period ${lockStart.toISOString().slice(0, 7)}`,
          startsAt: lockStart,
          endsAt: lockEnd,
          status: 'LOCKED',
          lockedAt: new Date(),
        },
      });

      // Create bill with date in locked period
      lockedBillId = await (async () => {
        const bill = await prisma.client.vendorBill.create({
          data: {
            orgId,
            vendorId,
            number: 'VB-LOCKED-001',
            billDate: lastMonth,
            dueDate: new Date(),
            subtotal: 25000,
            tax: 4500,
            total: 29500,
            status: 'DRAFT',
          },
        });
        return bill.id;
      })();
    });

    it('AC-02: opening bill in locked period returns 403', async () => {
      const response = await request(app.getHttpServer())
        .post(`/accounting/vendor-bills/${lockedBillId}/open`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.message).toContain('locked fiscal period');
    });

    it('AC-02: bill remains DRAFT after failed open attempt', async () => {
      const bill = await prisma.client.vendorBill.findUnique({
        where: { id: lockedBillId },
      });
      expect(bill?.status).toBe('DRAFT');
      expect(bill?.journalEntryId).toBeNull();
    });
  });

  // ===== AR (Customer Invoice) Tests =====

  describe('AR: CustomerInvoice Lifecycle', () => {
    let customerId: string;
    let invoiceId: string;

    beforeAll(async () => {
      // Create customer
      const customerRes = await request(app.getHttpServer())
        .post('/accounting/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Customer M83',
          email: 'test@customer-m83.com',
          creditLimit: 500000,
        })
        .expect(201);

      customerId = customerRes.body.id;
    });

    it('AC-05: should create customer invoice as DRAFT', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const response = await request(app.getHttpServer())
        .post('/accounting/customer-invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          number: 'INV-M83-001',
          dueDate: dueDate.toISOString(),
          subtotal: 200000,
          tax: 36000,
          total: 236000,
          memo: 'Test invoice for M8.3',
        })
        .expect(201);

      expect(response.body.status).toBe('DRAFT');
      expect(response.body.journalEntryId).toBeNull();
      invoiceId = response.body.id;
    });

    it('AC-05: opening DRAFT invoice creates POSTED journal entry', async () => {
      expect(invoiceId).toBeDefined(); // Ensure previous test passed
      const response = await request(app.getHttpServer())
        .post(`/accounting/customer-invoices/${invoiceId}/open`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.status).toBe('OPEN');
      expect(response.body.journalEntryId).toBeDefined();
      expect(response.body.openedAt).toBeDefined();
      expect(response.body.journalEntry.status).toBe('POSTED');

      // Verify journal entry (Debit AR, Credit Revenue)
      const journalEntry = await request(app.getHttpServer())
        .get(`/accounting/journal/${response.body.journalEntryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(journalEntry.body.source).toBe('CUSTOMER_INVOICE');
      expect(journalEntry.body.lines.length).toBe(2);

      const totalDebit = journalEntry.body.lines.reduce((sum: number, l: any) => sum + Number(l.debit), 0);
      const totalCredit = journalEntry.body.lines.reduce((sum: number, l: any) => sum + Number(l.credit), 0);
      expect(totalDebit).toBe(236000);
      expect(totalCredit).toBe(236000);
    });

    it('AC-07: customer receipt creates POSTED journal entry', async () => {
      expect(invoiceId).toBeDefined(); // Ensure invoice was created and opened
      const response = await request(app.getHttpServer())
        .post('/accounting/customer-receipts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          invoiceId,
          amount: 236000,
          method: 'CARD',
          ref: 'TXN-001',
          receivedAt: new Date().toISOString(),
        })
        .expect(201);

      expect(response.body.journalEntryId).toBeDefined();
      expect(response.body.journalEntry.status).toBe('POSTED');
      expect(response.body.journalEntry.source).toBe('CUSTOMER_RECEIPT');

      // Verify invoice is now PAID
      const invoiceRes = await prisma.client.customerInvoice.findUnique({
        where: { id: invoiceId },
      });
      expect(invoiceRes?.status).toBe('PAID');
    });

    it('AC-08: voiding invoice creates reversal journal entry', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const createRes = await request(app.getHttpServer())
        .post('/accounting/customer-invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          number: 'INV-M83-VOID',
          dueDate: dueDate.toISOString(),
          subtotal: 75000,
          tax: 13500,
          total: 88500,
        })
        .expect(201);

      const openRes = await request(app.getHttpServer())
        .post(`/accounting/customer-invoices/${createRes.body.id}/open`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      const originalJournalId = openRes.body.journalEntryId;

      const voidRes = await request(app.getHttpServer())
        .post(`/accounting/customer-invoices/${createRes.body.id}/void`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(voidRes.body.status).toBe('VOID');

      const originalJournal = await prisma.client.journalEntry.findUnique({
        where: { id: originalJournalId },
      });
      expect(originalJournal?.status).toBe('REVERSED');
    });
  });

  describe('AR: Period Lock Enforcement', () => {
    let customerId: string;
    let lockedInvoiceId: string;

    beforeAll(async () => {
      const customerRes = await request(app.getHttpServer())
        .post('/accounting/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Period Lock Test Customer',
          email: 'lock@customer.com',
        })
        .expect(201);

      customerId = customerRes.body.id;

      // Create invoice in locked period
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      lockedInvoiceId = await (async () => {
        const invoice = await prisma.client.customerInvoice.create({
          data: {
            orgId,
            customerId,
            number: 'INV-LOCKED-001',
            invoiceDate: lastMonth,
            dueDate: new Date(),
            subtotal: 30000,
            tax: 5400,
            total: 35400,
            status: 'DRAFT',
          },
        });
        return invoice.id;
      })();
    });

    it('AC-06: opening invoice in locked period returns 403', async () => {
      const response = await request(app.getHttpServer())
        .post(`/accounting/customer-invoices/${lockedInvoiceId}/open`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.message).toContain('locked fiscal period');
    });

    it('AC-06: invoice remains DRAFT after failed open attempt', async () => {
      const invoice = await prisma.client.customerInvoice.findUnique({
        where: { id: lockedInvoiceId },
      });
      expect(invoice?.status).toBe('DRAFT');
      expect(invoice?.journalEntryId).toBeNull();
    });
  });

  describe('Trial Balance Integration', () => {
    it('AC-09: trial balance includes GL entries from AP/AR', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/trial-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.balanced).toBe(true);
      
      // Should have entries from the bills/invoices we opened
      const apAccount = response.body.accounts.find((a: any) => a.name === 'Accounts Payable');
      const arAccount = response.body.accounts.find((a: any) => a.name === 'Accounts Receivable');
      
      // AP should have some credit balance from bills, AR should have some debit balance from invoices
      // (Exact amounts depend on what's been paid/voided)
      expect(apAccount).toBeDefined();
      expect(arAccount).toBeDefined();
    });

    it('AC-09: trial balance shows correct totals for AP/AR accounts', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/trial-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Total debits should equal total credits (balanced)
      expect(Math.abs(response.body.totalDebits - response.body.totalCredits)).toBeLessThan(1);
    });
  });
});
