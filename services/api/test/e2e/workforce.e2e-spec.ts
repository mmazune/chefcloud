import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { createOrgWithUsers, disconnect } from './factory';

describe('Workforce E2E', () => {
  let app: INestApplication;
  let waiterToken: string;
  let managerToken: string;
  let waiterId: string;

  beforeAll(async () => {
    const factory = await createOrgWithUsers('e2e-workforce');
    waiterId = factory.users.waiter.id;

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

    // Login as waiter
    const waiterLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: factory.users.waiter.email,
        password: 'Test#123',
      });
    waiterToken = waiterLogin.body.access_token;

    // Login as manager
    const managerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: factory.users.manager.email,
        password: 'Test#123',
      });
    managerToken = managerLogin.body.access_token;
  });

  afterAll(async () => {
    await app.close();
    await disconnect();
  });

  it('should clock in → clock out', async () => {
    // Clock in
    const clockInResponse = await request(app.getHttpServer())
      .post('/workforce/attendance/clock-in')
      .set('Authorization', `Bearer ${waiterToken}`)
      .expect(201);

    const attendanceId = clockInResponse.body.id;
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
