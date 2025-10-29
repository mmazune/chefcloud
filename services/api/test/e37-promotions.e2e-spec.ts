import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@chefcloud/db';

describe('E37 - Promotions & Pricing Engine (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let orgId: string;
  let branchId: string;
  let userId: string;
  let categoryId: string;
  let menuItemId: string;
  let promotionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    await app.init();

    // Create org, user, and branch for testing
    const org = await prisma.organization.create({
      data: {
        name: 'E37 Test Restaurant',
        email: 'e37test@chefcloud.test',
        phone: '+256700000037',
      },
    });
    orgId = org.id;

    const user = await prisma.user.create({
      data: {
        email: 'manager-e37@chefcloud.test',
        name: 'E37 Test Manager',
        role: 'L4',
        orgId,
      },
    });
    userId = user.id;

    const branch = await prisma.branch.create({
      data: {
        name: 'E37 Test Branch',
        orgId,
        address: 'Test Location',
      },
    });
    branchId = branch.id;

    // Create category and menu item (drinks)
    const category = await prisma.menuCategory.create({
      data: {
        name: 'Drinks',
        orgId,
      },
    });
    categoryId = category.id;

    const menuItem = await prisma.menuItem.create({
      data: {
        name: 'Craft Beer',
        price: 10000,
        categoryId,
        orgId,
      },
    });
    menuItemId = menuItem.id;

    // Mock authentication token (simple mock for e2e)
    authToken = Buffer.from(
      JSON.stringify({
        sub: user.email,
        email: user.email,
        orgId: user.orgId,
        role: user.role,
        id: user.id,
      }),
    ).toString('base64');
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.promotionEffect.deleteMany({ where: { promotion: { orgId } } });
    await prisma.promotion.deleteMany({ where: { orgId } });
    await prisma.orderItem.deleteMany({ where: { order: { branchId } } });
    await prisma.order.deleteMany({ where: { branchId } });
    await prisma.menuItem.deleteMany({ where: { orgId } });
    await prisma.menuCategory.deleteMany({ where: { orgId } });
    await prisma.branch.deleteMany({ where: { orgId } });
    await prisma.user.deleteMany({ where: { orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await app.close();
  });

  describe('Happy Hour Promotion Flow', () => {
    it('should create a happy hour promotion (20% off drinks 17:00-19:00)', async () => {
      const response = await request(app.getHttpServer())
        .post('/promotions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Happy Hour - Drinks',
          active: false,
          startsAt: new Date('2025-01-01T00:00:00Z').toISOString(),
          endsAt: new Date('2025-12-31T23:59:59Z').toISOString(),
          scope: {
            categories: [categoryId],
          },
          daypart: {
            days: [1, 2, 3, 4, 5], // Monday-Friday
            start: '17:00',
            end: '19:00',
          },
          priority: 100,
          exclusive: false,
          requiresApproval: true,
          effects: [
            {
              type: 'HAPPY_HOUR',
              value: 20, // 20% off
              meta: {
                description: 'Happy hour discount on drinks',
              },
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Happy Hour - Drinks');
      expect(response.body.active).toBe(false); // Not yet approved
      expect(response.body.effects).toHaveLength(1);
      expect(response.body.effects[0].type).toBe('HAPPY_HOUR');

      promotionId = response.body.id;
    });

    it('should list promotions (including inactive)', async () => {
      const response = await request(app.getHttpServer())
        .get('/promotions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      const promo = response.body.find((p) => p.id === promotionId);
      expect(promo).toBeDefined();
      expect(promo.active).toBe(false);
    });

    it('should approve the promotion', async () => {
      const response = await request(app.getHttpServer())
        .post(`/promotions/${promotionId}/approve`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.active).toBe(true);
      expect(response.body.approvedById).toBe(userId);
      expect(response.body.approvedAt).toBeDefined();
    });

    it('should apply discount when placing order during happy hour (18:00 on Monday)', async () => {
      // Create an order
      const order = await prisma.order.create({
        data: {
          branchId,
          status: 'OPEN',
          metadata: {},
        },
      });

      // Add drink items to the order
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          menuItemId,
          quantity: 2, // 2 beers @ 10,000 UGX = 20,000 UGX
          price: 10000,
          total: 20000,
        },
      });

      // Mock timestamp: Monday 2025-01-06 18:00 UTC (within happy hour 17:00-19:00)
      const happyHourTime = new Date('2025-01-06T18:00:00Z');

      // Close the order (this triggers promotion evaluation)
      const response = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/close`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 20000, // Total before discount
          timestamp: happyHourTime.toISOString(), // Pass timestamp for daypart evaluation
        });

      expect(response.status).toBe(200);

      // Verify discount was applied
      const closedOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: { items: true },
      });

      expect(closedOrder).toBeDefined();
      expect(closedOrder.discount).toBeGreaterThan(0);
      
      // 20% off 20,000 = 4,000 UGX discount
      expect(closedOrder.discount).toBe(4000);
      
      // Check metadata for promotions applied
      expect(closedOrder.metadata).toHaveProperty('promotionsApplied');
      const promotionsApplied = (closedOrder.metadata as any).promotionsApplied;
      expect(Array.isArray(promotionsApplied)).toBe(true);
      expect(promotionsApplied.length).toBeGreaterThan(0);
      expect(promotionsApplied[0]).toMatchObject({
        promotionId,
        promotionName: 'Happy Hour - Drinks',
        effect: 'HAPPY_HOUR',
      });
    });

    it('should NOT apply discount outside happy hour (20:00)', async () => {
      // Create another order
      const order = await prisma.order.create({
        data: {
          branchId,
          status: 'OPEN',
          metadata: {},
        },
      });

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          menuItemId,
          quantity: 1,
          price: 10000,
          total: 10000,
        },
      });

      // Mock timestamp: Monday 2025-01-06 20:00 UTC (AFTER happy hour ends at 19:00)
      const afterHappyHour = new Date('2025-01-06T20:00:00Z');

      const response = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/close`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 10000,
          timestamp: afterHappyHour.toISOString(),
        });

      expect(response.status).toBe(200);

      const closedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });

      // No discount should be applied (or 0)
      expect(closedOrder.discount).toBe(0);
      
      // No promotions in metadata
      const promotionsApplied = (closedOrder.metadata as any)?.promotionsApplied;
      expect(promotionsApplied || []).toHaveLength(0);
    });

    it('should toggle promotion inactive', async () => {
      const response = await request(app.getHttpServer())
        .post(`/promotions/${promotionId}/toggle`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ active: false });

      expect(response.status).toBe(200);
      expect(response.body.active).toBe(false);
    });

    it('should NOT apply discount when promotion is inactive', async () => {
      const order = await prisma.order.create({
        data: {
          branchId,
          status: 'OPEN',
          metadata: {},
        },
      });

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          menuItemId,
          quantity: 1,
          price: 10000,
          total: 10000,
        },
      });

      const happyHourTime = new Date('2025-01-06T18:00:00Z');

      const response = await request(app.getHttpServer())
        .post(`/pos/orders/${order.id}/close`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 10000,
          timestamp: happyHourTime.toISOString(),
        });

      expect(response.status).toBe(200);

      const closedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });

      expect(closedOrder.discount).toBe(0);
    });
  });
});
