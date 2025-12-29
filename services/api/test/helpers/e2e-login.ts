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
import * as request from 'supertest';
import { E2E_USERS, TAPAS_CREDENTIALS, CAFESSERIE_CREDENTIALS } from './e2e-credentials';

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
 * @param org - Optional org selector ('tapas' or 'cafesserie'), defaults to 'tapas'
 * @returns Login result with access token and user info
 * @throws Error if login fails with descriptive message
 */
export async function loginAs(
  app: INestApplication,
  role: keyof typeof E2E_USERS,
  org: 'tapas' | 'cafesserie' = 'tapas',
): Promise<LoginResult> {
  const credentials = org === 'cafesserie' 
    ? CAFESSERIE_CREDENTIALS[role]
    : TAPAS_CREDENTIALS[role];

  if (!credentials) {
    throw new Error(
      `E2E Login Helper: No credentials found for role "${role}" in org "${org}". ` +
      `Available roles: ${Object.keys(E2E_USERS).join(', ')}`
    );
  }

  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email: credentials.email,
      password: credentials.password,
    })
    .expect((res) => {
      if (res.status !== 200) {
        throw new Error(
          `E2E Login Helper: Login failed for ${credentials.email}\n` +
          `Expected: 200 OK\n` +
          `Received: ${res.status} ${res.statusText}\n` +
          `Response: ${JSON.stringify(res.body, null, 2)}\n` +
          `\nPossible causes:\n` +
          `1. Database not seeded (run: pnpm prisma db seed)\n` +
          `2. Wrong credentials (check prisma/demo/constants.ts)\n` +
          `3. Auth endpoint changed (check src/auth/auth.controller.ts)`
        );
      }
    });

  if (!response.body.accessToken) {
    throw new Error(
      `E2E Login Helper: Response missing accessToken for ${credentials.email}\n` +
      `Response: ${JSON.stringify(response.body, null, 2)}`
    );
  }

  return {
    accessToken: response.body.accessToken,
    refreshToken: response.body.refreshToken,
    user: response.body.user,
  };
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
 * @param orgSlug - Organization slug ('tapas-bar' or 'cafesserie')
 * @returns Object with Authorization and x-org-id headers
 */
export function getAuthHeadersWithOrg(
  token: string,
  orgSlug: string,
): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'x-org-id': orgSlug,
  };
}

/**
 * Quick login for owner role (most common case)
 * 
 * @param app - NestJS application instance
 * @param org - Optional org selector, defaults to 'tapas'
 * @returns Access token string
 */
export async function loginAsOwner(
  app: INestApplication,
  org: 'tapas' | 'cafesserie' = 'tapas',
): Promise<string> {
  const result = await loginAs(app, 'owner', org);
  return result.accessToken;
}

/**
 * Quick login for manager role (second most common)
 * 
 * @param app - NestJS application instance
 * @param org - Optional org selector, defaults to 'tapas'
 * @returns Access token string
 */
export async function loginAsManager(
  app: INestApplication,
  org: 'tapas' | 'cafesserie' = 'tapas',
): Promise<string> {
  const result = await loginAs(app, 'manager', org);
  return result.accessToken;
}
