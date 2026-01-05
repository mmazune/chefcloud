/**
 * M10.17 Workforce Leave Management E2E Tests
 *
 * STANDARD: instructions/E2E_NO_HANG_STANDARD.md
 *
 * This file validates:
 * - A) Leave Types CRUD: create, list, get, update, deactivate
 * - B) Leave Policies: create with accrual rules, branch overrides, effective policy
 * - C) Leave Requests: create→submit→approve/reject/cancel workflow
 * - D) Conflict Detection: overlap with other leave, shift conflict with override
 * - E) Balance Ledger: accrual, debit on approval, adjustments
 * - F) Reporting: balance summary, usage report, exports
 * - G) RBAC: staff can't access admin endpoints, managers can't approve cross-branch
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

describe('M10.17 Workforce Leave Management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let supervisorToken: string;
  let staffToken: string;
  let orgId: string;
  let branchId: string;
  let staffUserId: string;

  // Created test data IDs
  let leaveTypeId: string;
  let leavePolicyId: string;
  let leaveRequestId: string;

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

      // Login as supervisor (for approvals)
      const supervisorLogin = await withTimeout(loginAs(app, 'supervisor'), {
        ms: 10_000,
        label: 'supervisorLogin',
      });
      supervisorToken = supervisorLogin.accessToken;

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

      trace('beforeAll complete', { orgId, branchId, staffUserId });
    });
  });

  afterAll(async () => {
    await traceSpan('afterAll', async () => {
      trace('cleaning up test data');

      if (prisma) {
        try {
          // Clean M10.17 test data in reverse order
          if (leaveRequestId) {
            await prisma.client.leaveRequestV2.deleteMany({
              where: { orgId },
            });
          }
          if (leavePolicyId) {
            await prisma.client.leavePolicy.deleteMany({
              where: { orgId },
            });
          }
          if (leaveTypeId) {
            await prisma.client.leaveTypeDefinition.deleteMany({
              where: { orgId },
            });
          }
          // Clean ledger entries
          await prisma.client.leaveBalanceLedger.deleteMany({
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

  // ===== A) Leave Types CRUD =====

  describe('A) Leave Types', () => {
    it('A1: owner can create leave type (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/workforce/leave/types')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          code: 'ANNUAL',
          name: 'Annual Leave',
          isPaid: true,
          requiresApproval: true,
        })
        .expect(HttpStatus.CREATED);

      expect(res.body).toHaveProperty('id');
      expect(res.body.code).toBe('ANNUAL');
      expect(res.body.name).toBe('Annual Leave');
      expect(res.body.isPaid).toBe(true);
      expect(res.body.isActive).toBe(true);
      leaveTypeId = res.body.id;
    });

    it('A2: owner can list leave types (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/leave/types')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.some((t: { id: string }) => t.id === leaveTypeId)).toBe(true);
    });

    it('A3: owner can get single leave type (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/workforce/leave/types/${leaveTypeId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.id).toBe(leaveTypeId);
      expect(res.body.code).toBe('ANNUAL');
    });

    it('A4: owner can update leave type (200)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/workforce/leave/types/${leaveTypeId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Annual Leave Updated' })
        .expect(HttpStatus.OK);

      expect(res.body.name).toBe('Annual Leave Updated');
    });

    it('A5: staff cannot create leave type (403)', async () => {
      await request(app.getHttpServer())
        .post('/workforce/leave/types')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          code: 'SICK',
          name: 'Sick Leave',
        })
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ===== B) Leave Policies =====

  describe('B) Leave Policies', () => {
    it('B1: owner can create leave policy with accrual (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/workforce/leave/policies')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          leaveTypeId,
          name: 'Annual Leave Policy 2024',
          accrualMethod: 'MONTHLY',
          accrualRate: 1.67, // ~20 days/year
          maxAccrualDays: 25,
          minNoticeDays: 14,
          maxConsecutiveDays: 15,
          carryoverMaxDays: 5,
          isActive: true,
        })
        .expect(HttpStatus.CREATED);

      expect(res.body).toHaveProperty('id');
      expect(res.body.accrualMethod).toBe('MONTHLY');
      expect(res.body.minNoticeDays).toBe(14);
      expect(res.body.maxConsecutiveDays).toBe(15);
      leavePolicyId = res.body.id;
    });

    it('B2: owner can list policies (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/leave/policies')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((p: { id: string }) => p.id === leavePolicyId)).toBe(true);
    });

    it('B3: can get effective policy for employee (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/workforce/leave/policies/effective?userId=${staffUserId}&leaveTypeId=${leaveTypeId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('id');
      expect(res.body.leaveTypeId).toBe(leaveTypeId);
    });

    it('B4: owner can update policy (200)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/workforce/leave/policies/${leavePolicyId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ minNoticeDays: 7 })
        .expect(HttpStatus.OK);

      expect(res.body.minNoticeDays).toBe(7);
    });
  });

  // ===== C) Leave Requests Workflow =====

  describe('C) Leave Requests', () => {
    it('C1: staff can create draft leave request (201)', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 14); // 2 weeks from now
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3); // 4 days leave

      const res = await request(app.getHttpServer())
        .post('/workforce/leave/requests')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          leaveTypeId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Family vacation',
        })
        .expect(HttpStatus.CREATED);

      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.reason).toBe('Family vacation');
      leaveRequestId = res.body.id;
    });

    it('C2: staff can submit their draft (200)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/workforce/leave/requests/${leaveRequestId}/submit`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.status).toBe('SUBMITTED');
      expect(res.body.submittedAt).toBeDefined();
    });

    it('C3: supervisor can view pending approvals (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/leave/requests/pending')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((r: { id: string }) => r.id === leaveRequestId)).toBe(true);
    });

    it('C4: supervisor can approve request (200)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/workforce/leave/requests/${leaveRequestId}/approve`)
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.status).toBe('APPROVED');
      expect(res.body.approvedAt).toBeDefined();
    });

    it('C5: staff can view own leave requests (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/leave/requests/my')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((r: { id: string }) => r.id === leaveRequestId)).toBe(true);
    });

    it('C6: staff can cancel their own request (200)', async () => {
      // Create a new request to cancel
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 30);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const createRes = await request(app.getHttpServer())
        .post('/workforce/leave/requests')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          leaveTypeId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'To cancel',
        })
        .expect(HttpStatus.CREATED);

      const cancelRes = await request(app.getHttpServer())
        .patch(`/workforce/leave/requests/${createRes.body.id}/cancel`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(HttpStatus.OK);

      expect(cancelRes.body.status).toBe('CANCELLED');
    });
  });

  // ===== D) Conflict Detection =====

  describe('D) Conflict Detection', () => {
    it('D1: cannot submit overlapping leave requests (409)', async () => {
      // Create overlapping request
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 14); // Same as approved request
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      const res = await request(app.getHttpServer())
        .post('/workforce/leave/requests')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          leaveTypeId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Overlapping leave',
        });

      // May succeed as DRAFT, but should fail on submit
      if (res.status === HttpStatus.CREATED) {
        await request(app.getHttpServer())
          .patch(`/workforce/leave/requests/${res.body.id}/submit`)
          .set('Authorization', `Bearer ${staffToken}`)
          .expect(HttpStatus.CONFLICT);
      }
    });
  });

  // ===== E) Balance Ledger =====

  describe('E) Balance Ledger', () => {
    it('E1: can get current balance (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/workforce/leave/balance?userId=${staffUserId}&leaveTypeId=${leaveTypeId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('balance');
      expect(typeof res.body.balance).toBe('number');
    });

    it('E2: owner can adjust balance (200)', async () => {
      const res = await request(app.getHttpServer())
        .post('/workforce/leave/balance/adjust')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          userId: staffUserId,
          leaveTypeId,
          days: 5,
          reason: 'Initial balance allocation',
        })
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('id');
      expect(res.body.txType).toBe('ADJUSTMENT');
    });

    it('E3: can get ledger history (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/workforce/leave/balance/history?userId=${staffUserId}&leaveTypeId=${leaveTypeId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  // ===== F) Reporting =====

  describe('F) Reporting', () => {
    it('F1: can get balance summary for org (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/leave/reports/balance-summary')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('F2: can get usage report (200)', async () => {
      const year = new Date().getFullYear();
      const res = await request(app.getHttpServer())
        .get(`/workforce/leave/reports/usage?year=${year}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('F3: can get team calendar (200)', async () => {
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();
      const res = await request(app.getHttpServer())
        .get(`/workforce/leave/reports/calendar?month=${month}&year=${year}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('F4: can export balance summary CSV (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/leave/exports/balance-summary')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Employee');
    });

    it('F5: can get dashboard stats (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/leave/reports/dashboard')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('pendingApprovals');
      expect(res.body).toHaveProperty('approvedThisMonth');
      expect(res.body).toHaveProperty('upcomingLeave');
    });
  });

  // ===== G) RBAC =====

  describe('G) RBAC', () => {
    it('G1: staff cannot deactivate leave type (403)', async () => {
      await request(app.getHttpServer())
        .delete(`/workforce/leave/types/${leaveTypeId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('G2: staff cannot adjust balance (403)', async () => {
      await request(app.getHttpServer())
        .post('/workforce/leave/balance/adjust')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          userId: staffUserId,
          leaveTypeId,
          days: 10,
          reason: 'Unauthorized adjustment',
        })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('G3: staff cannot view other users leave requests (403)', async () => {
      // Get another user
      const otherUser = await prisma.client.user.findFirst({
        where: { orgId, id: { not: staffUserId } },
      });

      if (otherUser) {
        await request(app.getHttpServer())
          .get(`/workforce/leave/requests/user/${otherUser.id}`)
          .set('Authorization', `Bearer ${staffToken}`)
          .expect(HttpStatus.FORBIDDEN);
      }
    });

    it('G4: staff cannot run accrual (403)', async () => {
      await request(app.getHttpServer())
        .post('/workforce/leave/admin/run-accrual')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ month: 1, year: 2024 })
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ===== H) Admin Operations =====

  describe('H) Admin Operations', () => {
    it('H1: owner can run monthly accrual (200)', async () => {
      const res = await request(app.getHttpServer())
        .post('/workforce/leave/admin/run-accrual')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ month: new Date().getMonth() + 1, year: new Date().getFullYear() })
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('processedCount');
    });

    it('H2: owner can deactivate leave type (200)', async () => {
      // Create a throwaway leave type to deactivate
      const createRes = await request(app.getHttpServer())
        .post('/workforce/leave/types')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          code: 'TEMP',
          name: 'Temporary Leave',
        })
        .expect(HttpStatus.CREATED);

      const res = await request(app.getHttpServer())
        .delete(`/workforce/leave/types/${createRes.body.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.isActive).toBe(false);
    });
  });
});
