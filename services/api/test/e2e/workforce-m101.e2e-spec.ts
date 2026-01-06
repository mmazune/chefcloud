/**
 * M10.1 E2E Tests: Workforce Core (Shifts + Timeclock + Approvals + Reports)
 *
 * Tests shift scheduling, timeclock operations, approval workflows, and reporting.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';

describe('M10.1 Workforce Core (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let orgId: string;
  let branchId: string;
  let staffUserId: string;
  let managerUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();

    // Setup test org, branch, and users
    const org = await prisma.client.org.findFirst({
      where: { slug: { not: undefined } },
    });
    if (!org) {
      throw new Error('No org found for testing');
    }
    orgId = org.id;

    const branch = await prisma.client.branch.findFirst({
      where: { orgId },
    });
    if (!branch) {
      throw new Error('No branch found for testing');
    }
    branchId = branch.id;

    // Get owner user for auth
    const owner = await prisma.client.user.findFirst({
      where: { orgId, roleLevel: 'L5' },
    });
    if (!owner) {
      throw new Error('No owner user found for testing');
    }

    // Login to get auth token
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: owner.email, password: 'test123' });

    authToken = loginRes.body.accessToken;
    managerUserId = owner.id;

    // Get or create a staff user
    let staff = await prisma.client.user.findFirst({
      where: { orgId, roleLevel: 'L2' },
    });
    if (!staff) {
      staff = await prisma.client.user.create({
        data: {
          orgId,
          email: `staff-test-${Date.now()}@example.com`,
          passwordHash: 'test',
          roleLevel: 'L2',
          firstName: 'Test',
          lastName: 'Staff',
        },
      });
    }
    staffUserId = staff.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.client.scheduledShift.deleteMany({
      where: { notes: { contains: 'E2E_TEST' } },
    });
    await prisma.client.shiftTemplate.deleteMany({
      where: { description: { contains: 'E2E_TEST' } },
    });
    await app.close();
  });

  // ===== H1: Shift Templates CRUD =====
  describe('H1: Shift Templates CRUD', () => {
    let templateId: string;

    it('should create a shift template (L4+)', async () => {
      const res = await request(app.getHttpServer())
        .post('/workforce/scheduling/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Morning Shift E2E',
          startTime: '09:00',
          endTime: '17:00',
          breakMinutes: 30,
          description: 'E2E_TEST template',
        })
        .expect(HttpStatus.CREATED);

      // AC: Template created with correct data
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Morning Shift E2E');
      expect(res.body.startTime).toBe('09:00');
      expect(res.body.endTime).toBe('17:00');

      templateId = res.body.id;
    });

    it('should list shift templates', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/scheduling/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      // AC: Template list includes created template
      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((t: { id: string }) => t.id === templateId);
      expect(found).toBeDefined();
      expect(found.name).toBe('Morning Shift E2E');
    });

    it('should update shift template', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/workforce/scheduling/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Morning Shift Updated E2E' })
        .expect(HttpStatus.OK);

      // AC: Template name updated
      expect(res.body.name).toBe('Morning Shift Updated E2E');
    });
  });

  // ===== H2: Scheduled Shifts CRUD =====
  describe('H2: Scheduled Shifts CRUD', () => {
    let shiftId: string;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(17, 0, 0, 0);

    it('should create a scheduled shift', async () => {
      const res = await request(app.getHttpServer())
        .post('/workforce/scheduling/shifts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          branchId,
          userId: staffUserId,
          role: 'server',
          startAt: tomorrow.toISOString(),
          endAt: tomorrowEnd.toISOString(),
          notes: 'E2E_TEST shift',
        })
        .expect(HttpStatus.CREATED);

      // AC: Shift created with DRAFT status
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.plannedMinutes).toBe(480); // 8 hours

      shiftId = res.body.id;
    });

    it('should reject shift with invalid duration (too short)', async () => {
      const shortStart = new Date(tomorrow);
      shortStart.setHours(10, 0, 0, 0);
      const shortEnd = new Date(shortStart);
      shortEnd.setMinutes(shortEnd.getMinutes() + 30); // 30 min

      const res = await request(app.getHttpServer())
        .post('/workforce/scheduling/shifts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          branchId,
          userId: staffUserId,
          role: 'server',
          startAt: shortStart.toISOString(),
          endAt: shortEnd.toISOString(),
          notes: 'E2E_TEST',
        })
        .expect(HttpStatus.BAD_REQUEST);

      // AC: Error message indicates duration constraint
      expect(res.body.message).toContain('duration');
    });

    it('should reject overlapping shifts for same user', async () => {
      // Try to create another shift overlapping with existing
      const overlapStart = new Date(tomorrow);
      overlapStart.setHours(12, 0, 0, 0); // Overlaps with 9-17 shift
      const overlapEnd = new Date(overlapStart);
      overlapEnd.setHours(20, 0, 0, 0);

      const res = await request(app.getHttpServer())
        .post('/workforce/scheduling/shifts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          branchId,
          userId: staffUserId,
          role: 'server',
          startAt: overlapStart.toISOString(),
          endAt: overlapEnd.toISOString(),
          notes: 'E2E_TEST',
        })
        .expect(HttpStatus.BAD_REQUEST);

      // AC: Error indicates overlap conflict
      expect(res.body.message).toContain('overlapping');
    });

    it('should update a DRAFT shift', async () => {
      const newEnd = new Date(tomorrow);
      newEnd.setHours(18, 0, 0, 0); // Extend to 6 PM

      const res = await request(app.getHttpServer())
        .patch(`/workforce/scheduling/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ endAt: newEnd.toISOString() })
        .expect(HttpStatus.OK);

      // AC: End time updated, planned minutes recalculated
      expect(res.body.plannedMinutes).toBe(540); // 9 hours
    });

    it('should list shifts with filters', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/scheduling/shifts')
        .query({ status: 'DRAFT' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      // AC: Returns array with our shift
      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((s: { id: string }) => s.id === shiftId);
      expect(found).toBeDefined();
    });
  });

  // ===== H3: Shift Publishing =====
  describe('H3: Shift Publishing', () => {
    let draftShiftId: string;
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(9, 0, 0, 0);
    const nextWeekEnd = new Date(nextWeek);
    nextWeekEnd.setHours(17, 0, 0, 0);

    beforeAll(async () => {
      // Create a shift to publish
      const res = await request(app.getHttpServer())
        .post('/workforce/scheduling/shifts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          branchId,
          userId: staffUserId,
          role: 'server',
          startAt: nextWeek.toISOString(),
          endAt: nextWeekEnd.toISOString(),
          notes: 'E2E_TEST publish test',
        });
      draftShiftId = res.body.id;
    });

    it('should publish DRAFT shifts in date range', async () => {
      const from = new Date(nextWeek);
      from.setDate(from.getDate() - 1);
      const to = new Date(nextWeek);
      to.setDate(to.getDate() + 1);

      const res = await request(app.getHttpServer())
        .post('/workforce/scheduling/publish')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          branchId,
          from: from.toISOString(),
          to: to.toISOString(),
        })
        .expect(HttpStatus.CREATED);

      // AC: Returns count of published shifts
      expect(res.body.published).toBeGreaterThanOrEqual(1);
      expect(res.body.shifts).toContain(draftShiftId);
    });

    it('should verify shift status changed to PUBLISHED', async () => {
      const res = await request(app.getHttpServer())
        .get(`/workforce/scheduling/shifts/${draftShiftId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      // AC: Status is now PUBLISHED with timestamp
      expect(res.body.status).toBe('PUBLISHED');
      expect(res.body.publishedAt).toBeDefined();
    });

    it('should reject editing a PUBLISHED shift', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/workforce/scheduling/shifts/${draftShiftId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'Try to update' })
        .expect(HttpStatus.BAD_REQUEST);

      // AC: Error indicates status restriction
      expect(res.body.message).toContain('PUBLISHED');
    });
  });

  // ===== H4: Shift Approval Workflow =====
  describe('H4: Shift Approval Workflow', () => {
    let completedShiftId: string;

    beforeAll(async () => {
      // Create and manually set a shift to COMPLETED status for approval test
      const twoWeeks = new Date();
      twoWeeks.setDate(twoWeeks.getDate() + 14);
      twoWeeks.setHours(9, 0, 0, 0);
      const twoWeeksEnd = new Date(twoWeeks);
      twoWeeksEnd.setHours(17, 0, 0, 0);

      const shift = await prisma.client.scheduledShift.create({
        data: {
          orgId,
          branchId,
          userId: staffUserId,
          role: 'server',
          startAt: twoWeeks,
          endAt: twoWeeksEnd,
          plannedMinutes: 480,
          actualMinutes: 490,
          status: 'COMPLETED',
          notes: 'E2E_TEST approval',
        },
      });
      completedShiftId = shift.id;
    });

    it('should approve a COMPLETED shift', async () => {
      const res = await request(app.getHttpServer())
        .post(`/workforce/scheduling/shifts/${completedShiftId}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.CREATED);

      // AC: Status changes to APPROVED
      expect(res.body.status).toBe('APPROVED');
      expect(res.body.approvedAt).toBeDefined();
      expect(res.body.approvedById).toBe(managerUserId);
    });

    it('should reject approving non-COMPLETED shift', async () => {
      // Create a DRAFT shift
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 20);
      tomorrow.setHours(9, 0, 0, 0);
      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setHours(17, 0, 0, 0);

      const draftShift = await prisma.client.scheduledShift.create({
        data: {
          orgId,
          branchId,
          userId: staffUserId,
          role: 'server',
          startAt: tomorrow,
          endAt: tomorrowEnd,
          plannedMinutes: 480,
          status: 'DRAFT',
          notes: 'E2E_TEST',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/workforce/scheduling/shifts/${draftShift.id}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.BAD_REQUEST);

      // AC: Error indicates wrong status
      expect(res.body.message).toContain('DRAFT');
    });
  });

  // ===== H5: Conflict Detection =====
  describe('H5: Conflict Detection', () => {
    it('should detect conflicts before creating shift', async () => {
      // First create a shift
      const day = new Date();
      day.setDate(day.getDate() + 30);
      day.setHours(9, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(17, 0, 0, 0);

      await prisma.client.scheduledShift.create({
        data: {
          orgId,
          branchId,
          userId: staffUserId,
          role: 'server',
          startAt: day,
          endAt: dayEnd,
          plannedMinutes: 480,
          status: 'PUBLISHED',
          notes: 'E2E_TEST conflict check',
        },
      });

      // Check for conflicts
      const overlapStart = new Date(day);
      overlapStart.setHours(12, 0, 0, 0);
      const overlapEnd = new Date(day);
      overlapEnd.setHours(20, 0, 0, 0);

      const res = await request(app.getHttpServer())
        .post('/workforce/scheduling/conflicts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: staffUserId,
          startAt: overlapStart.toISOString(),
          endAt: overlapEnd.toISOString(),
        })
        .expect(HttpStatus.CREATED);

      // AC: Returns array of conflicting shifts
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  // ===== H6: Labor Reporting =====
  describe('H6: Labor Reporting', () => {
    it('should return labor metrics for date range', async () => {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      const to = new Date();
      to.setDate(to.getDate() + 30);

      const res = await request(app.getHttpServer())
        .get('/workforce/reports/labor')
        .query({
          from: from.toISOString(),
          to: to.toISOString(),
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      // AC: Returns labor metrics structure
      expect(res.body.totalScheduledMinutes).toBeDefined();
      expect(res.body.totalActualMinutes).toBeDefined();
      expect(res.body.shiftsCompleted).toBeDefined();
      expect(res.body.adherenceRate).toBeDefined();
      expect(res.body.employeeBreakdown).toBeDefined();
    });

    it('should return daily summary', async () => {
      const today = new Date();

      const res = await request(app.getHttpServer())
        .get('/workforce/reports/daily')
        .query({ date: today.toISOString() })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      // AC: Returns daily summary structure
      expect(res.body.date).toBeDefined();
      expect(res.body.shifts).toBeDefined();
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.shiftsByStatus).toBeDefined();
    });
  });

  // ===== H7: CSV Exports =====
  describe('H7: CSV Exports', () => {
    it('should export shifts as CSV', async () => {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      const to = new Date();
      to.setDate(to.getDate() + 30);

      const res = await request(app.getHttpServer())
        .get('/workforce/reports/export/shifts')
        .query({
          from: from.toISOString().split('T')[0],
          to: to.toISOString().split('T')[0],
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      // AC: Returns CSV with correct headers
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Shift ID');
      expect(res.text).toContain('Employee Name');
      expect(res.text).toContain('Status');
    });

    it('should export labor summary as CSV', async () => {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      const to = new Date();
      to.setDate(to.getDate() + 30);

      const res = await request(app.getHttpServer())
        .get('/workforce/reports/export/labor')
        .query({
          from: from.toISOString().split('T')[0],
          to: to.toISOString().split('T')[0],
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      // AC: Returns CSV with employee breakdown
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Employee ID');
      expect(res.text).toContain('Scheduled Hours');
      expect(res.text).toContain('Adherence');
    });
  });

  // ===== H8: Audit Logging =====
  describe('H8: Audit Logging', () => {
    it('should return audit logs (L5 only)', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/reports/audit')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      // AC: Returns logs array with pagination
      expect(res.body.logs).toBeDefined();
      expect(res.body.total).toBeDefined();
      expect(Array.isArray(res.body.logs)).toBe(true);
    });
  });
});
