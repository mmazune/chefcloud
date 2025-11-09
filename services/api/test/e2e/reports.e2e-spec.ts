import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { createOrgWithUsers, disconnect } from './factory';

describe('Reports E2E', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const factory = await createOrgWithUsers('e2e-reports');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    // Login as owner
    const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
      email: factory.users.owner.email,
      password: 'Test#123',
    });

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
    await disconnect();
  });

  it('should fetch X report (shift summary)', async () => {
    const response = await request(app.getHttpServer())
      .get('/reports/x-report')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toBeDefined();
    expect(response.body.shift).toBeDefined();
  });

  it('should fetch owner overview', async () => {
    const response = await request(app.getHttpServer())
      .get('/reports/owner-overview')
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      })
      .expect(200);

    expect(response.body).toBeDefined();
  });
});
