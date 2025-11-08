import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { createHmac } from 'crypto';
import { WebhookVerificationGuard } from './webhook-verification.guard';
import { RedisService } from './redis.service';

describe('WebhookVerificationGuard (E24)', () => {
  let guard: WebhookVerificationGuard;

  const mockRedisService = {
    exists: jest.fn(),
    set: jest.fn(),
  };

  const WH_SECRET = 'test-webhook-secret-key';

  beforeEach(async () => {
    process.env.WH_SECRET = WH_SECRET;
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookVerificationGuard,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    guard = module.get<WebhookVerificationGuard>(WebhookVerificationGuard);

    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.WH_SECRET;
  });

  const createMockExecutionContext = (headers: any, body: any, rawBody?: string): ExecutionContext => {
    const request = {
      headers: headers || {},
      body: body || {},
      rawBody: rawBody !== undefined ? rawBody : JSON.stringify(body || {}),
      on: jest.fn(),
    };

    const response = {};

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ExecutionContext;
  };

  const generateValidSignature = (timestamp: string, rawBody: string): string => {
    const payload = `${timestamp}.${rawBody}`;
    return createHmac('sha256', WH_SECRET).update(payload).digest('hex');
  };

  describe('Valid webhook requests', () => {
    it('should allow valid webhook with correct signature, timestamp, and unique ID', async () => {
      const timestamp = Date.now().toString();
      const body = { event: 'invoice.paid', id: 'evt_123' };
      const rawBody = JSON.stringify(body);
      const signature = generateValidSignature(timestamp, rawBody);
      const requestId = 'test-request-123';

      mockRedisService.exists.mockResolvedValue(false);
      mockRedisService.set.mockResolvedValue(undefined);

      const context = createMockExecutionContext(
        {
          'x-sig': signature,
          'x-ts': timestamp,
          'x-id': requestId,
        },
        body,
        rawBody,
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRedisService.exists).toHaveBeenCalledWith(`wh:replay:${requestId}`);
      expect(mockRedisService.set).toHaveBeenCalledWith(
        `wh:replay:${requestId}`,
        '1',
        24 * 3600,
      );
    });

    it('should allow webhook with timestamp at the edge of 5-minute window', async () => {
      const timestamp = (Date.now() - 4 * 60 * 1000).toString(); // 4 minutes ago
      const body = { test: 'data' };
      const rawBody = JSON.stringify(body);
      const signature = generateValidSignature(timestamp, rawBody);

      mockRedisService.exists.mockResolvedValue(false);
      mockRedisService.set.mockResolvedValue(undefined);

      const context = createMockExecutionContext(
        {
          'x-sig': signature,
          'x-ts': timestamp,
          'x-id': 'test-edge-case',
        },
        body,
        rawBody,
      );

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('Invalid signatures', () => {
    it('should reject webhook with invalid signature', async () => {
      const timestamp = Date.now().toString();
      const body = { event: 'test' };
      const rawBody = JSON.stringify(body);
      const wrongSignature = 'invalid-signature-hex';

      mockRedisService.exists.mockResolvedValue(false);

      const context = createMockExecutionContext(
        {
          'x-sig': wrongSignature,
          'x-ts': timestamp,
          'x-id': 'test-invalid-sig',
        },
        body,
        rawBody,
      );

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('should reject webhook with tampered body', async () => {
      const timestamp = Date.now().toString();
      const originalBody = { amount: 100 };
      const tamperedBody = { amount: 1000 }; // Attacker changed amount
      const signature = generateValidSignature(timestamp, JSON.stringify(originalBody));

      mockRedisService.exists.mockResolvedValue(false);

      const context = createMockExecutionContext(
        {
          'x-sig': signature,
          'x-ts': timestamp,
          'x-id': 'test-tampered',
        },
        tamperedBody,
        JSON.stringify(tamperedBody), // Raw body doesn't match signature
      );

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    });
  });

  describe('Stale timestamps', () => {
    it('should reject webhook with timestamp older than 5 minutes', async () => {
      const staleTimestamp = (Date.now() - 6 * 60 * 1000).toString(); // 6 minutes ago
      const body = { event: 'test' };
      const rawBody = JSON.stringify(body);
      const signature = generateValidSignature(staleTimestamp, rawBody);

      const context = createMockExecutionContext(
        {
          'x-sig': signature,
          'x-ts': staleTimestamp,
          'x-id': 'test-stale',
        },
        body,
        rawBody,
      );

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
        response: expect.objectContaining({
          message: expect.stringContaining('Timestamp outside valid window'),
        }),
      });
    });

    it('should reject webhook with future timestamp beyond 5 minutes', async () => {
      const futureTimestamp = (Date.now() + 6 * 60 * 1000).toString(); // 6 minutes in future
      const body = { event: 'test' };
      const rawBody = JSON.stringify(body);
      const signature = generateValidSignature(futureTimestamp, rawBody);

      const context = createMockExecutionContext(
        {
          'x-sig': signature,
          'x-ts': futureTimestamp,
          'x-id': 'test-future',
        },
        body,
        rawBody,
      );

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    });

    it('should reject webhook with invalid timestamp format', async () => {
      const body = { event: 'test' };
      const rawBody = JSON.stringify(body);

      const context = createMockExecutionContext(
        {
          'x-sig': 'some-signature',
          'x-ts': 'not-a-number',
          'x-id': 'test-invalid-ts',
        },
        body,
        rawBody,
      );

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
        response: expect.objectContaining({
          message: 'Invalid timestamp format',
        }),
      });
    });
  });

  describe('Replay protection', () => {
    it('should reject replay attack with duplicate request ID', async () => {
      const timestamp = Date.now().toString();
      const body = { event: 'invoice.paid' };
      const rawBody = JSON.stringify(body);
      const signature = generateValidSignature(timestamp, rawBody);
      const requestId = 'duplicate-id';

      // Simulate that this request ID was already processed
      mockRedisService.exists.mockResolvedValue(true);

      const context = createMockExecutionContext(
        {
          'x-sig': signature,
          'x-ts': timestamp,
          'x-id': requestId,
        },
        body,
        rawBody,
      );

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: expect.objectContaining({
          message: expect.stringContaining('Replay attack detected'),
          requestId: requestId,
        }),
      });

      // Should not try to store the duplicate
      expect(mockRedisService.set).not.toHaveBeenCalled();
    });

    it('should store request ID with 24-hour TTL on first request', async () => {
      const timestamp = Date.now().toString();
      const body = { event: 'test' };
      const rawBody = JSON.stringify(body);
      const signature = generateValidSignature(timestamp, rawBody);
      const requestId = 'unique-request-id';

      mockRedisService.exists.mockResolvedValue(false);
      mockRedisService.set.mockResolvedValue(undefined);

      const context = createMockExecutionContext(
        {
          'x-sig': signature,
          'x-ts': timestamp,
          'x-id': requestId,
        },
        body,
        rawBody,
      );

      await guard.canActivate(context);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        `wh:replay:${requestId}`,
        '1',
        24 * 3600, // 24 hours in seconds
      );
    });
  });

  describe('Missing headers', () => {
    it('should reject webhook missing X-Sig header', async () => {
      const context = createMockExecutionContext(
        {
          'x-ts': Date.now().toString(),
          'x-id': 'test-id',
        },
        {},
      );

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: expect.objectContaining({
          message: expect.stringContaining('Missing required headers'),
        }),
      });
    });

    it('should reject webhook missing X-Ts header', async () => {
      const context = createMockExecutionContext(
        {
          'x-sig': 'some-signature',
          'x-id': 'test-id',
        },
        {},
      );

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('should reject webhook missing X-Id header', async () => {
      const context = createMockExecutionContext(
        {
          'x-sig': 'some-signature',
          'x-ts': Date.now().toString(),
        },
        {},
      );

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });

  describe('Server configuration', () => {
    it('should reject webhook when WH_SECRET is not configured', async () => {
      delete process.env.WH_SECRET;

      const timestamp = Date.now().toString();
      const context = createMockExecutionContext(
        {
          'x-sig': 'some-signature',
          'x-ts': timestamp,
          'x-id': 'test-id',
        },
        {},
      );

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        response: expect.objectContaining({
          message: expect.stringContaining('webhook secret not set'),
        }),
      });
    });

    it('should reject webhook when raw body is not available', async () => {
      const timestamp = Date.now().toString();
      const body = { event: 'test' };
      
      // Create context where rawBody is explicitly undefined (not just empty string)
      const request = {
        headers: {
          'x-sig': 'test-signature',
          'x-ts': timestamp,
          'x-id': 'test-id',
        },
        body: body,
        // rawBody explicitly undefined
        on: jest.fn(),
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({}),
        }),
      } as ExecutionContext;

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        response: expect.objectContaining({
          message: expect.stringContaining('Raw body not available'),
        }),
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty request body', async () => {
      const timestamp = Date.now().toString();
      const rawBody = '';
      const signature = generateValidSignature(timestamp, rawBody);

      mockRedisService.exists.mockResolvedValue(false);
      mockRedisService.set.mockResolvedValue(undefined);

      const context = createMockExecutionContext(
        {
          'x-sig': signature,
          'x-ts': timestamp,
          'x-id': 'test-empty-body',
        },
        {},
        rawBody,
      );

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should be case-insensitive for header names', async () => {
      const timestamp = Date.now().toString();
      const body = { event: 'test' };
      const rawBody = JSON.stringify(body);
      const signature = generateValidSignature(timestamp, rawBody);

      mockRedisService.exists.mockResolvedValue(false);
      mockRedisService.set.mockResolvedValue(undefined);

      // Create request with mixed-case headers
      const request = {
        headers: {
          'X-Sig': signature, // Uppercase X
          'x-ts': timestamp,  // Lowercase x
          'X-Id': 'test-case-insensitive', // Uppercase X
        },
        body: body,
        rawBody: rawBody,
        on: jest.fn(),
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({}),
        }),
      } as ExecutionContext;

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });
});
