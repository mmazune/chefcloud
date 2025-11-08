import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { createOrgWithUsers, createChartOfAccounts, disconnect } from './factory';

describe('Accounting E2E', () => {
  let app: INestApplication;
  let authToken: string;
  let orgId: string;

  beforeAll(async () => {
    const factory = await createOrgWithUsers('e2e-accounting');
    await createChartOfAccounts(factory.orgId);

    orgId = factory.orgId;

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
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: factory.users.owner.email,
        password: 'Test#123',
      });

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
    await disconnect();
  });

  it('should create period → lock → posting blocked', async () => {
    // Create period
    const periodResponse = await request(app.getHttpServer())
      .post('/accounting/periods')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Jan 2025',
        startsAt: '2025-01-01',
        endsAt: '2025-01-31',
      })
      .expect(201);

    const periodId = periodResponse.body.id;
    expect(periodResponse.body.status).toBe('OPEN');

    // Lock period
    const lockResponse = await request(app.getHttpServer())
      .patch(`/accounting/periods/${periodId}/lock`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(lockResponse.body.status).toBe('LOCKED');
    expect(lockResponse.body.lockedAt).toBeDefined();

    // Verify period is locked
    const getResponse = await request(app.getHttpServer())
      .get(`/accounting/periods/${periodId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(getResponse.body.status).toBe('LOCKED');
  });
});
