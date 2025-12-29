import { Test, TestingModule } from '@nestjs/testing';
import { createE2ETestingModule, createE2ETestingModuleBuilder } from '../helpers/e2e-bootstrap';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { createOrgWithUsers } from './factory';
import { cleanup } from '../helpers/cleanup';

describe('Workforce E2E', () => {
  let app: INestApplication;
  let waiterToken: string;
  let _managerToken: string;
  let _waiterId: string;

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
    const factory = await createOrgWithUsers(prisma, 'e2e-workforce');
    _waiterId = factory.users.waiter.id;

    // Login as waiter
    const waiterLogin = await request(app.getHttpServer()).post('/auth/login').send({
      email: factory.users.waiter.email,
      password: 'Test#123',
    });
    waiterToken = waiterLogin.body.access_token;

    // Login as manager
    const managerLogin = await request(app.getHttpServer()).post('/auth/login').send({
      email: factory.users.manager.email,
      password: 'Test#123',
    });
    _managerToken = managerLogin.body.access_token;
  });

  afterAll(async () => {
    await cleanup(app);
  });

  it('should clock in → clock out', async () => {
    // Clock in
    const clockInResponse = await request(app.getHttpServer())
      .post('/workforce/attendance/clock-in')
      .set('Authorization', `Bearer ${waiterToken}`)
      .expect(201);

    const _attendanceId = clockInResponse.body.id;
    expect(clockInResponse.body.clockIn).toBeDefined();
    expect(clockInResponse.body.clockOut).toBeNull();

    // Wait a second
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Clock out
    const clockOutResponse = await request(app.getHttpServer())
      .post('/workforce/attendance/clock-out')
      .set('Authorization', `Bearer ${waiterToken}`)
      .expect(201);

    expect(clockOutResponse.body.clockOut).toBeDefined();
    expect(new Date(clockOutResponse.body.clockOut).getTime()).toBeGreaterThan(
      new Date(clockOutResponse.body.clockIn).getTime(),
    );
  });
});
