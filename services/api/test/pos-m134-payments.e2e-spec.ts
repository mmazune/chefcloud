/**
 * M13.4: POS Payments Core E2E Tests
 * Tests for Payment Lifecycle, Cash Sessions, Receipts
 * 
 * Hypotheses Tested:
 * - H1: Cross-org access fails (RBAC + org scoping)
 * - H2: State machine transitions (AUTHORIZED → CAPTURED → REFUNDED)
 * - H3: Idempotency key collision
 * - H4: Cash drawer balance calculation
 * - H5: One OPEN session per branch
 * - H6: Receipt only for fully paid orders
 * - H7: Export CSV hash consistency
 * - H8: RBAC for void/refund (L4+)
 * - H9: FakeCardProvider deterministic tokens
 * - H10: Refund cap (refundedCents ≤ capturedCents)
 */

import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

describe('M13.4 POS Payments Core (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let l4AuthToken: string;
  let l3AuthToken: string;
  let otherOrgToken: string;
  let testOrg: any;
  let testBranch: any;
  let testUser: any;
  let l4User: any;
  let l3User: any;
  let testCategory: any;
  let testItem: any;
  let otherOrg: any;
  let otherBranch: any;

  const authHeaders = () => ({
    Authorization: `Bearer ${authToken}`,
    'x-org-id': testOrg.id,
  });

  const l3AuthHeaders = () => ({
    Authorization: `Bearer ${l3AuthToken}`,
    'x-org-id': testOrg.id,
  });

  const l4AuthHeaders = () => ({
    Authorization: `Bearer ${l4AuthToken}`,
    'x-org-id': testOrg.id,
  });

  const otherAuthHeaders = () => ({
    Authorization: `Bearer ${otherOrgToken}`,
    'x-org-id': otherOrg.id,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up existing test data
    // M13.5.1: Use simplified cleanup - find org IDs first, then clean with orgId filter
    // Many models (PosReceipt, CashSession, PosPaymentEvent) lack org relation
    const testOrgs = await prisma.client.org.findMany({
      where: { slug: { startsWith: 'm134-test' } },
      select: { id: true },
    });
    const testOrgIds = testOrgs.map((o) => o.id);
    if (testOrgIds.length > 0) {
      // Models without org relation - use orgId directly
      await prisma.client.posReceipt.deleteMany({ where: { orgId: { in: testOrgIds } } });
      await prisma.client.cashSession.deleteMany({ where: { orgId: { in: testOrgIds } } });
      // Models with org relation - standard cleanup
      await prisma.client.posPaymentEvent.deleteMany({ where: { orgId: { in: testOrgIds } } });
      await prisma.client.payment.deleteMany({ where: { order: { branch: { orgId: { in: testOrgIds } } } } });
      await prisma.client.orderItem.deleteMany({ where: { order: { branch: { orgId: { in: testOrgIds } } } } });
      await prisma.client.order.deleteMany({ where: { branch: { orgId: { in: testOrgIds } } } });
      await prisma.client.menuItem.deleteMany({ where: { orgId: { in: testOrgIds } } });
      await prisma.client.category.deleteMany({ where: { orgId: { in: testOrgIds } } });
      await prisma.client.user.deleteMany({ where: { orgId: { in: testOrgIds } } });
      await prisma.client.branch.deleteMany({ where: { orgId: { in: testOrgIds } } });
    }
    await prisma.client.org.deleteMany({ where: { slug: { startsWith: 'm134-test' } } });

    // Create test organization
    testOrg = await prisma.client.org.create({
      data: {
        name: 'M13.4 Test Org',
        slug: 'm134-test-org',
      },
    });

    // Create other organization for cross-org tests
    otherOrg = await prisma.client.org.create({
      data: {
        name: 'M13.4 Other Org',
        slug: 'm134-test-other',
      },
    });

    // Create test branches
    testBranch = await prisma.client.branch.create({
      data: {
        orgId: testOrg.id,
        name: 'M13.4 Test Branch',
        timezone: 'Africa/Kampala',
      },
    });

    otherBranch = await prisma.client.branch.create({
      data: {
        orgId: otherOrg.id,
        name: 'M13.4 Other Branch',
        timezone: 'Africa/Kampala',
      },
    });

    // Create test users (L2, L3, L4)
    testUser = await prisma.client.user.create({
      data: {
        orgId: testOrg.id,
        branchId: testBranch.id,
        email: 'm134-test@example.com',
        firstName: 'Test',
        lastName: 'User',
        passwordHash: '$2b$10$test',
        roleLevel: 'L2',
      },
    });

    l3User = await prisma.client.user.create({
      data: {
        orgId: testOrg.id,
        branchId: testBranch.id,
        email: 'm134-l3@example.com',
        firstName: 'L3',
        lastName: 'User',
        passwordHash: '$2b$10$test',
        roleLevel: 'L3',
      },
    });

    l4User = await prisma.client.user.create({
      data: {
        orgId: testOrg.id,
        branchId: testBranch.id,
        email: 'm134-l4@example.com',
        firstName: 'L4',
        lastName: 'User',
        passwordHash: '$2b$10$test',
        roleLevel: 'L4',
      },
    });

    const otherUser = await prisma.client.user.create({
      data: {
        orgId: otherOrg.id,
        branchId: otherBranch.id,
        email: 'm134-other@example.com',
        firstName: 'Other',
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
        name: 'M13.4 Test Category',
        sortOrder: 1,
      },
    });

    // Create test menu item
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

    l3AuthToken = jwt.sign(
      { sub: l3User.id, orgId: testOrg.id, branchId: testBranch.id, roleLevel: 'L3' },
      secret,
      { expiresIn: '1h' },
    );

    l4AuthToken = jwt.sign(
      { sub: l4User.id, orgId: testOrg.id, branchId: testBranch.id, roleLevel: 'L4' },
      secret,
      { expiresIn: '1h' },
    );

    otherOrgToken = jwt.sign(
      { sub: otherUser.id, orgId: otherOrg.id, branchId: otherBranch.id, roleLevel: 'L4' },
      secret,
      { expiresIn: '1h' },
    );
  }, 60000);

  afterAll(async () => {
    // Clean up test data
    // M13.5.1: Use simplified cleanup - find org IDs first, then clean with orgId filter
    const testOrgs = await prisma.client.org.findMany({
      where: { slug: { startsWith: 'm134-test' } },
      select: { id: true },
    });
    const testOrgIds = testOrgs.map((o) => o.id);
    if (testOrgIds.length > 0) {
      // Models without org relation - use orgId directly
      await prisma.client.posReceipt.deleteMany({ where: { orgId: { in: testOrgIds } } });
      await prisma.client.cashSession.deleteMany({ where: { orgId: { in: testOrgIds } } });
      await prisma.client.posPaymentEvent.deleteMany({ where: { orgId: { in: testOrgIds } } });
      await prisma.client.payment.deleteMany({ where: { order: { branch: { orgId: { in: testOrgIds } } } } });
      await prisma.client.orderItem.deleteMany({ where: { order: { branch: { orgId: { in: testOrgIds } } } } });
      await prisma.client.order.deleteMany({ where: { branch: { orgId: { in: testOrgIds } } } });
      await prisma.client.menuItem.deleteMany({ where: { orgId: { in: testOrgIds } } });
      await prisma.client.category.deleteMany({ where: { orgId: { in: testOrgIds } } });
      await prisma.client.user.deleteMany({ where: { orgId: { in: testOrgIds } } });
      await prisma.client.branch.deleteMany({ where: { orgId: { in: testOrgIds } } });
    }
    await prisma.client.org.deleteMany({ where: { slug: { startsWith: 'm134-test' } } });

    await app.close();
  }, 30000);

  // ===== Helper: Create Order =====

  async function createTestOrder(): Promise<any> {
    const res = await request(app.getHttpServer())
      .post('/pos/orders')
      .set(authHeaders())
      .set('x-idempotency-key', `m134-order-${Date.now()}-${Math.random()}`)
      .send({
        items: [
          {
            menuItemId: testItem.id,
            qty: 2,
            modifiers: [],
          },
        ],
      });
    expect(res.status).toBe(201);
    return res.body;
  }

  // ===== CASH Payment Tests =====

  describe('CASH Payments', () => {
    it('should create CASH payment and auto-capture (H2)', async () => {
      const order = await createTestOrder();

      const res = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m134-pay-${Date.now()}`)
        .send({
          method: 'CASH',
          amountCents: 2000, // $20.00
        });

      expect(res.status).toBe(201);
      expect(res.body.method).toBe('CASH');
      expect(res.body.posStatus).toBe('CAPTURED');
      expect(res.body.amountCents).toBe(2000);
      expect(res.body.capturedCents).toBe(2000);
    });

    it('should enforce idempotency on duplicate key (H3)', async () => {
      const order = await createTestOrder();
      const idempotencyKey = `m134-idem-${Date.now()}`;

      const res1 = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', idempotencyKey)
        .send({
          method: 'CASH',
          amountCents: 2000,
          idempotencyKey, // Include in body for service-level check
        });

      expect(res1.status).toBe(201);

      // Second request with same key should return existing
      const res2 = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', idempotencyKey)
        .send({
          method: 'CASH',
          amountCents: 2000,
          idempotencyKey, // Include in body for service-level check
        });

      expect(res2.status).toBe(201);
      expect(res2.body.id).toBe(res1.body.id);
    });

    it('should reject negative payment amount', async () => {
      const order = await createTestOrder();

      const res = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m134-neg-${Date.now()}`)
        .send({
          method: 'CASH',
          amountCents: -100,
        });

      expect(res.status).toBe(400);
    });
  });

  // ===== CARD Payment Tests (FakeCardProvider) =====

  describe('CARD Payments (FakeCardProvider)', () => {
    it('should authorize CARD payment successfully (H9)', async () => {
      const order = await createTestOrder();

      const res = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m134-card-${Date.now()}`)
        .send({
          method: 'CARD',
          amountCents: 2000,
          cardToken: 'test-token-success',
        });

      expect(res.status).toBe(201);
      expect(res.body.method).toBe('CARD');
      expect(res.body.posStatus).toBe('AUTHORIZED');
      expect(res.body.capturedCents).toBe(0);
      expect(res.body.providerRef).toBeDefined();
    });

    it('should capture authorized CARD payment (H2)', async () => {
      const order = await createTestOrder();

      // First authorize
      const authRes = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m134-cap-auth-${Date.now()}`)
        .send({
          method: 'CARD',
          amountCents: 2000,
          cardToken: 'test-token-success',
        });

      expect(authRes.status).toBe(201);
      expect(authRes.body.posStatus).toBe('AUTHORIZED');

      // Then capture
      const captureRes = await request(app.getHttpServer())
        .post(`/pos/payments/${authRes.body.id}/capture`)
        .set(authHeaders());

      expect(captureRes.status).toBe(201); // M13.5.3: POST returns 201
      expect(captureRes.body.posStatus).toBe('CAPTURED');
      expect(captureRes.body.capturedCents).toBe(2000);
    });

    it('should reject declined card token (H9)', async () => {
      const order = await createTestOrder();

      const res = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m134-decline-${Date.now()}`)
        .send({
          method: 'CARD',
          amountCents: 2000,
          cardToken: 'test-token-decline',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('declined');
    });

    it('should reject insufficient funds token (H9)', async () => {
      const order = await createTestOrder();

      const res = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m134-insuff-${Date.now()}`)
        .send({
          method: 'CARD',
          amountCents: 2000,
          cardToken: 'test-token-insufficient',
        });

      expect(res.status).toBe(400);
      expect(res.body.message.toLowerCase()).toContain('insufficient'); // M13.5.3: case-insensitive
    });
  });

  // ===== Void/Refund Tests =====

  describe('Void and Refund (L4+ only)', () => {
    it('should reject void by L2 user (H8)', async () => {
      const order = await createTestOrder();

      const payRes = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m134-void-rbac-${Date.now()}`)
        .send({ method: 'CASH', amountCents: 2000 });

      const voidRes = await request(app.getHttpServer())
        .post(`/pos/payments/${payRes.body.id}/void`)
        .set(authHeaders()) // L2 token
        .send({ reason: 'Test void reason' });

      expect(voidRes.status).toBe(403);
    });

    it('should allow void by L4 user (H8)', async () => {
      const order = await createTestOrder();

      // M13.5.3: Use CARD payment which stays AUTHORIZED (not auto-captured like CASH)
      const payRes = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m134-void-ok-${Date.now()}`)
        .send({ method: 'CARD', amountCents: 2000, cardToken: 'test-token-success' });

      expect(payRes.body.posStatus).toBe('AUTHORIZED'); // Confirm not captured

      const voidRes = await request(app.getHttpServer())
        .post(`/pos/payments/${payRes.body.id}/void`)
        .set(l4AuthHeaders())
        .send({ reason: 'Customer changed mind' });

      expect(voidRes.status).toBe(201); // M13.5.3: POST returns 201
      expect(voidRes.body.posStatus).toBe('VOIDED');
    });

    it('should reject void with short reason', async () => {
      const order = await createTestOrder();

      const payRes = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m134-void-short-${Date.now()}`)
        .send({ method: 'CASH', amountCents: 2000 });

      const voidRes = await request(app.getHttpServer())
        .post(`/pos/payments/${payRes.body.id}/void`)
        .set(l4AuthHeaders())
        .send({ reason: 'Short' }); // Less than 10 chars

      expect(voidRes.status).toBe(400);
    });

    it('should allow partial refund (H10)', async () => {
      const order = await createTestOrder();

      const payRes = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m134-refund-partial-${Date.now()}`)
        .send({ method: 'CASH', amountCents: 2000 });

      const refundRes = await request(app.getHttpServer())
        .post(`/pos/payments/${payRes.body.id}/refund`)
        .set(l4AuthHeaders())
        .send({ amountCents: 500, reason: 'Item returned by customer' });

      expect(refundRes.status).toBe(201); // M13.5.3: POST returns 201
      expect(refundRes.body.refundedCents).toBe(500);
    });

    it('should reject over-refund (H10)', async () => {
      const order = await createTestOrder();

      const payRes = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m134-refund-over-${Date.now()}`)
        .send({ method: 'CASH', amountCents: 2000 });

      const refundRes = await request(app.getHttpServer())
        .post(`/pos/payments/${payRes.body.id}/refund`)
        .set(l4AuthHeaders())
        .send({ amountCents: 3000, reason: 'More than captured' });

      expect(refundRes.status).toBe(400);
      expect(refundRes.body.message).toContain('exceed');
    });
  });

  // ===== Cash Session Tests =====

  describe('Cash Sessions', () => {
    it('should open cash session (L3+)', async () => {
      const res = await request(app.getHttpServer())
        .post('/pos/cash-sessions/open')
        .set(l3AuthHeaders())
        .send({ openingFloatCents: 5000 });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('OPEN');
      expect(res.body.openingFloatCents).toBe(5000);

      // Clean up for next test
      await prisma.client.cashSession.deleteMany({ where: { orgId: testOrg.id } });
    });

    it('should reject second OPEN session for same branch (H5)', async () => {
      // Open first session
      await request(app.getHttpServer())
        .post('/pos/cash-sessions/open')
        .set(l3AuthHeaders())
        .send({ openingFloatCents: 5000 });

      // Try to open second
      const res = await request(app.getHttpServer())
        .post('/pos/cash-sessions/open')
        .set(l3AuthHeaders())
        .send({ openingFloatCents: 3000 });

      expect(res.status).toBe(400); // M13.5.3: API uses BadRequest consistently
      expect(res.body.message).toContain('already open');

      // Clean up
      await prisma.client.cashSession.deleteMany({ where: { orgId: testOrg.id } });
    });

    it('should close session and calculate expected cash (H4)', async () => {
      // Open session
      const openRes = await request(app.getHttpServer())
        .post('/pos/cash-sessions/open')
        .set(l3AuthHeaders())
        .send({ openingFloatCents: 5000 });

      expect(openRes.status).toBe(201); // M13.5.3: Verify open succeeded
      expect(openRes.body.id).toBeDefined();

      // Create an order and pay with cash
      const order = await createTestOrder();
      await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m134-session-pay-${Date.now()}`)
        .send({ method: 'CASH', amountCents: 2000 });

      // Close session
      const closeRes = await request(app.getHttpServer())
        .post(`/pos/cash-sessions/${openRes.body.id}/close`)
        .set(l3AuthHeaders())
        .send({ countedCashCents: 6900 });

      expect(closeRes.status).toBe(201); // M13.5.3: POST returns 201
      expect(closeRes.body.status).toBe('CLOSED');
      expect(closeRes.body.expectedCashCents).toBe(7000); // 5000 + 2000
      expect(closeRes.body.countedCashCents).toBe(6900);

      // Clean up
      await prisma.client.cashSession.deleteMany({ where: { orgId: testOrg.id } });
    });

    it('should reject open by L2 user (RBAC)', async () => {
      const res = await request(app.getHttpServer())
        .post('/pos/cash-sessions/open')
        .set(authHeaders()) // L2 token
        .send({ openingFloatCents: 5000 });

      expect(res.status).toBe(403);
    });
  });

  // ===== Receipt Tests =====

  describe('Receipts', () => {
    it('should issue receipt for fully paid order (H6)', async () => {
      const order = await createTestOrder();

      // Pay the order fully
      await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m134-receipt-pay-${Date.now()}`)
        .send({ method: 'CASH', amountCents: 2000 });

      // Issue receipt
      const res = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/receipt`)
        .set(authHeaders());

      expect(res.status).toBe(201);
      expect(res.body.receiptNumber).toMatch(/^RCP-\d{6}$/);
      expect(res.body.totalsSnapshot).toBeDefined();
    });

    it('should reject receipt for unpaid order (H6)', async () => {
      const order = await createTestOrder();

      const res = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/receipt`)
        .set(authHeaders());

      expect(res.status).toBe(400);
      // M13.5.3: API message format: "Order requires X cents but only Y cents captured"
      expect(res.body.message).toMatch(/requires.*cents|not fully paid/);
    });

    it('should be idempotent - return same receipt', async () => {
      const order = await createTestOrder();

      await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m134-receipt-idem-${Date.now()}`)
        .send({ method: 'CASH', amountCents: 2000 });

      const res1 = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/receipt`)
        .set(authHeaders());

      const res2 = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/receipt`)
        .set(authHeaders());

      expect(res1.body.id).toBe(res2.body.id);
    });
  });

  // ===== Cross-Org Security Tests =====

  describe('Cross-org security (H1)', () => {
    it('should reject payment on other org order', async () => {
      const order = await createTestOrder();

      const res = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(otherAuthHeaders())
        .set('x-idempotency-key', `m134-xorg-${Date.now()}`)
        .send({ method: 'CASH', amountCents: 2000 });

      expect(res.status).toBe(400); // M13.5.3: API uses BadRequest for "not found or access denied"
    });

    it('should reject capture on other org payment', async () => {
      const order = await createTestOrder();

      const payRes = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m134-xorg-cap-${Date.now()}`)
        .send({ method: 'CARD', amountCents: 2000, cardToken: 'test-token-success' });

      const captureRes = await request(app.getHttpServer())
        .post(`/pos/payments/${payRes.body.id}/capture`)
        .set(otherAuthHeaders());

      expect(captureRes.status).toBe(400); // M13.5.3: API uses BadRequest for "not found or access denied"
    });
  });

  // ===== CSV Export Tests =====

  describe('CSV Exports (H7)', () => {
    it('should export receipts CSV with hash header', async () => {
      // Ensure at least one receipt exists
      const order = await createTestOrder();
      await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m134-csv-pay-${Date.now()}`)
        .send({ method: 'CASH', amountCents: 2000 });

      await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/receipt`)
        .set(authHeaders());

      const res = await request(app.getHttpServer())
        .get('/pos/export/receipts.csv')
        .set(l4AuthHeaders());

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['x-nimbus-export-hash']).toBeDefined();
      expect(res.headers['x-nimbus-export-hash']).toHaveLength(64); // SHA-256 hex
    });

    it('should export cash sessions CSV with hash header', async () => {
      // Open and close a session
      const openRes = await request(app.getHttpServer())
        .post('/pos/cash-sessions/open')
        .set(l3AuthHeaders())
        .send({ openingFloatCents: 5000 });

      await request(app.getHttpServer())
        .post(`/pos/cash-sessions/${openRes.body.id}/close`)
        .set(l3AuthHeaders())
        .send({ countedCashCents: 5000 });

      const res = await request(app.getHttpServer())
        .get('/pos/export/cash-sessions.csv')
        .set(l4AuthHeaders());

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['x-nimbus-export-hash']).toBeDefined();

      // Clean up
      await prisma.client.cashSession.deleteMany({ where: { orgId: testOrg.id } });
    });

    it('should reject CSV export by non-L4 user (RBAC)', async () => {
      const res = await request(app.getHttpServer())
        .get('/pos/export/receipts.csv')
        .set(authHeaders()); // L2 token

      expect(res.status).toBe(403);
    });
  });

  // ===== Query Endpoints =====

  describe('Query Endpoints', () => {
    it('should list payments for order', async () => {
      const order = await createTestOrder();

      await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m134-list-${Date.now()}`)
        .send({ method: 'CASH', amountCents: 2000 });

      const res = await request(app.getHttpServer())
        .get(`/pos/orders/${order.id}/payments`)
        .set(authHeaders());

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should get payment by id', async () => {
      const order = await createTestOrder();

      const payRes = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/payments`)
        .set(authHeaders())
        .set('x-idempotency-key', `m134-get-${Date.now()}`)
        .send({ method: 'CASH', amountCents: 2000 });

      const res = await request(app.getHttpServer())
        .get(`/pos/payments/${payRes.body.id}`)
        .set(authHeaders());

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(payRes.body.id);
    });

    it('should list cash sessions', async () => {
      const res = await request(app.getHttpServer())
        .get('/pos/cash-sessions')
        .set(authHeaders());

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
