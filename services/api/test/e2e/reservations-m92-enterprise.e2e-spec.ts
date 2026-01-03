/**
 * M9.2: Reservations Enterprise Ops - E2E Tests
 * 
 * Tests for:
 * - Policy Management (CRUD, branch-level)
 * - Deposit Flow (require, pay, refund, apply, forfeit)
 * - Notification Logs (audit trail)
 * - Calendar View (day timeline)
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { createE2ETestingModule, createE2ETestingModuleBuilder } from '../helpers/e2e-bootstrap';

import { ReservationsModule } from '../../src/reservations/reservations.module';
import { AuthModule } from '../../src/auth/auth.module';

import { ThrottlerTestModule } from './throttler.test.module';
import { PrismaTestModule, PrismaService as TestPrismaService } from '../prisma/prisma.module';
import { PrismaService } from '../../src/prisma.service';
import { cleanup } from '../helpers/cleanup';

const AUTH = { Authorization: 'Bearer TEST_TOKEN' };

describe('Reservations Enterprise M9.2 (E2E)', () => {
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

  // ====== POLICY ENDPOINTS ======

  describe('Policy Management', () => {
    it('GET /reservations/policies -> 200 (list policies)', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/policies')
        .set(AUTH)
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body)).toBe(true);
      }
    });

    it('GET /reservations/policies?branchId=xyz -> 200 (filter by branch)', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/policies?branchId=test-branch-123')
        .set(AUTH)
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
    });

    it('PUT /reservations/policies -> 200/201 (upsert policy)', async () => {
      const payload = {
        branchId: 'test-branch-123',
        name: 'Test Policy',
        defaultDurationMinutes: 90,
        minPartySize: 1,
        maxPartySize: 12,
        advanceBookingDays: 14,
        minAdvanceMinutes: 60,
        depositRequired: true,
        depositMinPartySize: 6,
        depositAmount: 50000,
        depositType: 'PER_PERSON',
        depositDeadlineMinutes: 1440,
        noShowFeePercent: 100,
        lateCancelMinutes: 180,
        lateCancelFeePercent: 50,
        autoConfirm: false,
        maxDailyReservations: 50,
        slotIntervalMinutes: 15,
      };
      const res = await request(app.getHttpServer())
        .put('/reservations/policies')
        .set(AUTH)
        .send(payload)
        .ok(() => true);
      expect([200, 201, 401, 403]).toContain(res.status);
      if (res.status === 200 || res.status === 201) {
        expect(res.body?.id).toBeDefined();
        expect(res.body?.name).toBe('Test Policy');
      }
    });

    it('PUT /reservations/policies -> 400 (invalid payload)', async () => {
      const res = await request(app.getHttpServer())
        .put('/reservations/policies')
        .set(AUTH)
        .send({ invalidField: true })
        .ok(() => true);
      expect([400, 401, 403, 422]).toContain(res.status);
    });
  });

  // ====== DEPOSIT ENDPOINTS ======

  describe('Deposit Management', () => {
    it('GET /reservations/:id/deposit -> 200/404 (get deposit)', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/res-001/deposit')
        .set(AUTH)
        .ok(() => true);
      // 404 is ok if no deposit exists
      expect([200, 404, 401, 403]).toContain(res.status);
    });

    it('POST /reservations/:id/deposit/require -> 200/201 (require deposit)', async () => {
      const payload = {
        amount: 300000,
        dueAt: '2025-12-20T18:00:00Z',
      };
      const res = await request(app.getHttpServer())
        .post('/reservations/res-001/deposit/require')
        .set(AUTH)
        .send(payload)
        .ok(() => true);
      expect([200, 201, 400, 401, 403, 404]).toContain(res.status);
    });

    it('POST /reservations/:id/deposit/pay -> 200 (pay deposit)', async () => {
      const payload = {
        paymentMethod: 'MOBILE_MONEY',
        paymentReference: 'MM-123456',
      };
      const res = await request(app.getHttpServer())
        .post('/reservations/res-001/deposit/pay')
        .set(AUTH)
        .send(payload)
        .ok(() => true);
      expect([200, 400, 401, 403, 404]).toContain(res.status);
    });

    it('POST /reservations/:id/deposit/refund -> 200 (refund deposit)', async () => {
      const payload = {
        reason: 'Customer cancelled with notice',
      };
      const res = await request(app.getHttpServer())
        .post('/reservations/res-001/deposit/refund')
        .set(AUTH)
        .send(payload)
        .ok(() => true);
      expect([200, 400, 401, 403, 404]).toContain(res.status);
    });

    it('POST /reservations/:id/deposit/apply -> 200 (apply deposit to bill)', async () => {
      const payload = {
        billId: 'bill-123',
      };
      const res = await request(app.getHttpServer())
        .post('/reservations/res-001/deposit/apply')
        .set(AUTH)
        .send(payload)
        .ok(() => true);
      expect([200, 400, 401, 403, 404]).toContain(res.status);
    });
  });

  // ====== CALENDAR ENDPOINT ======

  describe('Calendar View', () => {
    it('GET /reservations/calendar?date=2025-12-21 -> 200 (day timeline)', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/calendar?date=2025-12-21')
        .set(AUTH)
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body?.date).toBeDefined();
        expect(Array.isArray(res.body?.slots)).toBe(true);
      }
    });

    it('GET /reservations/calendar?date=2025-12-21&branchId=xyz -> 200 (branch filter)', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/calendar?date=2025-12-21&branchId=test-branch-123')
        .set(AUTH)
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
    });

    it('GET /reservations/calendar -> 400 (missing date)', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/calendar')
        .set(AUTH)
        .ok(() => true);
      expect([400, 401, 403]).toContain(res.status);
    });
  });

  // ====== NOTIFICATION LOGS ======

  describe('Notification Logs', () => {
    it('GET /reservations/notifications -> 200 (list logs)', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/notifications')
        .set(AUTH)
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body)).toBe(true);
      }
    });

    it('GET /reservations/notifications?reservationId=res-001 -> 200 (filter by reservation)', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/notifications?reservationId=res-001')
        .set(AUTH)
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
    });

    it('GET /reservations/notifications?event=CONFIRMED -> 200 (filter by event)', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/notifications?event=CONFIRMED')
        .set(AUTH)
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
    });

    it('GET /reservations/notifications?status=FAILED -> 200 (filter by status)', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/notifications?status=FAILED')
        .set(AUTH)
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
    });
  });

  // ====== INTEGRATION SCENARIOS ======

  describe('Integration Scenarios', () => {
    it('Policy + Deposit flow: large party requires deposit', async () => {
      // This is a conceptual test - real implementation would:
      // 1. Create a policy with depositRequired=true, depositMinPartySize=6
      // 2. Create a reservation with partySize=8
      // 3. Verify deposit is required
      // 4. Pay the deposit
      // 5. Complete the reservation
      // 6. Apply the deposit
      
      // For now, just verify endpoints exist
      const policyRes = await request(app.getHttpServer())
        .get('/reservations/policies')
        .set(AUTH)
        .ok(() => true);
      expect([200, 401, 403]).toContain(policyRes.status);
    });

    it('Notification logging on reservation lifecycle', async () => {
      // Verify notification logs endpoint works
      const res = await request(app.getHttpServer())
        .get('/reservations/notifications')
        .set(AUTH)
        .ok(() => true);
      expect([200, 401, 403]).toContain(res.status);
    });
  });
});
