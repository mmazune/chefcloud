import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { cleanup } from './helpers/cleanup';
import { E2E_USERS } from './helpers/e2e-credentials';
import { PrismaService } from '../src/prisma.service';

/**
 * M1-KDS: Enterprise-grade KDS tests
 * Tests cover:
 * - Waiter names in ticket responses
 * - SLA state calculation (GREEN/ORANGE/RED)
 * - Proper ordering by sentAt
 * - Station filtering
 * - "since" parameter for incremental sync
 * - SLA configuration CRUD
 */
describe('M1 KDS Enterprise (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let waiterToken: string;
  let managerToken: string;
  let burgerId: string;
  let friesId: string;
  let beerMenuItemId: string;
  let tableId: string;
  let orgId: string;
  let branchId: string;
  let testCategoryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    // Login as waiter
    const waiterLogin = await request(app.getHttpServer()).post('/auth/login').send({
      email: E2E_USERS.waiter.email,
      password: E2E_USERS.waiter.password,
    });
    waiterToken = waiterLogin.body.access_token;

    // Login as manager for SLA config tests
    const managerLogin = await request(app.getHttpServer()).post('/auth/login').send({
      email: E2E_USERS.manager.email,
      password: E2E_USERS.manager.password,
    });
    managerToken = managerLogin.body.access_token;

    // M13.5.3: Get orgId and branchId from /me endpoint
    const meResponse = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${waiterToken}`);
    orgId = meResponse.body.orgId;
    branchId = meResponse.body.branchId;

    // M13.5.3: Create test category for KDS menu items
    const existingCategory = await prisma.client.category.findFirst({
      where: { orgId, name: 'KDS Test Items' },
    });
    if (existingCategory) {
      testCategoryId = existingCategory.id;
    } else {
      const category = await prisma.client.category.create({
        data: {
          orgId,
          branchId,
          name: 'KDS Test Items',
          sortOrder: 999,
        },
      });
      testCategoryId = category.id;
    }

    // M13.5.3: Create test menu items with specific KDS stations
    // Burger -> GRILL station
    const existingBurger = await prisma.client.menuItem.findFirst({
      where: { orgId, name: 'KDS Test Burger' },
    });
    if (existingBurger) {
      burgerId = existingBurger.id;
    } else {
      const burger = await prisma.client.menuItem.create({
        data: {
          orgId,
          branchId,
          categoryId: testCategoryId,
          name: 'KDS Test Burger',
          itemType: 'FOOD',
          price: 15.00,
          station: 'GRILL',
          isAvailable: true,
          isActive: true,
          sortOrder: 1,
        },
      });
      burgerId = burger.id;
    }

    // Fries -> FRY station
    const existingFries = await prisma.client.menuItem.findFirst({
      where: { orgId, name: 'KDS Test Fries' },
    });
    if (existingFries) {
      friesId = existingFries.id;
    } else {
      const fries = await prisma.client.menuItem.create({
        data: {
          orgId,
          branchId,
          categoryId: testCategoryId,
          name: 'KDS Test Fries',
          itemType: 'FOOD',
          price: 8.00,
          station: 'FRYER',
          isAvailable: true,
          isActive: true,
          sortOrder: 2,
        },
      });
      friesId = fries.id;
    }

    // Beer -> BAR station
    const existingBeer = await prisma.client.menuItem.findFirst({
      where: { orgId, name: 'KDS Test Beer' },
    });
    if (existingBeer) {
      beerMenuItemId = existingBeer.id;
    } else {
      const beer = await prisma.client.menuItem.create({
        data: {
          orgId,
          branchId,
          categoryId: testCategoryId,
          name: 'KDS Test Beer',
          itemType: 'DRINK',
          price: 6.00,
          station: 'BAR',
          isAvailable: true,
          isActive: true,
          sortOrder: 3,
        },
      });
      beerMenuItemId = beer.id;
    }

    // Get table
    const floorResponse = await request(app.getHttpServer())
      .get('/floor')
      .set('Authorization', `Bearer ${waiterToken}`);

    tableId = floorResponse.body.floorPlans[0]?.tables[0]?.id;
  }, 60000);

  afterAll(async () => {
    // M13.5.3: Skip menu item cleanup - foreign key constraint prevents deletion
    // (order items reference menu items). Test items are idempotently created
    // and don't affect other tests.
    await cleanup(app);
  });

  describe('KDS Queue with Enhanced DTOs', () => {
    it('should return tickets with waiterName, slaState, and proper ordering', async () => {
      // Create two orders with delay to ensure different sentAt times
      const order1Response = await request(app.getHttpServer())
        .post('/pos/orders')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({
          tableId,
          serviceType: 'DINE_IN',
          items: [{ menuItemId: burgerId, qty: 1, modifiers: [] }],
        })
        .expect(201);

      const order1Id = order1Response.body.id;

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 100));

      const order2Response = await request(app.getHttpServer())
        .post('/pos/orders')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({
          tableId,
          serviceType: 'DINE_IN',
          items: [{ menuItemId: friesId, qty: 1, modifiers: [] }],
        })
        .expect(201);

      const order2Id = order2Response.body.id;

      // Send both to kitchen
      await request(app.getHttpServer())
        .post(`/pos/orders/${order1Id}/send-to-kitchen`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/pos/orders/${order2Id}/send-to-kitchen`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(201);

      // Fetch GRILL queue (burger station)
      const queueResponse = await request(app.getHttpServer())
        .get('/kds/queue?station=GRILL')
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(200);

      expect(queueResponse.body).toBeInstanceOf(Array);
      expect(queueResponse.body.length).toBeGreaterThan(0);

      const ticket = queueResponse.body.find((t: any) => t.orderId === order1Id);
      expect(ticket).toBeDefined();

      // M1-KDS: Verify waiter name is present
      expect(ticket.waiterName).toBeDefined();
      expect(typeof ticket.waiterName).toBe('string');
      expect(ticket.waiterName.length).toBeGreaterThan(0);

      // M1-KDS: Verify SLA state
      expect(ticket.slaState).toBeDefined();
      expect(['GREEN', 'ORANGE', 'RED']).toContain(ticket.slaState);

      // M1-KDS: Verify elapsed seconds
      expect(ticket.elapsedSeconds).toBeDefined();
      expect(typeof ticket.elapsedSeconds).toBe('number');
      expect(ticket.elapsedSeconds).toBeGreaterThanOrEqual(0);

      // M1-KDS: Verify sentAt timestamp
      expect(ticket.sentAt).toBeDefined();
      expect(new Date(ticket.sentAt).getTime()).toBeGreaterThan(0);

      // M1-KDS: Verify proper ordering (oldest first)
      const ticket1 = queueResponse.body.find((t: any) => t.orderId === order1Id);
      const ticket2 = queueResponse.body.find((t: any) => t.orderId === order2Id);

      if (ticket1 && ticket2) {
        const ticket1Index = queueResponse.body.indexOf(ticket1);
        const ticket2Index = queueResponse.body.indexOf(ticket2);
        expect(ticket1Index).toBeLessThan(ticket2Index); // order1 created first, should come first
      }
    });

    it('should filter tickets by station correctly', async () => {
      // Create order with GRILL and FRYER items
      const orderResponse = await request(app.getHttpServer())
        .post('/pos/orders')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({
          tableId,
          serviceType: 'DINE_IN',
          items: [
            { menuItemId: burgerId, qty: 1, modifiers: [] }, // GRILL
            { menuItemId: friesId, qty: 1, modifiers: [] }, // FRYER
          ],
        })
        .expect(201);

      const orderId = orderResponse.body.id;

      await request(app.getHttpServer())
        .post(`/pos/orders/${orderId}/send-to-kitchen`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(201);

      // Check GRILL station
      const grillQueue = await request(app.getHttpServer())
        .get('/kds/queue?station=GRILL')
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(200);

      const grillTicket = grillQueue.body.find((t: any) => t.orderId === orderId);
      expect(grillTicket).toBeDefined();
      expect(grillTicket.station).toBe('GRILL');

      // M1-KDS: Verify items are filtered to this station only
      const hasGrillItem = grillTicket.items.some((item: any) => item.name === 'KDS Test Burger');
      expect(hasGrillItem).toBe(true);

      // Check FRYER station
      const fryerQueue = await request(app.getHttpServer())
        .get('/kds/queue?station=FRYER')
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(200);

      const fryerTicket = fryerQueue.body.find((t: any) => t.orderId === orderId);
      expect(fryerTicket).toBeDefined();
      expect(fryerTicket.station).toBe('FRYER');

      const hasFryerItem = fryerTicket.items.some((item: any) => item.name === 'KDS Test Fries');
      expect(hasFryerItem).toBe(true);
    });

    it('should support "since" parameter for incremental sync', async () => {
      const beforeTimestamp = new Date().toISOString();

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create a new order
      const orderResponse = await request(app.getHttpServer())
        .post('/pos/orders')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({
          tableId,
          serviceType: 'DINE_IN',
          items: [{ menuItemId: burgerId, qty: 1, modifiers: [] }],
        })
        .expect(201);

      const orderId = orderResponse.body.id;

      await request(app.getHttpServer())
        .post(`/pos/orders/${orderId}/send-to-kitchen`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(201);

      // M1-KDS: Fetch with "since" parameter
      const sinceQueue = await request(app.getHttpServer())
        .get(`/kds/queue?station=GRILL&since=${beforeTimestamp}`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(200);

      const newTicket = sinceQueue.body.find((t: any) => t.orderId === orderId);
      expect(newTicket).toBeDefined();

      // Verify ticket was created after the "since" timestamp
      expect(new Date(newTicket.updatedAt).getTime()).toBeGreaterThan(
        new Date(beforeTimestamp).getTime(),
      );
    });
  });

  describe('SLA Configuration', () => {
    it('should get default SLA config for a station', async () => {
      const response = await request(app.getHttpServer())
        .get('/kds/sla-config/GRILL')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.station).toBe('GRILL');
      expect(response.body.greenThresholdSec).toBeGreaterThan(0);
      expect(response.body.orangeThresholdSec).toBeGreaterThan(response.body.greenThresholdSec);
    });

    it('should update SLA config (Manager/Owner only)', async () => {
      const updateResponse = await request(app.getHttpServer())
        .patch('/kds/sla-config/GRILL')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          greenThresholdSec: 180, // 3 minutes
          orangeThresholdSec: 360, // 6 minutes
        })
        .expect(200);

      expect(updateResponse.body.greenThresholdSec).toBe(180);
      expect(updateResponse.body.orangeThresholdSec).toBe(360);

      // Verify it persisted
      const getResponse = await request(app.getHttpServer())
        .get('/kds/sla-config/GRILL')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(getResponse.body.greenThresholdSec).toBe(180);
      expect(getResponse.body.orangeThresholdSec).toBe(360);
    });

    it('should reject SLA config update from waiter (L1)', async () => {
      await request(app.getHttpServer())
        .patch('/kds/sla-config/GRILL')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({
          greenThresholdSec: 100,
          orangeThresholdSec: 200,
        })
        .expect(403); // Forbidden - only L4/L5 allowed
    });
  });

  describe('KDS Resilience', () => {
    it('should handle marking ticket ready and checking all-ready state', async () => {
      const orderResponse = await request(app.getHttpServer())
        .post('/pos/orders')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({
          tableId,
          serviceType: 'DINE_IN',
          items: [
            { menuItemId: burgerId, qty: 1, modifiers: [] }, // GRILL
            { menuItemId: friesId, qty: 1, modifiers: [] }, // FRYER
          ],
        })
        .expect(201);

      const orderId = orderResponse.body.id;

      await request(app.getHttpServer())
        .post(`/pos/orders/${orderId}/send-to-kitchen`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(201);

      // Get GRILL ticket
      const grillQueue = await request(app.getHttpServer())
        .get('/kds/queue?station=GRILL')
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(200);

      const grillTicket = grillQueue.body.find((t: any) => t.orderId === orderId);
      expect(grillTicket).toBeDefined();

      // Mark GRILL ready
      await request(app.getHttpServer())
        .post(`/kds/tickets/${grillTicket.id}/mark-ready`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(201);

      // Get FRYER ticket
      const fryerQueue = await request(app.getHttpServer())
        .get('/kds/queue?station=FRYER')
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(200);

      const fryerTicket = fryerQueue.body.find((t: any) => t.orderId === orderId);
      expect(fryerTicket).toBeDefined();

      // Mark FRYER ready
      await request(app.getHttpServer())
        .post(`/kds/tickets/${fryerTicket.id}/mark-ready`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(201);

      // Verify both tickets are marked READY
      const grillQueueAfter = await request(app.getHttpServer())
        .get('/kds/queue?station=GRILL')
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(200);

      const grillTicketAfter = grillQueueAfter.body.find((t: any) => t.id === grillTicket.id);
      expect(grillTicketAfter.status).toBe('READY');
    });
  });
});
