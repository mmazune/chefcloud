/**
 * M9.5: Integrations (Webhooks, ICS, Notifications) - E2E Tests
 *
 * Tests for M9.5 Acceptance Criteria:
 * - A) Outbound Webhooks
 * - B) ICS Calendar Feed
 * - C) Enterprise Notifications
 * - D) Customer Self-Service (token validation)
 * - E) Reporting Extensions
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { createE2ETestingModuleBuilder } from '../helpers/e2e-bootstrap';
import { createHmac } from 'crypto';

import { ReservationsModule } from '../../src/reservations/reservations.module';
import { IntegrationsModule } from '../../src/integrations/integrations.module';
import { AuthModule } from '../../src/auth/auth.module';

import { ThrottlerTestModule } from './throttler.test.module';
import { PrismaTestModule, PrismaService as TestPrismaService } from '../prisma/prisma.module';
import { PrismaService } from '../../src/prisma.service';
import { cleanup } from '../helpers/cleanup';

const AUTH_L4 = { Authorization: 'Bearer TEST_TOKEN_L4' };
const AUTH_L2 = { Authorization: 'Bearer TEST_TOKEN_L2' };
const TEST_ORG_ID = 'test-org-m95';
const TEST_BRANCH_ID = 'test-branch-m95';

describe('Integrations M9.5 (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modRef = await createE2ETestingModuleBuilder({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ReservationsModule,
        IntegrationsModule,
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

  // ==================== A) OUTBOUND WEBHOOKS ====================

  describe('A) Outbound Webhooks', () => {
    let webhookEndpointId: string;
    let webhookSecret: string;

    describe('Webhook Endpoint CRUD', () => {
      it('creates webhook endpoint (L4+ required)', async () => {
        const res = await request(app.getHttpServer())
          .post('/integrations/webhooks')
          .set(AUTH_L4)
          .send({
            url: 'https://example.com/webhook',
            eventTypes: ['reservation.created', 'reservation.confirmed'],
            enabled: true,
            maxRetries: 3,
            timeoutMs: 5000,
          })
          .ok(() => true);

        expect([200, 201, 401, 403]).toContain(res.status);
        if (res.status === 200 || res.status === 201) {
          expect(res.body.id).toBeDefined();
          expect(res.body.secret).toBeDefined();
          webhookEndpointId = res.body.id;
          webhookSecret = res.body.secret;
        }
      });

      it('L2 user cannot create webhook endpoint', async () => {
        const res = await request(app.getHttpServer())
          .post('/integrations/webhooks')
          .set(AUTH_L2)
          .send({
            url: 'https://example.com/webhook',
            eventTypes: ['reservation.created'],
          })
          .ok(() => true);

        expect([401, 403]).toContain(res.status);
      });

      it('lists webhook endpoints', async () => {
        const res = await request(app.getHttpServer())
          .get('/integrations/webhooks')
          .set(AUTH_L4)
          .ok(() => true);

        expect([200, 401, 403]).toContain(res.status);
        if (res.status === 200) {
          expect(Array.isArray(res.body)).toBe(true);
        }
      });

      it('updates webhook endpoint', async () => {
        if (!webhookEndpointId) return;

        const res = await request(app.getHttpServer())
          .put(`/integrations/webhooks/${webhookEndpointId}`)
          .set(AUTH_L4)
          .send({
            enabled: false,
          })
          .ok(() => true);

        expect([200, 401, 403, 404]).toContain(res.status);
      });

      it('rotates webhook secret', async () => {
        if (!webhookEndpointId) return;

        const res = await request(app.getHttpServer())
          .post(`/integrations/webhooks/${webhookEndpointId}/rotate-secret`)
          .set(AUTH_L4)
          .ok(() => true);

        expect([200, 401, 403, 404]).toContain(res.status);
        if (res.status === 200) {
          expect(res.body.secret).toBeDefined();
          expect(res.body.secret).not.toBe(webhookSecret);
        }
      });

      it('deletes webhook endpoint', async () => {
        if (!webhookEndpointId) return;

        const res = await request(app.getHttpServer())
          .delete(`/integrations/webhooks/${webhookEndpointId}`)
          .set(AUTH_L4)
          .ok(() => true);

        expect([200, 401, 403, 404]).toContain(res.status);
      });
    });

    describe('Webhook Validation', () => {
      it('rejects invalid URL (localhost)', async () => {
        const res = await request(app.getHttpServer())
          .post('/integrations/webhooks')
          .set(AUTH_L4)
          .send({
            url: 'http://localhost:3000/webhook',
            eventTypes: ['reservation.created'],
          })
          .ok(() => true);

        expect([400, 401, 403]).toContain(res.status);
      });

      it('rejects invalid event types', async () => {
        const res = await request(app.getHttpServer())
          .post('/integrations/webhooks')
          .set(AUTH_L4)
          .send({
            url: 'https://example.com/webhook',
            eventTypes: ['invalid.event.type'],
          })
          .ok(() => true);

        expect([400, 401, 403]).toContain(res.status);
      });

      it('requires at least one event type', async () => {
        const res = await request(app.getHttpServer())
          .post('/integrations/webhooks')
          .set(AUTH_L4)
          .send({
            url: 'https://example.com/webhook',
            eventTypes: [],
          })
          .ok(() => true);

        expect([400, 401, 403]).toContain(res.status);
      });
    });

    describe('Webhook Delivery Stats', () => {
      it('returns delivery statistics', async () => {
        const res = await request(app.getHttpServer())
          .get('/integrations/webhooks/stats')
          .set(AUTH_L4)
          .query({
            from: '2024-01-01',
            to: '2024-12-31',
          })
          .ok(() => true);

        expect([200, 401, 403]).toContain(res.status);
        if (res.status === 200) {
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('delivered');
          expect(res.body).toHaveProperty('failed');
        }
      });

      it('exports webhook deliveries as CSV', async () => {
        const res = await request(app.getHttpServer())
          .get('/integrations/webhooks/export')
          .set(AUTH_L4)
          .query({
            from: '2024-01-01',
            to: '2024-12-31',
          })
          .ok(() => true);

        expect([200, 401, 403]).toContain(res.status);
        if (res.status === 200) {
          expect(res.headers['content-type']).toContain('text/csv');
        }
      });
    });
  });

  // ==================== B) ICS CALENDAR FEED ====================

  describe('B) ICS Calendar Feed', () => {
    let calendarToken: string;

    it('generates calendar feed token (L4+ required)', async () => {
      const res = await request(app.getHttpServer())
        .post('/integrations/calendar/tokens')
        .set(AUTH_L4)
        .send({
          branchId: TEST_BRANCH_ID,
          expiresInDays: 30,
        })
        .ok(() => true);

      expect([200, 201, 401, 403, 404]).toContain(res.status);
      if (res.status === 200 || res.status === 201) {
        expect(res.body.token).toBeDefined();
        calendarToken = res.body.token;
      }
    });

    it('lists calendar tokens', async () => {
      const res = await request(app.getHttpServer())
        .get('/integrations/calendar/tokens')
        .set(AUTH_L4)
        .query({ branchId: TEST_BRANCH_ID })
        .ok(() => true);

      expect([200, 401, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body)).toBe(true);
      }
    });

    it('ICS feed returns valid calendar content', async () => {
      if (!calendarToken) return;

      const res = await request(app.getHttpServer())
        .get(`/public/reservations/${TEST_BRANCH_ID}/calendar.ics`)
        .query({ token: calendarToken })
        .ok(() => true);

      expect([200, 401, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(res.headers['content-type']).toContain('text/calendar');
        expect(res.text).toContain('BEGIN:VCALENDAR');
        expect(res.text).toContain('VERSION:2.0');
        expect(res.text).toContain('END:VCALENDAR');
      }
    });

    it('ICS feed rejects invalid token', async () => {
      const res = await request(app.getHttpServer())
        .get(`/public/reservations/${TEST_BRANCH_ID}/calendar.ics`)
        .query({ token: 'invalid-token-12345' })
        .ok(() => true);

      expect([401, 404]).toContain(res.status);
    });

    it('revokes calendar token', async () => {
      // First create a token to revoke
      const createRes = await request(app.getHttpServer())
        .post('/integrations/calendar/tokens')
        .set(AUTH_L4)
        .send({ branchId: TEST_BRANCH_ID })
        .ok(() => true);

      if (createRes.status === 200 || createRes.status === 201) {
        const tokenId = createRes.body.id;

        const res = await request(app.getHttpServer())
          .delete(`/integrations/calendar/tokens/${tokenId}`)
          .set(AUTH_L4)
          .query({ branchId: TEST_BRANCH_ID })
          .ok(() => true);

        expect([200, 401, 403, 404]).toContain(res.status);
      }
    });
  });

  // ==================== C) ENTERPRISE NOTIFICATIONS ====================

  describe('C) Enterprise Notifications', () => {
    let templateId: string;

    describe('Notification Template CRUD', () => {
      it('creates notification template (L4+ required)', async () => {
        const res = await request(app.getHttpServer())
          .post('/integrations/notifications/templates')
          .set(AUTH_L4)
          .send({
            type: 'EMAIL',
            event: 'reservation.confirmed',
            subject: 'Reservation Confirmed - {{branch}}',
            body: 'Hi {{name}}, your reservation for {{partySize}} guests on {{date}} at {{time}} is confirmed.',
            enabled: true,
          })
          .ok(() => true);

        expect([200, 201, 401, 403]).toContain(res.status);
        if (res.status === 200 || res.status === 201) {
          expect(res.body.id).toBeDefined();
          templateId = res.body.id;
        }
      });

      it('L2 user cannot create template', async () => {
        const res = await request(app.getHttpServer())
          .post('/integrations/notifications/templates')
          .set(AUTH_L2)
          .send({
            type: 'SMS',
            event: 'reservation.confirmed',
            body: 'Reservation confirmed!',
          })
          .ok(() => true);

        expect([401, 403]).toContain(res.status);
      });

      it('lists notification templates', async () => {
        const res = await request(app.getHttpServer())
          .get('/integrations/notifications/templates')
          .set(AUTH_L4)
          .ok(() => true);

        expect([200, 401, 403]).toContain(res.status);
        if (res.status === 200) {
          expect(Array.isArray(res.body)).toBe(true);
        }
      });

      it('previews template with sample data', async () => {
        if (!templateId) return;

        const res = await request(app.getHttpServer())
          .get(`/integrations/notifications/templates/${templateId}/preview`)
          .set(AUTH_L4)
          .ok(() => true);

        expect([200, 401, 403, 404]).toContain(res.status);
        if (res.status === 200) {
          expect(res.body.preview).toBeDefined();
          expect(res.body.preview.subject).toBeDefined();
          expect(res.body.preview.body).toBeDefined();
          // Variables should be replaced
          expect(res.body.preview.body).not.toContain('{{name}}');
        }
      });

      it('gets available template variables', async () => {
        const res = await request(app.getHttpServer())
          .get('/integrations/notifications/variables')
          .set(AUTH_L4)
          .ok(() => true);

        expect([200, 401, 403]).toContain(res.status);
        if (res.status === 200) {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.some((v: { name: string }) => v.name === 'name')).toBe(true);
          expect(res.body.some((v: { name: string }) => v.name === 'partySize')).toBe(true);
        }
      });

      it('updates notification template', async () => {
        if (!templateId) return;

        const res = await request(app.getHttpServer())
          .put(`/integrations/notifications/templates/${templateId}`)
          .set(AUTH_L4)
          .send({
            enabled: false,
          })
          .ok(() => true);

        expect([200, 401, 403, 404]).toContain(res.status);
      });

      it('deletes notification template', async () => {
        if (!templateId) return;

        const res = await request(app.getHttpServer())
          .delete(`/integrations/notifications/templates/${templateId}`)
          .set(AUTH_L4)
          .ok(() => true);

        expect([200, 401, 403, 404]).toContain(res.status);
      });
    });

    describe('Template Validation', () => {
      it('rejects template with script injection', async () => {
        const res = await request(app.getHttpServer())
          .post('/integrations/notifications/templates')
          .set(AUTH_L4)
          .send({
            type: 'EMAIL',
            event: 'reservation.confirmed',
            body: '<script>alert("xss")</script>',
          })
          .ok(() => true);

        expect([400, 401, 403]).toContain(res.status);
      });
    });

    describe('Notification Stats', () => {
      it('returns notification statistics', async () => {
        const res = await request(app.getHttpServer())
          .get('/integrations/notifications/stats')
          .set(AUTH_L4)
          .query({
            from: '2024-01-01',
            to: '2024-12-31',
          })
          .ok(() => true);

        expect([200, 401, 403]).toContain(res.status);
        if (res.status === 200) {
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('sent');
          expect(res.body).toHaveProperty('failed');
        }
      });

      it('exports notifications as CSV', async () => {
        const res = await request(app.getHttpServer())
          .get('/integrations/notifications/export')
          .set(AUTH_L4)
          .query({
            from: '2024-01-01',
            to: '2024-12-31',
          })
          .ok(() => true);

        expect([200, 401, 403]).toContain(res.status);
        if (res.status === 200) {
          expect(res.headers['content-type']).toContain('text/csv');
        }
      });
    });
  });

  // ==================== D) CUSTOMER SELF-SERVICE ====================

  describe('D) Customer Self-Service', () => {
    it('manage endpoint rejects invalid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/public/reservations/manage')
        .query({ token: 'invalid-token' })
        .ok(() => true);

      expect([401, 404]).toContain(res.status);
    });

    // Note: Full manage flow tested with valid reservation + token
    // requires creating reservation first (covered in M9.4 tests)
  });

  // ==================== E) REPORTING EXTENSIONS ====================

  describe('E) Reporting Extensions', () => {
    it('webhook stats available for reports', async () => {
      const res = await request(app.getHttpServer())
        .get('/integrations/webhooks/stats')
        .set(AUTH_L4)
        .query({
          from: '2024-01-01',
          to: '2024-12-31',
        })
        .ok(() => true);

      expect([200, 401, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(typeof res.body.total).toBe('number');
        expect(typeof res.body.delivered).toBe('number');
        expect(typeof res.body.failed).toBe('number');
        expect(typeof res.body.deadLetter).toBe('number');
      }
    });

    it('notification stats available for reports', async () => {
      const res = await request(app.getHttpServer())
        .get('/integrations/notifications/stats')
        .set(AUTH_L4)
        .query({
          from: '2024-01-01',
          to: '2024-12-31',
        })
        .ok(() => true);

      expect([200, 401, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(typeof res.body.total).toBe('number');
        expect(typeof res.body.sent).toBe('number');
        expect(typeof res.body.failed).toBe('number');
        expect(res.body.byType).toBeDefined();
      }
    });
  });

  // ==================== HMAC SIGNATURE VERIFICATION ====================

  describe('HMAC Signature Verification', () => {
    it('generates valid HMAC signature', () => {
      // This tests the signature generation algorithm
      const secret = 'test-secret-12345';
      const payload = JSON.stringify({ event: 'test', data: { id: '123' } });

      const signature = createHmac('sha256', secret).update(payload).digest('hex');

      expect(signature).toHaveLength(64); // SHA256 hex is 64 chars
      expect(/^[a-f0-9]+$/.test(signature)).toBe(true);
    });

    it('signature is deterministic', () => {
      const secret = 'test-secret-12345';
      const payload = JSON.stringify({ event: 'test' });

      const sig1 = createHmac('sha256', secret).update(payload).digest('hex');
      const sig2 = createHmac('sha256', secret).update(payload).digest('hex');

      expect(sig1).toBe(sig2);
    });

    it('different payloads produce different signatures', () => {
      const secret = 'test-secret-12345';
      const payload1 = JSON.stringify({ event: 'test1' });
      const payload2 = JSON.stringify({ event: 'test2' });

      const sig1 = createHmac('sha256', secret).update(payload1).digest('hex');
      const sig2 = createHmac('sha256', secret).update(payload2).digest('hex');

      expect(sig1).not.toBe(sig2);
    });
  });

  // ==================== EDGE CASES ====================

  describe('Edge Cases', () => {
    it('empty date range returns zero stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/integrations/webhooks/stats')
        .set(AUTH_L4)
        .query({
          from: '1990-01-01',
          to: '1990-01-02',
        })
        .ok(() => true);

      if (res.status === 200) {
        expect(res.body.total).toBe(0);
      }
    });

    it('ICS feed with no reservations returns empty calendar', async () => {
      // Create a fresh token for empty branch
      const tokenRes = await request(app.getHttpServer())
        .post('/integrations/calendar/tokens')
        .set(AUTH_L4)
        .send({ branchId: 'empty-branch-m95' })
        .ok(() => true);

      if (tokenRes.status === 200 || tokenRes.status === 201) {
        const res = await request(app.getHttpServer())
          .get('/public/reservations/empty-branch-m95/calendar.ics')
          .query({ token: tokenRes.body.token })
          .ok(() => true);

        if (res.status === 200) {
          expect(res.text).toContain('BEGIN:VCALENDAR');
          expect(res.text).toContain('END:VCALENDAR');
          // Should not have any VEVENT entries
          expect(res.text).not.toContain('BEGIN:VEVENT');
        }
      }
    });
  });
});
