import { Test, TestingModule } from '@nestjs/testing';
import { createE2ETestingModule, createE2ETestingModuleBuilder } from '../helpers/e2e-bootstrap';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { createOrgWithUsers, createInventory } from './factory';
import { cleanup } from '../helpers/cleanup';

describe('Inventory E2E', () => {
  let app: INestApplication;
  let authToken: string;
  let beefId: string;
  let _orgId: string;
  let _branchId: string;

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
    const factory = await createOrgWithUsers(prisma, 'e2e-inventory');
    const inventory = await createInventory(prisma, factory.orgId);

    _orgId = factory.orgId;
    _branchId = factory.branchId;
    beefId = inventory.beef.id;

    // Login as manager
    const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
      email: factory.users.manager.email,
      password: 'Test#123',
    });

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await cleanup(app);
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
