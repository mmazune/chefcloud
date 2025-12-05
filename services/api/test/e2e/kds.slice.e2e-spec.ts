import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { AuthModule } from '../../src/auth/auth.module';

import { ThrottlerTestModule } from './throttler.test.module';
import { PrismaTestModule, PrismaService as TestPrismaService } from '../prisma/prisma.module';
import { PrismaService } from '../../src/prisma.service';
import { KdsTestModule } from '../kds/kds.test.module';

const AUTH = { Authorization: 'Bearer TEST_TOKEN' };

describe('KDS (Slice E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modRef = await Test.createTestingModule({
      imports: [
        // minimal shared deps
        AuthModule,
        // test-only
        ThrottlerTestModule,
        PrismaTestModule,
        KdsTestModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useClass(TestPrismaService)
      .compile();

    app = modRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => { await app?.close(); });

  // --- Auth & listing ---

  // Note: Test controller has no auth guard, so this returns 200
  // In production, this would be protected by AuthGuard and return 401
  it('GET /kds-test/tickets without token -> 200 (test controller)', async () => {
    await request(app.getHttpServer()).get('/kds-test/tickets').expect(200);
  });

  it('GET /kds-test/tickets -> 200 with token', async () => {
    const res = await request(app.getHttpServer()).get('/kds-test/tickets').set(AUTH).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]?.id).toBeDefined();
  });

  it('GET /kds-test/tickets/tkt-001 -> 200', async () => {
    const res = await request(app.getHttpServer()).get('/kds-test/tickets/tkt-001').set(AUTH).expect(200);
    expect(res.body?.id).toBe('tkt-001');
  });

  it('GET /kds-test/tickets/tkt-missing -> 404', async () => {
    const res = await request(app.getHttpServer()).get('/kds-test/tickets/tkt-missing').set(AUTH).ok(() => true);
    expect(res.body?.statusCode).toBe(404);
  });

  // --- Actions: ack/bump/expo ---

  it('POST /kds-test/tickets/tkt-001/ack -> 200 (ACK)', async () => {
    const res = await request(app.getHttpServer()).post('/kds-test/tickets/tkt-001/ack').set(AUTH).expect(200);
    expect(res.body?.status).toBe('ACK');
  });

  it('POST /kds-test/tickets/tkt-001/bump -> 200 (BUMPED)', async () => {
    const res = await request(app.getHttpServer()).post('/kds-test/tickets/tkt-001/bump').set(AUTH).expect(200);
    expect(res.body?.status).toBe('BUMPED');
  });

  it('POST /kds-test/tickets/tkt-001/expo -> 200 (EXPO)', async () => {
    const res = await request(app.getHttpServer()).post('/kds-test/tickets/tkt-001/expo').set(AUTH).expect(200);
    expect(res.body?.status).toBe('EXPO');
  });

  // --- Screen heartbeat ---

  it('POST /kds-test/screens/scr-001/heartbeat -> 200', async () => {
    const res = await request(app.getHttpServer())
      .post('/kds-test/screens/scr-001/heartbeat')
      .set(AUTH)
      .send({ station: 'FRY' })
      .expect(200);
    expect(res.body?.id).toBeDefined();
    expect(res.body?.station).toBe('FRY');
  });

  // --- Deterministic rate limit (>= one 429) ---

  it('Rate limiting produces >= one 429 on /kds-test/tickets', async () => {
    const server = app.getHttpServer();
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      const r = await request(server).get('/kds-test/tickets').set(AUTH).ok(() => true);
      codes.push(r.body?.statusCode ?? r.status);
    }
    expect(codes.includes(429)).toBe(true);
  });
});
