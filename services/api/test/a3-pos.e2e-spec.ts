import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createE2EApp } from './helpers/e2e-bootstrap';
import { cleanup } from './helpers/cleanup';
import { E2E_USERS, DEMO_DATASETS } from './helpers/e2e-credentials';
import { requireMenuItems, requireFloorPlan } from './helpers/require-preconditions';
import { PrismaService } from '../src/prisma.service';

describe('A3 POS Core (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let burgerId: string;
  let friesId: string;
  let tableId: string;

  beforeAll(async () => {
    app = await createE2EApp({ imports: [AppModule] });
    const prisma = app.get<PrismaService>(PrismaService);

    // Preconditions: require Burger, Fries menu items and floor plan for POS flow
    await requireMenuItems(prisma.client, { 
      orgSlug: DEMO_DATASETS.DEMO_TAPAS.slug, 
      itemNames: ['Burger', 'Fries'] 
    });
    await requireFloorPlan(prisma.client, { orgSlug: DEMO_DATASETS.DEMO_TAPAS.slug });

    // Login as waiter
    const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
      email: E2E_USERS.waiter.email,
      password: E2E_USERS.waiter.password,
    });

    authToken = loginResponse.body.access_token;

    // Get menu items
    const menuResponse = await request(app.getHttpServer())
      .get('/menu/items')
      .set('Authorization', `Bearer ${authToken}`);

    const burger = menuResponse.body.find((item: any) => item.name === 'Burger');
    const fries = menuResponse.body.find((item: any) => item.name === 'Fries');
    burgerId = burger.id;
    friesId = fries.id;

    // Get tables
    const floorResponse = await request(app.getHttpServer())
      .get('/floor')
      .set('Authorization', `Bearer ${authToken}`);

    tableId = floorResponse.body.floorPlans[0]?.tables[0]?.id;
  });

  afterAll(async () => {
    await cleanup(app);
  });

  it('should create order with burger+fries -> send-to-kitchen -> kds queue shows ticket -> mark ready -> close order', async () => {
    // Create order
    const createResponse = await request(app.getHttpServer())
      .post('/pos/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        tableId,
        serviceType: 'DINE_IN',
        items: [
          { menuItemId: burgerId, qty: 1, modifiers: [] },
          { menuItemId: friesId, qty: 1, modifiers: [] },
        ],
      })
      .expect(201);

    const orderId = createResponse.body.id;
    expect(createResponse.body.status).toBe('NEW');

    // Send to kitchen
    const sendResponse = await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/send-to-kitchen`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    expect(sendResponse.body.status).toBe('SENT');

    // Check KDS queue for GRILL station
    const queueResponse = await request(app.getHttpServer())
      .get('/kds/queue?station=GRILL')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(queueResponse.body.length).toBeGreaterThan(0);
    const grillTicket = queueResponse.body.find((t: any) => t.orderId === orderId);
    expect(grillTicket).toBeDefined();

    // Mark GRILL ticket as ready
    await request(app.getHttpServer())
      .post(`/kds/tickets/${grillTicket.id}/mark-ready`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    // Check FRYER queue
    const fryerQueueResponse = await request(app.getHttpServer())
      .get('/kds/queue?station=FRYER')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const fryerTicket = fryerQueueResponse.body.find((t: any) => t.orderId === orderId);
    expect(fryerTicket).toBeDefined();

    // Mark FRYER ticket as ready
    await request(app.getHttpServer())
      .post(`/kds/tickets/${fryerTicket.id}/mark-ready`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    // Close order
    const closeResponse = await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/close`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 30000 })
      .expect(201);

    expect(closeResponse.body.status).toBe('CLOSED');
  });

  it('should create order with burger only -> send-to-kitchen -> order has NO_DRINKS anomaly flag', async () => {
    // Create order with only burger (no drinks)
    const createResponse = await request(app.getHttpServer())
      .post('/pos/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        tableId,
        serviceType: 'DINE_IN',
        items: [{ menuItemId: burgerId, qty: 1, modifiers: [] }],
      })
      .expect(201);

    const orderId = createResponse.body.id;

    // Send to kitchen
    const sendResponse = await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/send-to-kitchen`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    expect(sendResponse.body.anomalyFlags).toContain('NO_DRINKS');
  });
});
