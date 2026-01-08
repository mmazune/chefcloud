/**
 * M12.4: Inventory Close Approvals + Dashboard E2E Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { createOrgWithUsers, FactoryOrg } from './factory';
import { cleanup } from '../helpers/cleanup';
import { createE2ETestingModule } from '../helpers/e2e-bootstrap';

jest.setTimeout(120_000);

const testSuffix = Date.now().toString(36);

describe('M12.4 Close Approvals + Dashboard', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factory: FactoryOrg;

  let ownerToken: string; // L5
  let managerToken: string; // L4

  let periodIdJan: string;
  let periodIdFeb: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await createE2ETestingModule({ imports: [AppModule] });

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    );

    await app.init();

    prisma = app.get(PrismaService);
    factory = await createOrgWithUsers(prisma, `e2e-m124-${testSuffix}`);

    // Login users
    const loginOwner = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: factory.users.owner.email, password: 'Test#123' });
    ownerToken = loginOwner.body.access_token;

    const loginManager = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: factory.users.manager.email, password: 'Test#123' });
    managerToken = loginManager.body.access_token;

    // Generate January and February periods to avoid creation issues
    await request(app.getHttpServer())
      .post('/inventory/periods/generate')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ branchId: factory.branchId, fromMonth: '2025-01', toMonth: '2025-02' })
      .expect(200);

    // List periods and capture IDs for Jan/Feb
    const listRes = await request(app.getHttpServer())
      .get('/inventory/periods')
      .query({ branchId: factory.branchId })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const periods = Array.isArray(listRes.body)
      ? listRes.body
      : Array.isArray(listRes.body.periods)
        ? listRes.body.periods
        : [];

    const jan = periods.find((p: any) => new Date(p.startDate).toISOString().startsWith('2025-01-01'));
    const feb = periods.find((p: any) => new Date(p.startDate).toISOString().startsWith('2025-02-01'));

    if (!jan || !feb) {
      throw new Error('Failed to locate generated Jan/Feb periods');
    }
    periodIdJan = jan.id;
    periodIdFeb = feb.id;
  }, 90000);

  afterAll(async () => {
    await cleanup(app);
  });

  it('requires APPROVED request to close; then closes after approval', async () => {
    // Manager creates and submits close request for January
    const createRes = await request(app.getHttpServer())
      .post(`/inventory/periods/${periodIdJan}/close-requests`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(201);
    const requestId = createRes.body.id;

    await request(app.getHttpServer())
      .post(`/inventory/periods/close-requests/${requestId}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    // Manager attempts to close without approval -> 403 CLOSE_APPROVAL_REQUIRED
    await request(app.getHttpServer())
      .post('/inventory/periods/close')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        branchId: factory.branchId,
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-01-31T23:59:59.999Z',
        lockReason: 'Jan Close',
      })
      .expect(403);

    // Owner approves
    await request(app.getHttpServer())
      .post(`/inventory/periods/close-requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ notes: 'Approving Jan close' })
      .expect(200);

    // Manager closes successfully
    const closeRes = await request(app.getHttpServer())
      .post('/inventory/periods/close')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        branchId: factory.branchId,
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-01-31T23:59:59.999Z',
        lockReason: 'Jan Close',
      })
      .expect(200);

    expect(closeRes.body.status).toBe('CLOSED');
  });

  it('allows force-close by L5 with reason and logs event', async () => {
    // Owner force-closes February period without approval
    const closeRes = await request(app.getHttpServer())
      .post('/inventory/periods/close')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        branchId: factory.branchId,
        startDate: '2025-02-01T00:00:00.000Z',
        endDate: '2025-02-28T23:59:59.999Z',
        lockReason: 'Feb Close',
        forceClose: true,
        forceCloseReason: 'Urgent closing due to audit cutoff',
      })
      .expect(200);

    expect(closeRes.body.status).toBe('CLOSED');

    // Check period events include FORCE_CLOSE_USED
    const eventsRes = await request(app.getHttpServer())
      .get(`/inventory/periods/${periodIdFeb}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const hasForceEvent = (eventsRes.body.events || eventsRes.body).some((e: any) => e.type === 'FORCE_CLOSE_USED');
    expect(hasForceEvent).toBe(true);
  });

  it('returns dashboard row with close request status', async () => {
    const res = await request(app.getHttpServer())
      .get('/inventory/periods/dashboard')
      .query({ branchId: factory.branchId })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.rows).toBeDefined();
    expect(Array.isArray(res.body.rows)).toBe(true);
    // Row for branch should exist
    const row = res.body.rows.find((r: any) => r.branchId === factory.branchId);
    expect(row).toBeDefined();
    // closeRequest may be null if period is already closed; ensure field exists
    expect('closeRequest' in row).toBe(true);
  });
});
