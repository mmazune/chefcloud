import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { createOrgWithUsers, createInventory, disconnect } from './factory';

describe('Inventory E2E', () => {
  let app: INestApplication;
  let authToken: string;
  let beefId: string;
  let orgId: string;
  let branchId: string;

  beforeAll(async () => {
    const factory = await createOrgWithUsers('e2e-inventory');
    const inventory = await createInventory(factory.orgId);

    orgId = factory.orgId;
    branchId = factory.branchId;
    beefId = inventory.beef.id;

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

    // Login as manager
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: factory.users.manager.email,
        password: 'Test#123',
      });

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
    await disconnect();
  });

  it('should receive PO → on-hand increases', async () => {
    // Get initial on-hand
    const initialResponse = await request(app.getHttpServer())
      .get(`/inventory/items/${beefId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const initialOnHand = initialResponse.body.onHand || 0;

    // Create PO
    const poResponse = await request(app.getHttpServer())
      .post('/inventory/purchase-orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        vendorName: 'Test Vendor',
        items: [
          {
            inventoryItemId: beefId,
            qty: 10,
            unitCost: 20000,
          },
        ],
      })
      .expect(201);

    const poId = poResponse.body.id;

    // Receive PO
    await request(app.getHttpServer())
      .post(`/inventory/purchase-orders/${poId}/receive`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [
          {
            inventoryItemId: beefId,
            qtyReceived: 10,
          },
        ],
      })
      .expect(201);

    // Verify on-hand increased
    const finalResponse = await request(app.getHttpServer())
      .get(`/inventory/items/${beefId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(finalResponse.body.onHand).toBe(initialOnHand + 10);
  });
});
