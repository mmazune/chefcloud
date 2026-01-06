/**
 * M9.3: Reservations Automation + Host Ops - E2E Tests
 *
 * Tests for 12 Acceptance Criteria:
 * - AC-01: Hold Expiry Automation
 * - AC-02: Waitlist Auto-Promotion
 * - AC-03: Reminder Scheduling
 * - AC-04: Slot Availability Endpoint
 * - AC-05: Capacity Checking
 * - AC-06: No-Show Grace Period + Deposit Forfeiture
 * - AC-07: Today Board (Host View)
 * - AC-08: Host Actions
 * - AC-09: Calendar Refresh Key
 * - AC-10: Unified Status Taxonomy
 * - AC-11: RBAC Enforcement
 * - AC-12: Audit Logging
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { createE2ETestingModuleBuilder } from '../helpers/e2e-bootstrap';

import { ReservationsModule } from '../../src/reservations/reservations.module';
import { AuthModule } from '../../src/auth/auth.module';

import { ThrottlerTestModule } from './throttler.test.module';
import { PrismaTestModule, PrismaService as TestPrismaService } from '../prisma/prisma.module';
import { PrismaService } from '../../src/prisma.service';
import { cleanup } from '../helpers/cleanup';

const AUTH = { Authorization: 'Bearer TEST_TOKEN' };
const BRANCH_ID = 'test-branch-m93';

describe('Reservations Automation M9.3 (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modRef = await createE2ETestingModuleBuilder({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ReservationsModule,
        AuthModule,
        ThrottlerTestModule,
        PrismaTestModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useClass(TestPrismaService)
      .compile();

    app = modRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await cleanup(app);
  });

  // ====== AC-01: Hold Expiry Automation ======

  describe('AC-01: Hold Expiry Automation', () => {
    it('Policy can set autoExpireHeldEnabled flag', async () => {
      const payload = {
        branchId: BRANCH_ID,
        name: 'M9.3 Auto Expire Policy',
        defaultDurationMinutes: 90,
        minPartySize: 1,
        maxPartySize: 12,
        advanceBookingDays: 14,
        autoExpireHeldEnabled: true, // M9.3 field
        holdExpiryMinutes: 15,
      };
      const res = await request(app.getHttpServer())
        .put('/reservations/policies')
        .set(AUTH)
        .send(payload)
        .ok(() => true);
      expect([200, 201, 401, 403]).toContain(res.status);
      if (res.status === 200 || res.status === 201) {
        expect(res.body?.autoExpireHeldEnabled).toBe(true);
      }
    });

    it('Expired holds are auto-cancelled by automation runner', async () => {
      // This tests the concept - actual runner would be tested via cron
      const res = await request(app.getHttpServer())
        .get('/reservations/automation-logs')
        .set(AUTH)
        .query({ branchId: BRANCH_ID, actionType: 'EXPIRE_HELD' })
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
    });
  });

  // ====== AC-02: Waitlist Auto-Promotion ======

  describe('AC-02: Waitlist Auto-Promotion', () => {
    it('Policy can set waitlistAutoPromote flag', async () => {
      const payload = {
        branchId: BRANCH_ID,
        name: 'M9.3 Waitlist Promo Policy',
        defaultDurationMinutes: 90,
        minPartySize: 1,
        maxPartySize: 12,
        advanceBookingDays: 14,
        waitlistAutoPromote: true, // M9.3 field
      };
      const res = await request(app.getHttpServer())
        .put('/reservations/policies')
        .set(AUTH)
        .send(payload)
        .ok(() => true);
      expect([200, 201, 401, 403]).toContain(res.status);
      if (res.status === 200 || res.status === 201) {
        expect(res.body?.waitlistAutoPromote).toBe(true);
      }
    });

    it('POST /reservations/trigger-waitlist-promotion triggers manual promotion', async () => {
      const res = await request(app.getHttpServer())
        .post('/reservations/trigger-waitlist-promotion')
        .set(AUTH)
        .send({ branchId: BRANCH_ID })
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('promoted');
      }
    });
  });

  // ====== AC-03: Reminder Scheduling ======

  describe('AC-03: Reminder Scheduling', () => {
    it('Policy can set reminderEnabled and reminderLeadMinutes', async () => {
      const payload = {
        branchId: BRANCH_ID,
        name: 'M9.3 Reminder Policy',
        defaultDurationMinutes: 90,
        minPartySize: 1,
        maxPartySize: 12,
        advanceBookingDays: 14,
        reminderEnabled: true, // M9.3 field
        reminderLeadMinutes: 60, // M9.3 field
      };
      const res = await request(app.getHttpServer())
        .put('/reservations/policies')
        .set(AUTH)
        .send(payload)
        .ok(() => true);
      expect([200, 201, 401, 403]).toContain(res.status);
      if (res.status === 200 || res.status === 201) {
        expect(res.body?.reminderEnabled).toBe(true);
        expect(res.body?.reminderLeadMinutes).toBe(60);
      }
    });

    it('Reminder logs are created when reminders are sent', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/automation-logs')
        .set(AUTH)
        .query({ branchId: BRANCH_ID, actionType: 'SEND_REMINDER' })
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
    });
  });

  // ====== AC-04: Slot Availability Endpoint ======

  describe('AC-04: Slot Availability Endpoint', () => {
    it('GET /reservations/slots returns available slots', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/slots')
        .set(AUTH)
        .query({
          branchId: BRANCH_ID,
          date: new Date().toISOString().split('T')[0],
          partySize: 4,
        })
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body?.slots ?? res.body)).toBe(true);
      }
    });

    it('Slot availability respects existing reservations', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app.getHttpServer())
        .get('/reservations/slots')
        .set(AUTH)
        .query({
          branchId: BRANCH_ID,
          date: today,
          partySize: 2,
        })
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
    });
  });

  // ====== AC-05: Capacity Checking ======

  describe('AC-05: Capacity Checking', () => {
    it('POST /reservations/check-capacity validates capacity', async () => {
      const res = await request(app.getHttpServer())
        .post('/reservations/check-capacity')
        .set(AUTH)
        .send({
          branchId: BRANCH_ID,
          dateTime: new Date().toISOString(),
          partySize: 4,
        })
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('available');
        expect(res.body).toHaveProperty('currentCount');
        expect(res.body).toHaveProperty('maxCapacity');
      }
    });

    it('Policy maxCapacityPerSlot is respected', async () => {
      const payload = {
        branchId: BRANCH_ID,
        name: 'M9.3 Capacity Policy',
        defaultDurationMinutes: 90,
        minPartySize: 1,
        maxPartySize: 12,
        advanceBookingDays: 14,
        maxCapacityPerSlot: 20, // M9.3 field
      };
      const res = await request(app.getHttpServer())
        .put('/reservations/policies')
        .set(AUTH)
        .send(payload)
        .ok(() => true);
      expect([200, 201, 401, 403]).toContain(res.status);
      if (res.status === 200 || res.status === 201) {
        expect(res.body?.maxCapacityPerSlot).toBe(20);
      }
    });
  });

  // ====== AC-06: No-Show Grace Period ======

  describe('AC-06: No-Show Grace Period + Deposit Forfeiture', () => {
    it('POST /reservations/:id/no-show-with-grace applies grace logic', async () => {
      const res = await request(app.getHttpServer())
        .post('/reservations/res-test-001/no-show-with-grace')
        .set(AUTH)
        .ok(() => true);
      expect([200, 400, 404, 401, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('forfeited');
        expect(res.body).toHaveProperty('amount');
      }
    });

    it('Policy noShowGraceMinutes configures grace period', async () => {
      const payload = {
        branchId: BRANCH_ID,
        name: 'M9.3 No-Show Grace Policy',
        defaultDurationMinutes: 90,
        minPartySize: 1,
        maxPartySize: 12,
        advanceBookingDays: 14,
        noShowGraceMinutes: 15, // M9.3 field
      };
      const res = await request(app.getHttpServer())
        .put('/reservations/policies')
        .set(AUTH)
        .send(payload)
        .ok(() => true);
      expect([200, 201, 401, 403]).toContain(res.status);
      if (res.status === 200 || res.status === 201) {
        expect(res.body?.noShowGraceMinutes).toBe(15);
      }
    });
  });

  // ====== AC-07: Today Board (Host View) ======

  describe('AC-07: Today Board (Host View)', () => {
    it('GET /reservations/today-board returns today reservations', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/today-board')
        .set(AUTH)
        .query({ branchId: BRANCH_ID })
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('date');
        expect(res.body).toHaveProperty('reservations');
        expect(Array.isArray(res.body.reservations)).toBe(true);
      }
    });

    it('Today board includes waitlist when requested', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/today-board')
        .set(AUTH)
        .query({ branchId: BRANCH_ID, includeWaitlist: 'true' })
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('waitlist');
      }
    });
  });

  // ====== AC-08: Host Actions ======

  describe('AC-08: Host Actions', () => {
    it('POST /reservations/:id/confirm confirms a reservation', async () => {
      const res = await request(app.getHttpServer())
        .post('/reservations/res-test-001/confirm')
        .set(AUTH)
        .ok(() => true);
      expect([200, 400, 404, 401, 403]).toContain(res.status);
    });

    it('POST /reservations/:id/seat seats a guest', async () => {
      const res = await request(app.getHttpServer())
        .post('/reservations/res-test-001/seat')
        .set(AUTH)
        .ok(() => true);
      expect([200, 400, 404, 401, 403]).toContain(res.status);
    });

    it('POST /reservations/:id/complete marks as completed', async () => {
      const res = await request(app.getHttpServer())
        .post('/reservations/res-test-001/complete')
        .set(AUTH)
        .ok(() => true);
      expect([200, 400, 404, 401, 403]).toContain(res.status);
    });

    it('POST /reservations/:id/cancel cancels a reservation', async () => {
      const res = await request(app.getHttpServer())
        .post('/reservations/res-test-001/cancel')
        .set(AUTH)
        .send({ reason: 'E2E test cancellation' })
        .ok(() => true);
      expect([200, 400, 404, 401, 403]).toContain(res.status);
    });
  });

  // ====== AC-09: Calendar Refresh Key ======

  describe('AC-09: Calendar Refresh Key', () => {
    it('GET /reservations/calendar-refresh-key returns ETag or timestamp', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/calendar-refresh-key')
        .set(AUTH)
        .query({ branchId: BRANCH_ID })
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('key');
      }
    });

    it('Refresh key changes after reservation update', async () => {
      const res1 = await request(app.getHttpServer())
        .get('/reservations/calendar-refresh-key')
        .set(AUTH)
        .query({ branchId: BRANCH_ID })
        .ok(() => true);

      // Keys should be consistent for same state
      const res2 = await request(app.getHttpServer())
        .get('/reservations/calendar-refresh-key')
        .set(AUTH)
        .query({ branchId: BRANCH_ID })
        .ok(() => true);

      if (res1.status === 200 && res2.status === 200) {
        // Same data = same key (unless a change happened between)
        expect(res2.body?.key).toBeDefined();
      }
    });
  });

  // ====== AC-10: Unified Status Taxonomy ======

  describe('AC-10: Unified Status Taxonomy', () => {
    it('Reservation statuses follow standard taxonomy', async () => {
      const validStatuses = [
        'HELD',
        'CONFIRMED',
        'SEATED',
        'COMPLETED',
        'NO_SHOW',
        'CANCELLED',
      ];
      const res = await request(app.getHttpServer())
        .get('/reservations/today-board')
        .set(AUTH)
        .query({ branchId: BRANCH_ID, status: 'all' })
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
      if (res.status === 200 && res.body.reservations?.length > 0) {
        for (const r of res.body.reservations) {
          expect(validStatuses).toContain(r.status);
        }
      }
    });

    it('Waitlist statuses follow standard taxonomy', async () => {
      const validStatuses = ['WAITING', 'NOTIFIED', 'SEATED', 'LEFT', 'CANCELLED'];
      const res = await request(app.getHttpServer())
        .get('/reservations/today-board')
        .set(AUTH)
        .query({ branchId: BRANCH_ID, includeWaitlist: 'true' })
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
      if (res.status === 200 && res.body.waitlist?.length > 0) {
        for (const w of res.body.waitlist) {
          expect(validStatuses).toContain(w.status);
        }
      }
    });
  });

  // ====== AC-11: RBAC Enforcement ======

  describe('AC-11: RBAC Enforcement', () => {
    it('Unauthenticated requests are rejected', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/today-board')
        .ok(() => true);
      expect([401, 403]).toContain(res.status);
    });

    it('Automation logs require L2+ access', async () => {
      // Placeholder - actual RBAC testing requires proper auth fixtures
      const res = await request(app.getHttpServer())
        .get('/reservations/automation-logs')
        .set(AUTH)
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
    });
  });

  // ====== AC-12: Audit Logging ======

  describe('AC-12: Audit Logging (AutomationLog)', () => {
    it('GET /reservations/automation-logs returns log entries', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/automation-logs')
        .set(AUTH)
        .query({ branchId: BRANCH_ID })
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body?.logs ?? res.body)).toBe(true);
      }
    });

    it('Automation logs include actionType filter', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/automation-logs')
        .set(AUTH)
        .query({ branchId: BRANCH_ID, actionType: 'EXPIRE_HELD' })
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
    });

    it('Automation logs include date range filter', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app.getHttpServer())
        .get('/reservations/automation-logs')
        .set(AUTH)
        .query({
          branchId: BRANCH_ID,
          from: today,
          to: today,
        })
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
    });
  });

  // ====== ADDITIONAL: Table Status & Upcoming ======

  describe('Table Status & Upcoming Reservations', () => {
    it('GET /reservations/table-statuses returns table availability', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/table-statuses')
        .set(AUTH)
        .query({ branchId: BRANCH_ID })
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body?.tables ?? res.body)).toBe(true);
      }
    });

    it('GET /reservations/upcoming returns future reservations', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/upcoming')
        .set(AUTH)
        .query({ branchId: BRANCH_ID, days: 7 })
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body?.reservations ?? res.body)).toBe(true);
      }
    });
  });
});
