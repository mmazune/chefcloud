/**
 * M13.3 Kitchen Routing + KDS Tickets + Order Lifecycle
 * E2E Tests for:
 * - Ticket generation from orders
 * - State machine transitions (QUEUED → IN_PROGRESS → READY → DONE | VOID)
 * - Station routing based on MenuItem.station
 * - Order auto-completion when all tickets DONE
 * - CSV export with SHA-256 hash
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma.service';
import { AuthHelpers } from '../auth/auth.helpers';

describe('M13.3 KDS Order Routing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test data IDs
  let orgId: string;
  let branchId: string;
  let userId: string;
  let tableId: string;
  let menuItemGrill: string;
  let menuItemBar: string;
  let categoryId: string;

  // JWT tokens
  let l2Token: string;
  let l4Token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    // Create test org
    const org = await prisma.client.org.create({
      data: {
        name: 'M13.3 Test Org',
        slug: `m133-test-${Date.now()}`,
        subscriptionStatus: 'ACTIVE',
      },
    });
    orgId = org.id;

    // Create test branch
    const branch = await prisma.client.branch.create({
      data: {
        orgId,
        name: 'M13.3 Test Branch',
        address: '123 Test Street',
        currencyCode: 'USD',
        timezone: 'America/New_York',
      },
    });
    branchId = branch.id;

    // Create test user (L2)
    const l2User = await prisma.client.user.create({
      data: {
        email: `m133-l2-${Date.now()}@test.com`,
        password: await AuthHelpers.hash('test1234'),
        firstName: 'Test',
        lastName: 'Kitchen',
        role: 'L2',
        orgId,
        branchId,
      },
    });

    // Create test user (L4)
    const l4User = await prisma.client.user.create({
      data: {
        email: `m133-l4-${Date.now()}@test.com`,
        password: await AuthHelpers.hash('test1234'),
        firstName: 'Test',
        lastName: 'Manager',
        role: 'L4',
        orgId,
        branchId,
      },
    });
    userId = l2User.id;

    // Generate JWT tokens
    l2Token = AuthHelpers.signJwt({
      sub: l2User.id,
      orgId,
      branchId,
      role: 'L2',
    });

    l4Token = AuthHelpers.signJwt({
      sub: l4User.id,
      orgId,
      branchId,
      role: 'L4',
    });

    // Create table
    const table = await prisma.client.table.create({
      data: {
        branchId,
        label: 'T1',
        capacity: 4,
      },
    });
    tableId = table.id;

    // Create menu category
    const category = await prisma.client.menuCategory.create({
      data: {
        branchId,
        name: 'Test Category',
        sortOrder: 0,
      },
    });
    categoryId = category.id;

    // Create menu item for GRILL station
    const grillItem = await prisma.client.menuItem.create({
      data: {
        branchId,
        categoryId,
        name: 'Grilled Steak',
        price: 25.0,
        isAvailable: true,
        station: 'GRILL',
      },
    });
    menuItemGrill = grillItem.id;

    // Create menu item for BAR station
    const barItem = await prisma.client.menuItem.create({
      data: {
        branchId,
        categoryId,
        name: 'Craft Cocktail',
        price: 12.0,
        isAvailable: true,
        station: 'BAR',
      },
    });
    menuItemBar = barItem.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (orgId) {
      await prisma.client.org.delete({ where: { id: orgId } }).catch(() => { });
    }
    await app.close();
  });

  describe('Ticket Generation', () => {
    let orderId: string;

    it('should create KDS tickets grouped by station when order is created', async () => {
      // Create order with items for different stations
      const res = await request(app.getHttpServer())
        .post('/pos/orders')
        .set('Authorization', `Bearer ${l2Token}`)
        .send({
          tableId,
          items: [
            { menuItemId: menuItemGrill, qty: 2 },
            { menuItemId: menuItemBar, qty: 1 },
          ],
        })
        .expect(201);

      orderId = res.body.id;

      // Verify tickets were created
      const tickets = await prisma.client.kdsTicket.findMany({
        where: { orderId },
        include: { lines: true },
      });

      expect(tickets).toHaveLength(2); // One for GRILL, one for BAR

      const grillTicket = tickets.find((t) => t.station === 'GRILL');
      const barTicket = tickets.find((t) => t.station === 'BAR');

      expect(grillTicket).toBeDefined();
      expect(grillTicket?.status).toBe('QUEUED');
      expect(grillTicket?.lines).toHaveLength(1);
      expect(grillTicket?.lines[0].qty).toBe(2);

      expect(barTicket).toBeDefined();
      expect(barTicket?.status).toBe('QUEUED');
      expect(barTicket?.lines).toHaveLength(1);
      expect(barTicket?.lines[0].qty).toBe(1);
    });

    it('should be idempotent - creating same order should not duplicate tickets', async () => {
      // Try to regenerate tickets for same order
      const existingTickets = await prisma.client.kdsTicket.findMany({
        where: { orderId },
      });

      const originalCount = existingTickets.length;
      expect(originalCount).toBe(2);

      // Attempt to create tickets again (should be no-op due to unique constraint)
      try {
        await prisma.client.kdsTicket.create({
          data: {
            orderId,
            station: 'GRILL',
            status: 'QUEUED',
          },
        });
      } catch (e: any) {
        expect(e.code).toBe('P2002'); // Unique constraint violation
      }

      // Verify count unchanged
      const afterTickets = await prisma.client.kdsTicket.findMany({
        where: { orderId },
      });
      expect(afterTickets.length).toBe(originalCount);
    });
  });

  describe('State Machine Transitions', () => {
    let orderId: string;
    let ticketId: string;

    beforeEach(async () => {
      // Create fresh order for each test
      const order = await prisma.client.order.create({
        data: {
          branchId,
          userId,
          tableId,
          orderNumber: `M133-${Date.now()}`,
          subtotal: 25.0,
          tax: 2.5,
          total: 27.5,
        },
      });
      orderId = order.id;

      // Create ticket
      const ticket = await prisma.client.kdsTicket.create({
        data: {
          orderId,
          station: 'GRILL',
          status: 'QUEUED',
          sentAt: new Date(),
        },
      });
      ticketId = ticket.id;
    });

    it('should transition QUEUED → IN_PROGRESS via /start', async () => {
      const res = await request(app.getHttpServer())
        .post(`/kds/tickets/${ticketId}/start`)
        .set('Authorization', `Bearer ${l2Token}`)
        .expect(200);

      expect(res.body.status).toBe('IN_PROGRESS');
      expect(res.body.startedAt).toBeDefined();
    });

    it('should reject start on non-QUEUED ticket', async () => {
      // First start it
      await request(app.getHttpServer())
        .post(`/kds/tickets/${ticketId}/start`)
        .set('Authorization', `Bearer ${l2Token}`)
        .expect(200);

      // Try to start again
      const res = await request(app.getHttpServer())
        .post(`/kds/tickets/${ticketId}/start`)
        .set('Authorization', `Bearer ${l2Token}`)
        .expect(400);

      expect(res.body.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should transition IN_PROGRESS → READY via /ready', async () => {
      // Start ticket first
      await request(app.getHttpServer())
        .post(`/kds/tickets/${ticketId}/start`)
        .set('Authorization', `Bearer ${l2Token}`)
        .expect(200);

      // Then mark ready
      const res = await request(app.getHttpServer())
        .post(`/kds/tickets/${ticketId}/ready`)
        .set('Authorization', `Bearer ${l2Token}`)
        .expect(200);

      expect(res.body.status).toBe('READY');
      expect(res.body.readyAt).toBeDefined();
    });

    it('should transition READY → DONE via /done', async () => {
      // Move through states
      await request(app.getHttpServer())
        .post(`/kds/tickets/${ticketId}/start`)
        .set('Authorization', `Bearer ${l2Token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/kds/tickets/${ticketId}/ready`)
        .set('Authorization', `Bearer ${l2Token}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`/kds/tickets/${ticketId}/done`)
        .set('Authorization', `Bearer ${l2Token}`)
        .expect(200);

      expect(res.body.status).toBe('DONE');
      expect(res.body.doneAt).toBeDefined();
    });
  });

  describe('Void Functionality (L4+ only)', () => {
    let ticketId: string;

    beforeEach(async () => {
      const order = await prisma.client.order.create({
        data: {
          branchId,
          userId,
          tableId,
          orderNumber: `M133-VOID-${Date.now()}`,
          subtotal: 12.0,
          tax: 1.0,
          total: 13.0,
        },
      });

      const ticket = await prisma.client.kdsTicket.create({
        data: {
          orderId: order.id,
          station: 'BAR',
          status: 'QUEUED',
          sentAt: new Date(),
        },
      });
      ticketId = ticket.id;
    });

    it('should allow L4+ to void ticket with valid reason', async () => {
      const res = await request(app.getHttpServer())
        .post(`/kds/tickets/${ticketId}/void`)
        .set('Authorization', `Bearer ${l4Token}`)
        .send({ reason: 'Customer cancelled order - table walked out' })
        .expect(200);

      expect(res.body.status).toBe('VOID');
      expect(res.body.voidReason).toBe('Customer cancelled order - table walked out');
      expect(res.body.voidedAt).toBeDefined();
    });

    it('should reject void with reason < 10 characters', async () => {
      const res = await request(app.getHttpServer())
        .post(`/kds/tickets/${ticketId}/void`)
        .set('Authorization', `Bearer ${l4Token}`)
        .send({ reason: 'too short' })
        .expect(400);

      expect(res.body.message).toContain('10 characters');
    });

    it('should reject void from L2 user', async () => {
      await request(app.getHttpServer())
        .post(`/kds/tickets/${ticketId}/void`)
        .set('Authorization', `Bearer ${l2Token}`)
        .send({ reason: 'Customer cancelled order - table walked out' })
        .expect(403);
    });
  });

  describe('Order Auto-Completion', () => {
    it('should mark order as SERVED when all tickets are DONE', async () => {
      // Create order with single station
      const order = await prisma.client.order.create({
        data: {
          branchId,
          userId,
          tableId,
          orderNumber: `M133-AUTO-${Date.now()}`,
          subtotal: 25.0,
          tax: 2.5,
          total: 27.5,
          status: 'SENT',
        },
      });

      const ticket = await prisma.client.kdsTicket.create({
        data: {
          orderId: order.id,
          station: 'GRILL',
          status: 'QUEUED',
          sentAt: new Date(),
        },
      });

      // Progress through states
      await request(app.getHttpServer())
        .post(`/kds/tickets/${ticket.id}/start`)
        .set('Authorization', `Bearer ${l2Token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/kds/tickets/${ticket.id}/ready`)
        .set('Authorization', `Bearer ${l2Token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/kds/tickets/${ticket.id}/done`)
        .set('Authorization', `Bearer ${l2Token}`)
        .expect(200);

      // Verify order status updated
      const updatedOrder = await prisma.client.order.findUnique({
        where: { id: order.id },
      });
      expect(updatedOrder?.status).toBe('SERVED');
    });
  });

  describe('KDS Board Endpoint', () => {
    it('should return tickets filtered by station', async () => {
      // Create some tickets
      const order = await prisma.client.order.create({
        data: {
          branchId,
          userId,
          tableId,
          orderNumber: `M133-BOARD-${Date.now()}`,
          subtotal: 37.0,
          tax: 3.5,
          total: 40.5,
        },
      });

      await prisma.client.kdsTicket.create({
        data: { orderId: order.id, station: 'GRILL', status: 'QUEUED', sentAt: new Date() },
      });
      await prisma.client.kdsTicket.create({
        data: { orderId: order.id, station: 'BAR', status: 'QUEUED', sentAt: new Date() },
      });

      // Get board for GRILL only
      const res = await request(app.getHttpServer())
        .get('/kds/board')
        .query({ stationId: 'GRILL' })
        .set('Authorization', `Bearer ${l2Token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((ticket: any) => {
        expect(ticket.station).toBe('GRILL');
      });
    });
  });

  describe('CSV Export', () => {
    it('should export tickets with SHA-256 hash header', async () => {
      const res = await request(app.getHttpServer())
        .get('/kds/export/tickets.csv')
        .set('Authorization', `Bearer ${l4Token}`)
        .expect(200);

      expect(res.header['content-type']).toContain('text/csv');
      expect(res.header['x-nimbus-export-hash']).toBeDefined();
      expect(res.header['x-nimbus-export-hash']).toHaveLength(64); // SHA-256 = 64 hex chars
      expect(res.text).toContain('ticket_id,order_id');
    });

    it('should reject export from L2 user', async () => {
      await request(app.getHttpServer())
        .get('/kds/export/tickets.csv')
        .set('Authorization', `Bearer ${l2Token}`)
        .expect(403);
    });
  });
});
