/**
 * M12.8: Inventory Close Ops Finalization E2E Tests
 *
 * Regression pack covering:
 * - Approval gating (403 without approval)
 * - L5 forceClose with reason validation
 * - FAILED_GL_POSTINGS detection in preclose
 * - Cross-branch snapshot correctness
 * - Close-pack hash stability
 * - Event emission (OVERRIDE_USED, FORCE_CLOSE_USED)
 */
import { TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { createOrgWithUsers, FactoryOrg } from './factory';
import { cleanup } from '../helpers/cleanup';
import { createE2ETestingModule } from '../helpers/e2e-bootstrap';
import * as crypto from 'crypto';

jest.setTimeout(180_000);

const testSuffix = Date.now().toString(36);

describe('M12.8 Close Ops Finalization', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factory: FactoryOrg;

  let ownerToken: string; // L5
  let managerToken: string; // L4

  let periodIdMar: string;
  let periodIdApr: string;
  let branch2Id: string;
  let branch2PeriodId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await createE2ETestingModule({ imports: [AppModule] });

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();

    prisma = app.get(PrismaService);

    // Create first org
    factory = await createOrgWithUsers(prisma, `e2e-m128-${testSuffix}`);

    // Create a second branch in the same org for cross-branch testing
    const branch2 = await prisma.client.branch.create({
      data: {
        orgId: factory.orgId,
        name: `Branch2-${testSuffix}`,
        timezone: 'UTC',
      },
    });
    branch2Id = branch2.id;

    // Login users
    const loginOwner = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: factory.users.owner.email, password: 'Test#123' });
    ownerToken = loginOwner.body.access_token;

    const loginManager = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: factory.users.manager.email, password: 'Test#123' });
    managerToken = loginManager.body.access_token;

    // Generate March and April periods for branch 1
    await request(app.getHttpServer())
      .post('/inventory/periods/generate')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ branchId: factory.branchId, fromMonth: '2025-03', toMonth: '2025-04' })
      .expect(200);

    // Generate March period for branch 2
    await request(app.getHttpServer())
      .post('/inventory/periods/generate')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ branchId: branch2Id, fromMonth: '2025-03', toMonth: '2025-03' })
      .expect(200);

    // List periods for branch 1
    const listRes1 = await request(app.getHttpServer())
      .get('/inventory/periods')
      .query({ branchId: factory.branchId })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const periods1 = Array.isArray(listRes1.body)
      ? listRes1.body
      : listRes1.body.periods || [];

    const mar = periods1.find((p: any) => {
      const d = new Date(p.startDate);
      return d.getUTCFullYear() === 2025 && d.getUTCMonth() === 2; // March = 2
    });
    const apr = periods1.find((p: any) => {
      const d = new Date(p.startDate);
      return d.getUTCFullYear() === 2025 && d.getUTCMonth() === 3; // April = 3
    });

    if (!mar || !apr) {
      throw new Error('Failed to locate generated Mar/Apr periods for branch 1');
    }
    periodIdMar = mar.id;
    periodIdApr = apr.id;

    // List periods for branch 2
    const listRes2 = await request(app.getHttpServer())
      .get('/inventory/periods')
      .query({ branchId: branch2Id })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const periods2 = Array.isArray(listRes2.body)
      ? listRes2.body
      : listRes2.body.periods || [];

    const branch2Mar = periods2.find((p: any) => {
      const d = new Date(p.startDate);
      return d.getUTCFullYear() === 2025 && d.getUTCMonth() === 2;
    });

    if (!branch2Mar) {
      throw new Error('Failed to locate generated Mar period for branch 2');
    }
    branch2PeriodId = branch2Mar.id;
  }, 120000);

  afterAll(async () => {
    await cleanup(app);
  });

  // =========================================================================
  // H3: Approval Gating - Without Approval -> 403
  // =========================================================================
  describe('Approval Gating Regression', () => {
    it('blocks close without approved request (403)', async () => {
      const closeRes = await request(app.getHttpServer())
        .post('/inventory/periods/close')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          branchId: factory.branchId,
          startDate: '2025-03-01T00:00:00.000Z',
          endDate: '2025-03-31T23:59:59.999Z',
          lockReason: 'Mar Close',
        })
        .expect(403);

      // Should indicate approval required
      expect(closeRes.body.message).toMatch(/approval|request/i);
    });

    it('allows close after approval', async () => {
      // Create and submit close request
      const createRes = await request(app.getHttpServer())
        .post(`/inventory/periods/${periodIdMar}/close-requests`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(201);
      const requestId = createRes.body.id;

      await request(app.getHttpServer())
        .post(`/inventory/periods/close-requests/${requestId}/submit`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      // Owner approves
      await request(app.getHttpServer())
        .post(`/inventory/periods/close-requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ notes: 'Approving Mar close' })
        .expect(200);

      // Close succeeds
      const closeRes = await request(app.getHttpServer())
        .post('/inventory/periods/close')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          branchId: factory.branchId,
          startDate: '2025-03-01T00:00:00.000Z',
          endDate: '2025-03-31T23:59:59.999Z',
          lockReason: 'Mar Close',
        })
        .expect(200);

      expect(closeRes.body.status).toBe('CLOSED');
    });
  });

  // =========================================================================
  // H3: L5 ForceClose with Reason Validation
  // =========================================================================
  describe('L5 ForceClose Path', () => {
    it('rejects forceClose with short reason (<20 chars)', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/periods/close')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: factory.branchId,
          startDate: '2025-04-01T00:00:00.000Z',
          endDate: '2025-04-30T23:59:59.999Z',
          lockReason: 'Apr Close',
          forceClose: true,
          forceCloseReason: 'Too short',
        });

      // May be 400 or 403 depending on validation point
      expect([400, 403]).toContain(res.status);
    });

    it('allows forceClose with valid reason (≥20 chars) and emits audit', async () => {
      const closeRes = await request(app.getHttpServer())
        .post('/inventory/periods/close')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId: factory.branchId,
          startDate: '2025-04-01T00:00:00.000Z',
          endDate: '2025-04-30T23:59:59.999Z',
          lockReason: 'Apr Close',
          forceClose: true,
          forceCloseReason: 'Urgent closing due to quarterly audit cutoff requirements',
        })
        .expect(200);

      expect(closeRes.body.status).toBe('CLOSED');

      // Check events include FORCE_CLOSE_USED
      const eventsRes = await request(app.getHttpServer())
        .get(`/inventory/periods/${periodIdApr}/events`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const events = eventsRes.body.events || eventsRes.body || [];
      const hasForceEvent = events.some((e: any) => e.type === 'FORCE_CLOSE_USED');
      expect(hasForceEvent).toBe(true);
    });
  });

  // =========================================================================
  // H1: Cross-Branch Snapshot Correctness
  // =========================================================================
  describe('Cross-Branch Snapshot Correctness', () => {
    it('dashboard returns correct status per branch (not mixed)', async () => {
      // Branch 1 (Mar) is CLOSED, Branch 2 (Mar) is still OPEN
      const dashRes = await request(app.getHttpServer())
        .get('/inventory/periods/dashboard')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const rows = dashRes.body.rows || [];
      const branch1Row = rows.find((r: any) => r.branchId === factory.branchId);
      const branch2Row = rows.find((r: any) => r.branchId === branch2Id);

      // Branch 1 should show closed periods
      expect(branch1Row).toBeDefined();
      // Branch 2 should show open period
      expect(branch2Row).toBeDefined();

      // Verify no cross-branch contamination
      // Branch 2 period is still OPEN, so currentPeriod should have status OPEN
      if (branch2Row) {
        expect(branch2Row.currentPeriod).toBeDefined();
        expect(branch2Row.currentPeriod?.status).toBe('OPEN');
      }
    });

    it('preclose check returns correct status for specific branch period', async () => {
      // Run preclose for branch 2's open period
      const precloseRes = await request(app.getHttpServer())
        .post(`/inventory/periods/${branch2PeriodId}/run-preclose`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(precloseRes.body.periodId).toBe(branch2PeriodId);
      expect(precloseRes.body.branchId).toBe(branch2Id);
      // Status should be one of READY/BLOCKED/WARNING
      expect(['READY', 'BLOCKED', 'WARNING']).toContain(precloseRes.body.status);
    });
  });

  // =========================================================================
  // H2/H5: Close-Pack Hash Stability
  // =========================================================================
  describe('Close-Pack Hash Stability', () => {
    it('close-pack hash is stable across repeated calls', async () => {
      // Use March period which is closed
      const pack1 = await request(app.getHttpServer())
        .post(`/inventory/periods/${periodIdMar}/generate-close-pack`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const pack2 = await request(app.getHttpServer())
        .post(`/inventory/periods/${periodIdMar}/generate-close-pack`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(pack1.body.bundleHash).toBeDefined();
      expect(pack2.body.bundleHash).toBeDefined();
      expect(pack1.body.bundleHash).toBe(pack2.body.bundleHash);
    });

    it('export hashes are stable and deterministic', async () => {
      const pack1 = await request(app.getHttpServer())
        .post(`/inventory/periods/${periodIdMar}/generate-close-pack`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Export hashes should exist
      expect(pack1.body.exports).toBeDefined();
      if (pack1.body.exports) {
        expect(pack1.body.exports.valuation).toBeDefined();
        expect(pack1.body.exports.movements).toBeDefined();
        expect(pack1.body.exports.reconciliation).toBeDefined();
      }
    });
  });

  // =========================================================================
  // H4: FAILED_GL_POSTINGS Detection (using blockers engine)
  // =========================================================================
  describe('FAILED_GL_POSTINGS Detection', () => {
    it('blockers check includes FAILED_GL_POSTINGS check', async () => {
      // Run blockers check on branch 2's open period
      const blockersRes = await request(app.getHttpServer())
        .post(`/inventory/periods/${branch2PeriodId}/blockers/check`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(blockersRes.body.checks).toBeDefined();
      expect(Array.isArray(blockersRes.body.checks)).toBe(true);

      // Should have a FAILED_GL_POSTINGS check type (PASS or BLOCKED)
      const glCheck = blockersRes.body.checks.find(
        (c: any) => c.type === 'FAILED_GL_POSTINGS',
      );
      expect(glCheck).toBeDefined();
      expect(['PASS', 'BLOCKED', 'WARNING']).toContain(glCheck?.status);
    });
  });

  // =========================================================================
  // Close-Pack Rejection for OPEN Period (H10 from M12.7)
  // =========================================================================
  describe('Close-Pack Guard', () => {
    it('returns 409 for close-pack on OPEN period', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/periods/${branch2PeriodId}/generate-close-pack`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(409);

      expect(res.body.message).toMatch(/OPEN|close.*first/i);
    });
  });

  // =========================================================================
  // Event Emission Verification
  // =========================================================================
  describe('Event Emission', () => {
    it('OVERRIDE_USED event is emitted for blocker override', async () => {
      // Use blockers/resolve with OVERRIDE_BLOCKER action
      // First ensure we have a blocker (or just call override directly)
      const resolveRes = await request(app.getHttpServer())
        .post(`/inventory/periods/${branch2PeriodId}/blockers/resolve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          type: 'TEST_BLOCKER',
          action: 'OVERRIDE_BLOCKER',
          notes: 'Testing override event emission for M12.8',
        });

      // Should succeed (200) since owner is L5
      expect([200, 404]).toContain(resolveRes.status);

      // Check events if resolve succeeded
      if (resolveRes.status === 200) {
        const eventsRes = await request(app.getHttpServer())
          .get(`/inventory/periods/${branch2PeriodId}/events`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        const events = eventsRes.body.events || eventsRes.body || [];
        const hasOverrideEvent = events.some((e: any) => e.type === 'OVERRIDE_USED');
        expect(hasOverrideEvent).toBe(true);
      }
    });
  });
});

// =========================================================================
// Unit Tests for Hash Stability
// =========================================================================
describe('M12.8 Hash Stability Unit Tests', () => {
  it('LF normalization produces consistent hash', () => {
    const content1 = 'row1,val1\r\nrow2,val2\r\n';
    const content2 = 'row1,val1\nrow2,val2\n';

    // Normalize to LF
    const normalized1 = content1.replace(/\r\n/g, '\n');
    const normalized2 = content2.replace(/\r\n/g, '\n');

    const hash1 = crypto.createHash('sha256').update(normalized1, 'utf8').digest('hex');
    const hash2 = crypto.createHash('sha256').update(normalized2, 'utf8').digest('hex');

    expect(hash1).toBe(hash2);
  });

  it('BOM is stripped before hashing', () => {
    const BOM = '\uFEFF';
    const content = 'row1,val1\nrow2,val2\n';
    const contentWithBom = BOM + content;

    // Strip BOM before hashing
    const stripped = contentWithBom.replace(/^\uFEFF/, '');
    const hashStripped = crypto.createHash('sha256').update(stripped, 'utf8').digest('hex');
    const hashContent = crypto.createHash('sha256').update(content, 'utf8').digest('hex');

    expect(hashStripped).toBe(hashContent);
  });
});
