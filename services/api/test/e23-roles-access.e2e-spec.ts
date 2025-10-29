import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

describe('E23 Roles & Platform Access (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let managerToken: string;
  let procurementToken: string;
  let ticketMasterToken: string;
  let waiterToken: string;

  beforeAll(async () => {
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
    prisma = app.get<PrismaService>(PrismaService);

    // Login as manager (L4) to access /access/matrix
    const managerRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'manager@demo.local',
        password: 'Manager#123',
      });
    managerToken = managerRes.body.access_token;

    // Login as procurement (L3)
    const procurementRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'procurement@demo.local',
        password: 'Procurement#123',
      });
    procurementToken = procurementRes.body.access_token;

    // Login as ticket master (L2)
    const ticketMasterRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'ticketmaster@demo.local',
        password: 'TicketMaster#123',
      });
    ticketMasterToken = ticketMasterRes.body.access_token;

    // Login as waiter (L1)
    const waiterRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'waiter@demo.local',
        password: 'Waiter#123',
      });
    waiterToken = waiterRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /access/matrix', () => {
    it('should allow L4 (manager) to get platform access matrix', async () => {
      const response = await request(app.getHttpServer())
        .get('/access/matrix')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('platformAccess');
      expect(response.body).toHaveProperty('defaults');
      expect(response.body.platformAccess).toHaveProperty('WAITER');
      expect(response.body.platformAccess).toHaveProperty('PROCUREMENT');
      expect(response.body.platformAccess).toHaveProperty('TICKET_MASTER');
    });

    it('should reject L3 (procurement) from accessing matrix', async () => {
      await request(app.getHttpServer())
        .get('/access/matrix')
        .set('Authorization', `Bearer ${procurementToken}`)
        .expect(403);
    });

    it('should reject L2 (ticket master) from accessing matrix', async () => {
      await request(app.getHttpServer())
        .get('/access/matrix')
        .set('Authorization', `Bearer ${ticketMasterToken}`)
        .expect(403);
    });

    it('should reject L1 (waiter) from accessing matrix', async () => {
      await request(app.getHttpServer())
        .get('/access/matrix')
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(403);
    });

    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer()).get('/access/matrix').expect(401);
    });
  });

  describe('PATCH /access/matrix', () => {
    it('should allow L4 (manager) to update platform access matrix', async () => {
      const updates = {
        WAITER: { desktop: true, web: true, mobile: true },
        PROCUREMENT: { desktop: true, web: false, mobile: false },
      };

      const response = await request(app.getHttpServer())
        .patch('/access/matrix')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(updates)
        .expect(200);

      expect(response.body).toEqual(updates);
    });

    it('should reject updates with invalid structure', async () => {
      const invalidUpdates = {
        WAITER: { desktop: 'yes', web: true, mobile: true },
      };

      await request(app.getHttpServer())
        .patch('/access/matrix')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(invalidUpdates)
        .expect(500); // Service throws an error for invalid data
    });

    it('should reject L3 (procurement) from updating matrix', async () => {
      const updates = {
        WAITER: { desktop: true, web: true, mobile: true },
      };

      await request(app.getHttpServer())
        .patch('/access/matrix')
        .set('Authorization', `Bearer ${procurementToken}`)
        .send(updates)
        .expect(403);
    });

    it('should reject L2 (ticket master) from updating matrix', async () => {
      const updates = {
        WAITER: { desktop: true, web: true, mobile: true },
      };

      await request(app.getHttpServer())
        .patch('/access/matrix')
        .set('Authorization', `Bearer ${ticketMasterToken}`)
        .send(updates)
        .expect(403);
    });

    it('should reject unauthenticated requests', async () => {
      const updates = {
        WAITER: { desktop: true, web: true, mobile: true },
      };

      await request(app.getHttpServer())
        .patch('/access/matrix')
        .send(updates)
        .expect(401);
    });
  });

  describe('New role authentication', () => {
    it('should authenticate procurement user (L3)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'procurement@demo.local',
          password: 'Procurement#123',
        })
        .expect(200);

      expect(response.body.user).toMatchObject({
        email: 'procurement@demo.local',
        firstName: 'Frank',
        lastName: 'Procurement',
        roleLevel: 'L3',
      });
    });

    it('should authenticate assistant manager user (L3)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'assistantmgr@demo.local',
          password: 'AssistantMgr#123',
        })
        .expect(200);

      expect(response.body.user).toMatchObject({
        email: 'assistantmgr@demo.local',
        firstName: 'Grace',
        lastName: 'Asst Manager',
        roleLevel: 'L3',
      });
    });

    it('should authenticate event manager user (L3)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'eventmgr@demo.local',
          password: 'EventMgr#123',
        })
        .expect(200);

      expect(response.body.user).toMatchObject({
        email: 'eventmgr@demo.local',
        firstName: 'Henry',
        lastName: 'Event Manager',
        roleLevel: 'L3',
      });
    });

    it('should authenticate ticket master user (L2)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'ticketmaster@demo.local',
          password: 'TicketMaster#123',
        })
        .expect(200);

      expect(response.body.user).toMatchObject({
        email: 'ticketmaster@demo.local',
        firstName: 'Iris',
        lastName: 'Ticket Master',
        roleLevel: 'L2',
      });
    });

    it('should authenticate assistant chef user (L2)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'assistantchef@demo.local',
          password: 'AssistantChef#123',
        })
        .expect(200);

      expect(response.body.user).toMatchObject({
        email: 'assistantchef@demo.local',
        firstName: 'Jack',
        lastName: 'Asst Chef',
        roleLevel: 'L2',
      });
    });

    it('should authenticate head barista user (L3)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'headbarista@demo.local',
          password: 'HeadBarista#123',
        })
        .expect(200);

      expect(response.body.user).toMatchObject({
        email: 'headbarista@demo.local',
        firstName: 'Kelly',
        lastName: 'Head Barista',
        roleLevel: 'L3',
      });
    });
  });

  describe('Platform access matrix persistence', () => {
    it('should persist and retrieve updated platform access', async () => {
      // Update matrix
      const updates = {
        TICKET_MASTER: { desktop: false, web: true, mobile: true },
        HEAD_BARISTA: { desktop: true, web: true, mobile: false },
      };

      await request(app.getHttpServer())
        .patch('/access/matrix')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(updates)
        .expect(200);

      // Retrieve matrix
      const response = await request(app.getHttpServer())
        .get('/access/matrix')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.platformAccess).toMatchObject(updates);

      // Restore defaults for other tests
      await prisma.orgSettings.update({
        where: { orgId: (await prisma.org.findUnique({ where: { slug: 'demo-restaurant' } }))!.id },
        data: {
          platformAccess: {
            WAITER: { desktop: false, web: true, mobile: true },
            CASHIER: { desktop: true, web: true, mobile: true },
            SUPERVISOR: { desktop: true, web: true, mobile: true },
            CHEF: { desktop: false, web: true, mobile: true },
            STOCK: { desktop: true, web: true, mobile: false },
            MANAGER: { desktop: true, web: true, mobile: true },
            ACCOUNTANT: { desktop: true, web: true, mobile: false },
            OWNER: { desktop: true, web: true, mobile: true },
            ADMIN: { desktop: true, web: true, mobile: true },
            TICKET_MASTER: { desktop: true, web: true, mobile: true },
            ASSISTANT_CHEF: { desktop: false, web: true, mobile: true },
            PROCUREMENT: { desktop: true, web: true, mobile: false },
            ASSISTANT_MANAGER: { desktop: true, web: true, mobile: true },
            EVENT_MANAGER: { desktop: true, web: true, mobile: true },
            HEAD_BARISTA: { desktop: true, web: true, mobile: true },
          },
        },
      });
    });
  });
});
