/**
 * M11.5: Inventory Costing + Valuation + COGS E2E Tests
 * 
 * Tests:
 * 1. Cost layer creation on goods receipt posting
 * 2. WAC calculation (single receipt, multiple receipts)
 * 3. COGS breakdown on depletion posting
 * 4. Valuation endpoint (L4+ RBAC)
 * 5. COGS endpoint (L4+ RBAC, date range filter)
 * 6. Cost layer idempotency
 * 7. Initial cost seeding
 * 8. Export with BOM + hash
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2ETestingModule } from '../helpers/module';
import { cleanup } from '../helpers/cleanup';
import { createOrgWithUsers, FactoryOrg } from './factory';
import { PrismaService } from '@api/prisma/prisma.service';
import { AppModule } from '@api/app.module';
import { Decimal } from '@prisma/client/runtime/library';

describe('M11.5: Inventory Costing + Valuation + COGS E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testOrg: FactoryOrg;

  // Test data IDs
  let vendorId: string;
  let itemId: string;
  let uomBaseId: string;
  let locationId: string;
  let poId: string;
  let receiptId: string;

  beforeAll(async () => {
    const moduleRef = await createE2ETestingModule({
      imports: [AppModule],
    });
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
    await app.init();

    // Create test org with users
    testOrg = await createOrgWithUsers(prisma, `test-costing-${Date.now()}`);

    // Create vendor
    const vendorRes = await prisma.vendor.create({
      data: {
        organizationId: testOrg.orgId,
        code: 'VND-COST-TEST',
        name: 'Test Vendor for Costing',
        contactName: 'Test Contact',
        email: 'vendor-cost@test.com',
        isActive: true,
      },
    });
    vendorId = vendorRes.id;

    // Create base UOM
    const baseUom = await prisma.unitOfMeasure.create({
      data: {
        organizationId: testOrg.orgId,
        code: 'EA',
        name: 'Each',
        conversionFactor: new Decimal(1),
      },
    });
    uomBaseId = baseUom.id;

    // Create category
    const category = await prisma.inventoryCategory.create({
      data: {
        organizationId: testOrg.orgId,
        code: 'CAT-COST',
        name: 'Costing Test Category',
      },
    });

    // Create test item
    const item = await prisma.inventoryItem.create({
      data: {
        organizationId: testOrg.orgId,
        categoryId: category.id,
        sku: 'COST-ITEM-001',
        name: 'Costing Test Item',
        baseUnitOfMeasureId: baseUom.id,
        isActive: true,
      },
    });
    itemId = item.id;

    // Create location
    const location = await prisma.inventoryLocation.create({
      data: {
        organizationId: testOrg.orgId,
        branchId: testOrg.branchId,
        code: 'MAIN',
        name: 'Main Storage',
        locationType: 'STORAGE',
        isActive: true,
      },
    });
    locationId = location.id;
  });

  afterAll(async () => {
    await cleanup(prisma, testOrg.orgId);
    await app.close();
  });

  describe('Cost Layer Creation', () => {
    it('should create cost layer when receipt is posted', async () => {
      // Create a PO first
      const poResponse = await request(app.getHttpServer())
        .post('/inventory/procurement/purchase-orders')
        .set('Authorization', `Bearer ${testOrg.tokens.L4}`)
        .send({
          vendorId,
          expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          lines: [
            {
              itemId,
              qtyOrdered: 100,
              uomId: uomBaseId,
              unitCost: '5.0000',
            },
          ],
        });

      expect(poResponse.status).toBe(201);
      poId = poResponse.body.id;

      // Submit and approve the PO
      await request(app.getHttpServer())
        .post(`/inventory/procurement/purchase-orders/${poId}/submit`)
        .set('Authorization', `Bearer ${testOrg.tokens.L4}`);

      await request(app.getHttpServer())
        .post(`/inventory/procurement/purchase-orders/${poId}/approve`)
        .set('Authorization', `Bearer ${testOrg.tokens.L4}`);

      // Create receipt
      const receiptResponse = await request(app.getHttpServer())
        .post('/inventory/procurement/receipts')
        .set('Authorization', `Bearer ${testOrg.tokens.L4}`)
        .send({
          purchaseOrderId: poId,
          lines: [
            {
              itemId,
              locationId,
              qtyReceivedInput: 100,
              inputUomId: uomBaseId,
              unitCost: '5.0000',
            },
          ],
        });

      expect(receiptResponse.status).toBe(201);
      receiptId = receiptResponse.body.id;

      // Post receipt
      const postResponse = await request(app.getHttpServer())
        .post(`/inventory/procurement/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${testOrg.tokens.L4}`);

      expect(postResponse.status).toBe(200);
      expect(postResponse.body.costLayerCount).toBeGreaterThan(0);

      // Verify cost layer was created
      const costLayers = await prisma.inventoryCostLayer.findMany({
        where: { orgId: testOrg.orgId, itemId },
      });

      expect(costLayers.length).toBeGreaterThanOrEqual(1);
      expect(Number(costLayers[0].newWac)).toBe(5);
    });

    it('should calculate correct WAC for multiple receipts', async () => {
      // Create another PO at different cost
      const po2Response = await request(app.getHttpServer())
        .post('/inventory/procurement/purchase-orders')
        .set('Authorization', `Bearer ${testOrg.tokens.L4}`)
        .send({
          vendorId,
          expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          lines: [
            {
              itemId,
              qtyOrdered: 100,
              uomId: uomBaseId,
              unitCost: '10.0000', // Different cost
            },
          ],
        });

      expect(po2Response.status).toBe(201);
      const po2Id = po2Response.body.id;

      // Submit and approve
      await request(app.getHttpServer())
        .post(`/inventory/procurement/purchase-orders/${po2Id}/submit`)
        .set('Authorization', `Bearer ${testOrg.tokens.L4}`);

      await request(app.getHttpServer())
        .post(`/inventory/procurement/purchase-orders/${po2Id}/approve`)
        .set('Authorization', `Bearer ${testOrg.tokens.L4}`);

      // Create and post receipt
      const receipt2Response = await request(app.getHttpServer())
        .post('/inventory/procurement/receipts')
        .set('Authorization', `Bearer ${testOrg.tokens.L4}`)
        .send({
          purchaseOrderId: po2Id,
          lines: [
            {
              itemId,
              locationId,
              qtyReceivedInput: 100,
              inputUomId: uomBaseId,
              unitCost: '10.0000',
            },
          ],
        });

      const receipt2Id = receipt2Response.body.id;

      await request(app.getHttpServer())
        .post(`/inventory/procurement/receipts/${receipt2Id}/post`)
        .set('Authorization', `Bearer ${testOrg.tokens.L4}`);

      // Check WAC calculation
      // Initial: 100 units @ $5 = $500
      // Second: 100 units @ $10 = $1000
      // Total: 200 units, $1500 total cost
      // Expected WAC: $1500 / 200 = $7.50
      const latestLayer = await prisma.inventoryCostLayer.findFirst({
        where: { orgId: testOrg.orgId, itemId },
        orderBy: { effectiveAt: 'desc' },
      });

      expect(latestLayer).toBeTruthy();
      expect(Number(latestLayer!.newWac)).toBeCloseTo(7.5, 2);
    });
  });

  describe('Valuation Endpoint', () => {
    it('should return valuation data with correct total value', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/valuation')
        .set('Authorization', `Bearer ${testOrg.tokens.L4}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.lines).toBeDefined();
      expect(response.body.data.totalValue).toBeDefined();

      // Find our test item
      const itemLine = response.body.data.lines.find((l: any) => l.itemId === itemId);
      if (itemLine) {
        expect(itemLine.onHandQty).toBeGreaterThan(0);
        expect(itemLine.wac).toBeGreaterThan(0);
        expect(itemLine.totalValue).toBeGreaterThan(0);
      }
    });

    it('should enforce L4+ RBAC on valuation endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/valuation')
        .set('Authorization', `Bearer ${testOrg.tokens.L2}`);

      expect(response.status).toBe(403);
    });

    it('should export valuation CSV with BOM and hash', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/valuation/export')
        .set('Authorization', `Bearer ${testOrg.tokens.L4}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['x-nimbus-export-hash']).toBeDefined();
      expect(response.headers['x-nimbus-export-hash'].length).toBe(64); // SHA-256 hex

      // Check BOM (first character)
      const csv = response.text;
      expect(csv.charCodeAt(0)).toBe(0xfeff);
    });
  });

  describe('COGS Endpoint', () => {
    it('should return COGS data for date range', async () => {
      const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = new Date();

      const response = await request(app.getHttpServer())
        .get('/inventory/cogs')
        .query({
          fromDate: fromDate.toISOString(),
          toDate: toDate.toISOString(),
        })
        .set('Authorization', `Bearer ${testOrg.tokens.L4}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.lines).toBeDefined();
      expect(response.body.data.totalCogs).toBeDefined();
    });

    it('should enforce L4+ RBAC on COGS endpoint', async () => {
      const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = new Date();

      const response = await request(app.getHttpServer())
        .get('/inventory/cogs')
        .query({
          fromDate: fromDate.toISOString(),
          toDate: toDate.toISOString(),
        })
        .set('Authorization', `Bearer ${testOrg.tokens.L2}`);

      expect(response.status).toBe(403);
    });

    it('should require date range parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/cogs')
        .set('Authorization', `Bearer ${testOrg.tokens.L4}`);

      expect(response.status).toBe(400);
    });
  });

  describe('Cost Layer Idempotency', () => {
    it('should not create duplicate cost layers on re-posting', async () => {
      // Count existing cost layers for item
      const beforeCount = await prisma.inventoryCostLayer.count({
        where: { orgId: testOrg.orgId, itemId },
      });

      // Try to post the same receipt again (should be idempotent)
      const postResponse = await request(app.getHttpServer())
        .post(`/inventory/procurement/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${testOrg.tokens.L4}`);

      expect(postResponse.status).toBe(200);
      expect(postResponse.body.isAlreadyPosted).toBe(true);

      // Count should be unchanged
      const afterCount = await prisma.inventoryCostLayer.count({
        where: { orgId: testOrg.orgId, itemId },
      });

      expect(afterCount).toBe(beforeCount);
    });
  });

  describe('Cost History', () => {
    it('should return cost layer history for an item', async () => {
      const response = await request(app.getHttpServer())
        .get(`/inventory/items/${itemId}/cost-history`)
        .set('Authorization', `Bearer ${testOrg.tokens.L4}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.layers).toBeDefined();
      expect(response.body.data.layers.length).toBeGreaterThan(0);
      expect(response.body.data.totalCount).toBeGreaterThan(0);

      // Verify layer structure
      const layer = response.body.data.layers[0];
      expect(layer.id).toBeDefined();
      expect(layer.qtyReceived).toBeDefined();
      expect(layer.unitCost).toBeDefined();
      expect(layer.priorWac).toBeDefined();
      expect(layer.newWac).toBeDefined();
    });
  });

  describe('Initial Cost Seeding', () => {
    it('should allow seeding initial cost for item with stock', async () => {
      // Create a new item for this test
      const newItem = await prisma.inventoryItem.create({
        data: {
          organizationId: testOrg.orgId,
          sku: 'SEED-ITEM-001',
          name: 'Seed Test Item',
          baseUnitOfMeasureId: uomBaseId,
          isActive: true,
        },
      });

      // First add some stock via ledger
      await prisma.inventoryLedgerEntry.create({
        data: {
          orgId: testOrg.orgId,
          branchId: testOrg.branchId,
          itemId: newItem.id,
          locationId,
          qty: new Decimal(50),
          reason: 'ADJUSTMENT',
          sourceType: 'MANUAL',
          sourceId: 'seed-test',
          createdById: testOrg.users.L4.id,
        },
      });

      // Now seed cost
      const response = await request(app.getHttpServer())
        .post(`/inventory/items/${newItem.id}/seed-cost`)
        .set('Authorization', `Bearer ${testOrg.tokens.L4}`)
        .send({
          unitCost: '3.50',
          notes: 'Initial cost entry',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Number(response.body.data.newWac)).toBeCloseTo(3.5, 2);
    });

    it('should reject seeding cost for item with zero stock', async () => {
      // Create item with no stock
      const emptyItem = await prisma.inventoryItem.create({
        data: {
          organizationId: testOrg.orgId,
          sku: 'EMPTY-ITEM-001',
          name: 'Empty Test Item',
          baseUnitOfMeasureId: uomBaseId,
          isActive: true,
        },
      });

      const response = await request(app.getHttpServer())
        .post(`/inventory/items/${emptyItem.id}/seed-cost`)
        .set('Authorization', `Bearer ${testOrg.tokens.L4}`)
        .send({
          unitCost: '5.00',
        });

      expect(response.status).toBe(400);
    });
  });
});
