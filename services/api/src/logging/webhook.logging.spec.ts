import request from 'supertest';
import { Test } from '@nestjs/testing';
import {
  Controller,
  Post,
  INestApplication,
  Module,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { HttpLoggerMiddleware } from './http-logger.middleware';
import { RequestIdMiddleware } from '../meta/request-id.middleware';

@Controller()
class TestWebhookController {
  @Post('/webhooks/billing')
  @HttpCode(HttpStatus.OK)
  handleWebhook() {
    // Just return OK - we're testing logging, not business logic
    return { received: true };
  }
}

@Module({
  controllers: [TestWebhookController],
})
class TestModule {}

describe('Webhook logging (body omitted)', () => {
  let app: INestApplication;

  beforeAll(async () => {
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
    await app.close();
  });

  it('handles webhook POST without throwing (body redaction path exercised)', async () => {
    // Webhook with sensitive data - should be omitted from logs
    const res = await request(app.getHttpServer())
      .post('/webhooks/billing')
      .set('Content-Type', 'application/json')
      .send({ event: 'test', password: 'secret', token: 'abc123' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });
});
