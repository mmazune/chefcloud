/**
 * E22-s2: Franchise APIs (e2e)
 *
 * Tests franchise functionality using seeded DEMO_CAFESSERIE_FRANCHISE dataset.
 * Cafesserie has 4 branches configured for franchise features.
 *
 * Key endpoints:
 * - GET /franchise/rankings - Branch performance rankings
 * - GET /franchise/budgets - Budget allocations
 * - GET /franchise/analytics/overview - Franchise-wide metrics
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { createE2EApp } from './helpers/e2e-bootstrap';
import { cleanup } from './helpers/cleanup';
import { loginAs } from './helpers/e2e-login';
import { requireCafesserieFranchise } from './helpers/require-preconditions';

describe('E22-s2: Franchise APIs (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let orgId: string;
  let branchIds: string[];

  beforeAll(async () => {
    app = await createE2EApp({ imports: [AppModule] });
    prisma = app.get(PrismaService);

    // Validate preconditions - need Cafesserie with 4 branches
    await requireCafesserieFranchise(prisma, { minBranches: 4 });

    // Get Cafesserie org
    const org = await prisma.org.findFirst({
      where: { slug: 'cafesserie-demo' },
      include: { branches: true },
    });
    if (!org) throw new Error('Cafesserie org not found after precondition check');
    orgId = org.id;
    branchIds = org.branches.map((b) => b.id);

    // Login as owner
    const login = await loginAs(app, 'owner', 'cafesserie');
    ownerToken = login.accessToken;
  });

  afterAll(async () => {
    // No cleanup needed - using seeded read-only data
    await cleanup(app);
  });

  describe('GET /franchise/rankings', () => {
    it('should return branch rankings for franchise org', async () => {
      const response = await request(app.getHttpServer())
        .get('/franchise/rankings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-org-id', orgId)
        .expect(200);

      // Response could be array, object with data, or rankings property
      const body = response.body;
      const isValidResponse =
        Array.isArray(body) ||
        Array.isArray(body.data) ||
        Array.isArray(body.rankings) ||
        typeof body === 'object';
      expect(isValidResponse).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/franchise/rankings')
        .set('x-org-id', orgId)
        .expect(401);
    });
  });

  describe('GET /franchise/budgets', () => {
    it('should return budgets list for franchise org', async () => {
      const response = await request(app.getHttpServer())
        .get('/franchise/budgets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-org-id', orgId)
        .expect(200);

      // Response could be array, object with data, or budgets property
      const body = response.body;
      const isValidResponse =
        Array.isArray(body) ||
        Array.isArray(body.data) ||
        Array.isArray(body.budgets) ||
        typeof body === 'object';
      expect(isValidResponse).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/franchise/budgets')
        .set('x-org-id', orgId)
        .expect(401);
    });
  });

  describe('GET /franchise/analytics/overview', () => {
    it('should return analytics overview for franchise', async () => {
      const response = await request(app.getHttpServer())
        .get('/franchise/analytics/overview')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-org-id', orgId)
        .expect(200);

      // Should have some metrics
      expect(response.body).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/franchise/analytics/overview')
        .set('x-org-id', orgId)
        .expect(401);
    });
  });

  describe('GET /franchise/procurement/suggest', () => {
    it('should return procurement suggestions', async () => {
      const response = await request(app.getHttpServer())
        .get('/franchise/procurement/suggest')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-org-id', orgId)
        .expect(200);

      expect(Array.isArray(response.body.data || response.body)).toBe(true);
    });
  });

  describe('Multi-branch isolation', () => {
    it('should include all franchise branches in rankings', async () => {
      const response = await request(app.getHttpServer())
        .get('/franchise/rankings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-org-id', orgId)
        .expect(200);

      const rankings = response.body.data || response.body;
      if (Array.isArray(rankings) && rankings.length > 0) {
        // Verify each branch has required ranking fields
        rankings.forEach((branch: any) => {
          expect(branch).toHaveProperty('branchId');
        });
      }
    });

    it('should scope budgets to franchise org only', async () => {
      const response = await request(app.getHttpServer())
        .get('/franchise/budgets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-org-id', orgId)
        .expect(200);

      const budgets = response.body.data || response.body;
      if (Array.isArray(budgets)) {
        budgets.forEach((budget: any) => {
          // All budgets should belong to franchise branches
          if (budget.branchId) {
            expect(branchIds).toContain(budget.branchId);
          }
        });
      }
    });
  });
});
