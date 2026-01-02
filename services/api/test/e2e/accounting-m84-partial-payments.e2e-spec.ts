/**
 * M8.4: Partial Payments + Payment Method Mapping E2E Tests
 * 
 * Tests for:
 * - PaymentMethodMapping CRUD operations
 * - Partial payment for VendorBill (OPEN → PARTIALLY_PAID → PAID)
 * - Partial payment for CustomerInvoice (OPEN → PARTIALLY_PAID → PAID)
 * - Overpayment prevention (400 error)
 * - Period lock enforcement on payments (403)
 * - Outstanding balance endpoints
 */

import { createE2EApp } from '../helpers/e2e-bootstrap';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { createOrgWithUsers, createChartOfAccounts } from './factory';
import { cleanup } from '../helpers/cleanup';
import { withTimeout } from '../helpers/with-timeout';

describe('M8.4 Partial Payments + Payment Method Mapping E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let orgId: string;
  let vendorId: string;
  let customerId: string;
  let cashAccountId: string;
  let bankAccountId: string;

  beforeAll(async () => {
    app = await createE2EApp({ imports: [AppModule] });

    prisma = app.get(PrismaService);
    const prismaClient = prisma.client;
    
    const factory = await withTimeout(createOrgWithUsers(prismaClient, 'e2e-m84-partial'), {
      label: 'createOrgWithUsers factory',
      ms: 30000,
    });
    await withTimeout(createChartOfAccounts(prismaClient, factory.orgId), {
      label: 'createChartOfAccounts',
      ms: 15000,
    });

    orgId = factory.orgId;

    // Get account IDs for payment method mappings
    const accounts = await prismaClient.account.findMany({
      where: { orgId },
    });
    cashAccountId = accounts.find(a => a.code === '1000')?.id || '';
    bankAccountId = accounts.find(a => a.code === '1010')?.id || '';

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

    // Create vendor for bill tests
    const vendorRes = await request(app.getHttpServer())
      .post('/accounting/vendors')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Vendor M84',
        email: 'test@vendor-m84.com',
        defaultTerms: 'NET30',
      })
      .expect(201);
    vendorId = vendorRes.body.id;

    // Create customer for invoice tests
    const customerRes = await request(app.getHttpServer())
      .post('/accounting/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Customer M84',
        email: 'test@customer-m84.com',
        creditLimit: 5000000,
      })
      .expect(201);
    customerId = customerRes.body.id;
  }, 60000);

  afterAll(async () => {
    await cleanup(app);
  });

  // ===== Payment Method Mapping Tests =====
  
  describe('PaymentMethodMapping CRUD', () => {
    it('AC-01: should create payment method mapping for CASH', async () => {
      const response = await request(app.getHttpServer())
        .post('/accounting/payment-methods')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          method: 'CASH',
          accountId: cashAccountId,
        })
        .expect(201);

      expect(response.body.method).toBe('CASH');
      expect(response.body.accountId).toBe(cashAccountId);
      expect(response.body.account).toBeDefined();
    });

    it('AC-01: should list payment method mappings', async () => {
      // Create another mapping first
      await request(app.getHttpServer())
        .post('/accounting/payment-methods')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          method: 'CARD',
          accountId: bankAccountId,
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/accounting/payment-methods')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should upsert (update) existing mapping', async () => {
      // Update CASH mapping to point to bank account
      const response = await request(app.getHttpServer())
        .post('/accounting/payment-methods')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          method: 'CASH',
          accountId: bankAccountId,
        })
        .expect(201);

      expect(response.body.method).toBe('CASH');
      expect(response.body.accountId).toBe(bankAccountId);

      // Restore to cash account for later tests
      await request(app.getHttpServer())
        .post('/accounting/payment-methods')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          method: 'CASH',
          accountId: cashAccountId,
        })
        .expect(201);
    });
  });

  // ===== Vendor Bill Partial Payment Tests =====
  
  describe('AP: Partial Payment for VendorBill', () => {
    let billId: string;
    const billTotal = 1000; // 1000 total

    beforeAll(async () => {
      // Create and open a vendor bill
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const createRes = await request(app.getHttpServer())
        .post('/accounting/vendor-bills')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vendorId,
          number: 'VB-M84-001',
          dueDate: dueDate.toISOString(),
          subtotal: billTotal,
          tax: 0,
          total: billTotal,
          memo: 'Test bill for partial payment',
        })
        .expect(201);
      billId = createRes.body.id;

      // Open the bill
      await request(app.getHttpServer())
        .post(`/accounting/vendor-bills/${billId}/open`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);
    });

    it('AC-02: vendor payment posts to mapped account (not name search)', async () => {
      // Make a partial payment via CASH method
      const response = await request(app.getHttpServer())
        .post('/accounting/vendor-payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vendorId,
          billId,
          amount: 300,
          method: 'CASH',
          ref: 'PAY-001',
        })
        .expect(201);

      expect(response.body.journalEntryId).toBeDefined();
      
      // Verify the journal entry uses the mapped account
      const journalEntry = await prisma.client.journalEntry.findUnique({
        where: { id: response.body.journalEntryId },
        include: { lines: { include: { account: true } } },
      });
      
      expect(journalEntry).toBeDefined();
      // Cash account (1000) should be credited
      const cashLine = journalEntry?.lines.find(l => l.account.code === '1000');
      expect(cashLine).toBeDefined();
      expect(Number(cashLine?.credit)).toBe(300);
    });

    it('AC-03: partial payment transitions bill to PARTIALLY_PAID', async () => {
      // Check bill status after partial payment
      const outstanding = await request(app.getHttpServer())
        .get(`/accounting/vendor-bills/${billId}/outstanding`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(outstanding.body.status).toBe('PARTIALLY_PAID');
      expect(outstanding.body.paid).toBe(300);
      expect(outstanding.body.outstanding).toBe(700);
    });

    it('AC-05: overpayment rejected with 400', async () => {
      // Try to pay more than outstanding
      const response = await request(app.getHttpServer())
        .post('/accounting/vendor-payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vendorId,
          billId,
          amount: 800, // Only 700 outstanding
          method: 'CASH',
          ref: 'PAY-OVERPAY',
        })
        .expect(400);

      expect(response.body.message).toContain('exceeds outstanding');
    });

    it('AC-04: final payment transitions bill to PAID', async () => {
      // Pay the remaining 700
      await request(app.getHttpServer())
        .post('/accounting/vendor-payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vendorId,
          billId,
          amount: 700,
          method: 'CARD',
          ref: 'PAY-FINAL',
        })
        .expect(201);

      // Check bill status
      const outstanding = await request(app.getHttpServer())
        .get(`/accounting/vendor-bills/${billId}/outstanding`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(outstanding.body.status).toBe('PAID');
      expect(outstanding.body.paid).toBe(1000);
      expect(outstanding.body.outstanding).toBe(0);
    });
  });

  // ===== Customer Invoice Partial Payment Tests =====
  
  describe('AR: Partial Payment for CustomerInvoice', () => {
    let invoiceId: string;
    const invoiceTotal = 2000;

    beforeAll(async () => {
      // Create and open a customer invoice
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const createRes = await request(app.getHttpServer())
        .post('/accounting/customer-invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          number: 'INV-M84-001',
          dueDate: dueDate.toISOString(),
          subtotal: invoiceTotal,
          tax: 0,
          total: invoiceTotal,
          memo: 'Test invoice for partial payment',
        })
        .expect(201);
      invoiceId = createRes.body.id;

      // Open the invoice
      await request(app.getHttpServer())
        .post(`/accounting/customer-invoices/${invoiceId}/open`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);
    });

    it('AC-06: customer receipt posts to mapped account', async () => {
      // Make a partial receipt via CARD method
      const response = await request(app.getHttpServer())
        .post('/accounting/customer-receipts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          invoiceId,
          amount: 500,
          method: 'CARD',
          ref: 'REC-001',
        })
        .expect(201);

      expect(response.body.journalEntryId).toBeDefined();
      
      // Verify the journal entry uses the mapped account
      const journalEntry = await prisma.client.journalEntry.findUnique({
        where: { id: response.body.journalEntryId },
        include: { lines: { include: { account: true } } },
      });
      
      expect(journalEntry).toBeDefined();
      // Bank account (1010) should be debited (we mapped CARD to bank)
      const bankLine = journalEntry?.lines.find(l => l.account.code === '1010');
      expect(bankLine).toBeDefined();
      expect(Number(bankLine?.debit)).toBe(500);
    });

    it('AC-07: partial receipt transitions invoice to PARTIALLY_PAID', async () => {
      // Check invoice status after partial receipt
      const outstanding = await request(app.getHttpServer())
        .get(`/accounting/customer-invoices/${invoiceId}/outstanding`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(outstanding.body.status).toBe('PARTIALLY_PAID');
      expect(outstanding.body.paid).toBe(500);
      expect(outstanding.body.outstanding).toBe(1500);
    });

    it('should reject overpayment for invoice with 400', async () => {
      // Try to pay more than outstanding
      const response = await request(app.getHttpServer())
        .post('/accounting/customer-receipts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          invoiceId,
          amount: 2000, // Only 1500 outstanding
          method: 'CASH',
          ref: 'REC-OVERPAY',
        })
        .expect(400);

      expect(response.body.message).toContain('exceeds outstanding');
    });

    it('should transition invoice to PAID after full payment', async () => {
      // Pay the remaining 1500
      await request(app.getHttpServer())
        .post('/accounting/customer-receipts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          invoiceId,
          amount: 1500,
          method: 'MOMO',
          ref: 'REC-FINAL',
        })
        .expect(201);

      // Check invoice status
      const outstanding = await request(app.getHttpServer())
        .get(`/accounting/customer-invoices/${invoiceId}/outstanding`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(outstanding.body.status).toBe('PAID');
      expect(outstanding.body.paid).toBe(2000);
      expect(outstanding.body.outstanding).toBe(0);
    });
  });

  // ===== Period Lock Tests =====
  
  describe('Period Lock Enforcement', () => {
    let lockedBillId: string;

    beforeAll(async () => {
      // Create a bill for locked period test
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const createRes = await request(app.getHttpServer())
        .post('/accounting/vendor-bills')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vendorId,
          number: 'VB-M84-LOCK',
          dueDate: dueDate.toISOString(),
          subtotal: 500,
          tax: 0,
          total: 500,
          memo: 'Test bill for period lock',
        })
        .expect(201);
      lockedBillId = createRes.body.id;

      // Open the bill
      await request(app.getHttpServer())
        .post(`/accounting/vendor-bills/${lockedBillId}/open`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Lock ALL periods for this org that contain today's date
      // This ensures the period lock check will find a locked period
      const today = new Date();
      await prisma.client.fiscalPeriod.updateMany({
        where: { 
          orgId, 
          startsAt: { lte: today },
          endsAt: { gte: today },
        },
        data: { status: 'LOCKED' },
      });
    });

    afterAll(async () => {
      // Unlock all periods for this org that contain today's date for cleanup
      const today = new Date();
      await prisma.client.fiscalPeriod.updateMany({
        where: { 
          orgId,
          startsAt: { lte: today },
          endsAt: { gte: today },
        },
        data: { status: 'OPEN' },
      });
    });

    it('AC-08: period lock blocks payment posting with 403', async () => {
      const response = await request(app.getHttpServer())
        .post('/accounting/vendor-payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vendorId,
          billId: lockedBillId,
          amount: 100,
          method: 'CASH',
          ref: 'PAY-LOCKED',
        })
        .expect(403);

      expect(response.body.message).toContain('locked fiscal period');
    });
  });

  // ===== Negative Amount Validation =====
  
  describe('Input Validation', () => {
    it('should reject negative payment amount', async () => {
      const response = await request(app.getHttpServer())
        .post('/accounting/vendor-payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vendorId,
          amount: -100,
          method: 'CASH',
        })
        .expect(400);

      expect(response.body.message).toContain('greater than zero');
    });

    it('should reject zero payment amount', async () => {
      const response = await request(app.getHttpServer())
        .post('/accounting/vendor-payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vendorId,
          amount: 0,
          method: 'CASH',
        })
        .expect(400);

      expect(response.body.message).toContain('greater than zero');
    });
  });
});
