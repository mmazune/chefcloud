/**
 * HIGH Risk Capability E2E Tests (Prompt 2)
 *
 * Tests server-side enforcement of HIGH risk actions via RBAC + capability checks.
 * Validates that OWNER-exclusive operations reject non-owner roles with 403.
 *
 * Covered OWNER-exclusive actions:
 * - period-reopen: POST /inventory-periods/:id/reopen
 * - payroll-post: POST /workforce/payroll-runs/:id/post
 * - remittance-submit: POST /orgs/:orgId/remittances/:id/post
 * - billing-manage-subscription: POST /billing/plan/change, POST /billing/cancel
 * - security-manage-api-keys: POST /ops/apikeys, GET /ops/apikeys, DELETE /ops/apikeys/:id
 *
 * @see services/api/src/auth/capabilities.ts
 * @see reports/navigation/runtime/owner.runtime.json
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { createE2EApp } from '../helpers/e2e-bootstrap';
import { withTimeout } from '../helpers/with-timeout';
import { cleanup } from '../helpers/cleanup';
import { loginAs, LoginResult } from '../helpers/e2e-login';

describe('HIGH Risk Capability Enforcement (Prompt 2)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let managerToken: string;
  let waiterToken: string;
  let ownerLogin: LoginResult;

  beforeAll(async () => {
    // Create app with timeout to prevent hangs
    app = await withTimeout(createE2EApp({ imports: [AppModule] }), {
      ms: 60_000,
      label: 'createE2EApp',
    });

    // Login as different roles
    ownerLogin = await loginAs(app, 'owner');
    ownerToken = ownerLogin.accessToken;
    
    const managerLogin = await loginAs(app, 'manager');
    managerToken = managerLogin.accessToken;
    
    const waiterLogin = await loginAs(app, 'waiter');
    waiterToken = waiterLogin.accessToken;
  }, 120_000);

  afterAll(async () => {
    await cleanup(app);
  });

  // =========================================================================
  // A) API KEY MANAGEMENT (OWNER-exclusive)
  // =========================================================================
  describe('A) API Key Management (OWNER-exclusive)', () => {
    describe('POST /ops/apikeys - Create API Key', () => {
      it('OWNER can create API key', async () => {
        const response = await request(app.getHttpServer())
          .post('/ops/apikeys')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ name: 'test-key', scopes: ['read'] });

        // Should succeed or return validation error (not 403)
        expect([200, 201, 400]).toContain(response.status);
        expect(response.status).not.toBe(403);
      });

      it('MANAGER (L4) gets 403 - insufficient capability', async () => {
        const response = await request(app.getHttpServer())
          .post('/ops/apikeys')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ name: 'test-key', scopes: ['read'] });

        expect(response.status).toBe(403);
      });

      it('WAITER (L1) gets 403 - insufficient capability', async () => {
        const response = await request(app.getHttpServer())
          .post('/ops/apikeys')
          .set('Authorization', `Bearer ${waiterToken}`)
          .send({ name: 'test-key', scopes: ['read'] });

        expect(response.status).toBe(403);
      });
    });

    describe('GET /ops/apikeys - List API Keys', () => {
      it('OWNER can list API keys', async () => {
        const response = await request(app.getHttpServer())
          .get('/ops/apikeys')
          .set('Authorization', `Bearer ${ownerToken}`);

        expect([200, 201, 204]).toContain(response.status);
        expect(response.status).not.toBe(403);
      });

      it('MANAGER (L4) gets 403', async () => {
        const response = await request(app.getHttpServer())
          .get('/ops/apikeys')
          .set('Authorization', `Bearer ${managerToken}`);

        expect(response.status).toBe(403);
      });

      it('WAITER (L1) gets 403', async () => {
        const response = await request(app.getHttpServer())
          .get('/ops/apikeys')
          .set('Authorization', `Bearer ${waiterToken}`);

        expect(response.status).toBe(403);
      });
    });

    describe('DELETE /ops/apikeys/:id - Delete API Key', () => {
      it('MANAGER (L4) gets 403 on delete attempt', async () => {
        const response = await request(app.getHttpServer())
          .delete('/ops/apikeys/fake-key-id')
          .set('Authorization', `Bearer ${managerToken}`);

        // Should be 403, not 404 (permission check before resource check)
        expect(response.status).toBe(403);
      });
    });
  });

  // =========================================================================
  // B) BILLING MANAGEMENT (OWNER-exclusive)
  // =========================================================================
  describe('B) Billing Management (OWNER-exclusive)', () => {
    describe('POST /billing/plan/change', () => {
      it('OWNER can attempt plan change', async () => {
        const response = await request(app.getHttpServer())
          .post('/billing/plan/change')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ planCode: 'pro' });

        // Accept any status except 403 (may fail for other reasons)
        // 400 = invalid plan, 422 = demo protection, 500 = no stripe
        expect(response.status).not.toBe(403);
      });

      it('MANAGER (L4) gets 403', async () => {
        const response = await request(app.getHttpServer())
          .post('/billing/plan/change')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ planCode: 'pro' });

        expect(response.status).toBe(403);
      });

      it('WAITER (L1) gets 403', async () => {
        const response = await request(app.getHttpServer())
          .post('/billing/plan/change')
          .set('Authorization', `Bearer ${waiterToken}`)
          .send({ planCode: 'pro' });

        expect(response.status).toBe(403);
      });
    });

    describe('POST /billing/cancel', () => {
      it('MANAGER (L4) gets 403 on cancel attempt', async () => {
        const response = await request(app.getHttpServer())
          .post('/billing/cancel')
          .set('Authorization', `Bearer ${managerToken}`);

        expect(response.status).toBe(403);
      });
    });
  });

  // =========================================================================
  // C) PAYROLL POST (OWNER-exclusive)
  // =========================================================================
  describe('C) Payroll Post (OWNER-exclusive)', () => {
    describe('POST /workforce/payroll-runs/:id/post', () => {
      it('MANAGER (L4) gets 403 on payroll post attempt', async () => {
        // Use fake ID - should get 403 before reaching resource validation
        const response = await request(app.getHttpServer())
          .post('/workforce/payroll-runs/fake-run-id/post')
          .set('Authorization', `Bearer ${managerToken}`);

        expect(response.status).toBe(403);
      });

      it('WAITER (L1) gets 403 on payroll post attempt', async () => {
        const response = await request(app.getHttpServer())
          .post('/workforce/payroll-runs/fake-run-id/post')
          .set('Authorization', `Bearer ${waiterToken}`);

        expect(response.status).toBe(403);
      });

      it('OWNER can attempt payroll post (may fail on non-existent run)', async () => {
        const response = await request(app.getHttpServer())
          .post('/workforce/payroll-runs/fake-run-id/post')
          .set('Authorization', `Bearer ${ownerToken}`);

        // Should NOT be 403 - should be 404 or 400 (run not found)
        expect([400, 404, 500]).toContain(response.status);
        expect(response.status).not.toBe(403);
      });
    });
  });

  // =========================================================================
  // D) REMITTANCE SUBMIT (OWNER-exclusive)
  // =========================================================================
  describe('D) Remittance Submit (OWNER-exclusive)', () => {
    describe('POST /orgs/:orgId/remittances/:id/post', () => {
      it('MANAGER (L4) gets 403 on remittance post attempt', async () => {
        const orgId = ownerLogin.user.orgId;
        const response = await request(app.getHttpServer())
          .post(`/orgs/${orgId}/remittances/fake-batch-id/post`)
          .set('Authorization', `Bearer ${managerToken}`);

        expect(response.status).toBe(403);
      });

      it('WAITER (L1) gets 403 on remittance post attempt', async () => {
        const orgId = ownerLogin.user.orgId;
        const response = await request(app.getHttpServer())
          .post(`/orgs/${orgId}/remittances/fake-batch-id/post`)
          .set('Authorization', `Bearer ${waiterToken}`);

        expect(response.status).toBe(403);
      });
    });
  });

  // =========================================================================
  // E) PERIOD REOPEN (OWNER-exclusive)
  // =========================================================================
  describe('E) Period Reopen (OWNER-exclusive)', () => {
    describe('POST /inventory/periods/:id/reopen', () => {
      it('MANAGER (L4) gets 403 on period reopen attempt', async () => {
        const response = await request(app.getHttpServer())
          .post('/inventory/periods/fake-period-id/reopen')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ reason: 'Test reopen reason' });

        expect(response.status).toBe(403);
      });

      it('WAITER (L1) gets 403 on period reopen attempt', async () => {
        const response = await request(app.getHttpServer())
          .post('/inventory/periods/fake-period-id/reopen')
          .set('Authorization', `Bearer ${waiterToken}`)
          .send({ reason: 'Test reopen reason' });

        expect(response.status).toBe(403);
      });

      it('OWNER can attempt period reopen (may fail on non-existent period)', async () => {
        const response = await request(app.getHttpServer())
          .post('/inventory/periods/fake-period-id/reopen')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ reason: 'Test reopen reason' });

        // Should NOT be 403 - should be 404 (period not found)
        expect([400, 404, 500]).toContain(response.status);
        expect(response.status).not.toBe(403);
      });
    });
  });

  // =========================================================================
  // F) AUTH BASELINE - 401 without token
  // =========================================================================
  describe('F) Auth Baseline - 401 without token', () => {
    it('POST /ops/apikeys requires authentication', async () => {
      const response = await request(app.getHttpServer())
        .post('/ops/apikeys')
        .send({ name: 'test', scopes: [] });

      expect(response.status).toBe(401);
    });

    it('POST /billing/plan/change requires authentication', async () => {
      const response = await request(app.getHttpServer())
        .post('/billing/plan/change')
        .send({ planCode: 'pro' });

      expect(response.status).toBe(401);
    });

    it('POST /workforce/payroll-runs/:id/post requires authentication', async () => {
      const response = await request(app.getHttpServer())
        .post('/workforce/payroll-runs/fake-id/post');

      expect(response.status).toBe(401);
    });
  });
});
