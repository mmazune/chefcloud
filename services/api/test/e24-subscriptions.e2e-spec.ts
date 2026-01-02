import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createE2EApp } from './helpers/e2e-bootstrap';
import { cleanup } from './helpers/cleanup';
import { E2E_USERS } from './helpers/e2e-credentials';
import { withTimeout } from './helpers/with-timeout';

describe('E24 Subscriptions & Dev Portal (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2EApp({ imports: [AppModule] }, { enableValidation: false });
  });

  afterAll(async () => {
    await cleanup(app);
  });

  describe('Dev Portal - POST /dev/orgs', () => {
    it('should create org with ACTIVE subscription (dev admin)', async () => {
      const response = await withTimeout(
        request(app.getHttpServer())
          .post('/dev/orgs')
          .set('X-Dev-Admin', 'dev1@chefcloud.local')
          .send({
            ownerEmail: 'newowner@testorg.local',
            orgName: 'Test Org E24',
            planCode: 'BASIC',
          })
          .expect(201),
        { label: 'POST /dev/orgs', ms: 30000 },
      );

      expect(response.body).toHaveProperty('org');
      expect(response.body).toHaveProperty('owner');
      expect(response.body).toHaveProperty('subscription');
      expect(response.body.org.name).toBe('Test Org E24');
      expect(response.body.subscription.status).toBe('ACTIVE');
      expect(response.body.owner.email).toBe('newowner@testorg.local');
    });

    it('should reject without dev admin header', async () => {
      await request(app.getHttpServer())
        .post('/dev/orgs')
        .send({
          ownerEmail: 'test@test.com',
          orgName: 'Test',
          planCode: 'PRO',
        })
        .expect(401);
    });
  });

  describe('Dev Portal - GET /dev/subscriptions', () => {
    it('should list all subscriptions (dev admin)', async () => {
      const response = await request(app.getHttpServer())
        .get('/dev/subscriptions')
        .set('X-Dev-Admin', 'dev1@chefcloud.local')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('org');
      expect(response.body[0]).toHaveProperty('plan');
      expect(response.body[0]).toHaveProperty('status');
    });
  });

  describe('Dev Portal - POST /dev/plans', () => {
    it('should upsert plan (super dev)', async () => {
      const response = await request(app.getHttpServer())
        .post('/dev/plans')
        .set('X-Dev-Admin', 'dev1@chefcloud.local')
        .send({
          code: 'TEST_PLAN',
          name: 'Test Plan',
          priceUGX: 99000,
          features: { maxBranches: 2 },
          isActive: true,
        })
        .expect(201);

      expect(response.body.code).toBe('TEST_PLAN');
      expect(response.body.name).toBe('Test Plan');
    });

    it('should reject non-super dev from creating plans', async () => {
      // First create a non-super dev admin
      const { PrismaClient } = await import('@chefcloud/db');
      const prisma = new PrismaClient();

      await prisma.devAdmin.upsert({
        where: { email: 'regulardev@chefcloud.local' },
        create: { email: 'regulardev@chefcloud.local', isSuper: false },
        update: {},
      });

      await prisma.$disconnect();

      await request(app.getHttpServer())
        .post('/dev/plans')
        .set('X-Dev-Admin', 'regulardev@chefcloud.local')
        .send({
          code: 'FORBIDDEN',
          name: 'Forbidden',
          priceUGX: 1,
          features: {},
        })
        .expect(403);
    });
  });

  describe('Billing - GET /billing/subscription', () => {
    it('should return subscription for org owner', async () => {
      // Login as owner
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: E2E_USERS.owner.email,
          password: E2E_USERS.owner.password,
        })
        .expect(200);

      const token = loginResponse.body.access_token;

      const response = await request(app.getHttpServer())
        .get('/billing/subscription')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('plan');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('nextRenewalAt');
      expect(response.body.plan.code).toBe('PRO');
    });

    it('should reject non-owner from viewing subscription', async () => {
      // Login as waiter (L1)
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: E2E_USERS.waiter.email,
          password: E2E_USERS.waiter.password,
        })
        .expect(200);

      const token = loginResponse.body.access_token;

      await request(app.getHttpServer())
        .get('/billing/subscription')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('Billing - POST /billing/plan/change', () => {
    it('should allow owner to request plan change', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: E2E_USERS.owner.email,
          password: E2E_USERS.owner.password,
        })
        .expect(200);

      const token = loginResponse.body.access_token;

      const response = await request(app.getHttpServer())
        .post('/billing/plan/change')
        .set('Authorization', `Bearer ${token}`)
        .send({ planCode: 'ENTERPRISE' })
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('effectiveDate');
    });
  });

  describe('Billing - POST /billing/cancel', () => {
    it('should allow owner to request cancellation', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: E2E_USERS.owner.email,
          password: E2E_USERS.owner.password,
        })
        .expect(200);

      const token = loginResponse.body.access_token;

      const response = await request(app.getHttpServer())
        .post('/billing/cancel')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('effectiveDate');
    });
  });
});
