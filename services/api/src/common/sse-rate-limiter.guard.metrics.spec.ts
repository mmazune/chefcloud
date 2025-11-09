/**
 * SSE Rate Limiter Guard Metrics Emission Test
 * Verifies Prometheus metrics are emitted for rate limit violations and connection tracking
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { SseRateLimiterGuard } from './sse-rate-limiter.guard';
import { MetricsService } from '../observability/metrics.service';

describe('SseRateLimiterGuard Metrics', () => {
  let guard: SseRateLimiterGuard;
  let metricsService: MetricsService;

  const mockRateLimitHits = { inc: jest.fn() };
  const mockSseClients = { inc: jest.fn(), dec: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SseRateLimiterGuard,
        {
          provide: MetricsService,
          useValue: {
            enabled: true,
            rateLimitHits: mockRateLimitHits,
            sseClients: mockSseClients,
          },
        },
      ],
    }).compile();

    guard = module.get<SseRateLimiterGuard>(SseRateLimiterGuard);
    metricsService = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockContext = (ip: string = '127.0.0.1'): ExecutionContext => {
    const request = {
      ip,
      headers: {},
      connection: { remoteAddress: ip },
      socket: { remoteAddress: ip },
      on: jest.fn(),
    };

    const response = {
      setHeader: jest.fn(),
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as any;
  };

  describe('Window Rate Limit Violations', () => {
    it('should emit rate limit hit metric when window limit exceeded', async () => {
      const userId = 'rate-test-user';
      const request = {
        ip: '192.168.1.1',
        headers: {},
        connection: { remoteAddress: '192.168.1.1' },
        socket: { remoteAddress: '192.168.1.1' },
        user: { userId },
        on: jest.fn(),
      };
      const response = { setHeader: jest.fn() };
      const context = {
        switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
      } as any;
      
      // Trigger 61 rapid requests (limit is 60 per minute)
      for (let i = 0; i < 61; i++) {
        try {
          await guard.canActivate(context);
        } catch (error) {
          // Expected on 61st request
          if (i === 60) {
            expect(error).toBeInstanceOf(HttpException);
            expect((error as HttpException).getStatus()).toBe(429);
          }
        }
      }

      // Should have incremented rate limit metric once (on 61st request)
      expect(mockRateLimitHits.inc).toHaveBeenCalledWith({
        route: 'sse',
        kind: 'window',
      });
    });

    it('should include descriptive error message on window rate limit', async () => {
      const userId = 'rate-test-user-2';
      const request = {
        ip: '10.0.0.1',
        headers: {},
        connection: { remoteAddress: '10.0.0.1' },
        socket: { remoteAddress: '10.0.0.1' },
        user: { userId },
        on: jest.fn(),
      };
      const response = { setHeader: jest.fn() };
      const context = {
        switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
      } as any;
      
      // Exhaust rate limit (60 requests per minute)
      for (let i = 0; i < 61; i++) {
        try {
          await guard.canActivate(context);
        } catch (error) {
          if (i === 60) {
            const httpError = error as HttpException;
            const response = httpError.getResponse() as any;
            expect(response.message).toContain('Too many SSE connection requests');
          }
        }
      }
    });
  });

  describe('Concurrent Connection Limit', () => {
    it('should emit rate limit hit metric when concurrent limit exceeded', async () => {
      const userId = 'user123';
      const contexts: ExecutionContext[] = [];
      
      // Create 3 contexts with SAME userId (limit is 2 concurrent per user)
      for (let i = 0; i < 3; i++) {
        const request = {
          ip: '192.168.1.100',
          headers: {},
          connection: { remoteAddress: '192.168.1.100' },
          socket: { remoteAddress: '192.168.1.100' },
          user: { userId },
          on: jest.fn(),
        };
        const response = {
          setHeader: jest.fn(),
        };
        contexts.push({
          switchToHttp: () => ({
            getRequest: () => request,
            getResponse: () => response,
          }),
        } as any);
      }

      // Open 2 successful connections
      await guard.canActivate(contexts[0]);
      await guard.canActivate(contexts[1]);

      // 3rd should be rejected
      try {
        await guard.canActivate(contexts[2]);
        fail('Expected rate limit exception');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(429);
        expect(mockRateLimitHits.inc).toHaveBeenCalledWith({
          route: 'sse',
          kind: 'concurrent',
        });
      }
    });
  });

  describe('SSE Client Gauge Tracking', () => {
    it('should increment sseClients gauge on successful connection', async () => {
      const request = {
        ip: '192.168.1.100',
        headers: {},
        connection: { remoteAddress: '192.168.1.100' },
        socket: { remoteAddress: '192.168.1.100' },
        user: { userId: 'user-test-1' },
        on: jest.fn(),
      };
      const response = { setHeader: jest.fn() };
      const context = {
        switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
      } as any;
      
      await guard.canActivate(context);

      expect(mockSseClients.inc).toHaveBeenCalled();
    });

    it('should decrement sseClients gauge on connection close', async () => {
      const closeHandlers: Array<() => void> = [];
      const ip = '192.168.1.200';
      const request = {
        ip,
        headers: {},
        connection: { remoteAddress: ip },
        socket: { remoteAddress: ip },
        user: { userId: 'user-test-2' },
        on: jest.fn((event, handler) => {
          if (event === 'close') {
            closeHandlers.push(handler);
          }
        }),
      };

      const response = {
        setHeader: jest.fn(),
      };

      const context = {
        switchToHttp: () => ({ 
          getRequest: () => request,
          getResponse: () => response,
        }),
      } as any;

      await guard.canActivate(context);
      
      expect(mockSseClients.inc).toHaveBeenCalled();
      expect(closeHandlers).toHaveLength(1);

      // Simulate connection close
      closeHandlers[0]();
      
      expect(mockSseClients.dec).toHaveBeenCalled();
    });

    it('should track multiple concurrent connections accurately', async () => {
      const contexts: ExecutionContext[] = [];
      const closeHandlers: Array<() => void> = [];

      // Setup 2 connections with close tracking (under limit)
      for (let i = 0; i < 2; i++) {
        const ip = `192.168.1.${i}`;
        const request = {
          ip,
          headers: {},
          connection: { remoteAddress: ip },
          socket: { remoteAddress: ip },
          user: { userId: `user-multi-${i}` },
          on: jest.fn((event, handler) => {
            if (event === 'close') {
              closeHandlers.push(handler);
            }
          }),
        };
        const response = {
          setHeader: jest.fn(),
        };
        contexts.push({
          switchToHttp: () => ({ 
            getRequest: () => request,
            getResponse: () => response,
          }),
        } as any);
      }

      // Open 2 connections
      for (const ctx of contexts) {
        await guard.canActivate(ctx);
      }

      expect(mockSseClients.inc).toHaveBeenCalledTimes(2);
      
      // Close 1 connection
      closeHandlers[0]();

      expect(mockSseClients.dec).toHaveBeenCalledTimes(1);
    });
  });

  describe('Metrics Disabled', () => {
    it('should not emit metrics when disabled', async () => {
      (metricsService as any).enabled = false;
      
      const context = createMockContext('192.168.1.50');
      await guard.canActivate(context);

      expect(mockSseClients.inc).not.toHaveBeenCalled();
      expect(mockRateLimitHits.inc).not.toHaveBeenCalled();
    });

    it('should still enforce rate limits when metrics disabled', async () => {
      (metricsService as any).enabled = false;
      
      const context = createMockContext('10.0.0.50');
      
      // Exhaust window rate limit (60 requests)
      for (let i = 0; i < 61; i++) {
        try {
          await guard.canActivate(context);
        } catch (error) {
          if (i === 60) {
            expect(error).toBeInstanceOf(HttpException);
            expect((error as HttpException).getStatus()).toBe(429);
            // Metric should NOT be emitted
            expect(mockRateLimitHits.inc).not.toHaveBeenCalled();
          }
        }
      }
    });
  });
});
