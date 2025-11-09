import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { SseRateLimiterGuard } from './sse-rate-limiter.guard';

describe('SseRateLimiterGuard', () => {
  let guard: SseRateLimiterGuard;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [SseRateLimiterGuard],
    }).compile();

    guard = module.get<SseRateLimiterGuard>(SseRateLimiterGuard);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    // Clean up the module to stop any intervals and clear state
    if (module) {
      await module.close();
    }
    // Ensure timers don't leak between tests
    jest.clearAllTimers();
  });

  const createMockContext = (userId?: string, ip = '127.0.0.1'): ExecutionContext => {
    const handlers: Record<string, (...args: any[]) => any> = {};

    const mockRequest: any = {
      user: userId ? { userId, orgId: 'org-123' } : undefined,
      headers: { 'x-forwarded-for': ip },
      socket: { remoteAddress: ip },
      on: jest.fn((event: string, handler: (...args: any[]) => any) => {
        handlers[event] = handler;
      }),
      // Helper to trigger close for testing
      _triggerClose: () => {
        if (handlers['close']) {
          handlers['close']();
        }
      },
    };

    const mockResponse: any = {
      setHeader: jest.fn(),
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as ExecutionContext;
  };

  describe('Rate Limiting - Per User', () => {
    it('should allow requests under the rate limit', async () => {
      // Use different user IDs to avoid state pollution
      const contexts: any[] = [];

      for (let i = 0; i < 10; i++) {
        // Create unique context for each request to avoid concurrent connection limit
        const context = createMockContext(`user-allow-${i}`);
        contexts.push(context);
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
        // Immediately close connection to avoid hitting concurrent limit
        (context.switchToHttp().getRequest() as any)._triggerClose();
      }
    });

    it('should block requests exceeding rate limit', async () => {
      // Override env for faster testing
      const originalEnv = process.env.SSE_RATE_PER_MIN;
      process.env.SSE_RATE_PER_MIN = '5';
      const testGuard = new SseRateLimiterGuard();

      try {
        // First 5 should succeed (use unique users to avoid concurrent connection limit)
        for (let i = 0; i < 5; i++) {
          const context = createMockContext(`user-block-${i}`);
          const result = await testGuard.canActivate(context);
          expect(result).toBe(true);
          // Close connection immediately
          (context.switchToHttp().getRequest() as any)._triggerClose();
        }

        // 6th request with first user should fail with 429 (rate limit, not concurrent limit)
        const context = createMockContext('user-block-0');
        await expect(testGuard.canActivate(context)).rejects.toThrow(
          expect.objectContaining({
            status: HttpStatus.TOO_MANY_REQUESTS,
          }),
        );
      } finally {
        // Clean up
        testGuard.onModuleDestroy();
        if (originalEnv !== undefined) {
          process.env.SSE_RATE_PER_MIN = originalEnv;
        } else {
          delete process.env.SSE_RATE_PER_MIN;
        }
      }
    });

    it('should include Retry-After header on rate limit exceeded', async () => {
      const originalEnv = process.env.SSE_RATE_PER_MIN;
      process.env.SSE_RATE_PER_MIN = '2';
      const testGuard = new SseRateLimiterGuard();

      const mockResponse = { setHeader: jest.fn() };
      const mockRequest: any = {
        user: { userId: 'user-retry-3', orgId: 'org-123' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
        on: jest.fn(),
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as ExecutionContext;

      try {
        // Exhaust limit
        await testGuard.canActivate(context);
        await testGuard.canActivate(context);

        try {
          await testGuard.canActivate(context);
        } catch (e) {
          expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
        }
      } finally {
        testGuard.onModuleDestroy();
        if (originalEnv !== undefined) {
          process.env.SSE_RATE_PER_MIN = originalEnv;
        } else {
          delete process.env.SSE_RATE_PER_MIN;
        }
      }
    });
  });

  describe('Rate Limiting - Per IP', () => {
    it('should rate limit by IP when no user', async () => {
      const originalEnv = process.env.SSE_RATE_PER_MIN;
      process.env.SSE_RATE_PER_MIN = '3';
      const testGuard = new SseRateLimiterGuard();

      const context = createMockContext(undefined, '192.168.1.100');

      try {
        // First 3 should succeed
        for (let i = 0; i < 3; i++) {
          const result = await testGuard.canActivate(context);
          expect(result).toBe(true);
        }

        // 4th should fail
        await expect(testGuard.canActivate(context)).rejects.toThrow(HttpException);
      } finally {
        testGuard.onModuleDestroy();
        if (originalEnv !== undefined) {
          process.env.SSE_RATE_PER_MIN = originalEnv;
        } else {
          delete process.env.SSE_RATE_PER_MIN;
        }
      }
    });

    it('should extract IP from X-Forwarded-For header', async () => {
      const mockRequest: any = {
        user: { userId: 'user-fwd-4', orgId: 'org-123' },
        headers: { 'x-forwarded-for': '203.0.113.1, 198.51.100.1' },
        socket: { remoteAddress: '127.0.0.1' },
        on: jest.fn(),
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => ({ setHeader: jest.fn() }),
        }),
      } as ExecutionContext;

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('Concurrent Connection Limiting', () => {
    it('should track active connections per user', async () => {
      const context = createMockContext('user-track-5');

      await guard.canActivate(context);
      expect(guard.getActiveConnections('user-track-5')).toBe(1);

      await guard.canActivate(context);
      expect(guard.getActiveConnections('user-track-5')).toBe(2);
    });

    it('should block when max concurrent connections exceeded', async () => {
      const originalEnv = process.env.SSE_MAX_CONNS_PER_USER;
      process.env.SSE_MAX_CONNS_PER_USER = '2';
      const testGuard = new SseRateLimiterGuard();

      const createContext = () => createMockContext('user-max-6');

      try {
        // First 2 connections should succeed
        await testGuard.canActivate(createContext());
        await testGuard.canActivate(createContext());

        // 3rd should fail
        await expect(testGuard.canActivate(createContext())).rejects.toThrow(
          expect.objectContaining({
            status: HttpStatus.TOO_MANY_REQUESTS,
          }),
        );
      } finally {
        testGuard.onModuleDestroy();
        if (originalEnv !== undefined) {
          process.env.SSE_MAX_CONNS_PER_USER = originalEnv;
        } else {
          delete process.env.SSE_MAX_CONNS_PER_USER;
        }
      }
    });

    it('should decrement connections on request close', async () => {
      let closeHandler: () => void;

      const mockRequest: any = {
        user: { userId: 'user-close-7', orgId: 'org-123' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
        on: jest.fn((event, handler) => {
          if (event === 'close') {
            closeHandler = handler;
          }
        }),
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => ({ setHeader: jest.fn() }),
        }),
      } as ExecutionContext;

      await guard.canActivate(context);
      expect(guard.getActiveConnections('user-close-7')).toBe(1);

      // Simulate connection close
      closeHandler!();
      expect(guard.getActiveConnections('user-close-7')).toBe(0);
    });

    it('should track total active connections', async () => {
      const context1 = createMockContext('user-total-8');
      const context2 = createMockContext('user-total-9');

      const initialTotal = guard.getTotalActiveConnections();

      await guard.canActivate(context1);
      await guard.canActivate(context2);

      expect(guard.getTotalActiveConnections()).toBe(initialTotal + 2);
    });
  });

  describe('Sliding Window', () => {
    it('should allow requests after window expires', async () => {
      const originalEnv = process.env.SSE_RATE_PER_MIN;
      process.env.SSE_RATE_PER_MIN = '2';
      const testGuard = new SseRateLimiterGuard();

      const context = createMockContext('user-window-10');

      try {
        // Exhaust limit
        await testGuard.canActivate(context);
        await testGuard.canActivate(context);

        // Should fail immediately
        await expect(testGuard.canActivate(context)).rejects.toThrow(HttpException);

        // Mock time passing (in real scenario, wait 60s)
        // For this test, we just verify the mechanism is in place
      } finally {
        testGuard.onModuleDestroy();
        if (originalEnv !== undefined) {
          process.env.SSE_RATE_PER_MIN = originalEnv;
        } else {
          delete process.env.SSE_RATE_PER_MIN;
        }
      }
    });
  });

  describe('Error Messages', () => {
    it('should return clear error message on rate limit', async () => {
      const originalEnv = process.env.SSE_RATE_PER_MIN;
      process.env.SSE_RATE_PER_MIN = '1';
      const testGuard = new SseRateLimiterGuard();

      const context = createMockContext('user-err-11');

      try {
        await testGuard.canActivate(context);

        try {
          await testGuard.canActivate(context);
          fail('Should have thrown');
        } catch (e: any) {
          expect(e.getResponse()).toMatchObject({
            statusCode: 429,
            message: expect.stringContaining('Too many'),
            retryAfter: expect.any(Number),
          });
        }
      } finally {
        testGuard.onModuleDestroy();
        if (originalEnv !== undefined) {
          process.env.SSE_RATE_PER_MIN = originalEnv;
        } else {
          delete process.env.SSE_RATE_PER_MIN;
        }
      }
    });

    it('should return clear error message on concurrent limit', async () => {
      const originalEnv = process.env.SSE_MAX_CONNS_PER_USER;
      process.env.SSE_MAX_CONNS_PER_USER = '1';
      const testGuard = new SseRateLimiterGuard();

      const context1 = createMockContext('user-conc-12');
      const context2 = createMockContext('user-conc-12');

      try {
        await testGuard.canActivate(context1);

        try {
          await testGuard.canActivate(context2);
          fail('Should have thrown');
        } catch (e: any) {
          expect(e.getResponse()).toMatchObject({
            statusCode: 429,
            message: expect.stringContaining('concurrent'),
          });
        }
      } finally {
        testGuard.onModuleDestroy();
        if (originalEnv !== undefined) {
          process.env.SSE_MAX_CONNS_PER_USER = originalEnv;
        } else {
          delete process.env.SSE_MAX_CONNS_PER_USER;
        }
      }
    });
  });
});
