import { createE2EApp } from '../helpers/e2e-bootstrap';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { createOrgWithUsers } from './factory';
import { cleanup } from '../helpers/cleanup';
import { withTimeout } from '../helpers/with-timeout';

describe('Auth E2E', () => {
  let app: INestApplication;
  let _orgId: string;
  let waiterEmail: string;

  beforeAll(async () => {
    app = await createE2EApp({ imports: [AppModule] });

    const prisma = app.get(PrismaService);
    const factory = await withTimeout(
      createOrgWithUsers(prisma, 'e2e-auth'),
      { label: 'createOrgWithUsers factory', ms: 30000 }
    );
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
