/**
 * E2E Login Helper - Centralized Authentication for All Tests
 *
 * Provides shared login functionality to eliminate duplicate login code
 * and ensure consistent authentication across all E2E tests.
 *
 * Usage:
 *   const token = await loginAs(app, 'owner');
 *   const headers = getAuthHeaders(token);
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  E2E_USERS,
  TAPAS_CREDENTIALS,
  CAFESSERIE_CREDENTIALS,
  DEMO_DATASETS,
} from './e2e-credentials';
import { trace, traceSpan } from './e2e-trace';

export type DatasetType = 'tapas' | 'cafesserie';

/**
 * Get dataset configuration by name
 */
export function getDataset(type: DatasetType) {
  return type === 'cafesserie' ? DEMO_DATASETS.DEMO_CAFESSERIE_FRANCHISE : DEMO_DATASETS.DEMO_TAPAS;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roleLevel: string;
    orgId: string;
    branchId?: string;
  };
}

/**
 * Login as a specific demo user role
 *
 * @param app - NestJS application instance
 * @param role - User role ('owner', 'manager', 'cashier', etc.)
 * @param dataset - Dataset selector ('tapas' or 'cafesserie'), defaults to 'tapas'
 * @returns Login result with access token and user info
 * @throws Error if login fails with descriptive message
 */
export async function loginAs(
  app: INestApplication,
  role: keyof typeof E2E_USERS,
  dataset: DatasetType = 'tapas',
): Promise<LoginResult> {
  return traceSpan(`loginAs(${role}, ${dataset})`, async () => {
    const credentials =
      dataset === 'cafesserie' ? CAFESSERIE_CREDENTIALS[role] : TAPAS_CREDENTIALS[role];

    if (!credentials) {
      const availableRoles = Object.keys(
        dataset === 'cafesserie' ? CAFESSERIE_CREDENTIALS : TAPAS_CREDENTIALS,
      ).join(', ');
      throw new Error(
        `E2E Login Helper: No credentials found for role "${role}" in dataset "${dataset}". ` +
          `Available roles for ${dataset}: ${availableRoles}`,
      );
    }

    trace('sending login request', { email: credentials.email, dataset });
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: credentials.email,
        password: credentials.password,
      })
      .expect((res) => {
        if (res.status !== 200) {
          throw new Error(
            `E2E Login Helper: Login failed for ${credentials.email} (dataset: ${dataset})\n` +
              `Expected: 200 OK\n` +
              `Received: ${res.status} ${res.statusText}\n` +
              `Response: ${JSON.stringify(res.body, null, 2)}\n` +
              `\nPossible causes:\n` +
              `1. Database not seeded with E2E_DATASET=${dataset.toUpperCase()} (run: E2E_DATASET=ALL pnpm test:e2e:setup)\n` +
              `2. Wrong credentials (check prisma/demo/constants.ts)\n` +
              `3. Auth endpoint changed (check src/auth/auth.controller.ts)`,
          );
        }
      });

    trace('login successful');

    if (!response.body.access_token) {
      throw new Error(
        `E2E Login Helper: Response missing access_token for ${credentials.email}\n` +
          `Response: ${JSON.stringify(response.body, null, 2)}`,
      );
    }

    return {
      accessToken: response.body.access_token,
      refreshToken: response.body.refresh_token,
      user: response.body.user,
    };
  });
}

/**
 * Get authorization headers for API requests
 *
 * @param token - Access token from loginAs()
 * @returns Object with Authorization header
 */
export function getAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Get auth headers with org context
 *
 * @param token - Access token from loginAs()
 * @param orgSlug - Organization slug ('tapas-demo' or 'cafesserie-demo')
 * @returns Object with Authorization and x-org-id headers
 */
export function getAuthHeadersWithOrg(token: string, orgSlug: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'x-org-id': orgSlug,
  };
}

/**
 * Quick login for owner role (most common case)
 *
 * @param app - NestJS application instance
 * @param dataset - Dataset selector, defaults to 'tapas'
 * @returns Access token string
 */
export async function loginAsOwner(
  app: INestApplication,
  dataset: DatasetType = 'tapas',
): Promise<string> {
  const result = await loginAs(app, 'owner', dataset);
  return result.accessToken;
}

/**
 * Quick login for manager role (second most common)
 *
 * @param app - NestJS application instance
 * @param dataset - Dataset selector, defaults to 'tapas'
 * @returns Access token string
 */
export async function loginAsManager(
  app: INestApplication,
  dataset: DatasetType = 'tapas',
): Promise<string> {
  const result = await loginAs(app, 'manager', dataset);
  return result.accessToken;
}
