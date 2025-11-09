/**
 * Webhook Verification Guard Metrics Emission Test
 * Verifies webhook_verification_total counter increments with correct result labels
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { WebhookVerificationGuard } from './webhook-verification.guard';
import { MetricsService } from '../observability/metrics.service';
import { RedisService } from './redis.service';
import { createHmac } from 'crypto';

describe('WebhookVerificationGuard Metrics', () => {
  let guard: WebhookVerificationGuard;
  let metricsService: MetricsService;
  let redisService: RedisService;

  const mockWebhookVerifications = { inc: jest.fn() };
  const SECRET = 'test-webhook-secret';

  beforeEach(async () => {
    process.env.WH_SECRET = SECRET;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookVerificationGuard,
        {
          provide: MetricsService,
          useValue: {
            enabled: true,
            webhookVerifications: mockWebhookVerifications,
          },
        },
        {
          provide: RedisService,
          useValue: {
            exists: jest.fn().mockResolvedValue(0),
            set: jest.fn().mockResolvedValue('OK'),
          },
        },
      ],
    }).compile();

    guard = module.get<WebhookVerificationGuard>(WebhookVerificationGuard);
    metricsService = module.get<MetricsService>(MetricsService);
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.WH_SECRET;
  });

  const createValidSignature = (ts: string, body: string): string => {
    const payload = `${ts}.${body}`;
    return createHmac('sha256', SECRET).update(payload).digest('hex');
  };

  const createMockContext = (headers: any, rawBody: string): ExecutionContext => {
    const request = {
      headers,
      rawBody,
      on: jest.fn(),
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  };

  describe('Successful Verification - result=ok', () => {
    it('should emit ok metric on successful webhook verification', async () => {
      const ts = Date.now().toString();
      const body = JSON.stringify({ event: 'test' });
      const sig = createValidSignature(ts, body);

      const context = createMockContext(
        { 'x-sig': sig, 'x-ts': ts, 'x-id': 'unique-123' },
        body,
      );

      jest.spyOn(redisService, 'exists').mockResolvedValue(0);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockWebhookVerifications.inc).toHaveBeenCalledWith({ result: 'ok' });
    });
  });

  describe('Missing Headers - result=bad_sig', () => {
    it('should emit bad_sig metric when X-Sig missing', async () => {
      const context = createMockContext(
        { 'x-ts': Date.now().toString(), 'x-id': 'test-id' },
        'body',
      );

      try {
        await guard.canActivate(context);
        fail('Expected exception');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(400);
        expect(mockWebhookVerifications.inc).toHaveBeenCalledWith({ result: 'bad_sig' });
      }
    });

    it('should emit bad_sig metric when X-Ts missing', async () => {
      const context = createMockContext(
        { 'x-sig': 'somesig', 'x-id': 'test-id' },
        'body',
      );

      try {
        await guard.canActivate(context);
        fail('Expected exception');
      } catch (error) {
        expect(mockWebhookVerifications.inc).toHaveBeenCalledWith({ result: 'bad_sig' });
      }
    });

    it('should emit bad_sig metric when X-Id missing', async () => {
      const context = createMockContext(
        { 'x-sig': 'somesig', 'x-ts': Date.now().toString() },
        'body',
      );

      try {
        await guard.canActivate(context);
        fail('Expected exception');
      } catch (error) {
        expect(mockWebhookVerifications.inc).toHaveBeenCalledWith({ result: 'bad_sig' });
      }
    });
  });

  describe('Invalid Timestamp Format - result=bad_sig', () => {
    it('should emit bad_sig metric for non-numeric timestamp', async () => {
      const context = createMockContext(
        { 'x-sig': 'sig', 'x-ts': 'invalid-timestamp', 'x-id': 'test-id' },
        'body',
      );

      try {
        await guard.canActivate(context);
        fail('Expected exception');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(401);
        expect(mockWebhookVerifications.inc).toHaveBeenCalledWith({ result: 'bad_sig' });
      }
    });
  });

  describe('Stale Timestamp - result=stale', () => {
    it('should emit stale metric when timestamp too old', async () => {
      const oldTs = (Date.now() - 10 * 60 * 1000).toString(); // 10 minutes ago
      const body = JSON.stringify({ event: 'test' });
      const sig = createValidSignature(oldTs, body);

      const context = createMockContext(
        { 'x-sig': sig, 'x-ts': oldTs, 'x-id': 'test-id' },
        body,
      );

      try {
        await guard.canActivate(context);
        fail('Expected exception');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(401);
        expect(mockWebhookVerifications.inc).toHaveBeenCalledWith({ result: 'stale' });
      }
    });

    it('should emit stale metric when timestamp too far in future', async () => {
      const futureTs = (Date.now() + 10 * 60 * 1000).toString(); // 10 minutes future
      const body = JSON.stringify({ event: 'test' });
      const sig = createValidSignature(futureTs, body);

      const context = createMockContext(
        { 'x-sig': sig, 'x-ts': futureTs, 'x-id': 'test-id' },
        body,
      );

      try {
        await guard.canActivate(context);
        fail('Expected exception');
      } catch (error) {
        expect(mockWebhookVerifications.inc).toHaveBeenCalledWith({ result: 'stale' });
      }
    });
  });

  describe('Invalid Signature - result=bad_sig', () => {
    it('should emit bad_sig metric when signature does not match', async () => {
      const ts = Date.now().toString();
      const body = JSON.stringify({ event: 'test' });
      const wrongSig = 'deadbeefcafe1234567890abcdef';

      const context = createMockContext(
        { 'x-sig': wrongSig, 'x-ts': ts, 'x-id': 'test-id' },
        body,
      );

      jest.spyOn(redisService, 'exists').mockResolvedValue(0);

      try {
        await guard.canActivate(context);
        fail('Expected exception');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(401);
        expect(mockWebhookVerifications.inc).toHaveBeenCalledWith({ result: 'bad_sig' });
      }
    });

    it('should emit bad_sig metric when body is tampered', async () => {
      const ts = Date.now().toString();
      const originalBody = JSON.stringify({ event: 'original' });
      const sig = createValidSignature(ts, originalBody);
      const tamperedBody = JSON.stringify({ event: 'tampered' });

      const context = createMockContext(
        { 'x-sig': sig, 'x-ts': ts, 'x-id': 'test-id' },
        tamperedBody,
      );

      jest.spyOn(redisService, 'exists').mockResolvedValue(0);

      try {
        await guard.canActivate(context);
        fail('Expected exception');
      } catch (error) {
        expect(mockWebhookVerifications.inc).toHaveBeenCalledWith({ result: 'bad_sig' });
      }
    });
  });

  describe('Replay Attack - result=replay', () => {
    it('should emit replay metric when request ID already seen', async () => {
      const ts = Date.now().toString();
      const body = JSON.stringify({ event: 'test' });
      const sig = createValidSignature(ts, body);

      const context = createMockContext(
        { 'x-sig': sig, 'x-ts': ts, 'x-id': 'duplicate-id' },
        body,
      );

      // Simulate ID already exists in Redis
      jest.spyOn(redisService, 'exists').mockResolvedValue(1);

      try {
        await guard.canActivate(context);
        fail('Expected exception');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(409);
        expect(mockWebhookVerifications.inc).toHaveBeenCalledWith({ result: 'replay' });
      }
    });
  });

  describe('Metrics Disabled', () => {
    it('should not emit metrics when disabled', async () => {
      (metricsService as any).enabled = false;

      const ts = Date.now().toString();
      const body = JSON.stringify({ event: 'test' });
      const sig = createValidSignature(ts, body);

      const context = createMockContext(
        { 'x-sig': sig, 'x-ts': ts, 'x-id': 'test-123' },
        body,
      );

      jest.spyOn(redisService, 'exists').mockResolvedValue(0);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockWebhookVerifications.inc).not.toHaveBeenCalled();
    });

    it('should still reject invalid webhooks when metrics disabled', async () => {
      (metricsService as any).enabled = false;

      const context = createMockContext(
        { 'x-sig': 'bad', 'x-ts': 'bad', 'x-id': 'test' },
        'body',
      );

      try {
        await guard.canActivate(context);
        fail('Expected exception');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        // Metric should NOT be emitted
        expect(mockWebhookVerifications.inc).not.toHaveBeenCalled();
      }
    });
  });
});
