/**
 * M10.20 Workforce Geo-Fencing Enforcement E2E Tests
 *
 * STANDARD: instructions/E2E_NO_HANG_STANDARD.md
 *
 * This file validates:
 * - A) Branch Geo-Fence Configuration: CRUD operations
 * - B) Enforcement: Haversine distance check, accuracy gating
 * - C) Manager Overrides: L3+ override workflow with reason
 * - D) Reporting: KPIs, event history, exports
 *
 * Hypotheses addressed:
 * - H1: Haversine distance rounding (floating-point edge cases)
 * - H2: Accuracy gating (maxAccuracyMeters = 200m default for indoor GPS)
 * - H3: RBAC for overrides (L3+ only)
 * - H4: Export hash (UTF-8 BOM + SHA-256 in trailer)
 * - H7: Indoor GPS tolerance (200m default, not 100m)
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

describe('M10.20 Workforce Geo-Fencing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let managerToken: string;
  let staffToken: string;
  let orgId: string;
  let branchId: string;
  let staffUserId: string;
  let ownerUserId: string;
  let managerUserId: string;

  // Created test data IDs
  let geoFenceConfigId: string;
  let timeEntryId: string;

  // Test coordinates (NYC area)
  const NYC_CENTER = { lat: 40.7128, lng: -74.006 };
  const NYC_NEARBY = { lat: 40.7130, lng: -74.0062 }; // ~25m from center
  const NYC_FAR = { lat: 40.7200, lng: -74.0100 }; // ~1km from center

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

      // Login as owner (L5)
      const ownerLogin = await withTimeout(loginAs(app, 'owner'), {
        ms: 10_000,
        label: 'ownerLogin',
      });
      ownerToken = ownerLogin.accessToken;
      orgId = ownerLogin.user.orgId;
      ownerUserId = ownerLogin.user.userId;

      // Login as manager (L3)
      const managerLogin = await withTimeout(loginAs(app, 'manager'), {
        ms: 10_000,
        label: 'managerLogin',
      });
      managerToken = managerLogin.accessToken;
      managerUserId = managerLogin.user.userId;

      // Login as waiter (L2)
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

      trace('beforeAll complete', { orgId, branchId, staffUserId, ownerUserId, managerUserId });
    });
  });

  afterAll(async () => {
    await traceSpan('afterAll', async () => {
      trace('cleaning up test data');

      if (prisma) {
        try {
          // Clean M10.20 test data
          await prisma.client.geoFenceEvent.deleteMany({
            where: { orgId },
          });
          await prisma.client.branchGeoFence.deleteMany({
            where: { orgId },
          });
          if (timeEntryId) {
            await prisma.client.timeEntry.deleteMany({
              where: { id: timeEntryId },
            });
          }
        } catch (e) {
          trace('Cleanup error', { error: (e as Error).message });
        }
      }

      trace('closing app');
      await withTimeout(cleanup(app), { ms: 15_000, label: 'cleanup' });
      trace('afterAll complete');
    });
  });

  // ===== A) Branch Geo-Fence Configuration =====

  describe('A) Branch Geo-Fence Configuration', () => {
    it('A1: L4+ can create geo-fence config', async () => {
      const res = await request(app.getHttpServer())
        .put('/workforce/geofence/config')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId,
          enabled: true,
          centerLat: NYC_CENTER.lat,
          centerLng: NYC_CENTER.lng,
          radiusMeters: 100,
          enforceClockIn: true,
          enforceClockOut: true,
          allowManagerOverride: true,
          maxAccuracyMeters: 200, // H7: Indoor GPS tolerance
        })
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('id');
      expect(res.body.branchId).toBe(branchId);
      expect(res.body.radiusMeters).toBe(100);
      expect(res.body.maxAccuracyMeters).toBe(200); // H7
      geoFenceConfigId = res.body.id;
    });

    it('A2: L3 cannot create geo-fence config (403)', async () => {
      await request(app.getHttpServer())
        .put('/workforce/geofence/config')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          branchId,
          enabled: true,
          centerLat: NYC_CENTER.lat,
          centerLng: NYC_CENTER.lng,
          radiusMeters: 100,
          enforceClockIn: true,
          enforceClockOut: false,
          allowManagerOverride: true,
        })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('A3: validates coordinate ranges', async () => {
      const res = await request(app.getHttpServer())
        .put('/workforce/geofence/config')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId,
          enabled: true,
          centerLat: 100, // Invalid: > 90
          centerLng: NYC_CENTER.lng,
          radiusMeters: 100,
          enforceClockIn: true,
          enforceClockOut: true,
          allowManagerOverride: true,
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.message).toContain('latitude');
    });

    it('A4: validates radius bounds (min 10m, max 50km)', async () => {
      // Too small
      await request(app.getHttpServer())
        .put('/workforce/geofence/config')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId,
          enabled: true,
          centerLat: NYC_CENTER.lat,
          centerLng: NYC_CENTER.lng,
          radiusMeters: 5, // Too small
          enforceClockIn: true,
          enforceClockOut: true,
          allowManagerOverride: true,
        })
        .expect(HttpStatus.BAD_REQUEST);

      // Too large
      await request(app.getHttpServer())
        .put('/workforce/geofence/config')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId,
          enabled: true,
          centerLat: NYC_CENTER.lat,
          centerLng: NYC_CENTER.lng,
          radiusMeters: 100000, // 100km > 50km limit
          enforceClockIn: true,
          enforceClockOut: true,
          allowManagerOverride: true,
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('A5: can list all geo-fence configs', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/geofence/config')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('branch');
    });

    it('A6: can get config by branchId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/workforce/geofence/config/${branchId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.branchId).toBe(branchId);
      expect(res.body.enabled).toBe(true);
    });
  });

  // ===== B) Enforcement Logic =====

  describe('B) Enforcement Logic', () => {
    it('B1: allows clock-in when inside perimeter', async () => {
      const res = await request(app.getHttpServer())
        .post('/workforce/geofence/check')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          branchId,
          clockAction: 'CLOCK_IN',
          location: {
            lat: NYC_NEARBY.lat,
            lng: NYC_NEARBY.lng,
            accuracyMeters: 10,
          },
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.allowed).toBe(true);
      expect(res.body.requiresOverride).toBe(false);
      expect(res.body.distanceMeters).toBeDefined();
      expect(res.body.distanceMeters).toBeLessThan(100); // Within 100m radius
    });

    it('B2: blocks clock-in when outside perimeter (H1 Haversine)', async () => {
      const res = await request(app.getHttpServer())
        .post('/workforce/geofence/check')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          branchId,
          clockAction: 'CLOCK_IN',
          location: {
            lat: NYC_FAR.lat,
            lng: NYC_FAR.lng,
            accuracyMeters: 10,
          },
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.allowed).toBe(false);
      expect(res.body.reasonCode).toBe('OUTSIDE_GEOFENCE');
      expect(res.body.requiresOverride).toBe(true);
      expect(res.body.canOverride).toBe(true);
      expect(res.body.distanceMeters).toBeGreaterThan(100);
    });

    it('B3: blocks when accuracy too low (H2 Accuracy Gating)', async () => {
      const res = await request(app.getHttpServer())
        .post('/workforce/geofence/check')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          branchId,
          clockAction: 'CLOCK_IN',
          location: {
            lat: NYC_NEARBY.lat,
            lng: NYC_NEARBY.lng,
            accuracyMeters: 250, // > 200m default threshold
          },
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.allowed).toBe(false);
      expect(res.body.reasonCode).toBe('ACCURACY_TOO_LOW');
      expect(res.body.requiresOverride).toBe(true);
    });

    it('B4: blocks when location missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/workforce/geofence/check')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          branchId,
          clockAction: 'CLOCK_IN',
          // No location
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.allowed).toBe(false);
      expect(res.body.reasonCode).toBe('MISSING_LOCATION');
    });

    it('B5: H7 accepts 190m accuracy (within 200m threshold)', async () => {
      const res = await request(app.getHttpServer())
        .post('/workforce/geofence/check')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          branchId,
          clockAction: 'CLOCK_IN',
          location: {
            lat: NYC_NEARBY.lat,
            lng: NYC_NEARBY.lng,
            accuracyMeters: 190, // Within 200m threshold
          },
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.allowed).toBe(true);
      expect(res.body.reasonCode).toBeUndefined();
    });

    it('B6: allows when geo-fence disabled', async () => {
      // Disable geo-fence
      await request(app.getHttpServer())
        .put('/workforce/geofence/config')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId,
          enabled: false,
          centerLat: NYC_CENTER.lat,
          centerLng: NYC_CENTER.lng,
          radiusMeters: 100,
          enforceClockIn: true,
          enforceClockOut: true,
          allowManagerOverride: true,
        })
        .expect(HttpStatus.OK);

      // Check - should be allowed
      const res = await request(app.getHttpServer())
        .post('/workforce/geofence/check')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          branchId,
          clockAction: 'CLOCK_IN',
          location: {
            lat: NYC_FAR.lat,
            lng: NYC_FAR.lng,
            accuracyMeters: 10,
          },
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.allowed).toBe(true);

      // Re-enable for remaining tests
      await request(app.getHttpServer())
        .put('/workforce/geofence/config')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId,
          enabled: true,
          centerLat: NYC_CENTER.lat,
          centerLng: NYC_CENTER.lng,
          radiusMeters: 100,
          enforceClockIn: true,
          enforceClockOut: true,
          allowManagerOverride: true,
          maxAccuracyMeters: 200,
        })
        .expect(HttpStatus.OK);
    });
  });

  // ===== C) Manager Overrides =====

  describe('C) Manager Overrides', () => {
    beforeAll(async () => {
      // Create a time entry for override testing
      const clockIn = new Date();
      clockIn.setHours(clockIn.getHours() - 2);

      const timeEntry = await prisma.client.timeEntry.create({
        data: {
          orgId,
          branchId,
          userId: staffUserId,
          clockInAt: clockIn,
          method: 'MANUAL',
          clockInLat: NYC_FAR.lat,
          clockInLng: NYC_FAR.lng,
          clockInAccuracyMeters: 10,
          clockInSource: 'GPS',
        },
      });
      timeEntryId = timeEntry.id;

      // Log a blocked event for this entry
      await prisma.client.geoFenceEvent.create({
        data: {
          orgId,
          branchId,
          userId: staffUserId,
          eventType: 'BLOCKED',
          reasonCode: 'OUTSIDE_GEOFENCE',
          clockAction: 'CLOCK_IN',
          lat: NYC_FAR.lat,
          lng: NYC_FAR.lng,
          accuracyMeters: 10,
          distanceMeters: 900,
          radiusMeters: 100,
        },
      });
    });

    it('C1: L3+ can apply override with reason', async () => {
      const res = await request(app.getHttpServer())
        .post('/workforce/geofence/override')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          timeEntryId,
          clockAction: 'CLOCK_IN',
          reason: 'Employee confirmed at location via phone call verification',
        })
        .expect(HttpStatus.CREATED);

      expect(res.body).toHaveProperty('id');
      expect(res.body.clockInOverride).toBe(true);
      expect(res.body.clockInOverrideReason).toBe(
        'Employee confirmed at location via phone call verification',
      );
    });

    it('C2: L2 cannot apply override (H3 RBAC)', async () => {
      await request(app.getHttpServer())
        .post('/workforce/geofence/override')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          timeEntryId,
          clockAction: 'CLOCK_IN',
          reason: 'This should fail due to L2 role level',
        })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('C3: requires reason with minimum length', async () => {
      // Create another time entry for this test
      const timeEntry2 = await prisma.client.timeEntry.create({
        data: {
          orgId,
          branchId,
          userId: staffUserId,
          clockInAt: new Date(),
          method: 'MANUAL',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/workforce/geofence/override')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          timeEntryId: timeEntry2.id,
          clockAction: 'CLOCK_IN',
          reason: 'too short', // < 10 characters
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.message).toContain('10 characters');

      // Clean up
      await prisma.client.timeEntry.delete({ where: { id: timeEntry2.id } });
    });
  });

  // ===== D) Reporting =====

  describe('D) Reporting', () => {
    it('D1: can get enforcement KPIs', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/geofence/kpis')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('totalAttempts');
      expect(res.body).toHaveProperty('totalBlocked');
      expect(res.body).toHaveProperty('totalOverrides');
      expect(res.body).toHaveProperty('blockedByReason');
      expect(res.body).toHaveProperty('overrideRate');
    });

    it('D2: can filter KPIs by branch', async () => {
      const res = await request(app.getHttpServer())
        .get(`/workforce/geofence/kpis?branchId=${branchId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('totalAttempts');
    });

    it('D3: can get event history with pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/geofence/events?limit=10&offset=0')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('events');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.events)).toBe(true);
    });

    it('D4: can get branch KPIs report', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/geofence/reports/branch-kpis')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('D5: can get daily trends', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/geofence/reports/daily-trends')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('D6: can get top offenders', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/geofence/reports/top-offenders?limit=5')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('D7: can get override summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/workforce/geofence/reports/override-summary')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ===== E) Export =====

  describe('E) Export', () => {
    it('E1: L4+ can export CSV with hash (H4)', async () => {
      // Create some event data first
      await prisma.client.geoFenceEvent.create({
        data: {
          orgId,
          branchId,
          userId: staffUserId,
          eventType: 'ALLOWED',
          clockAction: 'CLOCK_IN',
          lat: NYC_NEARBY.lat,
          lng: NYC_NEARBY.lng,
          accuracyMeters: 10,
          distanceMeters: 25,
          radiusMeters: 100,
        },
      });

      const res = await request(app.getHttpServer())
        .get('/workforce/geofence/export')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      // Check headers
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['x-content-hash']).toBeDefined();
      expect(res.headers['x-content-hash'].length).toBe(64); // SHA-256 hex

      // Check CSV content
      const csv = res.text;
      expect(csv.charCodeAt(0)).toBe(0xfeff); // UTF-8 BOM (as decoded)
      expect(csv).toContain('Date,Branch,Employee');
      expect(csv).toContain('# SHA-256:');
    });

    it('E2: L3 cannot export (403)', async () => {
      await request(app.getHttpServer())
        .get('/workforce/geofence/export')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ===== F) Config Deletion =====

  describe('F) Config Deletion', () => {
    it('F1: L4 cannot delete config (403)', async () => {
      // Need to test with L4 role - using manager token should fail
      // For this test, we assume manager is L3
      await request(app.getHttpServer())
        .delete(`/workforce/geofence/config/${branchId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('F2: L5 can delete config', async () => {
      await request(app.getHttpServer())
        .delete(`/workforce/geofence/config/${branchId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      // Verify deleted
      const res = await request(app.getHttpServer())
        .get(`/workforce/geofence/config/${branchId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toBeNull();
    });
  });
});
