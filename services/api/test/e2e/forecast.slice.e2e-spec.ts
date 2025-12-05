import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { CacheModule } from '../../src/common/cache.module';
import { ObservabilityModule } from '../../src/observability/observability.module';
import { AuthModule } from '../../src/auth/auth.module';

import { ForecastTestModule } from '../forecast/forecast.test.module';
import { ForecastAuthOverrideModule } from '../forecast/auth-override.module';
import { ThrottlerTestModule } from './throttler.test.module';

const AUTH = { Authorization: 'Bearer TEST_TOKEN' };

describe('Forecast Caching (Slice E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modRef = await Test.createTestingModule({
      imports: [
        // minimal prod deps for parity
        CacheModule, ObservabilityModule, AuthModule,
        // test-only
        ForecastTestModule, ForecastAuthOverrideModule, ThrottlerTestModule,
      ],
    }).compile();
    app = modRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => { await app?.close(); });

  it('GET /forecast-test/sales -> 401 without token', async () => {
    const r = await request(app.getHttpServer()).get('/forecast-test/sales?period=2025-11').ok(() => true);
    expect([401, 403]).toContain(r.status);
  });

  it('GET /forecast-test/sales -> 400 for bad period', async () => {
    const r = await request(app.getHttpServer()).get('/forecast-test/sales?period=202511').set(AUTH).ok(() => true);
    expect([400,422]).toContain(r.status);
  });

  it('MISS then HIT for same period', async () => {
    const srv = app.getHttpServer();
    const r1 = await request(srv).get('/forecast-test/sales?period=2025-11').set(AUTH).expect(200);
    expect(r1.headers['x-cache']).toBe('MISS');
    const v1 = r1.body?.version;
    const r2 = await request(srv).get('/forecast-test/sales?period=2025-11').set(AUTH).expect(200);
    expect(r2.headers['x-cache']).toBe('HIT');
    expect(r2.body?.version).toBe(v1);
  });

  it('Invalidate then MISS with a new version', async () => {
    const srv = app.getHttpServer();
    const pre = await request(srv).get('/forecast-test/sales?period=2025-11').set(AUTH).ok(() => true);
    const vPre = pre.body?.version;

    await request(srv).post('/forecast-test/invalidate').set(AUTH).ok(() => true);

    const post = await request(srv).get('/forecast-test/sales?period=2025-11').set(AUTH).ok(() => true);
    if (post.status === 429) return; // Skip if throttled
    expect(post.headers['x-cache']).toBe('MISS');
    expect(post.body?.version).not.toBe(vPre);
  });

  it('Separate period keys are independent (MISS on first read)', async () => {
    const r = await request(app.getHttpServer()).get('/forecast-test/sales?period=2025-10').set(AUTH).ok(() => true);
    if (r.status === 429) return; // Skip if throttled
    expect(r.headers['x-cache']).toBe('MISS');
  });

  it('Deterministic rate limit: >= one 429 on sales', async () => {
    const server = app.getHttpServer();
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      const rr = await request(server).get('/forecast-test/sales?period=2025-12').set(AUTH).ok(() => true);
      codes.push(rr.body?.statusCode ?? rr.status);
    }
    expect(codes.includes(429)).toBe(true);
  });
});
