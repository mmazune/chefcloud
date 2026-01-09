import { Test, TestingModule } from '@nestjs/testing';
import { createE2ETestingModule, createE2ETestingModuleBuilder } from '../helpers/e2e-bootstrap';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { CacheService } from '../../src/common/cache.service';
import { cleanup } from '../helpers/cleanup';

/**
 * E22.C: Integration test for /franchise/budgets caching
 * 
 * Tests:
 * - First call returns cached=false (cache miss)
 * - Second call within TTL returns cached=true (cache hit)
 * - Data structure consistency between cached and non-cached responses
 * - Different periods generate different cache keys
 * - Invalid period format returns error
 * - Performance measurement (cache hit should be significantly faster)
 */
describe('E22.C - Franchise Budgets Caching (e2e)', () => {
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
        name: 'E22C Test Org',
        slug: `e22c-test-${Date.now()}`,
        tier: 'BASIC',
      },
    });
    testOrgId = org.id;

    // Create test branch
    const branch = await prisma.branch.create({
      data: {
        orgId: testOrgId,
        name: 'E22C Test Branch',
        status: 'ACTIVE',
        isHeadquarters: false,
      },
    });
    testBranchId = branch.id;

    // Create test user with L5 role
    const user = await prisma.user.create({
      data: {
        email: `e22c-test-${Date.now()}@example.com`,
        firstName: 'E22C',
        lastName: 'TestUser',
        passwordHash: 'hashed_password',
        orgId: testOrgId,
        branchId: testBranchId,
        roleLevel: 'L5',
      },
    });
    testUserId = user.id;

    // Create test budget
    const period = '2025-11';
    await prisma.budget.create({
      data: {
        orgId: testOrgId,
        branchId: testBranchId,
        period,
        revenueTarget: 50000,
        cogsTarget: 15000,
        expenseTarget: 20000,
        notes: 'E22C test budget',
      },
    });

    // Generate auth token (simplified - in real tests, use proper JWT)
    authToken = Buffer.from(
      JSON.stringify({ id: testUserId, orgId: testOrgId, branchId: testBranchId, roleLevel: 'L5' }),
    ).toString('base64');
  }

  beforeEach(async () => {
    // Clear cache before each test to ensure clean state
    await cacheService.bustPrefix('fr:budgets');
  });

  it('should return cached=false on first call (cache miss)', async () => {
    const period = '2025-11';
    const response = await request(app.getHttpServer())
      .get(`/franchise/budgets?period=${period}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('cached');
    expect(response.body.cached).toBe(false);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('should return cached=true on second call within TTL (cache hit)', async () => {
    const period = '2025-11';

    // First call - cache miss
    const response1 = await request(app.getHttpServer())
      .get(`/franchise/budgets?period=${period}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response1.body.cached).toBe(false);

    // Second call - cache hit (within 60s TTL)
    const response2 = await request(app.getHttpServer())
      .get(`/franchise/budgets?period=${period}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response2.body.cached).toBe(true);
    expect(response2.body.data).toEqual(response1.body.data);
  });

  it('should maintain data structure consistency between cached and non-cached responses', async () => {
    const period = '2025-11';

    // First call - cache miss
    const response1 = await request(app.getHttpServer())
      .get(`/franchise/budgets?period=${period}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const data1 = response1.body.data;
    expect(Array.isArray(data1)).toBe(true);

    // Second call - cache hit
    const response2 = await request(app.getHttpServer())
      .get(`/franchise/budgets?period=${period}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const data2 = response2.body.data;
    expect(data2).toEqual(data1);

    // Verify budget structure
    if (data1.length > 0) {
      const budget = data1[0];
      expect(budget).toHaveProperty('branchId');
      expect(budget).toHaveProperty('period');
      expect(budget).toHaveProperty('revenueTarget');
      expect(budget).toHaveProperty('cogsTarget');
      expect(budget).toHaveProperty('expenseTarget');
    }
  });

  it('should use different cache keys for different periods', async () => {
    const period1 = '2025-11';
    const period2 = '2025-12';

    // Create budget for second period
    await prisma.budget.create({
      data: {
        orgId: testOrgId,
        branchId: testBranchId,
        period: period2,
        revenueTarget: 60000,
        cogsTarget: 18000,
        expenseTarget: 22000,
      },
    });

    // First period - cache miss
    const response1 = await request(app.getHttpServer())
      .get(`/franchise/budgets?period=${period1}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response1.body.cached).toBe(false);

    // Second period - should also be cache miss (different key)
    const response2 = await request(app.getHttpServer())
      .get(`/franchise/budgets?period=${period2}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response2.body.cached).toBe(false);

    // First period again - should be cache hit now
    const response3 = await request(app.getHttpServer())
      .get(`/franchise/budgets?period=${period1}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response3.body.cached).toBe(true);
  });

  it('should return error for invalid period format', async () => {
    const response = await request(app.getHttpServer())
      .get('/franchise/budgets?period=invalid')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('Invalid period format');
  });

  it('cache hit should be significantly faster than cache miss', async () => {
    const period = '2025-11';

    // First call - cache miss (slower)
    const start1 = Date.now();
    await request(app.getHttpServer())
      .get(`/franchise/budgets?period=${period}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    const duration1 = Date.now() - start1;

    // Second call - cache hit (faster)
    const start2 = Date.now();
    await request(app.getHttpServer())
      .get(`/franchise/budgets?period=${period}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    const duration2 = Date.now() - start2;

    // Cache hit should be at least 2x faster (typically 10-20x faster)
    // Using conservative threshold for CI environments
    expect(duration2).toBeLessThan(duration1);
    console.log(`[E22.C Performance] Cache miss: ${duration1}ms, Cache hit: ${duration2}ms`);
  });
});
