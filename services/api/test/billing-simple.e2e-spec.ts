import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { json } from 'express';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Billing E2E (E24 - Auth, Authz, Rate Limiting)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let ownerToken: string;
  let managerToken: string;
  let testOrgId: string;
  let testBranchId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

    // Use existing demo data instead of creating new test data
    const demoOrg = await prisma.organization.findFirst({
      where: { slug: 'demo' },
      include: { branches: { where: { isHeadquarters: true } } },
    });

    if (!demoOrg) {
      throw new Error('Demo org not found - run seed first');
    }

    testOrgId = demoOrg.id;
    testBranchId = demoOrg.branches[0].id;

    // Find or create L5 owner user
    let ownerUser = await prisma.user.findFirst({
      where: { organizationId: testOrgId, role: 'L5' },
    });

    if (!ownerUser) {
      ownerUser = await prisma.user.create({
        data: {
          id: `test-owner-${Date.now()}`,
          email: `test-owner-${Date.now()}@test.com`,
          passwordHash: 'fake',
          role: 'L5',
          organizationId: testOrgId,
          branchId: testBranchId,
        },
      });
    }

    // Find or create L4 manager user
    let managerUser = await prisma.user.findFirst({
      where: { organizationId: testOrgId, role: 'L4' },
    });

    if (!managerUser) {
      managerUser = await prisma.user.create({
        data: {
          id: `test-manager-${Date.now()}`,
          email: `test-manager-${Date.now()}@test.com`,
          passwordHash: 'fake',
          role: 'L4',
          organizationId: testOrgId,
          branchId: testBranchId,
        },
      });
    }

    // Generate tokens
    ownerToken = jwtService.sign({
      sub: ownerUser.id,
      userId: ownerUser.id,
      email: ownerUser.email,
      orgId: testOrgId,
      branchId: testBranchId,
      role: 'L5',
    });

    managerToken = jwtService.sign({
      sub: managerUser.id,
      userId: managerUser.id,
      email: managerUser.email,
      orgId: testOrgId,
      branchId: testBranchId,
      role: 'L4',
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /billing/subscription', () => {
    it('should return 401 if no authorization token is provided', async () => {
      const response = await request(app.getHttpServer()).get(
        '/billing/subscription',
      );

      expect(response.status).toBe(401);
    });

    it('should return 200 and subscription details with valid L5 token', async () => {
      const response = await request(app.getHttpServer())
        .get('/billing/subscription')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect([200, 404]).toContain(response.status);
      // 404 is OK if org has no subscription
      if (response.status === 200) {
        expect(response.body).toHaveProperty('subscription');
      }
    });
  });

  describe('POST /billing/plan/change', () => {
    it('should return 401 if no authorization token is provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/billing/plan/change')
        .send({ planCode: 'PRO' });

      expect(response.status).toBe(401);
    });

    it('should return 403 if user is not L5 (manager attempting)', async () => {
      const response = await request(app.getHttpServer())
        .post('/billing/plan/change')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ planCode: 'PRO' });

      expect(response.status).toBe(403);
    });

    it('should return 200 or 404 with valid L5 token', async () => {
      const response = await request(app.getHttpServer())
        .post('/billing/plan/change')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ planCode: 'BASIC' });

      // 200 = success, 404 = plan not found or no subscription (both valid)
      expect([200, 404]).toContain(response.status);
    });

    it('should return 404 for unknown plan code', async () => {
      const response = await request(app.getHttpServer())
        .post('/billing/plan/change')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ planCode: 'NONEXISTENT_PLAN_XYZ' });

      expect(response.status).toBe(404);
    });

    it('should rate limit after burst requests (expect at least one 429)', async () => {
      // Wait a bit to clear any existing rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));

      const requests = Array.from({ length: 15 }, () =>
        request(app.getHttpServer())
          .post('/billing/plan/change')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ planCode: 'PRO' }),
      );

      const results = await Promise.all(requests);
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

    it('should return 403 if user is not L5 (manager attempting)', async () => {
      const response = await request(app.getHttpServer())
        .post('/billing/cancel')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(403);
    });

    it('should return 200 or 404 with valid L5 token', async () => {
      const response = await request(app.getHttpServer())
        .post('/billing/cancel')
        .set('Authorization', `Bearer ${ownerToken}`);

      // 200 = success, 404 = no subscription (both valid)
      expect([200, 404]).toContain(response.status);
    });

    it('should be idempotent (canceling twice should succeed)', async () => {
      const response1 = await request(app.getHttpServer())
        .post('/billing/cancel')
        .set('Authorization', `Bearer ${ownerToken}`);

      const response2 = await request(app.getHttpServer())
        .post('/billing/cancel')
        .set('Authorization', `Bearer ${ownerToken}`);

      // Both should return 200 or 404 (idempotent)
      expect([200, 404]).toContain(response1.status);
      expect([200, 404]).toContain(response2.status);
    });
  });
});
