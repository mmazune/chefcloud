/**
 * E2E Test Mocks
 * Common mocks for E2E tests to bypass external dependencies
 */

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * Mock Redis Service - provides no-op implementations
 */
export const MockRedisService = {
  get: jest.fn().mockResolvedValue(null),
  setEx: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  sMembers: jest.fn().mockResolvedValue([]),
  sAdd: jest.fn().mockResolvedValue(1),
  sRem: jest.fn().mockResolvedValue(1),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
};

/**
 * Mock Metrics Service - disabled for E2E
 */
export const MockMetricsService = {
  enabled: false,
  recordMetric: jest.fn(),
  incrementCounter: jest.fn(),
  recordHistogram: jest.fn(),
};

/**
 * Mock Readiness Service - always returns healthy
 */
export const MockReadinessService = {
  check: jest.fn().mockResolvedValue({
    ok: true,
    details: { db: 'skipped', redis: 'skipped', env: 'ok' },
  }),
};

/**
 * E2E Auth Bypass Guard
 * Accepts any request with "Bearer TEST_TOKEN" header
 * Used to bypass authentication in E2E tests
 */
@Injectable()
export class E2EBypassAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const auth = (req.headers?.authorization ?? '') as string;
    return auth === 'Bearer TEST_TOKEN';
  }
}
