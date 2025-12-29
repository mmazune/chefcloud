import { Test, TestingModule } from '@nestjs/testing';
import { createE2ETestingModule, createE2ETestingModuleBuilder } from '../helpers/e2e-bootstrap';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { createOrgWithUsers, createChartOfAccounts } from './factory';
import { cleanup } from '../helpers/cleanup';

describe('Accounting E2E', () => {
  let app: INestApplication;
  let authToken: string;
  let _orgId: string;

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
    const factory = await createOrgWithUsers(prisma, 'e2e-accounting');
    await createChartOfAccounts(prisma, factory.orgId);

    _orgId = factory.orgId;

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
