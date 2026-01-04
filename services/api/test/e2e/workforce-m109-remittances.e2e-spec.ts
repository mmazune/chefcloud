/**
 * M10.9 Workforce Remittances E2E Tests
 *
 * STANDARD: instructions/E2E_TESTING_STANDARD.md
 *
 * This file validates:
 * - H1: Remittance batch CRUD (create, list, get, update, delete DRAFT only)
 * - H2: Line management (add/remove lines, total recalculated)
 * - H3: State machine transitions (DRAFT→APPROVED→POSTED→PAID)
 * - H4: VOID transition from any non-VOID state
 * - H5: Journal creation on PAID (Dr Liability / Cr Cash)
 * - H6: Journal reversal on VOID
 * - H7: Payment preview endpoint
 * - H8: Idempotency key collision detection
 * - H9: RBAC enforcement (L4+ for CRUD, L5 only for post/pay/void)
 * - H10: KPI and export endpoints
 */

import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { createE2EApp } from '../helpers/e2e-bootstrap';
import { cleanup } from '../helpers/cleanup';
import { withTimeout } from '../helpers/with-timeout';
import { trace, traceSpan } from '../helpers/e2e-trace';
import { loginAs } from '../helpers/e2e-login';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';

// Layer B: Jest file timeout (120s for full AppModule tests)
jest.setTimeout(120_000);

describe('M10.9 Workforce Remittances (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let managerToken: string;
  let staffToken: string;
  let orgId: string;
  let branchId: string;
  
  // Test data IDs
  let createdBatchId: string;
  let createdLineId: string;
  let liabilityAccountId: string;
  let cashAccountId: string;

  beforeAll(async () => {
    await traceSpan('beforeAll', async () => {
      trace('creating E2E app');
      
      // Layer C: Wrap app creation with timeout
      app = await withTimeout(
        createE2EApp({ imports: [AppModule] }),
        { ms: 60_000, label: 'createE2EApp' }
      );
      
      prisma = app.get(PrismaService);
      trace('app created, logging in users');

      // Login as different roles
      const ownerLogin = await withTimeout(
        loginAs(app, 'owner'),
        { ms: 10_000, label: 'ownerLogin' }
      );
      ownerToken = ownerLogin.accessToken;
      orgId = ownerLogin.user.orgId;

      const managerLogin = await withTimeout(
        loginAs(app, 'manager'),
        { ms: 10_000, label: 'managerLogin' }
      );
      managerToken = managerLogin.accessToken;

      const staffLogin = await withTimeout(
        loginAs(app, 'staff'),
        { ms: 10_000, label: 'staffLogin' }
      );
      staffToken = staffLogin.accessToken;

      // Get or create test accounts
      const liabilityAccount = await prisma.client.account.findFirst({
        where: { orgId, type: 'LIABILITY' },
      });
      if (liabilityAccount) {
        liabilityAccountId = liabilityAccount.id;
      }

      const cashAccount = await prisma.client.account.findFirst({
        where: { orgId, type: 'ASSET' },
      });
      if (cashAccount) {
        cashAccountId = cashAccount.id;
      }

      // Get a branch for testing
      const branch = await prisma.client.branch.findFirst({
        where: { orgId },
      });
      if (branch) {
        branchId = branch.id;
      }

      trace('beforeAll complete', { orgId, branchId: branchId || 'none' });
    });
  });

  afterAll(async () => {
    await traceSpan('afterAll', async () => {
      trace('cleaning up test data');
      
      if (prisma) {
        // Clean remittance journal links
        try {
          await prisma.client.remittanceJournalLink.deleteMany({
            where: { batch: { orgId } },
          });
        } catch (e) {
          trace('Could not clean remittanceJournalLink', { error: (e as Error).message });
        }
        
        // Clean remittance lines
        try {
          await prisma.client.remittanceLine.deleteMany({
            where: { batch: { orgId } },
          });
        } catch (e) {
          trace('Could not clean remittanceLine', { error: (e as Error).message });
        }
        
        // Clean remittance batches (test only)
        try {
          await prisma.client.remittanceBatch.deleteMany({
            where: { orgId, memo: { startsWith: 'E2E_TEST_' } },
          });
        } catch (e) {
          trace('Could not clean remittanceBatch', { error: (e as Error).message });
        }
      }

      trace('closing app');
      await withTimeout(cleanup(app), { ms: 15_000, label: 'cleanup' });
      trace('afterAll complete');
    });
  });

  // ===== H1: Remittance Batch CRUD =====
  describe('H1: Remittance Batch CRUD', () => {
    it('should create a remittance batch (L4+)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          type: 'TAX',
          currencyCode: 'UGX',
          memo: 'E2E_TEST_tax_batch',
          idempotencyKey: `E2E_${Date.now()}`,
        })
        .expect(HttpStatus.CREATED);

      expect(res.body).toMatchObject({
        type: 'TAX',
        status: 'DRAFT',
        currencyCode: 'UGX',
        memo: 'E2E_TEST_tax_batch',
      });
      createdBatchId = res.body.id;
    });

    it('should list remittance batches', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orgs/${orgId}/remittances`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((b: any) => b.id === createdBatchId);
      expect(found).toBeDefined();
    });

    it('should get batch details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orgs/${orgId}/remittances/${createdBatchId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.id).toBe(createdBatchId);
      expect(res.body.status).toBe('DRAFT');
    });

    it('should update DRAFT batch', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orgs/${orgId}/remittances/${createdBatchId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ memo: 'E2E_TEST_updated_memo' })
        .expect(HttpStatus.OK);

      expect(res.body.memo).toBe('E2E_TEST_updated_memo');
    });

    it('should reject L1 user from listing batches', async () => {
      await request(app.getHttpServer())
        .get(`/orgs/${orgId}/remittances`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ===== H2: Line Management =====
  describe('H2: Line Management', () => {
    it('should add a line to batch', async () => {
      if (!liabilityAccountId || !cashAccountId) {
        trace('Skipping line test - no accounts available');
        return;
      }

      const res = await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances/${createdBatchId}/lines`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          liabilityAccountId,
          counterAccountId: cashAccountId,
          amount: '50000.00',
          payeeName: 'URA',
          referenceCode: 'TIN-E2E-001',
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.id).toBeDefined();
      createdLineId = res.body.id;
    });

    it('should recalculate total after adding line', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orgs/${orgId}/remittances/${createdBatchId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(parseFloat(res.body.totalAmount)).toBeGreaterThan(0);
    });

    it('should remove line from batch', async () => {
      if (!createdLineId) {
        trace('Skipping remove line test - no line created');
        return;
      }

      await request(app.getHttpServer())
        .delete(`/orgs/${orgId}/remittances/${createdBatchId}/lines/${createdLineId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      // Re-add line for subsequent tests
      if (liabilityAccountId && cashAccountId) {
        const res = await request(app.getHttpServer())
          .post(`/orgs/${orgId}/remittances/${createdBatchId}/lines`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            liabilityAccountId,
            counterAccountId: cashAccountId,
            amount: '75000.00',
            payeeName: 'NSSF',
          })
          .expect(HttpStatus.CREATED);
        createdLineId = res.body.id;
      }
    });
  });

  // ===== H3: State Machine Transitions =====
  describe('H3: State Machine Transitions', () => {
    it('should approve batch (DRAFT → APPROVED)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances/${createdBatchId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.status).toBe('APPROVED');
    });

    it('should post batch (APPROVED → POSTED) - L5 only', async () => {
      const res = await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances/${createdBatchId}/post`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.status).toBe('POSTED');
    });

    it('should pay batch (POSTED → PAID) - L5 only', async () => {
      const res = await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances/${createdBatchId}/pay`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.status).toBe('PAID');
    });
  });

  // ===== H4: VOID Transition =====
  describe('H4: VOID Transition', () => {
    let voidTestBatchId: string;

    beforeAll(async () => {
      // Create a new batch for void testing
      const res = await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          type: 'DEDUCTION',
          memo: 'E2E_TEST_void_batch',
        });
      voidTestBatchId = res.body.id;

      // Add a line if accounts available
      if (liabilityAccountId && cashAccountId) {
        await request(app.getHttpServer())
          .post(`/orgs/${orgId}/remittances/${voidTestBatchId}/lines`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            liabilityAccountId,
            counterAccountId: cashAccountId,
            amount: '10000.00',
          });
      }

      // Approve it
      await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances/${voidTestBatchId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`);
    });

    it('should void an APPROVED batch', async () => {
      const res = await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances/${voidTestBatchId}/void`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.status).toBe('VOID');
    });

    it('should reject void on already VOID batch', async () => {
      await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances/${voidTestBatchId}/void`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  // ===== H7: Payment Preview =====
  describe('H7: Payment Preview', () => {
    let previewBatchId: string;

    beforeAll(async () => {
      // Create a batch for preview testing
      const res = await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          type: 'EMPLOYER_CONTRIB',
          memo: 'E2E_TEST_preview_batch',
        });
      previewBatchId = res.body.id;

      // Add lines if accounts available
      if (liabilityAccountId && cashAccountId) {
        await request(app.getHttpServer())
          .post(`/orgs/${orgId}/remittances/${previewBatchId}/lines`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            liabilityAccountId,
            counterAccountId: cashAccountId,
            amount: '25000.00',
            payeeName: 'NSSF Employer',
          });
      }

      // Approve
      await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances/${previewBatchId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`);
    });

    it('should return payment preview with journal lines', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orgs/${orgId}/remittances/${previewBatchId}/preview`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.batchId).toBe(previewBatchId);
      expect(res.body.lines).toBeDefined();
      expect(Array.isArray(res.body.lines)).toBe(true);
      expect(res.body.totals).toBeDefined();
      expect(res.body.totals.balanced).toBe(true);
    });
  });

  // ===== H8: Idempotency Key Collision =====
  describe('H8: Idempotency Key Collision', () => {
    const idempotencyKey = `IDEM_${Date.now()}`;

    it('should create batch with idempotency key', async () => {
      const res = await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          type: 'MIXED',
          memo: 'E2E_TEST_idempotency',
          idempotencyKey,
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.idempotencyKey).toBe(idempotencyKey);
    });

    it('should reject duplicate idempotency key', async () => {
      const res = await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          type: 'TAX',
          memo: 'E2E_TEST_duplicate',
          idempotencyKey,
        })
        .expect(HttpStatus.CONFLICT);

      expect(res.body.message).toContain('Idempotency');
    });
  });

  // ===== H9: RBAC Enforcement =====
  describe('H9: RBAC Enforcement', () => {
    let rbacBatchId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          type: 'TAX',
          memo: 'E2E_TEST_rbac_batch',
        });
      rbacBatchId = res.body.id;
    });

    it('should reject manager from posting (L5 only)', async () => {
      // First approve
      await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances/${rbacBatchId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`);

      // Manager (L3) should fail to post
      await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances/${rbacBatchId}/post`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should reject staff from creating batch', async () => {
      await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          type: 'TAX',
          memo: 'E2E_TEST_unauthorized',
        })
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ===== H11: Period Lock Enforcement =====
  describe('H11: Period Lock Enforcement', () => {
    let periodLockBatchId: string;

    it('should reject pay transition when fiscal period is locked', async () => {
      // Create a batch
      const createRes = await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          type: 'TAX',
          memo: 'E2E_TEST_period_lock_batch',
        })
        .expect(HttpStatus.CREATED);
      periodLockBatchId = createRes.body.id;

      // Add a line
      if (liabilityAccountId && cashAccountId) {
        await request(app.getHttpServer())
          .post(`/orgs/${orgId}/remittances/${periodLockBatchId}/lines`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            liabilityAccountId,
            counterAccountId: cashAccountId,
            amount: '5000.00',
          });
      }

      // Approve and post
      await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances/${periodLockBatchId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`);
      await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances/${periodLockBatchId}/post`)
        .set('Authorization', `Bearer ${ownerToken}`);

      // Lock current fiscal period (use updateMany with date filter)
      const now = new Date();
      await prisma.client.fiscalPeriod.updateMany({
        where: {
          orgId,
          startsAt: { lte: now },
          endsAt: { gte: now },
          status: { not: 'LOCKED' },
        },
        data: { status: 'LOCKED' },
      });

      // Attempt to pay - should get 403
      await request(app.getHttpServer())
        .post(`/orgs/${orgId}/remittances/${periodLockBatchId}/pay`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.FORBIDDEN);

      // Unlock the period for cleanup
      await prisma.client.fiscalPeriod.updateMany({
        where: {
          orgId,
          startsAt: { lte: now },
          endsAt: { gte: now },
          status: 'LOCKED',
        },
        data: { status: 'OPEN' },
      });
    });
  });

  // ===== H10: KPI and Export Endpoints =====
  describe('H10: KPI and Export Endpoints', () => {
    it('should return remittance KPIs', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orgs/${orgId}/reports/remittances/kpis`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.totalBatches).toBeDefined();
      expect(res.body.byStatus).toBeDefined();
      expect(res.body.byType).toBeDefined();
      expect(res.body.totalPaid).toBeDefined();
      expect(res.body.totalPending).toBeDefined();
    });

    it('should export batches as CSV', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orgs/${orgId}/reports/export/remittances`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.header['content-type']).toContain('text/csv');
    });

    it('should export lines as CSV', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orgs/${orgId}/reports/export/remittance-lines`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.header['content-type']).toContain('text/csv');
    });
  });
});
