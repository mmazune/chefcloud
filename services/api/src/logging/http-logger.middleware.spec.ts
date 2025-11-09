import request from 'supertest';
import { Test } from '@nestjs/testing';
import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { HttpLoggerMiddleware } from './http-logger.middleware';
import { RequestIdMiddleware } from '../meta/request-id.middleware';

@Controller()
class TestController {
  @Get('healthz')
  healthz() {
    return { status: 'ok' };
  }
}

@Module({
  controllers: [TestController],
})
class TestModule {}

describe('HTTP Logger middleware', () => {
  let app: INestApplication;
  const prev = {
    PRETTY: process.env.PRETTY_LOGS,
    LHEALTH: process.env.LOG_SILENCE_HEALTH,
    LMET: process.env.LOG_SILENCE_METRICS,
  };

  beforeAll(async () => {
    process.env.PRETTY_LOGS = '0';
    process.env.LOG_SILENCE_HEALTH = '1';
    process.env.LOG_SILENCE_METRICS = '1';
    const mod = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    app = mod.createNestApplication();
    // Apply middleware
    app.use(new RequestIdMiddleware().use);
    app.use(new HttpLoggerMiddleware().use);
    await app.init();
  });

  afterAll(async () => {
    process.env.PRETTY_LOGS = prev.PRETTY;
    process.env.LOG_SILENCE_HEALTH = prev.LHEALTH;
    process.env.LOG_SILENCE_METRICS = prev.LMET;
    await app.close();
  });

  it('attaches and echoes X-Request-Id', async () => {
    const res = await request(app.getHttpServer())
      .get('/healthz')
      .set('X-Request-Id', 'LOG-123');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe('LOG-123');
  });

  it('generates a request id when missing', async () => {
    const res = await request(app.getHttpServer()).get('/healthz');
    expect(res.status).toBe(200);
    expect(typeof res.headers['x-request-id']).toBe('string');
    expect(res.headers['x-request-id'].length).toBeGreaterThan(10);
  });
});
