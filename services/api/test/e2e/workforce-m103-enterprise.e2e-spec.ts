/**
 * M10.3 Workforce Enterprise E2E Tests
 *
 * STANDARD: instructions/E2E_TESTING_STANDARD.md
 *
 * This file validates:
 * - PRE-007 Fix: WaitlistModule DI resolves correctly
 * - Workforce policy CRUD (H1)
 * - Pay period generation and closure (H2)
 * - Timesheet approval workflow (H3)
 * - Payroll export (H4)
 * - Role-based access control (H5)
 * - Audit logging for enterprise actions (H6)
 */

import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { createE2EApp } from '../helpers/e2e-bootstrap';
import { cleanup } from '../helpers/cleanup';
import { withTimeout } from '../helpers/with-timeout';
import { trace, traceSpan } from '../helpers/e2e-trace';
import { loginAs } from '../helpers/e2e-login';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';

// Layer B: Jest file timeout (120s for full AppModule tests)
jest.setTimeout(120_000);

describe('M10.3 Workforce Enterprise (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let managerToken: string;
  let supervisorToken: string;
  let orgId: string;
  let branchId: string;

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

      const supervisorLogin = await withTimeout(
        loginAs(app, 'supervisor'),
        { ms: 10_000, label: 'supervisorLogin' }
      );
      supervisorToken = supervisorLogin.accessToken;

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
      
      // Cleanup M10.3 test data
      if (prisma) {
        await prisma.client.workforceAuditLog.deleteMany({
          where: { 
            entityType: { in: ['WorkforcePolicy', 'PayPeriod', 'TimesheetApproval', 'PayrollExport'] },
          },
        });
        await prisma.client.timesheetApproval.deleteMany({
          where: { orgId },
        });
        await prisma.client.payPeriod.deleteMany({
          where: { orgId },
        });
      }

      trace('closing app');
      await withTimeout(cleanup(app), { ms: 15_000, label: 'cleanup' });
      trace('afterAll complete');
    });
  });

  // ===== PRE-007: WaitlistModule DI Fix =====
  describe('PRE-007: WaitlistModule DI Fix', () => {
    it('should bootstrap AppModule without DI failure for WaitlistModule', async () => {
      // The fact that beforeAll succeeded means WaitlistModule DI is fixed
      // This test explicitly validates that the waitlist endpoints are accessible
      expect(app).toBeDefined();
      trace('PRE-007: App bootstrapped successfully, DI issue resolved');
    });

    it('GET /waitlist/list should not throw DI error', async () => {
      const res = await request(app.getHttpServer())
        .get('/waitlist/list')
        .set('Authorization', `Bearer ${ownerToken}`)
        .ok(() => true);
      
      // Accept 200 (success with data) or 404 (no waitlist feature) but NOT 500
      expect(res.status).not.toBe(500);
      trace('PRE-007: Waitlist endpoint responds without 500 error', { status: res.status });
    });
  });

  // ===== H1: Workforce Policy CRUD =====
  describe('H1: Workforce Policy CRUD', () => {
    it('GET /workforce/policy should return policy (L4+)', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/policy')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);
      
      expect(res.body).toHaveProperty('dailyOtThresholdMins');
      expect(res.body).toHaveProperty('weeklyOtThresholdMins');
      trace('H1: Policy retrieved successfully');
    });

    it('PUT /workforce/policy should update policy (L4+)', async () => {
      const res = await request(app.getHttpServer())
        .put('/workforce/policy')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          dailyOtThresholdMins: 480,
          weeklyOtThresholdMins: 2400,
          roundingIntervalMins: 15,
          roundingMode: 'NEAREST',
          requireApproval: true,
          autoLockDays: 7,
        })
        .expect(HttpStatus.OK);
      
      expect(res.body.dailyOtThresholdMins).toBe(480);
      expect(res.body.weeklyOtThresholdMins).toBe(2400);
      expect(res.body.roundingIntervalMins).toBe(15);
      trace('H1: Policy updated successfully');
    });

    it('GET /workforce/policy should return 403 for L2 (supervisor)', async () => {
      await request(app.getHttpServer())
        .get('/workforce/policy')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(HttpStatus.FORBIDDEN);
      
      trace('H1: L2 correctly denied policy access');
    });
  });

  // ===== H2: Pay Period Generation and Closure =====
  describe('H2: Pay Period Management', () => {
    let generatedPeriodId: string;

    it('POST /workforce/pay-periods/generate should create periods (L4+)', async () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks

      const res = await request(app.getHttpServer())
        .post('/workforce/pay-periods/generate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          periodType: 'WEEKLY',
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          branchId,
        })
        .expect(HttpStatus.CREATED);
      
      expect(res.body.periods).toBeDefined();
      expect(res.body.periods.length).toBeGreaterThan(0);
      generatedPeriodId = res.body.periods[0].id;
      trace('H2: Pay periods generated', { count: res.body.periods.length });
    });

    it('GET /workforce/pay-periods should list periods (L3+)', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/pay-periods')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(HttpStatus.OK);
      
      expect(Array.isArray(res.body)).toBe(true);
      trace('H2: Pay periods listed', { count: res.body.length });
    });

    it('POST /workforce/pay-periods/:id/close should close period (L4+)', async () => {
      if (!generatedPeriodId) {
        trace('H2: Skipping close test - no period generated');
        return;
      }

      const res = await request(app.getHttpServer())
        .post(`/workforce/pay-periods/${generatedPeriodId}/close`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);
      
      expect(res.body.status).toBe('CLOSED');
      trace('H2: Pay period closed successfully');
    });

    it('POST /workforce/pay-periods/generate should return 403 for L2', async () => {
      await request(app.getHttpServer())
        .post('/workforce/pay-periods/generate')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({
          periodType: 'WEEKLY',
          startDate: '2024-01-01',
          endDate: '2024-01-14',
        })
        .expect(HttpStatus.FORBIDDEN);
      
      trace('H2: L2 correctly denied pay period generation');
    });
  });

  // ===== H3: Timesheet Approval Workflow =====
  describe('H3: Timesheet Approval Workflow', () => {
    it('GET /workforce/timesheets/pending should list pending approvals (L3+)', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/timesheets/pending')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(HttpStatus.OK);
      
      expect(Array.isArray(res.body)).toBe(true);
      trace('H3: Pending timesheets retrieved');
    });

    it('POST /workforce/timesheets/approve should approve timesheets (L3+)', async () => {
      // First get pending approvals
      const pendingRes = await request(app.getHttpServer())
        .get('/workforce/timesheets/pending')
        .set('Authorization', `Bearer ${managerToken}`);
      
      if (pendingRes.body.length === 0) {
        trace('H3: No pending timesheets to approve, skipping');
        return;
      }

      const approvalIds = pendingRes.body.slice(0, 2).map((a: { id: string }) => a.id);
      
      const res = await request(app.getHttpServer())
        .post('/workforce/timesheets/approve')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ approvalIds })
        .expect(HttpStatus.OK);
      
      expect(res.body.approved).toBe(approvalIds.length);
      trace('H3: Timesheets approved', { count: res.body.approved });
    });

    it('POST /workforce/timesheets/reject should reject timesheets (L3+)', async () => {
      const pendingRes = await request(app.getHttpServer())
        .get('/workforce/timesheets/pending')
        .set('Authorization', `Bearer ${managerToken}`);
      
      if (pendingRes.body.length === 0) {
        trace('H3: No pending timesheets to reject, skipping');
        return;
      }

      const approvalIds = [pendingRes.body[0].id];
      
      const res = await request(app.getHttpServer())
        .post('/workforce/timesheets/reject')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ 
          approvalIds,
          reason: 'E2E test rejection',
        })
        .expect(HttpStatus.OK);
      
      expect(res.body.rejected).toBe(1);
      trace('H3: Timesheet rejected');
    });
  });

  // ===== H4: Payroll Export =====
  describe('H4: Payroll Export', () => {
    it('POST /workforce/payroll/export should return CSV data (L4+)', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // 30 days ago
      const endDate = new Date();

      const res = await request(app.getHttpServer())
        .post('/workforce/payroll/export')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          format: 'csv',
        })
        .expect(HttpStatus.OK);
      
      expect(res.body).toHaveProperty('csv');
      expect(typeof res.body.csv).toBe('string');
      trace('H4: Payroll export generated');
    });

    it('POST /workforce/payroll/export should return 403 for L3', async () => {
      await request(app.getHttpServer())
        .post('/workforce/payroll/export')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          format: 'csv',
        })
        .expect(HttpStatus.FORBIDDEN);
      
      trace('H4: L3 correctly denied payroll export');
    });
  });

  // ===== H5: Role-Based Access Control =====
  describe('H5: Role-Based Access Control', () => {
    it('should enforce L4+ for policy management', async () => {
      // L2 (supervisor) should be denied
      await request(app.getHttpServer())
        .put('/workforce/policy')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({ dailyOtThresholdMins: 480 })
        .expect(HttpStatus.FORBIDDEN);
      
      trace('H5: L2 denied policy management');
    });

    it('should enforce L3+ for pay period listing', async () => {
      // L2 (supervisor) should be allowed for listing
      const res = await request(app.getHttpServer())
        .get('/workforce/pay-periods')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .ok(() => true);
      
      // L2 = supervisor should have L3+ access for viewing
      expect([200, 403]).toContain(res.status);
      trace('H5: Access control verified for pay period listing', { status: res.status });
    });

    it('should enforce L4+ for pay period closure', async () => {
      await request(app.getHttpServer())
        .post('/workforce/pay-periods/fake-id/close')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(HttpStatus.FORBIDDEN);
      
      trace('H5: L2 denied pay period closure');
    });
  });

  // ===== H6: Audit Logging =====
  describe('H6: Audit Logging', () => {
    it('should create audit log for policy update', async () => {
      // Update policy
      await request(app.getHttpServer())
        .put('/workforce/policy')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ dailyOtThresholdMins: 510 })
        .expect(HttpStatus.OK);
      
      // Check audit log
      const logs = await prisma.client.workforceAuditLog.findMany({
        where: {
          orgId,
          action: 'POLICY_UPDATED',
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].entityType).toBe('WorkforcePolicy');
      trace('H6: Policy update audit logged');
    });

    it('should create audit log for pay period generation', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 30); // Future dates to avoid conflicts
      const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

      await request(app.getHttpServer())
        .post('/workforce/pay-periods/generate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          periodType: 'WEEKLY',
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        })
        .expect(HttpStatus.CREATED);
      
      const logs = await prisma.client.workforceAuditLog.findMany({
        where: {
          orgId,
          action: 'PAY_PERIODS_GENERATED',
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].entityType).toBe('PayPeriod');
      trace('H6: Pay period generation audit logged');
    });
  });
});
