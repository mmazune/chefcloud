import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import {
  PlanRateLimiterGuard,
  PLAN_RATE_LIMITS,
  IP_RATE_LIMIT,
} from './plan-rate-limiter.guard';
import { RedisService } from './redis.service';
import { PrismaService } from '../prisma.service';

describe('PlanRateLimiterGuard', () => {
  let guard: PlanRateLimiterGuard;
  let mockRedisService: Partial<RedisService>;
  let mockPrismaService: Partial<PrismaService>;

  beforeEach(async () => {
    // Mock Redis to throw errors so guard falls back to in-memory store
    mockRedisService = {
      get: jest.fn().mockRejectedValue(new Error('Redis unavailable in tests')),
      set: jest.fn().mockRejectedValue(new Error('Redis unavailable in tests')),
    };

    mockPrismaService = {
      org: {
        findUnique: jest.fn(),
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanRateLimiterGuard,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    guard = module.get<PlanRateLimiterGuard>(PlanRateLimiterGuard);
    guard.resetMetrics();
  });

  afterEach(() => {
    guard.onModuleDestroy();
  });

  const createMockContext = (user: any, ip: string, route: string): ExecutionContext => {
    const request = {
      user,
      ip,
      headers: {},
      baseUrl: '',
      path: route,
      socket: { remoteAddress: ip },
    };

    const response = {
      setHeader: jest.fn(),
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ExecutionContext;
  };

  describe('Plan-aware rate limiting', () => {
    it('should allow requests within free tier limit (10/min)', async () => {
      const user = { userId: 'user-1', orgId: 'org-1' };
      (mockPrismaService.org!.findUnique as jest.Mock).mockResolvedValue({
        id: 'org-1',
        subscription: {
          plan: { code: 'free' },
        },
      });

      const context = createMockContext(user, '192.168.1.1', '/billing/plan/change');

      // First 10 requests should succeed
      for (let i = 0; i < PLAN_RATE_LIMITS.free; i++) {
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      }
    });

    it('should block requests exceeding free tier limit', async () => {
      const user = { userId: 'user-2', orgId: 'org-2' };
      (mockPrismaService.org!.findUnique as jest.Mock).mockResolvedValue({
        id: 'org-2',
        subscription: {
          plan: { code: 'free' },
        },
      });

      const context = createMockContext(user, '192.168.1.2', '/billing/plan/change');

      // Exhaust free tier limit
      for (let i = 0; i < PLAN_RATE_LIMITS.free; i++) {
        await guard.canActivate(context);
      }

      // Next request should be blocked
      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
        response: expect.objectContaining({
          plan: 'free',
          limit: PLAN_RATE_LIMITS.free,
          window: 60,
        }),
      });
    });

    it('should allow more requests for pro tier (60/min)', async () => {
      const user = { userId: 'user-3', orgId: 'org-3' };
      (mockPrismaService.org!.findUnique as jest.Mock).mockResolvedValue({
        id: 'org-3',
        subscription: {
          plan: { code: 'pro' },
        },
      });

      const context = createMockContext(user, '192.168.1.3', '/billing/plan/change');

      // Should allow up to 60 requests
      for (let i = 0; i < PLAN_RATE_LIMITS.pro; i++) {
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      }

      // 61st request should fail
      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    });

    it('should allow enterprise tier high limits (240/min)', async () => {
      const user = { userId: 'user-4', orgId: 'org-4' };
      (mockPrismaService.org!.findUnique as jest.Mock).mockResolvedValue({
        id: 'org-4',
        subscription: {
          plan: { code: 'enterprise' },
        },
      });

      const context = createMockContext(user, '192.168.1.4', '/billing/plan/change');

      // Should allow many more requests
      for (let i = 0; i < 50; i++) {
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      }
    });

    it('should default to free tier if no subscription found', async () => {
      const user = { userId: 'user-5', orgId: 'org-5' };
      (mockPrismaService.org!.findUnique as jest.Mock).mockResolvedValue({
        id: 'org-5',
        subscription: null,
      });

      const context = createMockContext(user, '192.168.1.5', '/billing/plan/change');

      // Exhaust free tier
      for (let i = 0; i < PLAN_RATE_LIMITS.free; i++) {
        await guard.canActivate(context);
      }

      // Should be limited to free tier
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: expect.objectContaining({
          plan: 'free',
        }),
      });
    });
  });

  describe('Per-IP rate limiting', () => {
    it('should enforce IP limit across different users', async () => {
      const ip = '192.168.1.100';
      (mockPrismaService.org!.findUnique as jest.Mock).mockResolvedValue({
        subscription: { plan: { code: 'enterprise' } },
      });

      // Simulate many users from same IP
      for (let i = 0; i < IP_RATE_LIMIT; i++) {
        const user = { userId: `user-${i}`, orgId: `org-${i}` };
        const context = createMockContext(user, ip, '/billing/plan/change');
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      }

      // Next request from same IP should fail
      const user = { userId: 'user-overflow', orgId: 'org-overflow' };
      const context = createMockContext(user, ip, '/billing/plan/change');
      
      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    });

    it('should extract IP from X-Forwarded-For header', async () => {
      const user = { userId: 'user-xff', orgId: 'org-xff' };
      (mockPrismaService.org!.findUnique as jest.Mock).mockResolvedValue({
        subscription: { plan: { code: 'free' } },
      });

      const request = {
        user,
        ip: '10.0.0.1',
        headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' },
        baseUrl: '',
        path: '/billing/plan/change',
        socket: { remoteAddress: '10.0.0.1' },
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({ setHeader: jest.fn() }),
        }),
      } as ExecutionContext;

      await guard.canActivate(context);
      
      // Should use first IP from X-Forwarded-For
      expect(mockRedisService.get).toHaveBeenCalledWith(
        expect.stringContaining('203.0.113.1'),
      );
    });
  });

  describe('Route isolation', () => {
    it('should track limits separately per route', async () => {
      const user = { userId: 'user-route', orgId: 'org-route' };
      (mockPrismaService.org!.findUnique as jest.Mock).mockResolvedValue({
        subscription: { plan: { code: 'free' } },
      });

      // Exhaust limit on route 1
      for (let i = 0; i < PLAN_RATE_LIMITS.free; i++) {
        const context = createMockContext(user, '192.168.1.50', '/billing/plan/change');
        await guard.canActivate(context);
      }

      // Should still allow requests on route 2
      const context2 = createMockContext(user, '192.168.1.50', '/billing/cancel');
      const result = await guard.canActivate(context2);
      expect(result).toBe(true);
    });
  });

  describe('Authentication requirement', () => {
    it('should reject unauthenticated requests', async () => {
      const context = createMockContext(null, '192.168.1.1', '/billing/plan/change');

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('should reject requests without userId', async () => {
      const user = { orgId: 'org-1' }; // Missing userId
      const context = createMockContext(user, '192.168.1.1', '/billing/plan/change');

      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
    });
  });

  describe('Retry-After header', () => {
    it('should include Retry-After header in 429 response', async () => {
      const user = { userId: 'user-retry', orgId: 'org-retry' };
      (mockPrismaService.org!.findUnique as jest.Mock).mockResolvedValue({
        subscription: { plan: { code: 'free' } },
      });

      const context = createMockContext(user, '192.168.1.60', '/billing/plan/change');

      // Exhaust limit
      for (let i = 0; i < PLAN_RATE_LIMITS.free; i++) {
        await guard.canActivate(context);
      }

      try {
        await guard.canActivate(context);
        fail('Should have thrown HttpException');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        const httpError = error as HttpException;
        expect(httpError.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(httpError.getResponse()).toMatchObject({
          retryAfter: 60,
        });
      }
    });
  });

  describe('Metrics', () => {
    it('should increment rate limit hit metrics', async () => {
      const user = { userId: 'user-metrics', orgId: 'org-metrics' };
      (mockPrismaService.org!.findUnique as jest.Mock).mockResolvedValue({
        subscription: { plan: { code: 'free' } },
      });

      const context = createMockContext(user, '192.168.1.70', '/billing/plan/change');

      // Exhaust limit
      for (let i = 0; i < PLAN_RATE_LIMITS.free; i++) {
        await guard.canActivate(context);
      }

      // Trigger rate limit
      try {
        await guard.canActivate(context);
      } catch {
        // Expected
      }

      const metrics = guard.getMetrics();
      expect(metrics.size).toBeGreaterThan(0);
      expect(Array.from(metrics.values())[0]).toBeGreaterThan(0);
    });

    it('should reset metrics when requested', async () => {
      const user = { userId: 'user-reset', orgId: 'org-reset' };
      (mockPrismaService.org!.findUnique as jest.Mock).mockResolvedValue({
        subscription: { plan: { code: 'free' } },
      });

      const context = createMockContext(user, '192.168.1.80', '/billing/plan/change');

      // Trigger some rate limits
      for (let i = 0; i < PLAN_RATE_LIMITS.free + 1; i++) {
        try {
          await guard.canActivate(context);
        } catch {
          // Expected
        }
      }

      expect(guard.getMetrics().size).toBeGreaterThan(0);

      guard.resetMetrics();
      expect(guard.getMetrics().size).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('should fail open if rate limiter has errors', async () => {
      const user = { userId: 'user-error', orgId: 'org-error' };
      
      // Simulate database error
      (mockPrismaService.org!.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database connection failed'),
      );

      const context = createMockContext(user, '192.168.1.90', '/billing/plan/change');

      // Should allow request despite error (fail open)
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent requests correctly', async () => {
      const user = { userId: 'user-concurrent', orgId: 'org-concurrent' };
      (mockPrismaService.org!.findUnique as jest.Mock).mockResolvedValue({
        subscription: { plan: { code: 'free' } },
      });

      const context = createMockContext(user, '192.168.1.95', '/billing/plan/change');

      // Fire concurrent requests
      const promises = Array.from({ length: 15 }, () => guard.canActivate(context));
      const results = await Promise.allSettled(promises);

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      // Should allow exactly up to the limit
      expect(successful).toBeLessThanOrEqual(PLAN_RATE_LIMITS.free);
      expect(failed).toBeGreaterThan(0);
      expect(successful + failed).toBe(15);
    });
  });
});
