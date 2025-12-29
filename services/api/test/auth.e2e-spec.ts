import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { E2eAppModule } from './e2e-app.module';
import { PrismaService } from '../src/prisma.service';
import { cleanup } from './helpers/cleanup';
import { E2E_USERS } from './helpers/e2e-credentials';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [E2eAppModule],
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
    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await cleanup(app);
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: E2E_USERS.owner.email,
          password: E2E_USERS.owner.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toMatchObject({
        email: E2E_USERS.owner.email,
        firstName: E2E_USERS.owner.firstName,
        lastName: E2E_USERS.owner.lastName,
        roleLevel: E2E_USERS.owner.roleLevel,
      });
    });

    it('should reject invalid email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@demo.restaurant',
          password: E2E_USERS.owner.password,
        })
        .expect(401);
    });

    it('should reject invalid password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: E2E_USERS.owner.email,
          password: 'WrongPassword!',
        })
        .expect(401);
    });

    it('should reject missing fields', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: E2E_USERS.owner.email,
        })
        .expect(400);
    });
  });

  describe('POST /auth/pin-login', () => {
    it('should login with valid employee code and PIN', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/pin-login')
        .send({
          employeeCode: 'MGR001',
          pin: '1234',
          branchId: await getMainBranchId(),
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body.user).toMatchObject({
        firstName: 'Bob',
        lastName: 'Manager',
        roleLevel: 'L4',
      });
    });

    it('should reject invalid employee code', async () => {
      await request(app.getHttpServer())
        .post('/auth/pin-login')
        .send({
          employeeCode: 'INVALID',
          pin: '1234',
          branchId: await getMainBranchId(),
        })
        .expect(401);
    });

    it('should reject invalid PIN', async () => {
      await request(app.getHttpServer())
        .post('/auth/pin-login')
        .send({
          employeeCode: 'MGR001',
          pin: '9999',
          branchId: await getMainBranchId(),
        })
        .expect(401);
    });

    it('should reject wrong branch', async () => {
      await request(app.getHttpServer())
        .post('/auth/pin-login')
        .send({
          employeeCode: 'MGR001',
          pin: '1234',
          branchId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(401);
    });
  });

  describe('POST /auth/msr-swipe', () => {
    it('should login with valid badge ID', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/msr-swipe')
        .send({
          badgeId: 'CASHIER001',
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body.user).toMatchObject({
        firstName: 'Diana',
        lastName: 'Cashier',
        roleLevel: 'L2',
      });
    });

    it('should reject unknown badge ID', async () => {
      await request(app.getHttpServer())
        .post('/auth/msr-swipe')
        .send({
          badgeId: 'UNKNOWN_BADGE',
        })
        .expect(404);
    });

    it('should login with branch verification', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/msr-swipe')
        .send({
          badgeId: 'CASHIER001',
          branchId: await getMainBranchId(),
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
    });
  });

  describe('GET /me', () => {
    let accessToken: string;

    beforeAll(async () => {
      const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
        email: E2E_USERS.owner.email,
        password: E2E_USERS.owner.password,
      });

      accessToken = loginResponse.body.access_token;
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        email: E2E_USERS.owner.email,
        firstName: E2E_USERS.owner.firstName,
        lastName: E2E_USERS.owner.lastName,
        roleLevel: E2E_USERS.owner.roleLevel,
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('orgId');
      expect(response.body).toHaveProperty('branchId');
    });

    it('should reject request without token', async () => {
      await request(app.getHttpServer()).get('/me').expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);
    });
  });

  describe('POST /devices/register', () => {
    let managerToken: string;

    beforeAll(async () => {
      const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
        email: E2E_USERS.manager.email,
        password: E2E_USERS.manager.password,
      });

      managerToken = loginResponse.body.access_token;
    });

    it('should allow L4 manager to register a device', async () => {
      const response = await request(app.getHttpServer())
        .post('/devices/register')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Test POS Terminal',
          branchId: await getMainBranchId(),
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('deviceKey');
      expect(response.body.name).toBe('Test POS Terminal');
      expect(response.body.deviceKey).toMatch(/^dk_[a-z0-9]+$/);
    });

    it('should reject device registration without auth', async () => {
      await request(app.getHttpServer())
        .post('/devices/register')
        .send({
          name: 'Test POS Terminal',
        })
        .expect(401);
    });
  });

  // Helper function to get main branch ID
  async function getMainBranchId(): Promise<string> {
    const branch = await prisma.client.branch.findFirst({
      where: { name: 'Main Branch' },
    });
    return branch?.id || '';
  }
});
