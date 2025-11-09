import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { createOrgWithUsers, disconnect } from './factory';

describe('Auth E2E', () => {
  let app: INestApplication;
  let _orgId: string;
  let waiterEmail: string;

  beforeAll(async () => {
    const factory = await createOrgWithUsers('e2e-auth');
    _orgId = factory.orgId;
    waiterEmail = factory.users.waiter.email;

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
  });

  afterAll(async () => {
    await app.close();
    await disconnect();
  });

  it('should login with email/password and return access_token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: waiterEmail,
        password: 'Test#123',
      })
      .expect(200);

    expect(response.body.access_token).toBeDefined();
    expect(response.body.user).toMatchObject({
      email: waiterEmail,
      roleLevel: 'L1',
    });
  });

  it('should reject invalid password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: waiterEmail,
        password: 'WrongPassword',
      })
      .expect(401);
  });
});
