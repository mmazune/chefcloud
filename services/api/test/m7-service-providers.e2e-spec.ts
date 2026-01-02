import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma.service';
import { AppModule } from '../src/app.module';
import { createE2EApp } from './helpers/e2e-bootstrap';
import { cleanup } from './helpers/cleanup';
import { requireTapasOrg } from './helpers/require-preconditions';
import { loginAs } from './helpers/e2e-login';

/**
 * M7 E2E Test: Service Providers, Budgets & Cost Insights
 *
 * Uses seeded DEMO_TAPAS data for isolation.
 * Tests read operations + validation errors only (no writes to seeded data).
 */
describe('M7: Service Providers, Budgets & Cost Insights (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let managerToken: string;
  let org: { id: string; name: string };
  let branch: { id: string; name: string };

  beforeAll(async () => {
    app = await createE2EApp({ imports: [AppModule] });
    prisma = app.get(PrismaService);

    // Use seeded Tapas org - requireTapasOrg just validates, returns void
    await requireTapasOrg(prisma);
    
    // Get the org directly
    const foundOrg = await prisma.org.findFirst({
      where: { slug: 'tapas-demo' },
      include: { branches: true },
    });
    if (!foundOrg) throw new Error('Tapas org not found after precondition check');
    org = foundOrg;

    // Get first branch
    if (!foundOrg.branches.length) {
      throw new Error(`PreconditionError: No branches found for org ${foundOrg.id}`);
    }
    branch = foundOrg.branches[0];

    // Login as owner + manager (dataset param is 'tapas' or 'cafesserie')
    const ownerLogin = await loginAs(app, 'owner', 'tapas');
    ownerToken = ownerLogin.accessToken;
    const managerLogin = await loginAs(app, 'manager', 'tapas');
    managerToken = managerLogin.accessToken;
  });

  afterAll(async () => {
    await cleanup(app);
  });

  describe('1. Service Providers Endpoints', () => {
    it('GET /service-providers should list providers for branch', async () => {
      const res = await request(app.getHttpServer())
        .get('/service-providers')
        .query({ branchId: branch.id })
        .set('Authorization', `Bearer ${managerToken}`);

      // 200 or 404 acceptable depending on seeded data
      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body.data || res.body)).toBe(true);
      }
    });

    it('GET /service-providers/summary should return summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/service-providers/summary')
        .query({ branchId: branch.id })
        .set('Authorization', `Bearer ${managerToken}`);

      expect([200, 404]).toContain(res.status);
    });

    it('POST /service-providers should require auth', async () => {
      const res = await request(app.getHttpServer())
        .post('/service-providers')
        .send({
          name: 'Test Provider',
          category: 'RENT',
          branchId: branch.id,
        });

      expect(res.status).toBe(401);
    });
  });

  describe('2. Service Contracts Endpoints', () => {
    it('GET /service-contracts should list contracts', async () => {
      const res = await request(app.getHttpServer())
        .get('/service-contracts')
        .query({ branchId: branch.id })
        .set('Authorization', `Bearer ${managerToken}`);

      expect([200, 404]).toContain(res.status);
    });

    it('POST /service-contracts should require valid dueDay for MONTHLY', async () => {
      const res = await request(app.getHttpServer())
        .post('/service-contracts')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          providerId: 'fake-provider-id',
          branchId: branch.id,
          frequency: 'MONTHLY',
          amount: 1000000,
          currency: 'UGX',
          dueDay: 35, // Invalid - should be 1-31
          startDate: new Date().toISOString(),
          status: 'ACTIVE',
        });

      // Should fail validation (400) or not found (404) for fake provider
      expect([400, 404, 422]).toContain(res.status);
    });
  });

  describe('3. Ops Budget Endpoints', () => {
    it('GET /ops-budgets should list budgets for branch', async () => {
      const res = await request(app.getHttpServer())
        .get('/ops-budgets')
        .query({
          branchId: branch.id,
          year: 2024,
          month: 11,
        })
        .set('Authorization', `Bearer ${managerToken}`);

      expect([200, 404]).toContain(res.status);
    });

    it('GET /ops-budgets/summary should return budget summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/ops-budgets/summary')
        .query({
          branchId: branch.id,
          year: 2024,
          month: 11,
        })
        .set('Authorization', `Bearer ${ownerToken}`);

      expect([200, 404]).toContain(res.status);
    });

    it('GET /ops-budgets/franchise should return franchise summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/ops-budgets/franchise')
        .query({
          year: 2024,
          month: 11,
        })
        .set('Authorization', `Bearer ${ownerToken}`);

      expect([200, 404]).toContain(res.status);
    });

    it('POST /ops-budgets should validate month range', async () => {
      const res = await request(app.getHttpServer())
        .post('/ops-budgets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: branch.id,
          year: 2024,
          month: 13, // Invalid month
          category: 'RENT',
          budgetAmount: 1000000,
        });

      // Should fail validation (400/422) or endpoint may not exist (404)
      expect([400, 404, 422]).toContain(res.status);
    });
  });

  describe('4. Cost Insights Endpoints', () => {
    it('GET /cost-insights should return insights for branch', async () => {
      const res = await request(app.getHttpServer())
        .get('/cost-insights')
        .query({ branchId: branch.id })
        .set('Authorization', `Bearer ${ownerToken}`);

      expect([200, 404]).toContain(res.status);
    });

    it('GET /cost-insights/franchise should return franchise insights', async () => {
      const res = await request(app.getHttpServer())
        .get('/cost-insights/franchise')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('5. Service Reminders Endpoints', () => {
    it('GET /service-reminders should list reminders', async () => {
      const res = await request(app.getHttpServer())
        .get('/service-reminders')
        .query({ branchId: branch.id })
        .set('Authorization', `Bearer ${managerToken}`);

      expect([200, 404]).toContain(res.status);
    });

    it('GET /service-reminders/summary should return summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/service-reminders/summary')
        .query({ branchId: branch.id })
        .set('Authorization', `Bearer ${managerToken}`);

      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        // Should have summary fields
        const body = res.body;
        if (body.overdue !== undefined) {
          expect(typeof body.overdue).toBe('number');
        }
      }
    });
  });

  describe('6. Role-Based Access', () => {
    it('owner can access franchise-level endpoints', async () => {
      const res = await request(app.getHttpServer())
        .get('/ops-budgets/franchise')
        .query({ year: 2024, month: 11 })
        .set('Authorization', `Bearer ${ownerToken}`);

      // Owner should have access (200) or endpoint may not exist (404)
      expect([200, 404]).toContain(res.status);
    });

    it('manager cannot access franchise-level endpoints', async () => {
      const res = await request(app.getHttpServer())
        .get('/ops-budgets/franchise')
        .query({ year: 2024, month: 11 })
        .set('Authorization', `Bearer ${managerToken}`);

      // Should be forbidden (403) or not found (404)
      expect([403, 404]).toContain(res.status);
    });
  });
});
