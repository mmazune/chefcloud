import { Test, TestingModule } from '@nestjs/testing';
import { createE2ETestingModule, createE2ETestingModuleBuilder } from '../helpers/e2e-bootstrap';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { createOrgWithUsers } from './factory';
import { cleanup } from '../helpers/cleanup';

describe('Auth E2E', () => {
  let app: INestApplication;
  let _orgId: string;
  let waiterEmail: string;

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
    const factory = await createOrgWithUsers(prisma, 'e2e-auth');
    _orgId = factory.orgId;
    waiterEmail = factory.users.waiter.email;
  });

  afterAll(async () => {
    await cleanup(app);
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
