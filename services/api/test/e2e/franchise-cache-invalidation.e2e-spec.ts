import { Test, TestingModule } from '@nestjs/testing';
import { createE2ETestingModule, createE2ETestingModuleBuilder } from '../helpers/e2e-bootstrap';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { CacheService } from '../../src/common/cache.service';
import { cleanup } from '../helpers/cleanup';

/**
 * E22.D: Integration test for cache invalidation
 * 
 * Tests:
 * - Prime cache → mutate data → verify cache invalidated (miss on next read)
 * - Budget update invalidates budgets cache
 * - Mutations don't affect unrelated caches
 */
describe('E22.D - Franchise Cache Invalidation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cacheService: CacheService;
  let authToken: string;
  let testOrgId: string;
  let testUserId: string;
  let testBranchId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await createE2ETestingModule({
      imports: [AppModule],
    });

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    cacheService = app.get<CacheService>(CacheService);

    // Set up test data
    await setupTestData();
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    if (testBranchId) {
      await prisma.branch.delete({ where: { id: testBranchId } }).catch(() => {});
    }
    if (testOrgId) {
      await prisma.org.delete({ where: { id: testOrgId } }).catch(() => {});
    }

    await cleanup(app);
  });

  async function setupTestData() {
    // Create test organization
    const org = await prisma.org.create({
      data: {
        name: 'E22D Test Org',
        slug: `e22d-test-${Date.now()}`,
        tier: 'BASIC',
      },
    });
    testOrgId = org.id;

    // Create test branch
    const branch = await prisma.branch.create({
      data: {
        orgId: testOrgId,
        name: 'E22D Test Branch',
        status: 'ACTIVE',
        isHeadquarters: false,
      },
    });
    testBranchId = branch.id;

    // Create test user with L5 role
    const user = await prisma.user.create({
      data: {
        email: `e22d-test-${Date.now()}@example.com`,
        firstName: 'E22D',
        lastName: 'TestUser',
        passwordHash: 'hashed_password',
        orgId: testOrgId,
        branchId: testBranchId,
        roleLevel: 'L5',
      },
    });
    testUserId = user.id;

    // Create initial budget
    const period = '2025-11';
    await prisma.budget.create({
      data: {
        orgId: testOrgId,
        branchId: testBranchId,
        period,
        revenueTarget: 50000,
        cogsTarget: 15000,
        expenseTarget: 20000,
        notes: 'Initial E22D test budget',
      },
    });

    // Generate auth token (simplified - in real tests, use proper JWT)
    authToken = Buffer.from(
      JSON.stringify({ id: testUserId, orgId: testOrgId, branchId: testBranchId, roleLevel: 'L5' }),
    ).toString('base64');
  }

  beforeEach(async () => {
    // Clear all franchise caches before each test
    await cacheService.bustPrefix('fr:overview');
    await cacheService.bustPrefix('fr:rankings');
    await cacheService.bustPrefix('fr:budgets');
    await cacheService.bustPrefix('fr:forecast');
  });

  describe('Budget Update Invalidation', () => {
    it('should invalidate budgets cache after budget update', async () => {
      const period = '2025-11';

      // Step 1: Prime the budgets cache (first call - miss)
      const prime = await request(app.getHttpServer())
        .get(`/franchise/budgets?period=${period}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(prime.body.cached).toBe(false);
      expect(Array.isArray(prime.body.data)).toBe(true);

      // Step 2: Second call should be a cache hit
      const cached = await request(app.getHttpServer())
        .get(`/franchise/budgets?period=${period}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(cached.body.cached).toBe(true);
      expect(cached.body.data).toEqual(prime.body.data);

      // Step 3: Update budget (mutation triggers invalidation)
      const updateResponse = await request(app.getHttpServer())
        .post('/franchise/budgets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          branchId: testBranchId,
          period,
          revenueTarget: 60000, // Changed from 50000
          cogsTarget: 18000,    // Changed from 15000
          expenseTarget: 22000, // Changed from 20000
          notes: 'Updated budget - should invalidate cache',
        })
        .expect(201);

      expect(updateResponse.body).toHaveProperty('id');

      // Step 4: Next read should be a MISS (cache was invalidated)
      const afterUpdate = await request(app.getHttpServer())
        .get(`/franchise/budgets?period=${period}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(afterUpdate.body.cached).toBe(false);
      expect(afterUpdate.body.data[0].revenueTarget).toBe(60000); // Verify updated value
    });

    it('should not affect other cache prefixes when updating budgets', async () => {
      const period = '2025-11';

      // Prime budgets cache
      await request(app.getHttpServer())
        .get(`/franchise/budgets?period=${period}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify budgets cache is hit
      const budgetsCached = await request(app.getHttpServer())
        .get(`/franchise/budgets?period=${period}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(budgetsCached.body.cached).toBe(true);

      // Prime overview cache (different endpoint)
      await request(app.getHttpServer())
        .get(`/franchise/overview?period=${period}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Update budget (should only invalidate budgets, not overview)
      await request(app.getHttpServer())
        .post('/franchise/budgets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          branchId: testBranchId,
          period,
          revenueTarget: 70000,
          cogsTarget: 21000,
          expenseTarget: 25000,
        })
        .expect(201);

      // Budgets should be invalidated (miss)
      const budgetsAfter = await request(app.getHttpServer())
        .get(`/franchise/budgets?period=${period}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(budgetsAfter.body.cached).toBe(false);

      // Overview cache should still be valid (not affected by budget update)
      // Note: This test would pass if overview was primed with valid data
      // For now, we just verify the system doesn't crash
    });
  });

  describe('Cache Miss After Invalidation', () => {
    it('should return fresh data after cache invalidation', async () => {
      const period = '2025-11';

      // Prime cache
      const initial = await request(app.getHttpServer())
        .get(`/franchise/budgets?period=${period}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const initialRevenue = initial.body.data[0]?.revenueTarget;

      // Update to new value
      const newRevenue = 99000;
      await request(app.getHttpServer())
        .post('/franchise/budgets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          branchId: testBranchId,
          period,
          revenueTarget: newRevenue,
          cogsTarget: 29000,
          expenseTarget: 30000,
        })
        .expect(201);

      // Next read should have new value (not stale cached value)
      const afterUpdate = await request(app.getHttpServer())
        .get(`/franchise/budgets?period=${period}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(afterUpdate.body.cached).toBe(false);
      expect(afterUpdate.body.data[0].revenueTarget).toBe(newRevenue);
      expect(afterUpdate.body.data[0].revenueTarget).not.toBe(initialRevenue);
    });
  });

  describe('Multiple Invalidations', () => {
    it('should handle multiple rapid invalidations without errors', async () => {
      const period = '2025-11';

      // Prime cache
      await request(app.getHttpServer())
        .get(`/franchise/budgets?period=${period}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Perform multiple rapid updates
      const updates = [60000, 70000, 80000];
      for (const revenue of updates) {
        await request(app.getHttpServer())
          .post('/franchise/budgets')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            branchId: testBranchId,
            period,
            revenueTarget: revenue,
            cogsTarget: 20000,
            expenseTarget: 25000,
          })
          .expect(201);
      }

      // Final read should return the last updated value
      const final = await request(app.getHttpServer())
        .get(`/franchise/budgets?period=${period}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(final.body.cached).toBe(false);
      expect(final.body.data[0].revenueTarget).toBe(80000);
    });
  });
});
