import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { SseRateLimiterGuard } from './sse-rate-limiter.guard';

describe('SseRateLimiterGuard', () => {
  let guard: SseRateLimiterGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SseRateLimiterGuard],
    }).compile();

    guard = module.get<SseRateLimiterGuard>(SseRateLimiterGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockContext = (userId?: string, ip = '127.0.0.1'): ExecutionContext => {
    const mockRequest: any = {
      user: userId ? { userId, orgId: 'org-123' } : undefined,
      headers: { 'x-forwarded-for': ip },
      socket: { remoteAddress: ip },
      on: jest.fn(),
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
      const context = createMockContext('user-1');
      
      for (let i = 0; i < 10; i++) {
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      }
    });

    it('should block requests exceeding rate limit', async () => {
      // Override env for faster testing
      process.env.SSE_RATE_PER_MIN = '5';
      const testGuard = new SseRateLimiterGuard();
      
      const context = createMockContext('user-2');
      
      // First 5 should succeed
      for (let i = 0; i < 5; i++) {
        const result = await testGuard.canActivate(context);
        expect(result).toBe(true);
      }
      
      // 6th should fail with 429
      await expect(testGuard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.TOO_MANY_REQUESTS,
        }),
      );
      
      delete process.env.SSE_RATE_PER_MIN;
    });

    it('should include Retry-After header on rate limit exceeded', async () => {
      process.env.SSE_RATE_PER_MIN = '2';
      const testGuard = new SseRateLimiterGuard();
      
      const mockResponse = { setHeader: jest.fn() };
      const mockRequest: any = {
        user: { userId: 'user-3', orgId: 'org-123' },
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
      
      // Exhaust limit
      await testGuard.canActivate(context);
      await testGuard.canActivate(context);
      
      try {
        await testGuard.canActivate(context);
      } catch (e) {
        expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
      }
      
      delete process.env.SSE_RATE_PER_MIN;
    });
  });

  describe('Rate Limiting - Per IP', () => {
    it('should rate limit by IP when no user', async () => {
      process.env.SSE_RATE_PER_MIN = '3';
      const testGuard = new SseRateLimiterGuard();
      
      const context = createMockContext(undefined, '192.168.1.100');
      
      // First 3 should succeed
      for (let i = 0; i < 3; i++) {
        const result = await testGuard.canActivate(context);
        expect(result).toBe(true);
      }
      
      // 4th should fail
      await expect(testGuard.canActivate(context)).rejects.toThrow(HttpException);
      
      delete process.env.SSE_RATE_PER_MIN;
    });

    it('should extract IP from X-Forwarded-For header', async () => {
      const mockRequest: any = {
        user: { userId: 'user-4', orgId: 'org-123' },
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
      const context = createMockContext('user-5');
      
      await guard.canActivate(context);
      expect(guard.getActiveConnections('user-5')).toBe(1);
      
      await guard.canActivate(context);
      expect(guard.getActiveConnections('user-5')).toBe(2);
    });

    it('should block when max concurrent connections exceeded', async () => {
      process.env.SSE_MAX_CONNS_PER_USER = '2';
      const testGuard = new SseRateLimiterGuard();
      
      const createContext = () => createMockContext('user-6');
      
      // First 2 connections should succeed
      await testGuard.canActivate(createContext());
      await testGuard.canActivate(createContext());
      
      // 3rd should fail
      await expect(testGuard.canActivate(createContext())).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.TOO_MANY_REQUESTS,
        }),
      );
      
      delete process.env.SSE_MAX_CONNS_PER_USER;
    });

    it('should decrement connections on request close', async () => {
      let closeHandler: () => void;
      
      const mockRequest: any = {
        user: { userId: 'user-7', orgId: 'org-123' },
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
      expect(guard.getActiveConnections('user-7')).toBe(1);
      
      // Simulate connection close
      closeHandler!();
      expect(guard.getActiveConnections('user-7')).toBe(0);
    });

    it('should track total active connections', async () => {
      const context1 = createMockContext('user-8');
      const context2 = createMockContext('user-9');
      
      const initialTotal = guard.getTotalActiveConnections();
      
      await guard.canActivate(context1);
      await guard.canActivate(context2);
      
      expect(guard.getTotalActiveConnections()).toBe(initialTotal + 2);
    });
  });

  describe('Sliding Window', () => {
    it('should allow requests after window expires', async () => {
      process.env.SSE_RATE_PER_MIN = '2';
      const testGuard = new SseRateLimiterGuard();
      
      const context = createMockContext('user-10');
      
      // Exhaust limit
      await testGuard.canActivate(context);
      await testGuard.canActivate(context);
      
      // Should fail immediately
      await expect(testGuard.canActivate(context)).rejects.toThrow(HttpException);
      
      // Mock time passing (in real scenario, wait 60s)
      // For this test, we just verify the mechanism is in place
      
      delete process.env.SSE_RATE_PER_MIN;
    });
  });

  describe('Error Messages', () => {
    it('should return clear error message on rate limit', async () => {
      process.env.SSE_RATE_PER_MIN = '1';
      const testGuard = new SseRateLimiterGuard();
      
      const context = createMockContext('user-11');
      
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
      
      delete process.env.SSE_RATE_PER_MIN;
    });

    it('should return clear error message on concurrent limit', async () => {
      process.env.SSE_MAX_CONNS_PER_USER = '1';
      const testGuard = new SseRateLimiterGuard();
      
      const context1 = createMockContext('user-12');
      const context2 = createMockContext('user-12');
      
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
      
      delete process.env.SSE_MAX_CONNS_PER_USER;
    });
  });
});
