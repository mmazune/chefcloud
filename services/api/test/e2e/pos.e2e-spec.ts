import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { createOrgWithUsers, createMenu, createFloor, disconnect } from './factory';

describe('POS E2E', () => {
  let app: INestApplication;
  let authToken: string;
  let burgerId: string;
  let friesId: string;
  let tableId: string;

  beforeAll(async () => {
    const factory = await createOrgWithUsers('e2e-pos');
    const menu = await createMenu(factory.orgId, factory.branchId);
    const floor = await createFloor(factory.orgId, factory.branchId);

    burgerId = menu.burger.id;
    friesId = menu.fries.id;
    tableId = floor.table1.id;

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
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: factory.users.waiter.email,
        password: 'Test#123',
      });

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
    await disconnect();
  });

  it('should create order → send-to-kitchen → close', async () => {
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
    await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/send-to-kitchen`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    // Close order (payment)
    const closeResponse = await request(app.getHttpServer())
      .post(`/pos/orders/${orderId}/close`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        paymentMethod: 'CASH',
        amountTendered: 25000,
      })
      .expect(201);

    expect(closeResponse.body.status).toBe('COMPLETED');
    expect(closeResponse.body.total).toBeGreaterThan(0);
  });
});
