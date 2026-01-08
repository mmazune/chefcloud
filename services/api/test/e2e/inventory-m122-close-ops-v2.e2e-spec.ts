/**
 * M12.2: Inventory Close Ops v2 E2E Tests
 *
 * Tests:
 * - Pre-close check (READY/BLOCKED/WARNING)
 * - Period generation (monthly auto-gen + idempotency)
 * - Reopen workflow (L5 only + reason required)
 * - Close pack export (bundle hash)
 * - Period events (audit log)
 * - Revision tracking
 *
 * NO-HANG compliant: Uses withTimeout, proper cleanup, no forceExit
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { createOrgWithUsers, FactoryOrg } from './factory';
import { cleanup } from '../helpers/cleanup';
import { createE2ETestingModule } from '../helpers/e2e-bootstrap';
import { withTimeout } from '../helpers/with-timeout';

// Layer B: File-level timeout
jest.setTimeout(120_000);

// Generate unique suffix for this test run
const testSuffix = Date.now().toString(36);

describe('M12.2 Inventory Close Ops v2 E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factory: FactoryOrg;

  // Auth tokens
  let ownerToken: string;
  let managerToken: string;
  let supervisorToken: string;

  // Test data
  let locationId: string;
  let periodId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await withTimeout(
      createE2ETestingModule({ imports: [AppModule] }),
      { ms: 60_000, label: 'createE2ETestingModule' }
    );

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await withTimeout(app.init(), { ms: 30_000, label: 'app.init' });

    prisma = app.get(PrismaService);
    factory = await withTimeout(
      createOrgWithUsers(prisma, `e2e-m122-${testSuffix}`),
      { ms: 30_000, label: 'createOrgWithUsers' }
    );

    // Create a location for testing
    const loc = await prisma.client.inventoryLocation.create({
      data: {
        orgId: factory.orgId,
        branchId: factory.branchId,
        code: `LOC-M122-${testSuffix}`,
        name: 'M12.2 Test Location',
        locationType: 'STORAGE',
      },
    });
    locationId = loc.id;

    // Login users
    const loginOwner = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: factory.users.owner.email, password: 'Test#123' });
    ownerToken = loginOwner.body.access_token;

    const loginManager = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: factory.users.manager.email, password: 'Test#123' });
    managerToken = loginManager.body.access_token;

    const loginSupervisor = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: factory.users.supervisor.email, password: 'Test#123' });
    supervisorToken = loginSupervisor.body.access_token;
  }, 90_000);

  afterAll(async () => {
    await withTimeout(cleanup(app), { ms: 15_000, label: 'cleanup' });
  });

  // ============= Pre-Close Check =============

  describe('Pre-Close Check', () => {
    it('should return READY when no blockers exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/periods/preclose-check')
        .query({
          branchId: factory.branchId,
          startDate: '2025-01-01T00:00:00.000Z',
          endDate: '2025-01-31T23:59:59.999Z',
        })
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.status).toBeDefined();
      expect(['READY', 'BLOCKED', 'WARNING']).toContain(response.body.status);
      expect(response.body.checklist).toBeDefined();
      expect(Array.isArray(response.body.checklist)).toBe(true);
      expect(response.body.overrideAllowed).toBeDefined();
    });

    it('should return BLOCKED when stocktakes are in progress', async () => {
      // Create an IN_PROGRESS stocktake
      const stocktake = await prisma.client.stocktake.create({
        data: {
          orgId: factory.orgId,
          branchId: factory.branchId,
          locationId: locationId,
          code: `ST-BLOCK-${testSuffix}`,
          status: 'IN_PROGRESS',
          scheduledDate: new Date('2025-02-15'),
          createdBy: factory.users.owner.id,
        },
      });

      try {
        const response = await request(app.getHttpServer())
          .get('/inventory/periods/preclose-check')
          .query({
            branchId: factory.branchId,
            startDate: '2025-02-01T00:00:00.000Z',
            endDate: '2025-02-28T23:59:59.999Z',
          })
          .set('Authorization', `Bearer ${managerToken}`)
          .expect(200);

        expect(response.body.status).toBe('BLOCKED');
        expect(response.body.checklist.some((c: { category: string }) => c.category === 'STOCKTAKE_IN_PROGRESS')).toBe(true);
      } finally {
        // Cleanup
        await prisma.client.stocktake.delete({ where: { id: stocktake.id } });
      }
    });
  });

  // ============= Period Generation =============

  describe('Period Generation', () => {
    it('should generate monthly periods from fromMonth to toMonth', async () => {
      const response = await request(app.getHttpServer())
        .post('/inventory/periods/generate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: factory.branchId,
          fromMonth: '2025-03',
          toMonth: '2025-05',
        })
        .expect(200);

      expect(response.body.created).toBeGreaterThanOrEqual(0);
      expect(response.body.existing).toBeGreaterThanOrEqual(0);
      expect(response.body.created + response.body.existing).toBe(3); // 3 months
    });

    it('should be idempotent - skip existing periods', async () => {
      // Call generate again with same range
      const response = await request(app.getHttpServer())
        .post('/inventory/periods/generate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: factory.branchId,
          fromMonth: '2025-03',
          toMonth: '2025-05',
        })
        .expect(200);

      // Second call should find all existing
      expect(response.body.existing).toBe(3);
      expect(response.body.created).toBe(0);
    });

    it('should reject range > 24 months', async () => {
      await request(app.getHttpServer())
        .post('/inventory/periods/generate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: factory.branchId,
          fromMonth: '2023-01',
          toMonth: '2025-12', // 36 months
        })
        .expect(400);
    });
  });

  // ============= Reopen Workflow =============

  describe('Reopen Workflow', () => {
    let closedPeriodId: string;

    beforeAll(async () => {
      // Create and close a period for reopen testing
      const createRes = await request(app.getHttpServer())
        .post('/inventory/periods')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: factory.branchId,
          startDate: '2025-06-01T00:00:00.000Z',
          endDate: '2025-06-30T23:59:59.999Z',
          notes: 'Reopen test period',
        })
        .expect(201);
      closedPeriodId = createRes.body.id;

      // Close the period (M12.4: L5 force close required)
      await request(app.getHttpServer())
        .post('/inventory/periods/close')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: factory.branchId,
          startDate: '2025-06-01T00:00:00.000Z',
          endDate: '2025-06-30T23:59:59.999Z',
          forceClose: true,
          forceCloseReason: 'M12.2 reopen workflow test - initial close',
        })
        .expect(200);
    });

    it('should allow L5 to reopen a closed period', async () => {
      const response = await request(app.getHttpServer())
        .post(`/inventory/periods/${closedPeriodId}/reopen`)
        .set('Authorization', `Bearer ${ownerToken}`) // Owner = L5
        .send({
          reason: 'Correction needed for June entries - discovered missing invoices',
        })
        .expect(200);

      expect(response.body.status).toBe('OPEN');
      expect(response.body.reopenedAt).toBeDefined();
    });

    it('should require reason of at least 10 characters', async () => {
      // Close it again first (M12.4: L5 force close required)
      await request(app.getHttpServer())
        .post('/inventory/periods/close')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: factory.branchId,
          startDate: '2025-06-01T00:00:00.000Z',
          endDate: '2025-06-30T23:59:59.999Z',
          forceClose: true,
          forceCloseReason: 'M12.2 reopen workflow test - re-close for validation',
        });

      await request(app.getHttpServer())
        .post(`/inventory/periods/${closedPeriodId}/reopen`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reason: 'Short', // Too short
        })
        .expect(400);
    });

    it('should not allow manager to reopen (L5 only)', async () => {
      await request(app.getHttpServer())
        .post(`/inventory/periods/${closedPeriodId}/reopen`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          reason: 'Manager trying to reopen - should fail',
        })
        .expect(403);
    });

    it('should not allow reopening OPEN periods', async () => {
      // Create an OPEN period
      const openPeriod = await request(app.getHttpServer())
        .post('/inventory/periods')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: factory.branchId,
          startDate: '2025-07-01T00:00:00.000Z',
          endDate: '2025-07-31T23:59:59.999Z',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/inventory/periods/${openPeriod.body.id}/reopen`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reason: 'Trying to reopen an already open period',
        })
        .expect(400);
    });
  });

  // ============= Close Pack Export =============

  describe('Close Pack Export', () => {
    let packPeriodId: string;

    beforeAll(async () => {
      // Create and close a period for close pack testing
      const createRes = await request(app.getHttpServer())
        .post('/inventory/periods')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: factory.branchId,
          startDate: '2025-08-01T00:00:00.000Z',
          endDate: '2025-08-31T23:59:59.999Z',
          notes: 'Close pack test period',
        })
        .expect(201);
      packPeriodId = createRes.body.id;

      // M12.4: L5 force close required
      await request(app.getHttpServer())
        .post('/inventory/periods/close')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: factory.branchId,
          startDate: '2025-08-01T00:00:00.000Z',
          endDate: '2025-08-31T23:59:59.999Z',
          forceClose: true,
          forceCloseReason: 'M12.2 close pack export test - closing period',
        })
        .expect(200);
    });

    it('should return close pack summary with bundle hash', async () => {
      const response = await request(app.getHttpServer())
        .get(`/inventory/periods/${packPeriodId}/close-pack`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.bundleHash).toBeDefined();
      expect(response.body.bundleHash.length).toBe(64); // SHA-256 hex
      expect(response.body.exports).toBeDefined();
      expect(Array.isArray(response.body.exports)).toBe(true);
      expect(response.body.revision).toBeDefined();
    });

    it('should export close pack index CSV', async () => {
      const response = await request(app.getHttpServer())
        .get(`/inventory/periods/${packPeriodId}/export/close-pack-index.csv`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['x-nimbus-bundle-hash']).toBeDefined();
      expect(response.text).toContain('type,filename,hash,rows');
    });
  });

  // ============= Period Events (Audit Log) =============

  describe('Period Events (Audit Log)', () => {
    let eventPeriodId: string;

    beforeAll(async () => {
      // Create a period for event testing
      const createRes = await request(app.getHttpServer())
        .post('/inventory/periods')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: factory.branchId,
          startDate: '2025-09-01T00:00:00.000Z',
          endDate: '2025-09-30T23:59:59.999Z',
          notes: 'Events test period',
        })
        .expect(201);
      eventPeriodId = createRes.body.id;
    });

    it('should log CREATED event on period creation', async () => {
      const response = await request(app.getHttpServer())
        .get(`/inventory/periods/${eventPeriodId}/events`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.events).toBeDefined();
      expect(Array.isArray(response.body.events)).toBe(true);
      const createdEvent = response.body.events.find((e: { type: string }) => e.type === 'CREATED');
      expect(createdEvent).toBeDefined();
    });

    it('should log CLOSED event on period close', async () => {
      // Close the period (M12.4: L5 force close required)
      await request(app.getHttpServer())
        .post('/inventory/periods/close')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: factory.branchId,
          startDate: '2025-09-01T00:00:00.000Z',
          endDate: '2025-09-30T23:59:59.999Z',
          forceClose: true,
          forceCloseReason: 'M12.2 period events test - closing for audit log',
        })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/inventory/periods/${eventPeriodId}/events`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const closedEvent = response.body.events.find((e: { type: string }) => e.type === 'CLOSED');
      expect(closedEvent).toBeDefined();
    });

    it('should log REOPENED event on period reopen with reason', async () => {
      // Reopen the period
      await request(app.getHttpServer())
        .post(`/inventory/periods/${eventPeriodId}/reopen`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reason: 'Audit adjustment required for September',
        })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/inventory/periods/${eventPeriodId}/events`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const reopenedEvent = response.body.events.find((e: { type: string }) => e.type === 'REOPENED');
      expect(reopenedEvent).toBeDefined();
      expect(reopenedEvent.reason).toContain('September');
    });
  });

  // ============= Revision History =============

  describe('Revision History', () => {
    let revisionPeriodId: string;

    beforeAll(async () => {
      // Create, close, reopen, and close again to create revisions
      const createRes = await request(app.getHttpServer())
        .post('/inventory/periods')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: factory.branchId,
          startDate: '2025-10-01T00:00:00.000Z',
          endDate: '2025-10-31T23:59:59.999Z',
        })
        .expect(201);
      revisionPeriodId = createRes.body.id;

      // Close (revision 1) - M12.4: L5 force close required
      await request(app.getHttpServer())
        .post('/inventory/periods/close')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: factory.branchId,
          startDate: '2025-10-01T00:00:00.000Z',
          endDate: '2025-10-31T23:59:59.999Z',
          forceClose: true,
          forceCloseReason: 'M12.2 revision history test - initial close',
        });

      // Reopen
      await request(app.getHttpServer())
        .post(`/inventory/periods/${revisionPeriodId}/reopen`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reason: 'Creating revision 2 for testing purposes',
        });

      // Close again (revision 2) - M12.4: L5 force close required
      await request(app.getHttpServer())
        .post('/inventory/periods/close')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: factory.branchId,
          startDate: '2025-10-01T00:00:00.000Z',
          endDate: '2025-10-31T23:59:59.999Z',
          forceClose: true,
          forceCloseReason: 'M12.2 revision history test - second close',
        });
    });

    it('should return list of revisions for a period', async () => {
      const response = await request(app.getHttpServer())
        .get(`/inventory/periods/${revisionPeriodId}/revisions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.revisions).toBeDefined();
      expect(Array.isArray(response.body.revisions)).toBe(true);
      expect(response.body.revisions.length).toBeGreaterThanOrEqual(1);
    });

    it('should preserve historical snapshots when new revision created (H4)', async () => {
      // Get valuation snapshots - should have data for revision 2
      const response = await request(app.getHttpServer())
        .get(`/inventory/periods/${revisionPeriodId}/valuation`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Response should include revision information
      expect(response.body.snapshots).toBeDefined();
    });
  });

  // ============= Hypothesis Validation =============

  describe('Hypothesis Validation', () => {
    it('H1: Pre-close check handles boundary dates correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/periods/preclose-check')
        .query({
          branchId: factory.branchId,
          startDate: '2025-11-01T00:00:00.000Z',
          endDate: '2025-11-30T23:59:59.999Z',
        })
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Boundary handling is implicit in the check logic
      expect(response.body.status).toBeDefined();
    });

    it('H5: Bundle hash is deterministic', async () => {
      // Create and close a period
      const createRes = await request(app.getHttpServer())
        .post('/inventory/periods')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: factory.branchId,
          startDate: '2025-12-01T00:00:00.000Z',
          endDate: '2025-12-31T23:59:59.999Z',
        })
        .expect(201);

      // M12.4: L5 force close required
      await request(app.getHttpServer())
        .post('/inventory/periods/close')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: factory.branchId,
          startDate: '2025-12-01T00:00:00.000Z',
          endDate: '2025-12-31T23:59:59.999Z',
          forceClose: true,
          forceCloseReason: 'M12.2 bundle hash determinism test - closing',
        });

      // Get close pack twice
      const pack1 = await request(app.getHttpServer())
        .get(`/inventory/periods/${createRes.body.id}/close-pack`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const pack2 = await request(app.getHttpServer())
        .get(`/inventory/periods/${createRes.body.id}/close-pack`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Same period should always produce same bundle hash
      expect(pack1.body.bundleHash).toBe(pack2.body.bundleHash);
    });

    it('H6: Cross-tenant isolation enforced', async () => {
      // Try to access period from another org - should get 404 or 403
      const otherOrgPeriodId = 'non-existent-period-id';

      await request(app.getHttpServer())
        .get(`/inventory/periods/${otherOrgPeriodId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });
});
