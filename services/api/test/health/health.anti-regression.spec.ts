import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('HealthController (Anti-Regression)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health should NEVER be throttled (150 rapid requests)', async () => {
    const requests = [];
    const numberOfRequests = 150;

    // Fire 150 requests rapidly
    for (let i = 0; i < numberOfRequests; i++) {
      requests.push(
        request(app.getHttpServer())
          .get('/api/health')
          .expect((res) => {
            // Assert NO request returns 429
            if (res.status === 429) {
              throw new Error(
                `Health endpoint was throttled on request ${i + 1}/${numberOfRequests}. ` +
                `This is a CRITICAL regression - /api/health must NEVER be rate-limited.`
              );
            }
            // Should always be 200
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('status');
            expect(res.body).toHaveProperty('uptime');
          })
      );
    }

    // Wait for all requests to complete
    await Promise.all(requests);
  }, 30000); // 30 second timeout for 150 requests

  it('GET /api/health response has correct structure', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: expect.stringMatching(/^(ok|degraded)$/),
      timestamp: expect.any(String),
      uptime: expect.any(Number),
      version: expect.any(String),
      services: {
        database: expect.stringMatching(/^(ok|down)$/),
        redis: expect.stringMatching(/^(ok|down)$/),
      },
    });
  });
});
