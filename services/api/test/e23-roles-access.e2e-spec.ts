import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { createE2EApp } from './helpers/e2e-bootstrap';
import { cleanup } from './helpers/cleanup';
import { E2E_USERS, DEMO_DATASETS } from './helpers/e2e-credentials';
import { requireTapasOrg } from './helpers/require-preconditions';
import { withTimeout } from './helpers/with-timeout';

describe('E23 Roles & Platform Access (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let managerToken: string;
  let procurementToken: string;
  let ticketMasterToken: string;
  let waiterToken: string;

  beforeAll(async () => {
    app = await createE2EApp({ imports: [AppModule] });

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    // Precondition: require Tapas org with users
    await requireTapasOrg(prisma.client);

    // Login as manager (L4) to access /access/matrix
    const managerRes = await withTimeout(
      request(app.getHttpServer()).post('/auth/login').send({
        email: E2E_USERS.manager.email,
        password: E2E_USERS.manager.password,
      }),
      { label: 'manager login', ms: 15000 },
    );
    managerToken = managerRes.body.access_token;

    // Login as procurement (L3)
    const procurementRes = await withTimeout(
      request(app.getHttpServer()).post('/auth/login').send({
        email: E2E_USERS.procurement.email,
        password: E2E_USERS.procurement.password,
      }),
      { label: 'procurement login', ms: 15000 },
    );
    procurementToken = procurementRes.body.access_token;

    // Login as supervisor (L2) - using supervisor instead of non-existent ticketmaster
    const ticketMasterRes = await withTimeout(
      request(app.getHttpServer()).post('/auth/login').send({
        email: E2E_USERS.supervisor.email,
        password: E2E_USERS.supervisor.password,
      }),
      { label: 'supervisor login', ms: 15000 },
    );
    ticketMasterToken = ticketMasterRes.body.access_token;

    // Login as waiter (L1)
    const waiterRes = await withTimeout(
      request(app.getHttpServer()).post('/auth/login').send({
        email: E2E_USERS.waiter.email,
        password: E2E_USERS.waiter.password,
      }),
      { label: 'waiter login', ms: 15000 },
    );
    waiterToken = waiterRes.body.access_token;
  });

  afterAll(async () => {
    await cleanup(app);
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

      await request(app.getHttpServer()).patch('/access/matrix').send(updates).expect(401);
    });
  });

  describe('New role authentication', () => {
    it('should authenticate procurement user (L3)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: E2E_USERS.procurement.email,
          password: E2E_USERS.procurement.password,
        })
        .expect(200);

      expect(response.body.user).toMatchObject({
        email: E2E_USERS.procurement.email,
        firstName: E2E_USERS.procurement.firstName,
        lastName: E2E_USERS.procurement.lastName,
        roleLevel: E2E_USERS.procurement.roleLevel,
      });
    });

    it('should authenticate stock user (L3)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: E2E_USERS.stock.email,
          password: E2E_USERS.stock.password,
        })
        .expect(200);

      expect(response.body.user).toMatchObject({
        email: E2E_USERS.stock.email,
        firstName: E2E_USERS.stock.firstName,
        lastName: E2E_USERS.stock.lastName,
        roleLevel: E2E_USERS.stock.roleLevel,
      });
    });

    it('should authenticate event manager user (L3)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: E2E_USERS.eventmgr.email,
          password: E2E_USERS.eventmgr.password,
        })
        .expect(200);

      expect(response.body.user).toMatchObject({
        email: E2E_USERS.eventmgr.email,
        firstName: E2E_USERS.eventmgr.firstName,
        lastName: E2E_USERS.eventmgr.lastName,
        roleLevel: E2E_USERS.eventmgr.roleLevel,
      });
    });

    it('should authenticate supervisor user (L2)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: E2E_USERS.supervisor.email,
          password: E2E_USERS.supervisor.password,
        })
        .expect(200);

      expect(response.body.user).toMatchObject({
        email: E2E_USERS.supervisor.email,
        firstName: E2E_USERS.supervisor.firstName,
        lastName: E2E_USERS.supervisor.lastName,
        roleLevel: E2E_USERS.supervisor.roleLevel,
      });
    });

    it('should authenticate chef user (L2)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: E2E_USERS.chef.email,
          password: E2E_USERS.chef.password,
        })
        .expect(200);

      expect(response.body.user).toMatchObject({
        email: E2E_USERS.chef.email,
        firstName: E2E_USERS.chef.firstName,
        lastName: E2E_USERS.chef.lastName,
        roleLevel: E2E_USERS.chef.roleLevel,
      });
    });

    it('should authenticate bartender user (L1)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: E2E_USERS.bartender.email,
          password: E2E_USERS.bartender.password,
        })
        .expect(200);

      expect(response.body.user).toMatchObject({
        email: E2E_USERS.bartender.email,
        firstName: E2E_USERS.bartender.firstName,
        lastName: E2E_USERS.bartender.lastName,
        roleLevel: E2E_USERS.bartender.roleLevel,
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
