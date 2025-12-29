import { Test, TestingModule } from '@nestjs/testing';
import { createE2ETestingModule, createE2ETestingModuleBuilder } from '../helpers/e2e-bootstrap';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { createOrgWithUsers } from './factory';
import { cleanup } from '../helpers/cleanup';

describe('Reports E2E', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await createE2ETestingModule({
      imports: [AppModule],
    });

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    const prisma = app.get(PrismaService);
    const factory = await createOrgWithUsers(prisma, 'e2e-reports');

    // Login as owner
    const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
      email: factory.users.owner.email,
      password: 'Test#123',
    });

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await cleanup(app);
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
