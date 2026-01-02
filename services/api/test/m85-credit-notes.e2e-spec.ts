/**
 * M8.5: Credit Notes + Write-offs + Refund Accounting E2E Tests
 *
 * Tests for CustomerCreditNote and VendorCreditNote lifecycle,
 * allocations, refunds, and GL integration.
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createE2EApp } from './helpers/e2e-bootstrap';
import { cleanup } from './helpers/cleanup';
import { TAPAS_CREDENTIALS, DEMO_DATASETS } from './helpers/e2e-credentials';
import { PrismaService } from '../src/prisma.service';

describe('M8.5 Credit Notes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let orgId: string;

  // Test data IDs
  let customerId: string;
  let vendorId: string;
  let customerInvoiceId: string;
  let vendorBillId: string;
  let customerCreditNoteId: string;
  let vendorCreditNoteId: string;

  beforeAll(async () => {
    app = await createE2EApp({ imports: [AppModule] });
    prisma = app.get<PrismaService>(PrismaService);

    // Login as accountant (L4)
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: TAPAS_CREDENTIALS.accountant.email,
        password: TAPAS_CREDENTIALS.accountant.password,
      });

    authToken = loginResponse.body.access_token;

    // Get orgId
    const org = await prisma.client.org.findFirst({
      where: { slug: DEMO_DATASETS.DEMO_TAPAS.slug },
    });
    orgId = org!.id;

    // Create or get a customer account for testing
    let customer = await prisma.client.customerAccount.findFirst({
      where: { orgId, name: 'Test Credit Note Customer' },
    });
    if (!customer) {
      customer = await prisma.client.customerAccount.create({
        data: {
          orgId,
          name: 'Test Credit Note Customer',
          email: 'creditcustomer@test.local',
        },
      });
    }
    customerId = customer.id;

    // Create or get a vendor for testing
    let vendor = await prisma.client.vendor.findFirst({
      where: { orgId, name: 'Test Credit Note Vendor' },
    });
    if (!vendor) {
      vendor = await prisma.client.vendor.create({
        data: {
          orgId,
          name: 'Test Credit Note Vendor',
          email: 'creditvendor@test.local',
        },
      });
    }
    vendorId = vendor.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (customerCreditNoteId) {
      await prisma.client.customerCreditNoteAllocation.deleteMany({
        where: { creditNoteId: customerCreditNoteId },
      });
      await prisma.client.customerCreditNoteRefund.deleteMany({
        where: { creditNoteId: customerCreditNoteId },
      });
      await prisma.client.customerCreditNote.deleteMany({
        where: { id: customerCreditNoteId },
      });
    }
    if (vendorCreditNoteId) {
      await prisma.client.vendorCreditNoteAllocation.deleteMany({
        where: { creditNoteId: vendorCreditNoteId },
      });
      await prisma.client.vendorCreditNoteRefund.deleteMany({
        where: { creditNoteId: vendorCreditNoteId },
      });
      await prisma.client.vendorCreditNote.deleteMany({
        where: { id: vendorCreditNoteId },
      });
    }
    if (customerInvoiceId) {
      await prisma.client.customerInvoice.deleteMany({
        where: { id: customerInvoiceId },
      });
    }
    if (vendorBillId) {
      await prisma.client.vendorBill.deleteMany({
        where: { id: vendorBillId },
      });
    }
    await cleanup(app);
  });

  // ===== Customer Credit Note Tests =====

  describe('Customer Credit Notes', () => {
    it('AC-01: should create customer credit note in DRAFT status', async () => {
      const response = await request(app.getHttpServer())
        .post('/accounting/credit-notes/customer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          number: 'CCN-TEST-001',
          amount: 100,
          reason: 'Product return',
          memo: 'Test credit note',
        })
        .expect(201);

      expect(response.body.status).toBe('DRAFT');
      expect(response.body.amount).toBe('100');
      expect(response.body.number).toBe('CCN-TEST-001');
      expect(response.body.customer).toBeDefined();
      customerCreditNoteId = response.body.id;
    });

    it('AC-01b: should reject credit note with zero amount', async () => {
      await request(app.getHttpServer())
        .post('/accounting/credit-notes/customer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          amount: 0,
          reason: 'Invalid test',
        })
        .expect(400);
    });

    it('AC-01c: should reject credit note with negative amount', async () => {
      await request(app.getHttpServer())
        .post('/accounting/credit-notes/customer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          amount: -50,
        })
        .expect(400);
    });

    it('should list customer credit notes', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/credit-notes/customer')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const found = response.body.find((cn: any) => cn.id === customerCreditNoteId);
      expect(found).toBeDefined();
    });

    it('should get customer credit note by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/accounting/credit-notes/customer/${customerCreditNoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(customerCreditNoteId);
      expect(response.body.status).toBe('DRAFT');
    });

    it('AC-02: should open customer credit note and create GL entry', async () => {
      const response = await request(app.getHttpServer())
        .post(`/accounting/credit-notes/customer/${customerCreditNoteId}/open`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.status).toBe('OPEN');
      expect(response.body.journalEntry).toBeDefined();
      expect(response.body.openedAt).toBeDefined();

      // Verify GL entry
      const je = response.body.journalEntry;
      expect(je.status).toBe('POSTED');
      expect(je.source).toBe('CUSTOMER_CREDIT_NOTE');
    });

    it('AC-02b: should reject opening non-DRAFT credit note', async () => {
      await request(app.getHttpServer())
        .post(`/accounting/credit-notes/customer/${customerCreditNoteId}/open`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should create customer invoice for allocation testing', async () => {
      // Create invoice
      const invoiceResponse = await request(app.getHttpServer())
        .post('/accounting/customer-invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          subtotal: 150,
          tax: 0,
          total: 150,
        })
        .expect(201);

      customerInvoiceId = invoiceResponse.body.id;

      // Open invoice
      await request(app.getHttpServer())
        .post(`/accounting/customer-invoices/${customerInvoiceId}/open`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);
    });

    it('AC-04: should allocate credit to invoice', async () => {
      const response = await request(app.getHttpServer())
        .post(`/accounting/credit-notes/customer/${customerCreditNoteId}/allocate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          allocations: [{ invoiceId: customerInvoiceId, amount: 60 }],
        })
        .expect(201);

      expect(response.body.creditNote.allocatedAmount).toBe('60');
      expect(response.body.creditNote.status).toBe('PARTIALLY_APPLIED');
      expect(response.body.allocations.length).toBe(1);
    });

    it('AC-05: should show correct remaining balance after partial allocation', async () => {
      const response = await request(app.getHttpServer())
        .get(`/accounting/credit-notes/customer/${customerCreditNoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Amount=100, Allocated=60, Remaining=40
      expect(response.body.allocatedAmount).toBe('60');
      expect(response.body.status).toBe('PARTIALLY_APPLIED');
    });

    it('AC-07: should reject over-allocation', async () => {
      await request(app.getHttpServer())
        .post(`/accounting/credit-notes/customer/${customerCreditNoteId}/allocate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          allocations: [{ invoiceId: customerInvoiceId, amount: 100 }], // Only 40 remaining
        })
        .expect(400);
    });

    it('AC-08: should create refund and generate GL entry', async () => {
      const response = await request(app.getHttpServer())
        .post(`/accounting/credit-notes/customer/${customerCreditNoteId}/refund`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 20,
          method: 'CASH',
          ref: 'REF-001',
          memo: 'Partial refund',
        })
        .expect(201);

      expect(response.body.amount).toBe('20');
      expect(response.body.journalEntry).toBeDefined();
      expect(response.body.journalEntry.source).toBe('CUSTOMER_CREDIT_REFUND');
    });

    it('should reject refund exceeding remaining balance', async () => {
      // 100 - 60 (allocated) - 20 (refunded) = 20 remaining
      await request(app.getHttpServer())
        .post(`/accounting/credit-notes/customer/${customerCreditNoteId}/refund`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 50, // Only 20 remaining
          method: 'CASH',
        })
        .expect(400);
    });

    it('AC-06: should update status to APPLIED when fully exhausted', async () => {
      // Allocate remaining 20
      const response = await request(app.getHttpServer())
        .post(`/accounting/credit-notes/customer/${customerCreditNoteId}/allocate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          allocations: [{ invoiceId: customerInvoiceId, amount: 20 }],
        })
        .expect(201);

      expect(response.body.creditNote.status).toBe('APPLIED');
    });

    it('should reject allocation on fully applied credit note', async () => {
      await request(app.getHttpServer())
        .post(`/accounting/credit-notes/customer/${customerCreditNoteId}/allocate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          allocations: [{ invoiceId: customerInvoiceId, amount: 10 }],
        })
        .expect(400);
    });
  });

  // ===== Vendor Credit Note Tests =====

  describe('Vendor Credit Notes', () => {
    it('AC-11: should create vendor credit note in DRAFT status', async () => {
      const response = await request(app.getHttpServer())
        .post('/accounting/credit-notes/vendor')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vendorId,
          number: 'VCN-TEST-001',
          amount: 200,
          reason: 'Overcharge correction',
          memo: 'Vendor credit test',
        })
        .expect(201);

      expect(response.body.status).toBe('DRAFT');
      expect(response.body.amount).toBe('200');
      expect(response.body.vendor).toBeDefined();
      vendorCreditNoteId = response.body.id;
    });

    it('should list vendor credit notes', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/credit-notes/vendor')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get vendor credit note by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/accounting/credit-notes/vendor/${vendorCreditNoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(vendorCreditNoteId);
    });

    it('AC-12: should open vendor credit note with GL (Dr AP, Cr Expense)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/accounting/credit-notes/vendor/${vendorCreditNoteId}/open`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.status).toBe('OPEN');
      expect(response.body.journalEntry).toBeDefined();
      expect(response.body.journalEntry.source).toBe('VENDOR_CREDIT_NOTE');
    });

    it('should create vendor bill for allocation testing', async () => {
      // Create bill
      const billResponse = await request(app.getHttpServer())
        .post('/accounting/vendor-bills')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vendorId,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          subtotal: 300,
          tax: 0,
          total: 300,
        })
        .expect(201);

      vendorBillId = billResponse.body.id;

      // Open bill
      await request(app.getHttpServer())
        .post(`/accounting/vendor-bills/${vendorBillId}/open`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);
    });

    it('should allocate vendor credit to bill', async () => {
      const response = await request(app.getHttpServer())
        .post(`/accounting/credit-notes/vendor/${vendorCreditNoteId}/allocate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          allocations: [{ billId: vendorBillId, amount: 100 }],
        })
        .expect(201);

      expect(response.body.creditNote.allocatedAmount).toBe('100');
      expect(response.body.creditNote.status).toBe('PARTIALLY_APPLIED');
    });

    it('should create vendor credit refund (receive cash)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/accounting/credit-notes/vendor/${vendorCreditNoteId}/refund`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 50,
          method: 'BANK_TRANSFER',
          ref: 'VREF-001',
        })
        .expect(201);

      expect(response.body.amount).toBe('50');
      expect(response.body.journalEntry.source).toBe('VENDOR_CREDIT_REFUND');
    });

    it('should show correct remaining for vendor credit', async () => {
      const response = await request(app.getHttpServer())
        .get(`/accounting/credit-notes/vendor/${vendorCreditNoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 200 - 100 (allocated) - 50 (refunded) = 50 remaining
      expect(response.body.allocatedAmount).toBe('100');
      expect(response.body.refundedAmount).toBe('50');
    });
  });

  // ===== Void Tests =====

  describe('Void Operations', () => {
    let voidTestCreditNoteId: string;

    beforeAll(async () => {
      // Create a new credit note for void testing
      const response = await request(app.getHttpServer())
        .post('/accounting/credit-notes/customer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          number: 'CCN-VOID-TEST',
          amount: 50,
          reason: 'Void test',
        });
      voidTestCreditNoteId = response.body.id;

      // Open it
      await request(app.getHttpServer())
        .post(`/accounting/credit-notes/customer/${voidTestCreditNoteId}/open`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    afterAll(async () => {
      // Cleanup
      await prisma.client.customerCreditNote.deleteMany({
        where: { id: voidTestCreditNoteId },
      });
    });

    it('AC-09: should void open credit note with no allocations', async () => {
      const response = await request(app.getHttpServer())
        .post(`/accounting/credit-notes/customer/${voidTestCreditNoteId}/void`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.status).toBe('VOID');
    });

    it('AC-10: should reject voiding credit note with allocations', async () => {
      // The main customerCreditNoteId has allocations
      await request(app.getHttpServer())
        .post(`/accounting/credit-notes/customer/${customerCreditNoteId}/void`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  // ===== Delete Allocation Tests =====

  describe('Delete Allocations', () => {
    let deleteTestCreditNoteId: string;
    let deleteTestInvoiceId: string;
    let allocationId: string;

    beforeAll(async () => {
      // Create credit note
      const cnResponse = await request(app.getHttpServer())
        .post('/accounting/credit-notes/customer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          amount: 100,
          reason: 'Delete allocation test',
        });
      deleteTestCreditNoteId = cnResponse.body.id;

      // Open credit note
      await request(app.getHttpServer())
        .post(`/accounting/credit-notes/customer/${deleteTestCreditNoteId}/open`)
        .set('Authorization', `Bearer ${authToken}`);

      // Create invoice
      const invResponse = await request(app.getHttpServer())
        .post('/accounting/customer-invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          subtotal: 80,
          total: 80,
        });
      deleteTestInvoiceId = invResponse.body.id;

      await request(app.getHttpServer())
        .post(`/accounting/customer-invoices/${deleteTestInvoiceId}/open`)
        .set('Authorization', `Bearer ${authToken}`);

      // Allocate
      const allocResponse = await request(app.getHttpServer())
        .post(`/accounting/credit-notes/customer/${deleteTestCreditNoteId}/allocate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          allocations: [{ invoiceId: deleteTestInvoiceId, amount: 50 }],
        });

      allocationId = allocResponse.body.allocations[0].id;
    });

    afterAll(async () => {
      await prisma.client.customerCreditNoteAllocation.deleteMany({
        where: { creditNoteId: deleteTestCreditNoteId },
      });
      await prisma.client.customerCreditNote.deleteMany({
        where: { id: deleteTestCreditNoteId },
      });
      await prisma.client.customerInvoice.deleteMany({
        where: { id: deleteTestInvoiceId },
      });
    });

    it('should delete allocation and restore balances', async () => {
      await request(app.getHttpServer())
        .delete(`/accounting/credit-notes/customer/allocations/${allocationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify credit note is back to OPEN
      const cnResponse = await request(app.getHttpServer())
        .get(`/accounting/credit-notes/customer/${deleteTestCreditNoteId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(cnResponse.body.allocatedAmount).toBe('0');
      expect(cnResponse.body.status).toBe('OPEN');
    });
  });

  // ===== Authorization Tests =====

  describe('Authorization', () => {
    let waiterToken: string;

    beforeAll(async () => {
      // Login as waiter (L1 - should not have access to L4+ endpoints)
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: TAPAS_CREDENTIALS.waiter.email,
          password: TAPAS_CREDENTIALS.waiter.password,
        });
      waiterToken = loginResponse.body.access_token;
    });

    it('should deny L1 user access to credit notes', async () => {
      await request(app.getHttpServer())
        .get('/accounting/credit-notes/customer')
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(403);
    });

    it('should deny L1 user creating credit notes', async () => {
      await request(app.getHttpServer())
        .post('/accounting/credit-notes/customer')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({
          customerId,
          amount: 100,
        })
        .expect(403);
    });
  });

  // ===== Filter Tests =====

  describe('Filtering', () => {
    it('should filter credit notes by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/credit-notes/customer?status=APPLIED')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      response.body.forEach((cn: any) => {
        expect(cn.status).toBe('APPLIED');
      });
    });
  });
});
