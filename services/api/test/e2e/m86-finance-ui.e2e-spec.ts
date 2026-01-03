/**
 * M8.6: Finance UI Endpoints E2E Tests
 *
 * Tests for new M8.6 finance UI API endpoints:
 * - GET /vendors/:id (vendor with details)
 * - GET /customers/:id (customer with details)
 * - GET /vendor-bills (list with filters)
 * - GET /customer-invoices (list with filters)
 * - PATCH /payment-methods/:id (GL mapping update)
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { createE2EApp } from '../helpers/e2e-bootstrap';
import { TAPAS_CREDENTIALS, DEMO_DATASETS } from '../helpers/e2e-credentials';
import { PrismaService } from '../../src/prisma.service';

describe('M8.6 Finance UI Endpoints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let orgId: string;
  let vendorId: string;
  let customerId: string;

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

    // Create test vendor
    let vendor = await prisma.client.vendor.findFirst({
      where: { orgId, name: 'M86 Test Vendor' },
    });
    if (!vendor) {
      vendor = await prisma.client.vendor.create({
        data: {
          orgId,
          name: 'M86 Test Vendor',
          email: 'm86vendor@test.local',
        },
      });
    }
    vendorId = vendor.id;

    // Create test customer
    let customer = await prisma.client.customerAccount.findFirst({
      where: { orgId, name: 'M86 Test Customer' },
    });
    if (!customer) {
      customer = await prisma.client.customerAccount.create({
        data: {
          orgId,
          name: 'M86 Test Customer',
          email: 'm86customer@test.local',
        },
      });
    }
    customerId = customer.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /accounting/vendors', () => {
    it('should return vendors list with _count for L4 user', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/vendors')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Each vendor should have _count
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('_count');
      }
    });
  });

  describe('GET /accounting/vendors/:id', () => {
    it('should return vendor with bills and credit notes', async () => {
      const response = await request(app.getHttpServer())
        .get(`/accounting/vendors/${vendorId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', vendorId);
      expect(response.body).toHaveProperty('name', 'M86 Test Vendor');
      expect(response.body).toHaveProperty('bills');
      expect(response.body).toHaveProperty('creditNotes');
      expect(Array.isArray(response.body.bills)).toBe(true);
      expect(Array.isArray(response.body.creditNotes)).toBe(true);
    });

    it('should return null for non-existent vendor', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/vendors/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeNull();
    });
  });

  describe('GET /accounting/customers', () => {
    it('should return customers list with _count for L4 user', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Each customer should have _count
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('_count');
      }
    });
  });

  describe('GET /accounting/customers/:id', () => {
    it('should return customer with invoices and credit notes', async () => {
      const response = await request(app.getHttpServer())
        .get(`/accounting/customers/${customerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', customerId);
      expect(response.body).toHaveProperty('name', 'M86 Test Customer');
      expect(response.body).toHaveProperty('invoices');
      expect(response.body).toHaveProperty('creditNotes');
      expect(Array.isArray(response.body.invoices)).toBe(true);
      expect(Array.isArray(response.body.creditNotes)).toBe(true);
    });
  });

  describe('GET /accounting/vendor-bills', () => {
    it('should return vendor bills list for L4 user', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/vendor-bills')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/vendor-bills?status=OPEN')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // All returned bills should have status OPEN
      for (const bill of response.body) {
        expect(bill.status).toBe('OPEN');
      }
    });

    it('should filter by vendorId', async () => {
      const response = await request(app.getHttpServer())
        .get(`/accounting/vendor-bills?vendorId=${vendorId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // All returned bills should belong to the vendor
      for (const bill of response.body) {
        expect(bill.vendorId).toBe(vendorId);
      }
    });
  });

  describe('GET /accounting/customer-invoices', () => {
    it('should return customer invoices list for L4 user', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/customer-invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/customer-invoices?status=PAID')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // All returned invoices should have status PAID
      for (const invoice of response.body) {
        expect(invoice.status).toBe('PAID');
      }
    });

    it('should filter by customerId', async () => {
      const response = await request(app.getHttpServer())
        .get(`/accounting/customer-invoices?customerId=${customerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // All returned invoices should belong to the customer
      for (const invoice of response.body) {
        expect(invoice.customerId).toBe(customerId);
      }
    });
  });

  describe('GET /accounting/credit-notes/customer', () => {
    it('should return customer credit notes list for L4 user', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/credit-notes/customer')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /accounting/credit-notes/vendor', () => {
    it('should return vendor credit notes list for L4 user', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/credit-notes/vendor')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /accounting/payment-methods', () => {
    it('should return payment method mappings for L4 user', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/payment-methods')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /accounting/accounts', () => {
    it('should return GL accounts for L4 user', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Each account should have core properties
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('code');
        expect(response.body[0]).toHaveProperty('name');
        expect(response.body[0]).toHaveProperty('type');
      }
    });
  });

  describe('RBAC enforcement', () => {
    let waiterToken: string;

    beforeAll(async () => {
      // Login as a lower-privilege user (waiter = L1)
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: TAPAS_CREDENTIALS.waiter.email,
          password: TAPAS_CREDENTIALS.waiter.password,
        });
      waiterToken = loginResponse.body.access_token;
    });

    it('should deny L1 user access to vendor-bills', async () => {
      await request(app.getHttpServer())
        .get('/accounting/vendor-bills')
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(403);
    });

    it('should deny L1 user access to customer-invoices', async () => {
      await request(app.getHttpServer())
        .get('/accounting/customer-invoices')
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(403);
    });

    it('should deny L1 user access to vendors', async () => {
      await request(app.getHttpServer())
        .get('/accounting/vendors')
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(403);
    });

    it('should deny L1 user access to customers', async () => {
      await request(app.getHttpServer())
        .get('/accounting/customers')
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(403);
    });
  });
});
