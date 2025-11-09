import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, Controller, Get } from '@nestjs/common';
import { RequestIdMiddleware } from './request-id.middleware';

// Simple test controller
@Controller()
class TestController {
  @Get('test')
  test(): { success: boolean } {
    return { success: true };
  }
}

describe('Request-ID middleware', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [TestController],
    }).compile();
    app = mod.createNestApplication();

    // Apply Request-ID middleware
    app.use(new RequestIdMiddleware().use);

    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('echoes inbound X-Request-Id unchanged', async () => {
    const res = await request(app.getHttpServer())
      .get('/test')
      .set('X-Request-Id', 'RID-12345');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe('RID-12345');
  });

  it('generates a new X-Request-Id when missing', async () => {
    const res = await request(app.getHttpServer()).get('/test');
    expect(res.status).toBe(200);
    const rid = res.headers['x-request-id'];
    expect(typeof rid).toBe('string');
    expect(String(rid).length).toBeGreaterThan(10);
  });
});
