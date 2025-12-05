import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { CacheModule } from '../../src/common/cache.module';
import { ObservabilityModule } from '../../src/observability/observability.module';
import { AuthModule } from '../../src/auth/auth.module';

import { SseTestModule } from '../sse/sse.test.module';
import { SseAuthOverrideModule } from '../sse/auth-override.module';
import { SseThrottlerModule } from '../sse/throttler.module';

const AUTH = { Authorization: 'Bearer TEST_TOKEN' };

describe('SSE Black-Box Smoke (Slice E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modRef = await Test.createTestingModule({
      imports: [
        // minimal prod deps
        CacheModule, ObservabilityModule, AuthModule,
        // test-only
        SseTestModule, SseAuthOverrideModule, SseThrottlerModule,
      ],
    }).compile();

    app = modRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => { await app?.close(); });

  it('GET /sse-test/stream -> 401 without token', async () => {
    const r = await request(app.getHttpServer()).get('/sse-test/stream').ok(() => true);
    expect([401, 403]).toContain(r.status);
  });

  it('Sends first SSE event quickly and has correct headers', async () => {
    // custom parser: capture data until we see our event, then stop
    const chunks: Buffer[] = [];
    let foundEvent = false;
    
    const response = await request(app.getHttpServer())
      .get('/sse-test/stream')
      .set(AUTH)
      .set('x-request-id', 'sse-smoke-1')
      .buffer(false)
      .parse((res, cb) => {
        res.on('data', (c: Buffer) => {
          chunks.push(c);
          const soFar = Buffer.concat(chunks).toString('utf8');
          // Check if we've received the complete event (has "data:" and our requestId)
          if (soFar.includes('data:') && soFar.includes('sse-smoke-1')) {
            foundEvent = true;
            // Give a tiny delay to ensure full event is captured, then stop
            setTimeout(() => (res as any).destroy?.(), 50);
          }
        });
        res.on('end', () => cb(null, Buffer.concat(chunks)));
        res.on('close', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);

    // Validate SSE headers
    expect(response.headers['content-type']).toMatch(/text\/event-stream/);
    expect(response.headers['cache-control']).toMatch(/no-cache/i);
    expect(response.headers['connection']).toMatch(/keep-alive/i);

    const body = Buffer.concat(chunks).toString('utf8');
    // Expect at least one SSE "data:" line with our JSON
    expect(body).toMatch(/data:\s*\{/);
    expect(body).toContain('"ok":true');
    expect(body).toContain('"kind":"smoke"');
    expect(body).toContain('"requestId":"sse-smoke-1"');
  });

  it('Event payload contains deterministic requestId from header', async () => {
    const chunks: Buffer[] = [];
    
    await request(app.getHttpServer())
      .get('/sse-test/stream')
      .set(AUTH)
      .set('x-request-id', 'custom-id-123')
      .buffer(false)
      .parse((res, cb) => {
        res.on('data', (c: Buffer) => {
          chunks.push(c);
          const soFar = Buffer.concat(chunks).toString('utf8');
          if (soFar.includes('data:') && soFar.includes('custom-id-123')) {
            setTimeout(() => (res as any).destroy?.(), 50);
          }
        });
        res.on('end', () => cb(null, Buffer.concat(chunks)));
        res.on('close', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);

    const body = Buffer.concat(chunks).toString('utf8');
    expect(body).toContain('"requestId":"custom-id-123"');
  });

  it('Deterministic rate limit: >= one 429 on SSE connect burst', async () => {
    const server = app.getHttpServer();
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      const r = await request(server).get('/sse-test/stream').set(AUTH).ok(() => true);
      codes.push(r.status);
    }
    expect(codes.includes(429)).toBe(true);
  });
});
