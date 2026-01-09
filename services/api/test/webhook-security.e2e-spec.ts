import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createHmac } from 'crypto';
import { AppModule } from '../src/app.module';
import { json } from 'express';
import { cleanup } from './helpers/cleanup';

describe('Webhook Security E2E (E24)', () => {
  let app: INestApplication;
  const WH_SECRET = 'e2e-test-webhook-secret';

  beforeAll(async () => {
    process.env.WH_SECRET = WH_SECRET;
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Configure body parser with raw body capture (same as main.ts)
    app.use(
      json({
        limit: '256kb',
        verify: (req: any, _res, buf: Buffer) => {
          req.rawBody = buf.toString('utf8');
        },
      }),
    );

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    delete process.env.WH_SECRET;
    await cleanup(app);
  });

  const generateSignature = (timestamp: string, body: string): string => {
    const payload = `${timestamp}.${body}`;
    return createHmac('sha256', WH_SECRET).update(payload).digest('hex');
  };

  const sendWebhook = (payload: any, headers: { sig?: string; ts?: string; id?: string } = {}) => {
    const bodyStr = JSON.stringify(payload);
    const timestamp = headers.ts || Date.now().toString();
    const signature = headers.sig || generateSignature(timestamp, bodyStr);
    const requestId = headers.id || `test-${Date.now()}-${Math.random()}`;

    return request(app.getHttpServer())
      .post('/webhooks/billing')
      .set('Content-Type', 'application/json')
      .set('X-Sig', signature)
      .set('X-Ts', timestamp)
      .set('X-Id', requestId)
      .send(payload);
  };

  describe('Authentication', () => {
    it('should reject webhook without signature header', async () => {
      const response = await request(app.getHttpServer())
        .post('/webhooks/billing')
        .set('Content-Type', 'application/json')
        .set('X-Ts', Date.now().toString())
        .set('X-Id', 'test-no-sig')
        .send({ event: 'test' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Missing required headers');
    });

    it('should reject webhook without timestamp header', async () => {
      const response = await request(app.getHttpServer())
        .post('/webhooks/billing')
        .set('Content-Type', 'application/json')
        .set('X-Sig', 'some-signature')
        .set('X-Id', 'test-no-ts')
        .send({ event: 'test' });

      expect(response.status).toBe(400);
    });

    it('should reject webhook without request ID header', async () => {
      const response = await request(app.getHttpServer())
        .post('/webhooks/billing')
        .set('Content-Type', 'application/json')
        .set('X-Sig', 'some-signature')
        .set('X-Ts', Date.now().toString())
        .send({ event: 'test' });

      expect(response.status).toBe(400);
    });

    it('should reject webhook with invalid signature', async () => {
      const payload = { event: 'invoice.paid', id: 'evt_123' };
      const response = await sendWebhook(payload, {
        sig: 'invalid-signature-hex-value',
      });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid signature');
    });

    it('should accept webhook with valid signature', async () => {
      const payload = { event: 'invoice.paid', id: 'evt_valid' };
      const response = await sendWebhook(payload);

      expect(response.status).toBe(201);
      expect(response.body.received).toBe(true);
      expect(response.body.event).toBe('invoice.paid');
    });
  });

  describe('Timestamp validation', () => {
    it('should reject webhook with stale timestamp (>5 minutes old)', async () => {
      const staleTimestamp = (Date.now() - 6 * 60 * 1000).toString();
      const payload = { event: 'test' };
      const bodyStr = JSON.stringify(payload);
      const signature = generateSignature(staleTimestamp, bodyStr);

      const response = await sendWebhook(payload, {
        sig: signature,
        ts: staleTimestamp,
      });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Timestamp outside valid window');
      expect(response.body.error).toContain('Stale Request');
    });

    it('should reject webhook with future timestamp (>5 minutes ahead)', async () => {
      const futureTimestamp = (Date.now() + 6 * 60 * 1000).toString();
      const payload = { event: 'test' };
      const bodyStr = JSON.stringify(payload);
      const signature = generateSignature(futureTimestamp, bodyStr);

      const response = await sendWebhook(payload, {
        sig: signature,
        ts: futureTimestamp,
      });

      expect(response.status).toBe(401);
    });

    it('should accept webhook with timestamp at edge of window (4 minutes old)', async () => {
      const timestamp = (Date.now() - 4 * 60 * 1000).toString();
      const payload = { event: 'edge_test' };
      const bodyStr = JSON.stringify(payload);
      const signature = generateSignature(timestamp, bodyStr);

      const response = await sendWebhook(payload, {
        sig: signature,
        ts: timestamp,
      });

      expect(response.status).toBe(201);
    });

    it('should reject webhook with invalid timestamp format', async () => {
      const response = await request(app.getHttpServer())
        .post('/webhooks/billing')
        .set('Content-Type', 'application/json')
        .set('X-Sig', 'some-signature')
        .set('X-Ts', 'not-a-number')
        .set('X-Id', 'test-invalid-ts')
        .send({ event: 'test' });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid timestamp format');
    });
  });

  describe('Replay protection', () => {
    it('should reject duplicate request ID (replay attack)', async () => {
      const requestId = `replay-test-${Date.now()}`;
      const payload = { event: 'invoice.paid', amount: 100 };

      // First request should succeed
      const response1 = await sendWebhook(payload, { id: requestId });
      expect(response1.status).toBe(201);

      // Wait a bit to ensure Redis has processed the first request
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second request with same ID should be rejected as replay
      const response2 = await sendWebhook(payload, { id: requestId });
      expect(response2.status).toBe(409);
      expect(response2.body.message).toContain('Replay attack detected');
      expect(response2.body.requestId).toBe(requestId);
    });

    it('should allow same payload with different request IDs', async () => {
      const payload = { event: 'invoice.paid', amount: 100 };

      const response1 = await sendWebhook(payload, { id: `unique-1-${Date.now()}` });
      expect(response1.status).toBe(201);

      const response2 = await sendWebhook(payload, { id: `unique-2-${Date.now()}` });
      expect(response2.status).toBe(201);
    });
  });

  describe('Body integrity', () => {
    it('should reject webhook with tampered body', async () => {
      const originalPayload = { event: 'payment', amount: 100 };
      const tamperedPayload = { event: 'payment', amount: 1000 };

      const timestamp = Date.now().toString();
      const signature = generateSignature(timestamp, JSON.stringify(originalPayload));

      // Send tampered payload with signature from original
      const response = await request(app.getHttpServer())
        .post('/webhooks/billing')
        .set('Content-Type', 'application/json')
        .set('X-Sig', signature)
        .set('X-Ts', timestamp)
        .set('X-Id', `tamper-test-${Date.now()}`)
        .send(tamperedPayload);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid signature');
    });

    it('should handle empty body correctly', async () => {
      const emptyPayload = {};
      const response = await sendWebhook(emptyPayload);

      expect(response.status).toBe(201);
    });

    it('should handle complex nested JSON', async () => {
      const complexPayload = {
        event: 'invoice.paid',
        data: {
          invoice: {
            id: 'inv_123',
            customer: { name: 'Test Customer', email: 'test@example.com' },
            items: [
              { name: 'Item 1', price: 100 },
              { name: 'Item 2', price: 200 },
            ],
          },
        },
      };

      const response = await sendWebhook(complexPayload);
      expect(response.status).toBe(201);
    });
  });

  describe('Multiple webhook endpoints', () => {
    it('should protect MTN webhook endpoint', async () => {
      const payload = { transactionId: 'mtn-123', status: 'completed' };
      const response = await request(app.getHttpServer())
        .post('/webhooks/mtn')
        .set('Content-Type', 'application/json')
        .send(payload);

      // Should fail without proper headers
      expect(response.status).toBe(400);
    });

    it('should protect Airtel webhook endpoint', async () => {
      const payload = { transactionId: 'airtel-123', status: 'completed' };
      const response = await request(app.getHttpServer())
        .post('/webhooks/airtel')
        .set('Content-Type', 'application/json')
        .send(payload);

      // Should fail without proper headers
      expect(response.status).toBe(400);
    });
  });

  describe('Response format', () => {
    it('should return proper success response', async () => {
      const payload = { event: 'invoice.created', id: 'inv_456' };
      const response = await sendWebhook(payload);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        received: true,
        event: 'invoice.created',
        id: 'inv_456',
      });
      expect(response.body.timestamp).toBeDefined();
    });

    it('should return proper error response for auth failure', async () => {
      const payload = { event: 'test' };
      const response = await sendWebhook(payload, { sig: 'wrong-signature' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('statusCode');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Performance and load', () => {
    it('should handle multiple concurrent valid webhooks', async () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        sendWebhook({ event: 'test', index: i }, { id: `concurrent-${Date.now()}-${i}` }),
      );

      const responses = await Promise.all(requests);
      const successCount = responses.filter((r) => r.status === 201).length;

      expect(successCount).toBe(10);
    });
  });
});
