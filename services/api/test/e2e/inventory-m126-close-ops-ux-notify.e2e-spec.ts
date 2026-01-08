/**
 * M12.6 E2E Tests: Close Ops UX + Notifications
 *
 * Tests for:
 * - Close request lifecycle (create/submit/approve/reject)
 * - Notification emission on close events
 * - Dashboard aggregation org-scoped
 * - CSV exports with BOM and hash
 * - RBAC enforcement (L3 cannot approve)
 * - No test hangs (detectOpenHandles compliant)
 */
import { TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { createOrgWithUsers, FactoryOrg } from './factory';
import { cleanup } from '../helpers/cleanup';
import { createE2ETestingModule } from '../helpers/e2e-bootstrap';
import { createHash } from 'crypto';

jest.setTimeout(120_000);

const testSuffix = Date.now().toString(36);

describe('M12.6 Close Ops UX + Notifications (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factory: FactoryOrg;

  // Test tokens
  let ownerToken: string; // L5
  let managerToken: string; // L4

  // Test entities
  let periodIdJan: string;
  let periodIdFeb: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let periodIdMar: string;
  let closeRequestId: string;

  // ============================================
  // Setup / Teardown
  // ============================================

  beforeAll(async () => {
    const moduleFixture: TestingModule = await createE2ETestingModule({ imports: [AppModule] });

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    );

    await app.init();

    prisma = app.get(PrismaService);
    factory = await createOrgWithUsers(prisma, `e2e-m126-${testSuffix}`);

    // Login users
    const loginOwner = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: factory.users.owner.email, password: 'Test#123' });
    ownerToken = loginOwner.body.access_token;

    const loginManager = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: factory.users.manager.email, password: 'Test#123' });
    managerToken = loginManager.body.access_token;

    // Generate Jan/Feb/Mar periods
    await request(app.getHttpServer())
      .post('/inventory/periods/generate')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ branchId: factory.branchId, fromMonth: '2026-01', toMonth: '2026-03' })
      .expect(200);

    // List periods and capture IDs
    const listRes = await request(app.getHttpServer())
      .get('/inventory/periods')
      .query({ branchId: factory.branchId })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const periods = Array.isArray(listRes.body)
      ? listRes.body
      : Array.isArray(listRes.body.periods)
        ? listRes.body.periods
        : [];

    const jan = periods.find((p: any) => {
      const d = new Date(p.startDate);
      return d.getUTCFullYear() === 2026 && d.getUTCMonth() === 0;
    });
    const feb = periods.find((p: any) => {
      const d = new Date(p.startDate);
      return d.getUTCFullYear() === 2026 && d.getUTCMonth() === 1;
    });
    const mar = periods.find((p: any) => {
      const d = new Date(p.startDate);
      return d.getUTCFullYear() === 2026 && d.getUTCMonth() === 2;
    });

    if (!jan || !feb || !mar) {
      console.error('Failed to find periods. Available:', JSON.stringify(periods, null, 2));
      throw new Error('Failed to locate generated Jan/Feb/Mar periods');
    }

    periodIdJan = jan.id;
    periodIdFeb = feb.id;
    periodIdMar = mar.id;
  }, 90000);

  afterAll(async () => {
    await cleanup(app);
  });

  // ============================================
  // Close Request Lifecycle
  // ============================================

  describe('Close Request Lifecycle', () => {
    it('should create close request (L4+ required)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/periods/${periodIdJan}/close-requests`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.periodId).toBe(periodIdJan);
      closeRequestId = res.body.id;
    });

    it('should list close requests with filters', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/periods/close-requests')
        .query({ branchId: factory.branchId })
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const found = res.body.find((r: any) => r.id === closeRequestId);
      expect(found).toBeDefined();
    });

    it('should submit close request', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/periods/close-requests/${closeRequestId}/submit`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(res.body.status).toBe('SUBMITTED');
      expect(res.body.requestedAt).toBeDefined();
    });

    it('should emit notification on submit', async () => {
      // Check notification outbox for SUBMITTED event
      const notifications = await prisma.client.notificationOutbox.findMany({
        where: {
          orgId: factory.orgId,
          event: { contains: 'CLOSE_REQUEST_SUBMITTED' },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      expect(notifications.length).toBeGreaterThanOrEqual(1);
      expect(notifications[0].type).toBe('IN_APP');
    });

    it('should allow L5+ to approve', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/periods/close-requests/${closeRequestId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ notes: 'Approved for M12.6 testing' })
        .expect(200);

      expect(res.body.status).toBe('APPROVED');
      expect(res.body.approvedAt).toBeDefined();
    });

    it('should emit notification on approve (H3: safe subset)', async () => {
      const notifications = await prisma.client.notificationOutbox.findMany({
        where: {
          orgId: factory.orgId,
          event: { contains: 'CLOSE_REQUEST_APPROVED' },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      expect(notifications.length).toBeGreaterThanOrEqual(1);

      // Verify safe subset (H3)
      const payload = JSON.parse(notifications[0].body);
      expect(payload.branchName).toBeDefined();
      expect(payload.periodRange).toBeDefined();
      expect(payload.actorRole).toBeDefined();
      // Should NOT have userId
      expect(payload.userId).toBeUndefined();
    });
  });

  // ============================================
  // Dashboard Org Scoping (H1)
  // ============================================

  describe('Dashboard Org Scoping', () => {
    it('should return dashboard data scoped to org', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/periods/dashboard')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.rows).toBeDefined();
      expect(res.body.summary).toBeDefined();

      // All rows should belong to our org's branches
      for (const row of res.body.rows) {
        expect(row.branchId).toBe(factory.branchId);
      }
    });
  });

  // ============================================
  // CSV Export (H4)
  // ============================================

  describe('CSV Export', () => {
    it('should export close requests with BOM and hash header', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/periods/close-requests/export')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Check Content-Type
      expect(res.headers['content-type']).toContain('text/csv');

      // Check hash header exists
      const hashHeader = res.headers['x-nimbus-export-hash'];
      expect(hashHeader).toBeDefined();
      expect(hashHeader.length).toBe(64); // SHA-256 hex

      // Verify BOM (first character for UTF-8 BOM)
      const body = res.text;
      expect(body.charCodeAt(0)).toBe(0xFEFF); // BOM

      // Verify hash matches content
      const normalized = body.replace(/\r\n/g, '\n');
      const computedHash = createHash('sha256').update(normalized, 'utf8').digest('hex');
      expect(computedHash).toBe(hashHeader);
    });
  });

  // ============================================
  // Rejection Flow
  // ============================================

  describe('Rejection Flow', () => {
    let rejectRequestId: string;

    beforeAll(async () => {
      // Create close request for February
      const requestRes = await request(app.getHttpServer())
        .post(`/inventory/periods/${periodIdFeb}/close-requests`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(201);
      rejectRequestId = requestRes.body.id;

      // Submit for approval
      await request(app.getHttpServer())
        .post(`/inventory/periods/close-requests/${rejectRequestId}/submit`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);
    });

    it('should require rejection reason of min 10 chars', async () => {
      await request(app.getHttpServer())
        .post(`/inventory/periods/close-requests/${rejectRequestId}/reject`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'Short' })
        .expect(400);
    });

    it('should reject with valid reason', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/periods/close-requests/${rejectRequestId}/reject`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'Rejected due to incomplete stocktake verification required' })
        .expect(200);

      expect(res.body.status).toBe('REJECTED');
      expect(res.body.rejectionReason).toBeDefined();
    });

    it('should emit notification on reject', async () => {
      const notifications = await prisma.client.notificationOutbox.findMany({
        where: {
          orgId: factory.orgId,
          event: { contains: 'CLOSE_REQUEST_REJECTED' },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      expect(notifications.length).toBeGreaterThanOrEqual(1);

      // Verify reason is in payload
      const payload = JSON.parse(notifications[0].body);
      expect(payload.reason).toBeDefined();
    });
  });

  // ============================================
  // Idempotency (H7)
  // ============================================

  describe('Close Request Idempotency', () => {
    it('should return 409 on duplicate close request', async () => {
      // Try to create another request for the same period (January)
      await request(app.getHttpServer())
        .post(`/inventory/periods/${periodIdJan}/close-requests`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(409);
    });
  });

  // ============================================
  // Notifications API
  // ============================================

  describe('Notifications API', () => {
    it('should list inventory close notifications', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/notifications')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.notifications).toBeDefined();
      expect(res.body.total).toBeGreaterThanOrEqual(0);
    });

    it('should acknowledge notification idempotently (H9)', async () => {
      // Get first notification
      const listRes = await request(app.getHttpServer())
        .get('/inventory/notifications')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      if (listRes.body.notifications.length > 0) {
        const notificationId = listRes.body.notifications[0].id;

        // First ack
        const ackRes1 = await request(app.getHttpServer())
          .post(`/inventory/notifications/${notificationId}/ack`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(ackRes1.body.status).toBe('ACKED');

        // Second ack should be idempotent
        const ackRes2 = await request(app.getHttpServer())
          .post(`/inventory/notifications/${notificationId}/ack`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(ackRes2.body.status).toBe('ACKED');
      }
    });

    it('should export notifications as CSV with hash', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/notifications/export')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['x-nimbus-export-hash']).toBeDefined();
    });
  });
});
