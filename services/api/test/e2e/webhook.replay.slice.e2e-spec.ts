import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { CacheModule } from '../../src/common/cache.module';
import { ObservabilityModule } from '../../src/observability/observability.module';

import { WebhookReplayTestModule } from '../webhooks/replay.test.module';
import { signCanonical } from '../webhooks/replay.validate';

describe('Webhook Replay Protection (Slice E2E)', () => {
  let app: INestApplication;
  const secret = 'whsec_test_123'; // Matches jest-setup-e2e.ts

  beforeAll(async () => {
    const modRef = await Test.createTestingModule({
      imports: [CacheModule, ObservabilityModule, WebhookReplayTestModule],
    }).compile();

    app = modRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => { await app?.close(); });

  const url = '/webhook-test/events';

  it('accepts a valid (HMAC + fresh timestamp + new nonce)', async () => {
    const body = { id: 'evt_100', type: 'payment.updated' };
    const raw = JSON.stringify(body);
    const ts = String(Date.now());
    const nonce = 'nonce_1';
    const sig = signCanonical(raw, ts, nonce, secret);

    const res = await request(app.getHttpServer())
      .post(url)
      .set('x-timestamp', ts)
      .set('x-nonce', nonce)
      .set('x-signature', sig)
      .send(body)
      .expect(200);

    expect(res.body?.ok).toBe(true);
  });

  it('rejects replay of the same nonce', async () => {
    const body = { id: 'evt_101', type: 'payment.updated' };
    const raw = JSON.stringify(body);
    const ts = String(Date.now());
    const nonce = 'nonce_replay';
    const sig = signCanonical(raw, ts, nonce, secret);

    // first attempt OK
    await request(app.getHttpServer())
      .post(url)
      .set('x-timestamp', ts)
      .set('x-nonce', nonce)
      .set('x-signature', sig)
      .send(body)
      .expect(200);

    // second attempt → replay_detected
    const res2 = await request(app.getHttpServer())
      .post(url)
      .set('x-timestamp', ts)
      .set('x-nonce', nonce)
      .set('x-signature', sig)
      .send(body)
      .expect(200);

    expect(res2.body?.ok).toBe(false);
    expect(res2.body?.reason).toBe('replay_detected');
  });

  it('rejects stale timestamp', async () => {
    const body = { id: 'evt_102', type: 'payment.updated' };
    const raw = JSON.stringify(body);
    const ts = String(Date.now() - (parseInt(process.env.WH_SKEW_SEC || '300', 10) + 10) * 1000);
    const nonce = 'nonce_stale';
    const sig = signCanonical(raw, ts, nonce, secret);

    const res = await request(app.getHttpServer())
      .post(url)
      .set('x-timestamp', ts)
      .set('x-nonce', nonce)
      .set('x-signature', sig)
      .send(body)
      .expect(200);

    expect(res.body?.ok).toBe(false);
    expect(res.body?.reason).toBe('stale_or_invalid_timestamp');
  });

  it('rejects bad signature', async () => {
    const body = { id: 'evt_103', type: 'payment.updated' };
    const ts = String(Date.now());
    const nonce = 'nonce_bad_sig';

    const res = await request(app.getHttpServer())
      .post(url)
      .set('x-timestamp', ts)
      .set('x-nonce', nonce)
      .set('x-signature', 'not-a-valid-sig')
      .send(body)
      .expect(200);

    expect(res.body?.ok).toBe(false);
    expect(res.body?.reason).toBe('bad_signature');
  });
});
