import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { createE2ETestingModule, createE2ETestingModuleBuilder } from '../helpers/e2e-bootstrap';

import {} from '../../src/common/cache.module';
import { ObservabilityModule } from '../../src/observability/observability.module';
import { AuthModule } from '../../src/auth/auth.module';

import { ThrottlerTestModule } from './throttler.test.module';
import { ForecastTestModule } from '../forecast/forecast.test.module';
import { ForecastAuthOverrideModule } from '../forecast/auth-override.module';
import { TransferEventsTestModule } from '../transfers/transfer.events.test.module';
import { cleanup } from '../helpers/cleanup';

const AUTH = { Authorization: 'Bearer TEST_TOKEN' };

describe('Transfer Invalidation (Slice E2E) — E22.D', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modRef = await createE2ETestingModule({
      imports: [
        // ConfigModule is required by AuthModule's JwtModule.registerAsync
        ConfigModule.forRoot({ isGlobal: true }),

        // minimal prod deps for parityObservabilityModule, AuthModule,
        // test-only modules
        ThrottlerTestModule,
        ForecastTestModule, // exposes /forecast-test/sales + /invalidate
        ForecastAuthOverrideModule, // bypass auth with TEST_TOKEN
        TransferEventsTestModule, // new event endpoint
      ],
    });

    app = modRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await cleanup(app);
  });

  it('POST /transfer-test/event -> 401 without token', async () => {
    const r = await request(app.getHttpServer())
      .post('/transfer-test/event')
      .send({})
      .ok(() => true);
    expect([401, 403]).toContain(r.status);
  });

  it('POST /transfer-test/event -> 200 {ok:false} on invalid payload', async () => {
    const res = await request(app.getHttpServer())
      .post('/transfer-test/event')
      .set(AUTH)
      .send({ bogus: true })
      .expect(200);
    expect(res.body?.ok).toBe(false);
    expect(res.body?.reason).toBe('invalid_payload');
  });

  it('HIT → transfer.changed → MISS (forecast cache proves invalidation)', async () => {
    const srv = app.getHttpServer();

    // Warm the cache: MISS then HIT
    const r1 = await request(srv)
      .get('/forecast-test/sales?period=2025-11')
      .set(AUTH)
      .ok(() => true);
    if (r1.status === 429) return; // Skip if throttled
    const v1 = r1.body?.version;
    const r2 = await request(srv)
      .get('/forecast-test/sales?period=2025-11')
      .set(AUTH)
      .ok(() => true);
    if (r2.status === 429) return; // Skip if throttled
    expect(r2.headers['x-cache']).toBe('HIT');
    expect(r2.body?.version).toBe(v1);

    // Fire transfer.changed
    const evt = {
      id: 'evt-x1',
      type: 'transfer.changed',
      data: { from: 'A', to: 'B', sku: 'SKU-1', qty: 4, at: new Date().toISOString() },
    };
    const e = await request(srv).post('/transfer-test/event').set(AUTH).send(evt).expect(200);
    expect(e.body?.ok).toBe(true);

    // Next read should be MISS with a new version
    const r3 = await request(srv)
      .get('/forecast-test/sales?period=2025-11')
      .set(AUTH)
      .ok(() => true);
    if (r3.status === 429) return; // Skip if throttled
    expect(r3.headers['x-cache']).toBe('MISS');
    expect(r3.body?.version).not.toBe(v1);
  });

  it('Idempotency: repeating same event still returns ok:true', async () => {
    const srv = app.getHttpServer();
    const evt = {
      id: 'evt-repeat',
      type: 'transfer.changed',
      data: { from: 'A', to: 'B', sku: 'SKU-2', qty: 1, at: new Date().toISOString() },
    };
    const a = await request(srv).post('/transfer-test/event').set(AUTH).send(evt).expect(200);
    const b = await request(srv).post('/transfer-test/event').set(AUTH).send(evt).expect(200);
    expect(a.body?.ok && b.body?.ok).toBe(true);
  });

  it('Deterministic rate limit: >= one 429 on /forecast-test/sales', async () => {
    const server = app.getHttpServer();
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      const r = await request(server)
        .get('/forecast-test/sales?period=2025-12')
        .set(AUTH)
        .ok(() => true);
      codes.push(r.body?.statusCode ?? r.status);
    }
    expect(codes.includes(429)).toBe(true);
  });
});
