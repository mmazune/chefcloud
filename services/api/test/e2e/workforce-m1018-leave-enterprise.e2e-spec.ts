/**
 * M10.18 Workforce Leave Enterprise Ops V2 E2E Tests
 *
 * STANDARD: instructions/E2E_NO_HANG_STANDARD.md
 *
 * This file validates:
 * - A) Team Calendar: view team leave calendar (L4+), conflict counts
 * - B) Self Calendar: staff can view own leave calendar
 * - C) Approval Delegation: CRUD delegates, branch scoping
 * - D) Two-Step Approvals: approve-step1 → approve-final workflow
 * - E) Attachments Metadata: add/list/delete attachment URLs, SSRF blocking
 * - F) Balance Projection: deterministic accrual forecast
 * - G) Extended Reports: approval stats, calendar/approvals exports
 * - H) RBAC: delegate permission check, same-approver-both-steps blocked
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

describe('M10.18 Workforce Leave Enterprise (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let supervisorToken: string;
  let staffToken: string;
  let orgId: string;
  let branchId: string;
  let staffUserId: string;
  let supervisorUserId: string;
  let ownerUserId: string;

  // Created test data IDs
  let leaveTypeId: string;
  let leavePolicyId: string;
  let leaveRequestId: string;
  let delegateId: string;
  let attachmentId: string;

  beforeAll(async () => {
    await traceSpan('beforeAll', async () => {
      trace('creating E2E app');

      // Layer C: Wrap app creation with timeout
      app = await withTimeout(createE2EApp({ imports: [AppModule] }), {
        ms: 60_000,
        label: 'createE2EApp',
      });

      prisma = app.get(PrismaService);
      trace('app created, logging in users');

      // Login as owner (for admin operations)
      const ownerLogin = await withTimeout(loginAs(app, 'owner'), {
        ms: 10_000,
        label: 'ownerLogin',
      });
      ownerToken = ownerLogin.accessToken;
      orgId = ownerLogin.user.orgId;
      ownerUserId = ownerLogin.user.userId;

      // Login as supervisor (for approvals)
      const supervisorLogin = await withTimeout(loginAs(app, 'supervisor'), {
        ms: 10_000,
        label: 'supervisorLogin',
      });
      supervisorToken = supervisorLogin.accessToken;
      supervisorUserId = supervisorLogin.user.userId;

      // Login as waiter (staff role for self-service)
      const staffLogin = await withTimeout(loginAs(app, 'waiter'), {
        ms: 10_000,
        label: 'staffLogin',
      });
      staffToken = staffLogin.accessToken;
      staffUserId = staffLogin.user.userId;

      // Get a branch for testing
      const branch = await prisma.client.branch.findFirst({
        where: { orgId },
      });
      if (branch) {
        branchId = branch.id;
      }

      // Create leave type for tests
      const leaveType = await prisma.client.leaveTypeDefinition.create({
        data: {
          orgId,
          code: 'M1018_TEST',
          name: 'M10.18 Test Leave',
          isPaid: true,
          requiresApproval: true,
          isActive: true,
        },
      });
      leaveTypeId = leaveType.id;

      // Create leave policy with TWO_STEP approval
      const policy = await prisma.client.leavePolicy.create({
        data: {
          orgId,
          name: 'M10.18 Two-Step Policy',
          leaveTypeId,
          accrualFrequency: 'MONTHLY',
          accrualAmount: 1.5,
          maxBalance: 30,
          allowNegativeBalance: false,
          approvalMode: 'TWO_STEP',
          effectiveFrom: new Date(),
          isActive: true,
        },
      });
      leavePolicyId = policy.id;

      trace('beforeAll complete', { orgId, branchId, staffUserId, leaveTypeId, leavePolicyId });
    });
  });

  afterAll(async () => {
    await traceSpan('afterAll', async () => {
      trace('cleaning up test data');

      if (prisma) {
        try {
          // Clean M10.18 test data in reverse order
          await prisma.client.leaveRequestAttachment.deleteMany({
            where: { orgId },
          });
          await prisma.client.approvalDelegate.deleteMany({
            where: { orgId },
          });
          await prisma.client.leaveRequestV2.deleteMany({
            where: { orgId },
          });
          await prisma.client.leaveBalanceLedger.deleteMany({
            where: { orgId },
          });
          await prisma.client.leavePolicy.deleteMany({
            where: { orgId },
          });
          await prisma.client.leaveTypeDefinition.deleteMany({
            where: { orgId },
          });
        } catch (e) {
          trace('Cleanup error', { error: (e as Error).message });
        }
      }

      trace('closing app');
      await withTimeout(cleanup(app), { ms: 15_000, label: 'cleanup' });
      trace('afterAll complete');
    });
  });

  // ===== A) Team Calendar =====

  describe('A) Team Calendar', () => {
    it('A1: supervisor can view team calendar (200)', async () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const res = await request(app.getHttpServer())
        .get('/workforce/leave/calendar')
        .query({ branchId, from, to })
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('entries');
      expect(Array.isArray(res.body.entries)).toBe(true);
      expect(res.body).toHaveProperty('totalConflicts');
    });

    it('A2: staff cannot view team calendar (403)', async () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      await request(app.getHttpServer())
        .get('/workforce/leave/calendar')
        .query({ branchId, from, to })
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('A3: supervisor can view calendar summary (200)', async () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const res = await request(app.getHttpServer())
        .get('/workforce/leave/calendar/summary')
        .query({ branchId, from, to })
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('byDate');
      expect(res.body).toHaveProperty('byLeaveType');
    });
  });

  // ===== B) Self Calendar =====

  describe('B) Self Calendar', () => {
    it('B1: staff can view own calendar (200)', async () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const res = await request(app.getHttpServer())
        .get('/workforce/leave/my-calendar')
        .query({ from, to })
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('entries');
      expect(Array.isArray(res.body.entries)).toBe(true);
    });
  });

  // ===== C) Approval Delegation =====

  describe('C) Approval Delegation', () => {
    it('C1: owner can create approval delegate (201)', async () => {
      const startAt = new Date();
      const endAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const res = await request(app.getHttpServer())
        .post('/workforce/leave/delegates')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          principalUserId: ownerUserId,
          delegateUserId: supervisorUserId,
          branchId,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          enabled: true,
        })
        .expect(HttpStatus.CREATED);

      expect(res.body).toHaveProperty('id');
      expect(res.body.principalUserId).toBe(ownerUserId);
      expect(res.body.delegateUserId).toBe(supervisorUserId);
      expect(res.body.enabled).toBe(true);
      delegateId = res.body.id;
    });

    it('C2: owner can list delegates (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/leave/delegates')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((d: { id: string }) => d.id === delegateId)).toBe(true);
    });

    it('C3: owner can get single delegate (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/workforce/leave/delegates/${delegateId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.id).toBe(delegateId);
    });

    it('C4: owner can update delegate (200)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/workforce/leave/delegates/${delegateId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ enabled: false })
        .expect(HttpStatus.OK);

      expect(res.body.enabled).toBe(false);
    });

    it('C5: staff cannot create delegate (403)', async () => {
      await request(app.getHttpServer())
        .post('/workforce/leave/delegates')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          principalUserId: supervisorUserId,
          delegateUserId: staffUserId,
          branchId,
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          enabled: true,
        })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('C6: owner can delete delegate (204)', async () => {
      await request(app.getHttpServer())
        .delete(`/workforce/leave/delegates/${delegateId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.NO_CONTENT);

      // Verify deleted
      await request(app.getHttpServer())
        .get(`/workforce/leave/delegates/${delegateId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  // ===== D) Two-Step Approvals =====

  describe('D) Two-Step Approvals', () => {
    beforeAll(async () => {
      // Create a leave request for two-step testing
      const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      const endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days duration

      const request2 = await prisma.client.leaveRequestV2.create({
        data: {
          orgId,
          userId: staffUserId,
          leaveTypeId,
          branchId,
          startDate,
          endDate,
          businessDays: 2,
          status: 'PENDING',
          submittedAt: new Date(),
        },
      });
      leaveRequestId = request2.id;
    });

    it('D1: supervisor can approve step 1 (200)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/workforce/leave/requests/${leaveRequestId}/approve-step1`)
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({ reason: 'Step 1 approved' })
        .expect(HttpStatus.OK);

      expect(res.body.status).toBe('APPROVED_STEP1');
      expect(res.body.approvedStep1ById).toBe(supervisorUserId);
    });

    it('D2: same approver cannot approve step 2 (400)', async () => {
      await request(app.getHttpServer())
        .post(`/workforce/leave/requests/${leaveRequestId}/approve-final`)
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({ reason: 'Final approval' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('D3: different approver can approve step 2 (200)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/workforce/leave/requests/${leaveRequestId}/approve-final`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'Final approval by owner' })
        .expect(HttpStatus.OK);

      expect(res.body.status).toBe('APPROVED');
      expect(res.body.approvedById).toBe(ownerUserId);
    });
  });

  // ===== E) Attachments Metadata =====

  describe('E) Attachments Metadata', () => {
    beforeAll(async () => {
      // Create a new leave request for attachment testing
      const startDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

      const req = await prisma.client.leaveRequestV2.create({
        data: {
          orgId,
          userId: staffUserId,
          leaveTypeId,
          branchId,
          startDate,
          endDate,
          businessDays: 1,
          status: 'DRAFT',
        },
      });
      leaveRequestId = req.id;
    });

    it('E1: staff can add attachment metadata (201)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/workforce/leave/requests/${leaveRequestId}/attachments`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          label: 'Medical Certificate',
          url: 'https://storage.example.com/docs/medical-cert.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 102400,
        })
        .expect(HttpStatus.CREATED);

      expect(res.body).toHaveProperty('id');
      expect(res.body.label).toBe('Medical Certificate');
      expect(res.body.url).toContain('storage.example.com');
      attachmentId = res.body.id;
    });

    it('E2: SSRF URL is blocked (400)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/workforce/leave/requests/${leaveRequestId}/attachments`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          label: 'Evil Link',
          url: 'javascript:alert(1)',
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.message).toContain('blocked');
    });

    it('E3: internal IP URL is blocked (400)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/workforce/leave/requests/${leaveRequestId}/attachments`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          label: 'Internal Link',
          url: 'http://192.168.1.1/admin',
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.message).toContain('internal');
    });

    it('E4: staff can list attachments (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/workforce/leave/requests/${leaveRequestId}/attachments`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((a: { id: string }) => a.id === attachmentId)).toBe(true);
    });

    it('E5: staff can delete own attachment (204)', async () => {
      await request(app.getHttpServer())
        .delete(`/workforce/leave/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(HttpStatus.NO_CONTENT);
    });
  });

  // ===== F) Balance Projection =====

  describe('F) Balance Projection', () => {
    it('F1: staff can view balance projection (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/leave/balances/projection')
        .query({ months: 6 })
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('projections');
      expect(Array.isArray(res.body.projections)).toBe(true);
      // Each projection should have deterministic fields
      if (res.body.projections.length > 0) {
        const proj = res.body.projections[0];
        expect(proj).toHaveProperty('leaveTypeId');
        expect(proj).toHaveProperty('monthlyBreakdown');
      }
    });

    it('F2: projection is deterministic (same result on repeat call)', async () => {
      const res1 = await request(app.getHttpServer())
        .get('/workforce/leave/balances/projection')
        .query({ months: 3, leaveTypeId })
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(HttpStatus.OK);

      const res2 = await request(app.getHttpServer())
        .get('/workforce/leave/balances/projection')
        .query({ months: 3, leaveTypeId })
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(HttpStatus.OK);

      // Deep equality check for determinism
      expect(JSON.stringify(res1.body)).toBe(JSON.stringify(res2.body));
    });
  });

  // ===== G) Extended Reports =====

  describe('G) Extended Reports', () => {
    it('G1: supervisor can view approval stats (200)', async () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const res = await request(app.getHttpServer())
        .get('/workforce/leave/reports/approvals')
        .query({ branchId, from, to })
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('totalSubmitted');
      expect(res.body).toHaveProperty('totalApproved');
      expect(res.body).toHaveProperty('totalRejected');
      expect(res.body).toHaveProperty('averageApprovalTimeHours');
    });

    it('G2: supervisor can export calendar CSV (200)', async () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const res = await request(app.getHttpServer())
        .get('/workforce/leave/reports/export/calendar')
        .query({ branchId, from, to })
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(HttpStatus.OK)
        .expect('Content-Type', /text\/csv/);

      // Check UTF-8 BOM for Excel compatibility
      expect(res.text.charCodeAt(0)).toBe(0xfeff);
      expect(res.text).toContain('Employee');
    });

    it('G3: supervisor can export approvals CSV (200)', async () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const res = await request(app.getHttpServer())
        .get('/workforce/leave/reports/export/approvals')
        .query({ branchId, from, to })
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(HttpStatus.OK)
        .expect('Content-Type', /text\/csv/);

      expect(res.text.charCodeAt(0)).toBe(0xfeff);
      expect(res.text).toContain('Request ID');
    });

    it('G4: staff cannot access approval stats (403)', async () => {
      await request(app.getHttpServer())
        .get('/workforce/leave/reports/approvals')
        .query({ branchId })
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ===== H) RBAC Edge Cases =====

  describe('H) RBAC Edge Cases', () => {
    it('H1: unauthenticated request returns 401', async () => {
      await request(app.getHttpServer())
        .get('/workforce/leave/calendar')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('H2: staff cannot approve leave requests (403)', async () => {
      // Create a pending request
      const req = await prisma.client.leaveRequestV2.create({
        data: {
          orgId,
          userId: supervisorUserId,
          leaveTypeId,
          branchId,
          startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
          businessDays: 1,
          status: 'PENDING',
          submittedAt: new Date(),
        },
      });

      await request(app.getHttpServer())
        .post(`/workforce/leave/requests/${req.id}/approve-step1`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ reason: 'Trying to approve' })
        .expect(HttpStatus.FORBIDDEN);

      // Cleanup
      await prisma.client.leaveRequestV2.delete({ where: { id: req.id } });
    });
  });
});
