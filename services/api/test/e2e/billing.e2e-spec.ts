import { Test, TestingModule } from '@nestjs/testing';
import { createE2ETestingModule, createE2ETestingModuleBuilder } from '../helpers/e2e-bootstrap';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { json } from 'express';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../src/common/redis.service';
import { MetricsService } from '../../src/observability/metrics.service';
import { ReadinessService } from '../../src/observability/readiness.service';
import {
  MockRedisService,
  MockMetricsService,
  MockReadinessService,
} from './_mocks';
import { cleanup } from '../helpers/cleanup';

describe('Billing E2E (E24 - Auth, Authz, Rate Limiting)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let orgId: string;
  let branchId: string;
  let owner: any;
  let manager: any;
  let ownerToken: string;
  let managerToken: string;
  let basicPlan: any;
  let proPlan: any;
  let enterprisePlan: any;

  async function setupTestData() {
    // Create test org
    orgId = `billing-test-org-${Date.now()}`;
    const org = await prisma.org.create({
      data: {
        id: orgId,
        name: 'Billing Test Org',
        slug: `billing-test-${Date.now()}`,
      },
    });

    // Create branch
    branchId = `billing-test-branch-${Date.now()}`;
    await prisma.branch.create({
      data: {
        id: branchId,
        orgId: org.id,
        name: 'Main Branch',
      },
    });

    // Create plans
    basicPlan = await prisma.subscriptionPlan.create({
      data: {
        code: `BASIC-${Date.now()}`,
        name: 'Basic Plan',
        priceUGX: 37000,
        features: {},
        isActive: true,
      },
    });

    proPlan = await prisma.subscriptionPlan.create({
      data: {
        code: `PRO-${Date.now()}`,
        name: 'Pro Plan',
        priceUGX: 185000,
        features: {},
        isActive: true,
      },
    });

    enterprisePlan = await prisma.subscriptionPlan.create({
      data: {
        code: `ENTERPRISE-${Date.now()}`,
        name: 'Enterprise Plan',
        priceUGX: 740000,
        features: {},
        isActive: true,
      },
    });

    // Create owner user (L5)
    owner = await prisma.user.create({
      data: {
        id: `owner-${Date.now()}`,
        email: `owner-${Date.now()}@test.com`,
        passwordHash: 'fake-hash',
        firstName: 'Test',
        lastName: 'Owner',
        roleLevel: 'L5',
        orgId: org.id,
        branchId,
      },
    });

    // Create manager user (L4)
    manager = await prisma.user.create({
      data: {
        id: `manager-${Date.now()}`,
        email: `manager-${Date.now()}@test.com`,
        passwordHash: 'fake-hash',
        firstName: 'Test',
        lastName: 'Manager',
        roleLevel: 'L4',
        orgId: org.id,
        branchId,
      },
    });

    // Create subscription for the org
    await prisma.orgSubscription.create({
      data: {
        orgId: org.id,
        planId: basicPlan.id,
        status: 'ACTIVE',
        nextRenewalAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
    });

    // Generate JWT tokens
    ownerToken = jwtService.sign({
      sub: owner.id,
      userId: owner.id,
      email: owner.email,
      orgId,
      branchId,
      roleLevel: 'L5',
    });

    managerToken = jwtService.sign({
      sub: manager.id,
      userId: manager.id,
      email: manager.email,
      orgId,
      branchId,
      roleLevel: 'L4',
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await createE2ETestingModuleBuilder({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useValue(MockRedisService)
      .overrideProvider(MetricsService)
      .useValue(MockMetricsService)
      .overrideProvider(ReadinessService)
      .useValue(MockReadinessService)
      .compile();

    app = moduleFixture.createNestApplication();

    // Configure body parser same as main.ts
    app.use(
      json({
        limit: '256kb',
        verify: (req: any, _res, buf: Buffer) => {
          req.rawBody = buf.toString('utf8');
        },
      }),
    );

    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await setupTestData();
  });

  afterAll(async () => {
    // Clean up test data
    if (orgId) {
      await prisma.subscriptionEvent.deleteMany({
        where: { orgId: orgId },
      });
      await prisma.orgSubscription.deleteMany({
        where: { orgId: orgId },
      });
      await prisma.user.deleteMany({ where: { orgId: orgId } });
      await prisma.branch.deleteMany({ where: { orgId: orgId } });
      await prisma.org.delete({ where: { id: orgId } });
    }

    // Clean up plans
    if (basicPlan) {
      await prisma.subscriptionPlan.delete({ where: { code: basicPlan.code } });
    }
    if (proPlan) {
      await prisma.subscriptionPlan.delete({ where: { code: proPlan.code } });
    }
    if (enterprisePlan) {
      await prisma.subscriptionPlan.delete({
        where: { code: enterprisePlan.code },
      });
    }

    await cleanup(app);
  });

  describe('POST /billing/plan/change', () => {
    it('should return 401 if no authorization token is provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/billing/plan/change')
        .send({ planCode: proPlan.code });

      expect(response.status).toBe(401);
    });

    it('should return 403 if user is not L5 (owner)', async () => {
      const response = await request(app.getHttpServer())
        .post('/billing/plan/change')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ planCode: proPlan.code });

      expect(response.status).toBe(403);
    });

    it('should return 200 and log plan change for L5 owner', async () => {
      const response = await request(app.getHttpServer())
        .post('/billing/plan/change')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ planCode: proPlan.code });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Plan change requested');
    });

    it('should return 404 for non-existent plan code', async () => {
      const response = await request(app.getHttpServer())
        .post('/billing/plan/change')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ planCode: 'INVALID-PLAN-9999' });

      expect(response.status).toBe(404);
    });

    it('should return 429 after exceeding plan-aware rate limit (burst)', async () => {
      // Wait a bit to clear any previous rate limit state
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send burst of 15 requests (exceeds Free tier 10/min limit)
      const requests = Array.from({ length: 15 }, () =>
        request(app.getHttpServer())
          .post('/billing/plan/change')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ planCode: proPlan.code }),
      );

      const results = await Promise.all(requests);

      // At least one request should be rate limited
      const has429 = results.some((r: any) => r.status === 429);
      expect(has429).toBe(true);
    });
  });

  describe('POST /billing/cancel', () => {
    it('should return 401 if no authorization token is provided', async () => {
      const response = await request(app.getHttpServer()).post(
        '/billing/cancel',
      );

      expect(response.status).toBe(401);
    });

    it('should return 403 if user is not L5 (owner)', async () => {
      const response = await request(app.getHttpServer())
        .post('/billing/cancel')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(403);
    });

    it('should return 200 and log cancellation for L5 owner', async () => {
      const response = await request(app.getHttpServer())
        .post('/billing/cancel')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Cancellation requested');
    });

    it('should be idempotent (canceling twice returns 200)', async () => {
      // First cancellation
      const response1 = await request(app.getHttpServer())
        .post('/billing/cancel')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response1.status).toBe(200);

      // Second cancellation (should also succeed)
      const response2 = await request(app.getHttpServer())
        .post('/billing/cancel')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response2.status).toBe(200);
    });
  });

  describe('GET /billing/subscription', () => {
    it('should return 401 if no authorization token is provided', async () => {
      const response = await request(app.getHttpServer()).get(
        '/billing/subscription',
      );

      expect(response.status).toBe(401);
    });

    it('should return 200 with subscription details for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/billing/subscription')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('subscription');
      expect(response.body.subscription).toHaveProperty('planCode');
      expect(response.body.subscription).toHaveProperty('status');
      expect(response.body.subscription).toHaveProperty('startDate');
    });
  });
});
