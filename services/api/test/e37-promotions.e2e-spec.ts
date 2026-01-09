import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { createE2EApp } from './helpers/e2e-bootstrap';
import { cleanup } from './helpers/cleanup';
import { loginAs } from './helpers/e2e-login';
import { requireTapasOrg } from './helpers/require-preconditions';

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
    app = await createE2EApp({ imports: [AppModule] });
    prisma = app.get(PrismaService);

    // Use seeded Tapas org and branch
    await requireTapasOrg(prisma);

    const org = await prisma.org.findFirst({
      where: { slug: 'tapas-demo' },
    });
    if (!org) throw new Error('Tapas org not found after precondition check');
    orgId = org.id;

    // Get first branch from Tapas org
    const branch = await prisma.branch.findFirst({
      where: { orgId },
    });
    if (!branch) throw new Error('Tapas org must have at least 1 branch');
    branchId = branch.id;

    // Login as manager from seeded data
    const login = await loginAs(app, 'manager', 'tapas');
    authToken = login.accessToken;
    userId = login.user.id;

    // Use existing menu category and item from seeded Tapas data
    const category = await prisma.category.findFirst({
      where: { orgId },
    });
    if (!category) throw new Error('Tapas org must have at least 1 category');
    categoryId = category.id;

    const menuItem = await prisma.menuItem.findFirst({
      where: { categoryId },
    });
    if (!menuItem) throw new Error('Tapas category must have at least 1 item');
    menuItemId = menuItem.id;
  });

  afterAll(async () => {
    // Clean up only the promotion created in tests (not seeded data)
    if (promotionId) {
      await prisma.promotionEffect.deleteMany({
        where: { promotionId },
      });
      await prisma.promotion.deleteMany({
        where: { id: promotionId },
      });
    }
    await cleanup(app);
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
