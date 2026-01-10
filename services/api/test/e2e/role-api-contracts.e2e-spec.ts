/**
 * Role-Based API Contract Tests (J1)
 *
 * Deterministic tests derived from NavMap v2 runtime JSON files.
 * Validates RBAC enforcement at the API layer:
 * - 401 for requests without authentication token
 * - 403 for requests with wrong role (lower privilege)
 * - 2xx for requests with correct role
 *
 * Source: reports/contracts/role-api-contracts.json
 * Generated from: reports/navigation/runtime/*.runtime.json
 *
 * @see scripts/analysis/extract-role-api-contracts.mjs
 * @see docs/contracts/ROLE_API_CONTRACTS.md
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { createE2EApp } from '../helpers/e2e-bootstrap';
import { withTimeout } from '../helpers/with-timeout';
import { cleanup } from '../helpers/cleanup';
import { TAPAS_CREDENTIALS } from '../helpers/e2e-credentials';
import { loginAs } from '../helpers/e2e-login';
import * as path from 'path';
import * as fs from 'fs';

// Load contracts from the generated JSON file
const contractsPath = path.resolve(__dirname, '../../../../reports/contracts/role-api-contracts.json');
const contractData = JSON.parse(fs.readFileSync(contractsPath, 'utf-8'));

// Role to credentials key mapping (uppercase role name → TAPAS_CREDENTIALS key)
const ROLE_CREDENTIAL_MAP: Record<string, keyof typeof TAPAS_CREDENTIALS> = {
  CASHIER: 'cashier',
  WAITER: 'waiter',
  CHEF: 'chef',
  BARTENDER: 'bartender',
  SUPERVISOR: 'supervisor',
  MANAGER: 'manager',
  ACCOUNTANT: 'accountant',
};

// Protected endpoints for auth baseline tests (common to most roles)
const AUTH_BASELINE_ENDPOINTS = [
  { method: 'GET', path: '/dashboard' },
  { method: 'GET', path: '/pos/menu' },
  { method: 'GET', path: '/pos/open' },
];

// Endpoints that are MANAGER/ACCOUNTANT only (for negative RBAC tests)
const HIGH_PRIVILEGE_ENDPOINTS = [
  { method: 'GET', path: '/analytics/daily', minLevel: 4 },
  { method: 'GET', path: '/analytics/branches', minLevel: 4 },
  { method: 'GET', path: '/accounting/accounts', minLevel: 4 },
];

describe('Role API Contracts (J1)', () => {
  let app: INestApplication;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    // Create app with timeout to prevent hangs
    app = await withTimeout(createE2EApp({ imports: [AppModule] }), {
      ms: 60_000,
      label: 'createE2EApp',
    });

    // Pre-login all roles in parallel-ish fashion
    const roleKeys = Object.keys(ROLE_CREDENTIAL_MAP) as Array<keyof typeof ROLE_CREDENTIAL_MAP>;
    for (const role of roleKeys) {
      const credKey = ROLE_CREDENTIAL_MAP[role];
      const result = await loginAs(app, credKey);
      tokens[role] = result.accessToken;
    }
  }, 120_000);

  afterAll(async () => {
    await cleanup(app);
  });

  // -------------------------------------------------------------------------
  // Section A: Auth Baseline (401 without token)
  // -------------------------------------------------------------------------
  describe('A) Auth Baseline - 401 without token', () => {
    for (const endpoint of AUTH_BASELINE_ENDPOINTS) {
      it(`${endpoint.method} ${endpoint.path} requires authentication`, async () => {
        const response = await request(app.getHttpServer())
          [endpoint.method.toLowerCase() as 'get'](endpoint.path);

        expect(response.status).toBe(401);
      });
    }
  });

  // -------------------------------------------------------------------------
  // Section B: Role Allowed Endpoints (2xx for correct role)
  // -------------------------------------------------------------------------
  describe('B) Role Allowed Endpoints', () => {
    const roles = Object.keys(contractData.roles) as string[];

    for (const role of roles) {
      const roleContracts = contractData.roles[role];
      const credKey = ROLE_CREDENTIAL_MAP[role];

      if (!credKey) {
        console.warn(`No credentials mapping for role: ${role}`);
        continue;
      }

      describe(`${role} endpoints`, () => {
        // Only test GET endpoints to avoid side effects (J1 scope)
        const getEndpoints = roleContracts.endpoints.filter(
          (ep: { method: string; path: string }) => ep.method === 'GET'
        );

        for (const endpoint of getEndpoints.slice(0, 10)) {
          // Cap at 10 per role
          it(`GET ${endpoint.path} → 2xx`, async () => {
            const token = tokens[role];
            if (!token) {
              throw new Error(`No token for role ${role}`);
            }

            const response = await request(app.getHttpServer())
              .get(endpoint.path)
              .set('Authorization', `Bearer ${token}`);

            // Accept 200, 201, 204 (and 404 for parameterized paths with :id)
            if (endpoint.path.includes(':id')) {
              // Parameterized paths may return 404 (no test data) - acceptable
              expect([200, 201, 204, 404]).toContain(response.status);
            } else {
              // Non-parameterized should return success or empty
              expect([200, 201, 204]).toContain(response.status);
            }
          });
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // Section C: Negative RBAC (403 for wrong role)
  // -------------------------------------------------------------------------
  describe('C) Negative RBAC - 403 for wrong role', () => {
    // L1 roles should not access L4 endpoints
    const lowPrivilegeRoles = ['WAITER', 'BARTENDER'];

    for (const role of lowPrivilegeRoles) {
      describe(`${role} cannot access high-privilege endpoints`, () => {
        for (const endpoint of HIGH_PRIVILEGE_ENDPOINTS) {
          it(`${endpoint.method} ${endpoint.path} → 403`, async () => {
            const token = tokens[role];
            if (!token) {
              throw new Error(`No token for role ${role}`);
            }

            const response = await request(app.getHttpServer())
              .get(endpoint.path)
              .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(403);
          });
        }
      });
    }

    // CASHIER (L2) should not access L4 endpoints
    describe('CASHIER cannot access L4 endpoints', () => {
      for (const endpoint of HIGH_PRIVILEGE_ENDPOINTS) {
        it(`${endpoint.method} ${endpoint.path} → 403`, async () => {
          const token = tokens.CASHIER;
          if (!token) {
            throw new Error('No token for CASHIER');
          }

          const response = await request(app.getHttpServer())
            .get(endpoint.path)
            .set('Authorization', `Bearer ${token}`);

          expect(response.status).toBe(403);
        });
      }
    });
  });

  // -------------------------------------------------------------------------
  // Section D: Cross-Role Verification
  // -------------------------------------------------------------------------
  describe('D) Cross-Role Verification', () => {
    it('MANAGER can access analytics/daily', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/daily')
        .set('Authorization', `Bearer ${tokens.MANAGER}`);

      expect([200, 204]).toContain(response.status);
    });

    it('ACCOUNTANT can access accounting/accounts', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounting/accounts')
        .set('Authorization', `Bearer ${tokens.ACCOUNTANT}`);

      expect([200, 204]).toContain(response.status);
    });

    it('CHEF can access kds/tickets', async () => {
      const response = await request(app.getHttpServer())
        .get('/kds/tickets')
        .set('Authorization', `Bearer ${tokens.CHEF}`);

      expect([200, 204]).toContain(response.status);
    });

    it('SUPERVISOR can access workforce/swaps', async () => {
      const response = await request(app.getHttpServer())
        .get('/workforce/swaps')
        .set('Authorization', `Bearer ${tokens.SUPERVISOR}`);

      expect([200, 204]).toContain(response.status);
    });
  });
});
