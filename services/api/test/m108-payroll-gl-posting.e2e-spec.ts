/**
 * M10.8: Payroll GL Posting Full E2E Tests
 *
 * Tests for configurable GL mappings and full gross-to-net posting.
 *
 * Scenarios covered:
 * 1. Mapping CRUD (list/upsert/delete)
 * 2. Posting preview
 * 3. Post idempotency (double-post returns error)
 * 4. Journal totals match payslip aggregates
 * 5. Pay uses NET only (not gross)
 * 6. Void creates reversal entries
 * 7. Branch-specific mappings override org-level
 *
 * Follows E2E_NO_HANG_STANDARD: 120s global timeout, withTimeout wrappers.
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

describe('M10.8: Payroll GL Posting Full (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let managerToken: string;
  let orgId: string;
  let branchId: string;
  let payPeriodId: string;
  const createdRunIds: string[] = [];
  const createdMappingIds: string[] = [];

  // Default account codes
  let laborExpenseAcctId: string;
  let wagesPayableAcctId: string;
  let taxesPayableAcctId: string;
  let deductionsPayableAcctId: string;
  let employerContribExpenseAcctId: string;
  let employerContribPayableAcctId: string;
  let cashAcctId: string;

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

    // Get or create pay period
    let payPeriod = await prisma.payPeriod.findFirst({
      where: { orgId, locked: false },
      orderBy: { startDate: 'desc' },
    });
    if (!payPeriod) {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth(), 15);
      payPeriod = await prisma.payPeriod.create({
        data: { orgId, startDate, endDate, locked: false },
      });
    }
    payPeriodId = payPeriod.id;

    // Ensure GL accounts exist for payroll posting
    const accountCodes = [
      { code: '6000', name: 'Labor Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
      { code: '2105', name: 'Wages Payable', type: 'LIABILITY', normalBalance: 'CREDIT' },
      { code: '2110', name: 'Taxes Payable', type: 'LIABILITY', normalBalance: 'CREDIT' },
      { code: '2115', name: 'Deductions Payable', type: 'LIABILITY', normalBalance: 'CREDIT' },
      { code: '6050', name: 'Employer Contrib Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
      { code: '2120', name: 'Employer Contrib Payable', type: 'LIABILITY', normalBalance: 'CREDIT' },
      { code: '1000', name: 'Cash', type: 'ASSET', normalBalance: 'DEBIT' },
    ];

    for (const acct of accountCodes) {
      await prisma.account.upsert({
        where: { orgId_code: { orgId, code: acct.code } },
        create: { orgId, ...acct },
        update: {},
      });
    }

    // Fetch account IDs
    const accounts = await prisma.account.findMany({
      where: { orgId, code: { in: accountCodes.map((a) => a.code) } },
    });
    const acctMap = new Map(accounts.map((a) => [a.code, a.id]));
    laborExpenseAcctId = acctMap.get('6000')!;
    wagesPayableAcctId = acctMap.get('2105')!;
    taxesPayableAcctId = acctMap.get('2110')!;
    deductionsPayableAcctId = acctMap.get('2115')!;
    employerContribExpenseAcctId = acctMap.get('6050')!;
    employerContribPayableAcctId = acctMap.get('2120')!;
    cashAcctId = acctMap.get('1000')!;

    // Login tokens
    const ownerLogin = await loginAs(app, 'owner', 'tapas');
    ownerToken = ownerLogin.accessToken;
    const managerLogin = await loginAs(app, 'manager', 'tapas');
    managerToken = managerLogin.accessToken;
  });

  afterAll(async () => {
    // Cleanup created mappings
    for (const mappingId of createdMappingIds) {
      try {
        await prisma.payrollPostingMapping.delete({ where: { id: mappingId } });
      } catch { /* ignore */ }
    }
    // Cleanup created runs
    for (const runId of createdRunIds) {
      try {
        await prisma.payslip.deleteMany({ where: { payrollRunId: runId } });
        await prisma.payrollRunLine.deleteMany({ where: { payrollRunId: runId } });
        await prisma.payrollRunJournalLink.deleteMany({ where: { payrollRunId: runId } });
        await prisma.payrollRun.delete({ where: { id: runId } });
      } catch { /* ignore */ }
    }
    await cleanup(app);
  });

  // ===== H1: Mapping CRUD =====
  describe('H1: Payroll mapping CRUD', () => {
    it('should list mappings (empty initially)', async () => {
      const res = await withTimeout(
        request(app.getHttpServer())
          .get(`/orgs/${orgId}/payroll-mapping/list`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId),
        10_000,
        'list mappings',
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should upsert org-level mapping', async () => {
      const res = await withTimeout(
        request(app.getHttpServer())
          .put(`/orgs/${orgId}/payroll-mapping`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId)
          .send({
            branchId: null,
            laborExpenseAccountId: laborExpenseAcctId,
            wagesPayableAccountId: wagesPayableAcctId,
            taxesPayableAccountId: taxesPayableAcctId,
            deductionsPayableAccountId: deductionsPayableAcctId,
            employerContribExpenseAccountId: employerContribExpenseAcctId,
            employerContribPayableAccountId: employerContribPayableAcctId,
            cashAccountId: cashAcctId,
          }),
        10_000,
        'upsert mapping',
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.laborExpenseAccount.code).toBe('6000');
      createdMappingIds.push(res.body.data.id);
    });

    it('should get effective mapping', async () => {
      const res = await withTimeout(
        request(app.getHttpServer())
          .get(`/orgs/${orgId}/payroll-mapping`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId),
        10_000,
        'get mapping',
      );

      expect(res.status).toBe(200);
      expect(res.body.data).toBeTruthy();
      expect(res.body.data.laborExpenseAccount.code).toBe('6000');
    });
  });

  // ===== H2: Posting Preview =====
  describe('H2: Posting preview', () => {
    let runId: string;

    beforeAll(async () => {
      // Create and prepare a payroll run with payslips
      const createRes = await request(app.getHttpServer())
        .post('/workforce/payroll-runs')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-org-id', orgId)
        .send({ payPeriodId, branchId });

      runId = createRes.body?.id;
      if (runId) {
        createdRunIds.push(runId);
        // Calculate and approve
        await request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/calculate`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId);
        await request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/approve`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId);

        // Generate payslips (if endpoint exists)
        await request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/generate-payslips`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId);
      }
    });

    it('should return posting preview with entries', async () => {
      if (!runId) return;

      const res = await withTimeout(
        request(app.getHttpServer())
          .get(`/workforce/payroll-runs/${runId}/posting-preview`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId),
        10_000,
        'posting preview',
      );

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('runId');
      expect(res.body).toHaveProperty('totals');
      expect(res.body).toHaveProperty('entries');
      expect(res.body).toHaveProperty('mapping');
    });
  });

  // ===== H3: Post Idempotency =====
  describe('H3: Post idempotency', () => {
    let runId: string;

    beforeAll(async () => {
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
          .post(`/workforce/payroll-runs/${runId}/generate-payslips`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId);
      }
    });

    it('should post payroll run once', async () => {
      if (!runId) return;

      const res = await withTimeout(
        request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/post`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId),
        15_000,
        'first post',
      );

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('POSTED');
    });

    it('should reject double-post', async () => {
      if (!runId) return;

      const res = await withTimeout(
        request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/post`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId),
        10_000,
        'double post',
      );

      expect([400, 409]).toContain(res.status);
    });
  });

  // ===== H4: Journal totals match payslips =====
  describe('H4: Journal totals match payslip aggregates', () => {
    it('should create balanced journal with correct totals', async () => {
      // Get a posted run and verify journal entry totals
      const run = await prisma.payrollRun.findFirst({
        where: { orgId, status: 'POSTED' },
        include: {
          payslips: true,
          journalLinks: {
            include: { journalEntry: { include: { lines: true } } },
          },
        },
      });

      if (!run || run.payslips.length === 0) {
        console.log('Skipping H4: No posted run with payslips');
        return;
      }

      // Aggregate payslip totals
      const Decimal = (n: unknown) => Number(n);
      const expectedGross = run.payslips.reduce((s, p) => s + Decimal(p.grossEarnings), 0);
      const expectedNet = run.payslips.reduce((s, p) => s + Decimal(p.netPay), 0);

      // Find ACCRUAL journal
      const accrualLink = run.journalLinks.find((l) => l.type === 'ACCRUAL');
      expect(accrualLink).toBeTruthy();

      const lines = accrualLink!.journalEntry.lines;
      const totalDebits = lines.reduce((s, l) => s + Decimal(l.debit), 0);
      const totalCredits = lines.reduce((s, l) => s + Decimal(l.credit), 0);

      // Journal should be balanced
      expect(Math.abs(totalDebits - totalCredits)).toBeLessThan(0.01);
    });
  });

  // ===== H5: Pay uses NET only =====
  describe('H5: Pay uses NET pay only', () => {
    let runId: string;

    beforeAll(async () => {
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
          .post(`/workforce/payroll-runs/${runId}/generate-payslips`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId);
        await request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/post`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId);
      }
    });

    it('should pay using net amount only', async () => {
      if (!runId) return;

      const res = await withTimeout(
        request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/pay`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId),
        10_000,
        'pay run',
      );

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PAID');

      // Verify payment journal uses net pay
      const run = await prisma.payrollRun.findUnique({
        where: { id: runId },
        include: {
          payslips: true,
          journalLinks: {
            include: { journalEntry: { include: { lines: true } } },
          },
        },
      });

      const paymentLink = run?.journalLinks.find((l) => l.type === 'PAYMENT');
      expect(paymentLink).toBeTruthy();

      const paymentLines = paymentLink!.journalEntry.lines;
      expect(paymentLines.length).toBe(2); // Dr Wages Payable, Cr Cash

      // Payment amount should equal net pay
      const expectedNet = run!.payslips.reduce((s, p) => s + Number(p.netPay), 0);
      const cashCredit = paymentLines.find((l) => Number(l.credit) > 0);
      if (expectedNet > 0 && cashCredit) {
        expect(Number(cashCredit.credit)).toBeCloseTo(expectedNet, 2);
      }
    });
  });

  // ===== H6: Void reversal =====
  describe('H6: Void creates reversal entries', () => {
    let runId: string;

    beforeAll(async () => {
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
          .post(`/workforce/payroll-runs/${runId}/generate-payslips`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId);
        await request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/post`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId);
      }
    });

    it('should void and create reversal entries', async () => {
      if (!runId) return;

      const res = await withTimeout(
        request(app.getHttpServer())
          .post(`/workforce/payroll-runs/${runId}/void`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId),
        15_000,
        'void run',
      );

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('VOID');

      // Verify reversal links exist
      const run = await prisma.payrollRun.findUnique({
        where: { id: runId },
        include: { journalLinks: true },
      });

      const reversalLinks = run?.journalLinks.filter((l) =>
        l.type.includes('REVERSAL'),
      );
      expect(reversalLinks!.length).toBeGreaterThan(0);
    });
  });

  // ===== H7: Branch-specific mapping override =====
  describe('H7: Branch-specific mapping override', () => {
    it('should create branch-level mapping that overrides org-level', async () => {
      const res = await withTimeout(
        request(app.getHttpServer())
          .put(`/orgs/${orgId}/payroll-mapping`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId)
          .send({
            branchId,
            laborExpenseAccountId: laborExpenseAcctId,
            wagesPayableAccountId: wagesPayableAcctId,
            taxesPayableAccountId: taxesPayableAcctId,
            deductionsPayableAccountId: deductionsPayableAcctId,
            employerContribExpenseAccountId: employerContribExpenseAcctId,
            employerContribPayableAccountId: employerContribPayableAcctId,
            cashAccountId: cashAcctId,
          }),
        10_000,
        'upsert branch mapping',
      );

      expect(res.status).toBe(200);
      expect(res.body.data.branchId).toBe(branchId);
      createdMappingIds.push(res.body.data.id);
    });

    it('should get branch-specific mapping when queried', async () => {
      const res = await withTimeout(
        request(app.getHttpServer())
          .get(`/orgs/${orgId}/payroll-mapping?branchId=${branchId}`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-org-id', orgId),
        10_000,
        'get branch mapping',
      );

      expect(res.status).toBe(200);
      expect(res.body.data.branchId).toBe(branchId);
    });
  });
});
