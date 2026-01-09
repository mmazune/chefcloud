import { Test, TestingModule } from '@nestjs/testing';
import { createE2ETestingModule, createE2ETestingModuleBuilder } from '../helpers/e2e-bootstrap';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { CacheService } from '../../src/common/cache.service';
import { cleanup } from '../helpers/cleanup';

/**
 * E22.B: Integration test for /franchise/rankings caching
 * 
 * Tests:
 * - First call returns cached=false (cache miss)
 * - Second call within TTL returns cached=true (cache hit)
 * - Different periods generate different cache keys
 */
describe('E22.B - Franchise Rankings Caching (e2e)', () => {
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
        name: 'E22B Test Org',
        slug: `e22b-test-${Date.now()}`,
        tier: 'BASIC',
      },
    });
    testOrgId = org.id;

    // Create test branch
    const branch = await prisma.branch.create({
      data: {
        orgId: testOrgId,
        name: 'E22B Test Branch',
        status: 'ACTIVE',
        isHeadquarters: false,
      },
    });
    testBranchId = branch.id;

    // Create test user with L5 role
    const user = await prisma.user.create({
      data: {
        email: `e22b-test-${Date.now()}@example.com`,
        firstName: 'E22B',
        lastName: 'TestUser',
        passwordHash: 'test-hash',
        orgId: testOrgId,
        branchId: testBranchId,
        roleLevel: 'L5',
      },
    });
    testUserId = user.id;

    // Generate auth token
    authToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        orgId: testOrgId,
        roleLevel: 'L5',
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' },
    );

    // Create some test orders for rankings calculation
    const _period = new Date().toISOString().slice(0, 7); // YYYY-MM
    await prisma.order.create({
      data: {
        orgId: testOrgId,
        branchId: testBranchId,
        tableNumber: 1,
        status: 'CLOSED',
        total: 75000,
        updatedAt: new Date(),
      },
    });
  }

  describe('GET /franchise/rankings', () => {
    const getCurrentPeriod = () => new Date().toISOString().slice(0, 7);

    beforeEach(async () => {
      // Clear cache before each test
      cacheService.clearInMemory();
    });

    it('should return cached=false on first call (cache miss)', async () => {
      const period = getCurrentPeriod();

      const response = await request(app.getHttpServer())
        .get(`/franchise/rankings?period=${period}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('cached');
      expect(response.body.cached).toBe(false);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return cached=true on second call within TTL (cache hit)', async () => {
      const period = getCurrentPeriod();

      // First call - cache miss
      const response1 = await request(app.getHttpServer())
        .get(`/franchise/rankings?period=${period}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response1.body.cached).toBe(false);

      // Second call immediately - cache hit
      const response2 = await request(app.getHttpServer())
        .get(`/franchise/rankings?period=${period}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response2.body.cached).toBe(true);
      
      // Data should be identical
      expect(response2.body.data).toEqual(response1.body.data);
    });

    it('should return same data structure on cache hit and miss', async () => {
      const _period = getCurrentPeriod();

      const response1 = await request(app.getHttpServer())
        .get(`/franchise/rankings?period=${period}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get(`/franchise/rankings?period=${period}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Both responses should have same structure
      expect(response1.body).toHaveProperty('data');
      expect(response1.body).toHaveProperty('cached');
      expect(response2.body).toHaveProperty('data');
      expect(response2.body).toHaveProperty('cached');

      // Data should match
      expect(response2.body.data).toEqual(response1.body.data);
    });

    it('should cache separately for different periods', async () => {
      const period1 = getCurrentPeriod();
      const period2 = '2024-12'; // Different period

      const response1 = await request(app.getHttpServer())
        .get(`/franchise/rankings?period=${period1}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get(`/franchise/rankings?period=${period2}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Both should be cache misses (different cache keys)
      expect(response1.body.cached).toBe(false);
      expect(response2.body.cached).toBe(false);

      // Third call to period1 should be cached
      const response3 = await request(app.getHttpServer())
        .get(`/franchise/rankings?period=${period1}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response3.body.cached).toBe(true);
    });

    it('should return error for invalid period format', async () => {
      const response = await request(app.getHttpServer())
        .get('/franchise/rankings?period=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid period format');
    });

    it('should measure response time difference between miss and hit', async () => {
      const _period = getCurrentPeriod();

      // First call - cache miss (should take longer)
      const start1 = Date.now();
      const response1 = await request(app.getHttpServer())
        .get(`/franchise/rankings?period=${period}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const elapsed1 = Date.now() - start1;

      expect(response1.body.cached).toBe(false);

      // Second call - cache hit (should be faster)
      const start2 = Date.now();
      const response2 = await request(app.getHttpServer())
        .get(`/franchise/rankings?period=${period}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const elapsed2 = Date.now() - start2;

      expect(response2.body.cached).toBe(true);

      // Log timing for monitoring
      console.log(`E22.B Timing: Cache MISS=${elapsed1}ms, Cache HIT=${elapsed2}ms`);
      
      // Just ensure it's reasonably fast (avoid flaky tests)
      expect(elapsed2).toBeLessThan(1000);
    });
  });
});
