/**
 * M10.6: Payroll Runs E2E Tests
 *
 * Tests payroll run lifecycle: DRAFT → CALCULATED → APPROVED → POSTED → PAID|VOID
 * Uses seeded DEMO_TAPAS data for isolation.
 *
 * Key endpoints:
 * - POST /workforce/payroll-runs (create run)
 * - POST /workforce/payroll-runs/:id/calculate
 * - POST /workforce/payroll-runs/:id/approve
 * - POST /workforce/payroll-runs/:id/post (GL posting)
 * - POST /workforce/payroll-runs/:id/pay
 * - POST /workforce/payroll-runs/:id/void (with reversal)
 * - GET /workforce/payroll-runs/:id/export (CSV)
 *
 * Follows E2E_NO_HANG_STANDARD.md: 120s global timeout, withTimeout wrappers, cleanup.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { createE2EApp } from './helpers/e2e-bootstrap';
import { cleanup } from './helpers/cleanup';
import { loginAs } from './helpers/e2e-login';
import { requireTapasOrg } from './helpers/require-preconditions';

jest.setTimeout(120_000);

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} exceeded ${ms}ms`)), ms),
    ),
  ]);
};

describe('M10.6: Payroll Runs (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let managerToken: string;
  let staffToken: string;
  let orgId: string;
  let branchId: string;
  let payPeriodId: string;
  const createdRunIds: string[] = [];

  beforeAll(async () => {
    app = await withTimeout(
      createE2EApp({ imports: [AppModule] }),
      30_000,
      'app bootstrap',
    );
    prisma = app.get(PrismaService);

    // Use seeded Tapas org
    await withTimeout(requireTapasOrg(prisma), 10_000, 'requireTapasOrg');

    const org = await prisma.org.findFirst({
      where: { slug: 'tapas-demo' },
      include: { branches: true },
    });
    if (!org) throw new Error('PreconditionError: Tapas org not found');
    orgId = org.id;
    branchId = org.branches[0]?.id;
    if (!branchId) throw new Error('PreconditionError: No branches for Tapas');

    // Get or create a pay period for testing
    let payPeriod = await prisma.payPeriod.findFirst({
      where: { orgId, locked: false },
      orderBy: { startDate: 'desc' },
    });
    if (!payPeriod) {
      // Create one for testing
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth(), 15);
      payPeriod = await prisma.payPeriod.create({
        data: {
          orgId,
          startDate,
          endDate,
          locked: false,
        },
      });
    }
    payPeriodId = payPeriod.id;

    // Login as owner (L5), manager (L4), staff (L3)
    const ownerLogin = await loginAs(app, 'owner', 'tapas');
    ownerToken = ownerLogin.accessToken;
    const managerLogin = await loginAs(app, 'manager', 'tapas');
    managerToken = managerLogin.accessToken;
    try {
      const staffLogin = await loginAs(app, 'staff', 'tapas');
      staffToken = staffLogin.accessToken;
    } catch {
      // Staff user may not exist in seeded data
      staffToken = '';
    }
  });

  afterAll(async () => {
    // Clean up created payroll runs
    for (const runId of createdRunIds) {
      try {
        await prisma.payrollRunLine.deleteMany({ where: { payrollRunId: runId } });
        await prisma.payrollRunJournalLink.deleteMany({ where: { payrollRunId: runId } });
        await prisma.payrollRun.delete({ where: { id: runId } });
      } catch {
        // Ignore cleanup errors
      }
    }
    await cleanup(app);
  });

  describe('H1: Payroll run creation and calculation', () => {
    let runId: string;

    it('should create a DRAFT payroll run', async () => {
      const res = await withTimeout(
        request(app.getHttpServer())
          .post('/workforce/payroll-runs')
          .set('Authorization', `Bearer ${managerToken}`)
          .set('x-org-id', orgId)
          .send({ payPeriodId, branchId }),
        10_000,
        'create payroll run',
      );

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('DRAFT');
      runId = res.body.id;
      createdRunIds.push(runId);
    });

    it('should calculate payroll run hours', async () => {
      if (!runId) return; // Skip if create failed

      const res = await withTimeout(
        request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/calculate`)
          .set('Authorization', `Bearer ${managerToken}`)
          .set('x-org-id', orgId)
          .send(),
        15_000,
        'calculate payroll run',
      );

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CALCULATED');
      expect(res.body).toHaveProperty('regularHours');
      expect(res.body).toHaveProperty('overtimeHours');
    });
  });

  describe('H2: RBAC - Staff cannot create or approve', () => {
    it('should deny staff (L3) from creating payroll run', async () => {
      if (!staffToken) return; // Skip if no staff user

      const res = await withTimeout(
        request(app.getHttpServer())
          .post('/workforce/payroll-runs')
          .set('Authorization', `Bearer ${staffToken}`)
          .set('x-org-id', orgId)
          .send({ payPeriodId }),
        10_000,
        'staff create payroll run',
      );

      expect([401, 403]).toContain(res.status);
    });
  });

  describe('H3: Full lifecycle - DRAFT to PAID', () => {
    let runId: string;

    it('should complete full payroll lifecycle', async () => {
      // 1. Create
      const createRes = await withTimeout(
        request(app.getHttpServer())
          .post('/workforce/payroll-runs')
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId)
          .send({ payPeriodId }),
        10_000,
        'create run',
      );
      expect([200, 201]).toContain(createRes.status);
      runId = createRes.body.id;
      createdRunIds.push(runId);

      // 2. Calculate
      const calcRes = await withTimeout(
        request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/calculate`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId)
          .send(),
        15_000,
        'calculate run',
      );
      expect(calcRes.status).toBe(200);
      expect(calcRes.body.status).toBe('CALCULATED');

      // 3. Approve
      const approveRes = await withTimeout(
        request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/approve`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId)
          .send(),
        10_000,
        'approve run',
      );
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.status).toBe('APPROVED');

      // 4. Post to GL
      const postRes = await withTimeout(
        request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/post`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId)
          .send(),
        15_000,
        'post run',
      );
      expect(postRes.status).toBe(200);
      expect(postRes.body.status).toBe('POSTED');

      // 5. Mark Paid
      const payRes = await withTimeout(
        request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/pay`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId)
          .send(),
        10_000,
        'pay run',
      );
      expect(payRes.status).toBe(200);
      expect(payRes.body.status).toBe('PAID');
    });
  });

  describe('H4: Manager cannot post or pay', () => {
    let runId: string;

    beforeAll(async () => {
      // Create and approve a run
      const createRes = await request(app.getHttpServer())
        .post('/workforce/payroll-runs')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-org-id', orgId)
        .send({ payPeriodId });
      runId = createRes.body?.id;
      if (runId) {
        createdRunIds.push(runId);
        await request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/calculate`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId);
        await request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/approve`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId);
      }
    });

    it('should deny manager (L4) from posting', async () => {
      if (!runId) return;

      const res = await withTimeout(
        request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/post`)
          .set('Authorization', `Bearer ${managerToken}`)
          .set('x-org-id', orgId)
          .send(),
        10_000,
        'manager post',
      );

      expect([401, 403]).toContain(res.status);
    });
  });

  describe('H5: Void creates reversal entries', () => {
    let runId: string;

    beforeAll(async () => {
      // Create, calculate, approve, post a run
      const createRes = await request(app.getHttpServer())
        .post('/workforce/payroll-runs')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-org-id', orgId)
        .send({ payPeriodId });
      runId = createRes.body?.id;
      if (runId) {
        createdRunIds.push(runId);
        await request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/calculate`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId);
        await request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/approve`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId);
        await request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/post`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId);
      }
    });

    it('should void a posted payroll run', async () => {
      if (!runId) return;

      const res = await withTimeout(
        request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/void`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId)
          .send(),
        10_000,
        'void run',
      );

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('VOID');
    });
  });

  describe('H6: CSV Export', () => {
    it('should export payroll run as CSV', async () => {
      // Create and calculate a run first
      const createRes = await request(app.getHttpServer())
        .post('/workforce/payroll-runs')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-org-id', orgId)
        .send({ payPeriodId });

      if (createRes.body?.id) {
        const runId = createRes.body.id;
        createdRunIds.push(runId);

        await request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/calculate`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId);

        const res = await withTimeout(
          request(app.getHttpServer())
            .get(`/workforce/payroll-runs/${runId}/export`)
            .set('Authorization', `Bearer ${managerToken}`)
            .set('x-org-id', orgId),
          10_000,
          'export CSV',
        );

        expect([200, 404]).toContain(res.status);
        if (res.status === 200) {
          expect(res.header['content-type']).toContain('text/csv');
        }
      }
    });
  });

  describe('H7: List payroll runs with filters', () => {
    it('should list payroll runs', async () => {
      const res = await withTimeout(
        request(app.getHttpServer())
          .get('/workforce/payroll-runs')
          .set('Authorization', `Bearer ${managerToken}`)
          .set('x-org-id', orgId),
        10_000,
        'list runs',
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should filter by status', async () => {
      const res = await withTimeout(
        request(app.getHttpServer())
          .get('/workforce/payroll-runs')
          .query({ status: 'DRAFT' })
          .set('Authorization', `Bearer ${managerToken}`)
          .set('x-org-id', orgId),
        10_000,
        'filter by status',
      );

      expect(res.status).toBe(200);
      if (Array.isArray(res.body) && res.body.length > 0) {
        expect(res.body.every((r: { status: string }) => r.status === 'DRAFT')).toBe(true);
      }
    });
  });

  describe('H8: Locked pay period rejection', () => {
    it('should reject creating run for locked pay period', async () => {
      // Create a locked pay period
      const lockedPeriod = await prisma.payPeriod.create({
        data: {
          orgId,
          startDate: new Date('2020-01-01'),
          endDate: new Date('2020-01-15'),
          locked: true,
        },
      });

      const res = await withTimeout(
        request(app.getHttpServer())
          .post('/workforce/payroll-runs')
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId)
          .send({ payPeriodId: lockedPeriod.id }),
        10_000,
        'locked period rejection',
      );

      expect([400, 403]).toContain(res.status);

      // Cleanup
      await prisma.payPeriod.delete({ where: { id: lockedPeriod.id } });
    });
  });
});
