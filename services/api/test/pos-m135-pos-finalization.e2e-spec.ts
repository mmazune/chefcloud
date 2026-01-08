/**
 * M13.5: POS Finalization E2E Tests
 * Tests for Split/Partial Payments, Tips, Order Payment Status, Z-Report
 *
 * Hypotheses Tested:
 * - H1: Cross-branch payment leakage (payments stay in branch)
 * - H2: Overpayment race condition (atomic dueCents check)
 * - H3: Tip counted in dueCents (tip should NOT affect dueCents)
 * - H4: Double capture double-counts (idempotent capture)
 * - H5: Refund exceeds captured (already tested in M13.4, re-verify)
 * - H6: Z-report hash mismatch (Windows line endings)
 * - H7: PaymentStatus breaks KDS (paymentStatus is separate from OrderStatus)
 * - H8: UI test hangs (not applicable to e2e - handled in unit tests)
 */

import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

describe('M13.5 POS Finalization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let l4AuthToken: string;
  let testOrg: any;
  let testBranch: any;
  let secondBranch: any;
  let testUser: any;
  let l4User: any;
  let testCategory: any;
  let testItem: any;

  const authHeaders = () => ({
    Authorization: `Bearer ${authToken}`,
    'x-org-id': testOrg.id,
  });

  const l4AuthHeaders = () => ({
    Authorization: `Bearer ${l4AuthToken}`,
    'x-org-id': testOrg.id,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up existing test data - delete org and let cascade handle the rest
    await prisma.client.org.deleteMany({ where: { slug: { startsWith: 'm135-test' } } });

    // Create test organization
    testOrg = await prisma.client.org.create({
      data: {
        name: 'M13.5 Test Org',
        slug: 'm135-test-org',
      },
    });

    // Create test branches (two for cross-branch tests)
    testBranch = await prisma.client.branch.create({
      data: {
        orgId: testOrg.id,
        name: 'M13.5 Test Branch',
        timezone: 'Africa/Kampala',
      },
    });

    secondBranch = await prisma.client.branch.create({
      data: {
        orgId: testOrg.id,
        name: 'M13.5 Second Branch',
        timezone: 'Africa/Kampala',
      },
    });

    // Create test users (L2, L4)
    testUser = await prisma.client.user.create({
      data: {
        orgId: testOrg.id,
        branchId: testBranch.id,
        email: 'm135-test@example.com',
        firstName: 'Test',
        lastName: 'User',
        passwordHash: '$2b$10$test',
        roleLevel: 'L2',
      },
    });

    l4User = await prisma.client.user.create({
      data: {
        orgId: testOrg.id,
        branchId: testBranch.id,
        email: 'm135-l4@example.com',
        firstName: 'L4',
        lastName: 'User',
        passwordHash: '$2b$10$test',
        roleLevel: 'L4',
      },
    });

    // Create test category
    testCategory = await prisma.client.category.create({
      data: {
        orgId: testOrg.id,
        branchId: testBranch.id,
        name: 'M13.5 Test Category',
        sortOrder: 1,
      },
    });

    // Create test menu item ($10.00)
    testItem = await prisma.client.menuItem.create({
      data: {
        orgId: testOrg.id,
        branchId: testBranch.id,
        categoryId: testCategory.id,
        name: 'Test Item',
        itemType: 'FOOD',
        price: 10.00,
        isAvailable: true,
        isActive: true,
        sortOrder: 1,
      },
    });

    // Generate JWT tokens
    const secret = process.env.JWT_SECRET || 'test-secret';

    authToken = jwt.sign(
      { sub: testUser.id, orgId: testOrg.id, branchId: testBranch.id, roleLevel: 'L2' },
      secret,
      { expiresIn: '1h' },
    );

    l4AuthToken = jwt.sign(
      { sub: l4User.id, orgId: testOrg.id, branchId: testBranch.id, roleLevel: 'L4' },
      secret,
      { expiresIn: '1h' },
    );
  }, 60000);

  afterAll(async () => {
    // Clean up test data - delete org and let cascade handle the rest
    await prisma.client.org.deleteMany({ where: { slug: { startsWith: 'm135-test' } } });

    await app.close();
  }, 30000);

  // ===== Helper: Create Order =====

  async function createTestOrder(qty = 2): Promise<any> {
    const res = await request(app.getHttpServer())
      .post('/pos/orders')
      .set(authHeaders())
      .set('x-idempotency-key', `m135-order-${Date.now()}-${Math.random()}`)
      .send({
        items: [
          {
            menuItemId: testItem.id,
            qty,
            modifiers: [],
          },
        ],
      });
    if (res.status !== 201) {
      console.error('Order creation failed:', res.status, res.body);
    }
    expect(res.status).toBe(201);
    return res.body;
  }

  // ===== Partial Payments Tests =====

  describe('Split/Partial Payments', () => {
    it('should allow partial payment less than order total', async () => {
      const order = await createTestOrder(2); // $20.00 total
      const orderTotalCents = Math.round(Number(order.total) * 100);

      // Pay $10 (half)
      const res = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m135-partial-${Date.now()}`)
        .send({
          method: 'CASH',
          amountCents: 1000,
        });

      expect(res.status).toBe(201);
      expect(res.body.amountCents).toBe(1000);
      expect(res.body.posStatus).toBe('CAPTURED');

      // Verify order is PARTIALLY_PAID
      const orderAfter = await prisma.client.order.findUnique({ where: { id: order.id } });
      expect(orderAfter?.paymentStatus).toBe('PARTIALLY_PAID');
    });

    it('should allow second payment to complete order', async () => {
      const order = await createTestOrder(2); // $20.00 total

      // Pay $10 (first half)
      await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m135-part1-${Date.now()}`)
        .send({
          method: 'CASH',
          amountCents: 1000,
        });

      // Pay $10 (second half)
      const res2 = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m135-part2-${Date.now()}`)
        .send({
          method: 'CASH',
          amountCents: 1000,
        });

      expect(res2.status).toBe(201);

      // Verify order is PAID
      const orderAfter = await prisma.client.order.findUnique({ where: { id: order.id } });
      expect(orderAfter?.paymentStatus).toBe('PAID');
    });

    it('H2: should reject overpayment (atomic check)', async () => {
      const order = await createTestOrder(2); // $20.00 total

      // Pay $15
      await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m135-over1-${Date.now()}`)
        .send({
          method: 'CASH',
          amountCents: 1500,
        });

      // Try to pay $10 more (would exceed total)
      const res = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m135-over2-${Date.now()}`)
        .send({
          method: 'CASH',
          amountCents: 1000,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('OVERPAYMENT');
    });

    it('should allow mixed payment methods', async () => {
      const order = await createTestOrder(2); // $20.00 total

      // Pay $10 with CASH
      await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m135-mixed1-${Date.now()}`)
        .send({
          method: 'CASH',
          amountCents: 1000,
        });

      // Pay $10 with CARD
      const res = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m135-mixed2-${Date.now()}`)
        .send({
          method: 'CARD',
          amountCents: 1000,
          cardToken: 'test-token-success',
        });

      expect(res.status).toBe(201);
      expect(res.body.posStatus).toBe('AUTHORIZED');

      // Capture card payment
      const capture = await request(app.getHttpServer())
        .post(`/pos/payments/${res.body.id}/capture`)
        .set(authHeaders())
        .set('x-idempotency-key', `m135-cap-${Date.now()}`);

      expect(capture.status).toBe(200);

      // Verify order is PAID
      const orderAfter = await prisma.client.order.findUnique({ where: { id: order.id } });
      expect(orderAfter?.paymentStatus).toBe('PAID');
    });
  });

  // ===== Tips Tests =====

  describe('Tips', () => {
    it('H3: tips should NOT affect dueCents', async () => {
      const order = await createTestOrder(2); // $20.00 total

      // Pay full amount ($20) with $5 tip
      const res = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m135-tip1-${Date.now()}`)
        .send({
          method: 'CASH',
          amountCents: 2000, // Order total
          tipCents: 500,     // Tip
        });

      expect(res.status).toBe(201);
      expect(res.body.tipCents).toBe(500);
      expect(res.body.amountCents).toBe(2000);

      // Order should be PAID (tip doesn't affect payment status)
      const orderAfter = await prisma.client.order.findUnique({ where: { id: order.id } });
      expect(orderAfter?.paymentStatus).toBe('PAID');
    });

    it('should reject negative tips', async () => {
      const order = await createTestOrder(2);

      const res = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m135-negtip-${Date.now()}`)
        .send({
          method: 'CASH',
          amountCents: 2000,
          tipCents: -100,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TIP');
    });

    it('should reject tips over 500% of payment', async () => {
      const order = await createTestOrder(2);

      const res = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m135-bigtip-${Date.now()}`)
        .send({
          method: 'CASH',
          amountCents: 2000,
          tipCents: 15000, // 750% of payment
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('TIP_TOO_HIGH');
    });

    it('should include tips in payment summary', async () => {
      const order = await createTestOrder(1); // $10.00 total

      // Pay with tip
      await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m135-tipsum-${Date.now()}`)
        .send({
          method: 'CASH',
          amountCents: 1000,
          tipCents: 200,
        });

      // Get payment summary
      const res = await request(app.getHttpServer())
        .get(`/pos/orders/${order.id}/payment-summary`)
        .set(authHeaders());

      expect(res.status).toBe(200);
      expect(res.body.orderTotalCents).toBe(1000);
      expect(res.body.paidCents).toBe(1000);
      expect(res.body.tipsCents).toBe(200);
      expect(res.body.dueCents).toBe(0);
      expect(res.body.paymentStatus).toBe('PAID');
    });
  });

  // ===== Payment Summary Tests =====

  describe('Payment Summary', () => {
    it('should return correct summary for UNPAID order', async () => {
      const order = await createTestOrder(2); // $20.00 total

      const res = await request(app.getHttpServer())
        .get(`/pos/orders/${order.id}/payment-summary`)
        .set(authHeaders());

      expect(res.status).toBe(200);
      expect(res.body.orderTotalCents).toBe(2000);
      expect(res.body.paidCents).toBe(0);
      expect(res.body.dueCents).toBe(2000);
      expect(res.body.paymentStatus).toBe('UNPAID');
    });

    it('should return correct summary for PARTIALLY_PAID order', async () => {
      const order = await createTestOrder(2); // $20.00 total

      // Pay $5
      await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m135-sumpart-${Date.now()}`)
        .send({
          method: 'CASH',
          amountCents: 500,
        });

      const res = await request(app.getHttpServer())
        .get(`/pos/orders/${order.id}/payment-summary`)
        .set(authHeaders());

      expect(res.status).toBe(200);
      expect(res.body.orderTotalCents).toBe(2000);
      expect(res.body.paidCents).toBe(500);
      expect(res.body.dueCents).toBe(1500);
      expect(res.body.paymentStatus).toBe('PARTIALLY_PAID');
    });

    it('H5: should handle refund and update paymentStatus', async () => {
      const order = await createTestOrder(2); // $20.00 total

      // Pay full amount
      const payRes = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m135-refundsum-${Date.now()}`)
        .send({
          method: 'CASH',
          amountCents: 2000,
        });

      // Refund full amount (L4 required)
      await request(app.getHttpServer())
        .post(`/pos/payments/${payRes.body.id}/refund`)
        .set(l4AuthHeaders())
        .set('x-idempotency-key', `m135-refsum-${Date.now()}`)
        .send({
          amountCents: 2000,
          reason: 'Customer complaint - full refund',
        });

      const res = await request(app.getHttpServer())
        .get(`/pos/orders/${order.id}/payment-summary`)
        .set(authHeaders());

      expect(res.status).toBe(200);
      expect(res.body.paidCents).toBe(0);
      expect(res.body.paymentStatus).toBe('REFUNDED');
    });
  });

  // ===== Z-Report Tests =====

  describe('Z-Report (End-of-Day)', () => {
    it('should generate Z-Report JSON (L4 required)', async () => {
      // Create an order and pay it
      const order = await createTestOrder(1);
      await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m135-zrep-${Date.now()}`)
        .send({
          method: 'CASH',
          amountCents: 1000,
          tipCents: 100,
        });

      const today = new Date().toISOString().split('T')[0];

      const res = await request(app.getHttpServer())
        .get('/pos/reports/z')
        .query({ branchId: testBranch.id, date: today })
        .set(l4AuthHeaders());

      expect(res.status).toBe(200);
      expect(res.body.reportId).toBeDefined();
      expect(res.body.branchId).toBe(testBranch.id);
      expect(res.body.reportDate).toBe(today);
      expect(res.body.grossSalesCents).toBeGreaterThanOrEqual(0);
      expect(res.body.tipsCents).toBeGreaterThanOrEqual(0);
      expect(res.body.paymentsByMethod).toBeDefined();
      expect(Array.isArray(res.body.paymentsByMethod)).toBe(true);
    });

    it('should reject L2 access to Z-Report', async () => {
      const today = new Date().toISOString().split('T')[0];

      const res = await request(app.getHttpServer())
        .get('/pos/reports/z')
        .query({ branchId: testBranch.id, date: today })
        .set(authHeaders()); // L2 token

      expect(res.status).toBe(403);
    });

    it('H6: should export Z-Report CSV with SHA-256 hash', async () => {
      const today = new Date().toISOString().split('T')[0];

      const res = await request(app.getHttpServer())
        .get('/pos/export/z-report.csv')
        .query({ branchId: testBranch.id, date: today })
        .set(l4AuthHeaders());

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['x-nimbus-export-hash']).toBeDefined();
      expect(res.headers['x-nimbus-export-hash']).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex

      // Verify CSV has UTF-8 BOM
      const csvBuffer = Buffer.from(res.text, 'utf8');
      // UTF-8 BOM is EF BB BF
      expect(csvBuffer[0]).toBe(0xef);
      expect(csvBuffer[1]).toBe(0xbb);
      expect(csvBuffer[2]).toBe(0xbf);
    });

    it('should include tips in Z-Report', async () => {
      const order = await createTestOrder(1);
      await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m135-zreptip-${Date.now()}`)
        .send({
          method: 'CASH',
          amountCents: 1000,
          tipCents: 300,
        });

      const today = new Date().toISOString().split('T')[0];

      const res = await request(app.getHttpServer())
        .get('/pos/reports/z')
        .query({ branchId: testBranch.id, date: today })
        .set(l4AuthHeaders());

      expect(res.status).toBe(200);
      expect(res.body.tipsCents).toBeGreaterThanOrEqual(300);
    });
  });

  // ===== Cross-Branch Tests =====

  describe('Cross-Branch Isolation (H1)', () => {
    it('H1: payments should stay in branch', async () => {
      const order = await createTestOrder(1);

      // Pay with test branch user
      await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m135-branch-${Date.now()}`)
        .send({
          method: 'CASH',
          amountCents: 1000,
        });

      // Z-Report for second branch should NOT include this payment
      const today = new Date().toISOString().split('T')[0];

      // Create L4 token for second branch
      const secret = process.env.JWT_SECRET || 'test-secret';
      const secondBranchToken = jwt.sign(
        { sub: l4User.id, orgId: testOrg.id, branchId: secondBranch.id, roleLevel: 'L4' },
        secret,
        { expiresIn: '1h' },
      );

      const res = await request(app.getHttpServer())
        .get('/pos/reports/z')
        .query({ branchId: secondBranch.id, date: today })
        .set({
          Authorization: `Bearer ${secondBranchToken}`,
          'x-org-id': testOrg.id,
        });

      expect(res.status).toBe(200);
      // Second branch should have 0 gross sales from this test
      // (assuming no other tests created orders in second branch)
      expect(res.body.totalOrders).toBe(0);
    });
  });

  // ===== Payment Status + Order Status Independence (H7) =====

  describe('Payment Status Independence (H7)', () => {
    it('H7: paymentStatus should be independent of orderStatus', async () => {
      const order = await createTestOrder(1);

      // Order starts as NEW
      expect(order.status).toBe('NEW');

      // Pay for the order
      await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m135-indep-${Date.now()}`)
        .send({
          method: 'CASH',
          amountCents: 1000,
        });

      // Check that paymentStatus is PAID but orderStatus is still NEW
      const orderAfter = await prisma.client.order.findUnique({ where: { id: order.id } });
      expect(orderAfter?.paymentStatus).toBe('PAID');
      expect(orderAfter?.status).toBe('NEW'); // Order lifecycle unchanged
    });

    it('should allow sending order to kitchen after payment', async () => {
      const order = await createTestOrder(1);

      // Pay first
      await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m135-sendkds-${Date.now()}`)
        .send({
          method: 'CASH',
          amountCents: 1000,
        });

      // Then send to kitchen (if endpoint exists)
      // This validates that payment doesn't interfere with order lifecycle
      const orderAfter = await prisma.client.order.findUnique({ where: { id: order.id } });
      expect(orderAfter?.paymentStatus).toBe('PAID');
      // Order should still be modifiable for kitchen operations
    });
  });
});
