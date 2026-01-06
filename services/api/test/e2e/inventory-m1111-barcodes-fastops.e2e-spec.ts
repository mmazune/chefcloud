/**
 * M11.11 Barcodes + Fast Ops E2E Tests
 * 
 * Tests barcode CRUD, resolution, and fast operations.
 * Validates hypotheses H1-H8 from M11.11_HYPOTHESES.md
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { createTestUser, getTestJwt, TEST_ORG_ID, TEST_BRANCH_ID } from './helpers/auth-helper';

describe('M11.11 Barcodes + Fast Ops (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminJwt: string;
  let teamMemberJwt: string;
  let testItemId: string;
  let testLocationId: string;
  let testBarcodeId: string;
  let testStocktakeSessionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create test users
    adminJwt = await getTestJwt(app, 'L5_ADMIN');
    teamMemberJwt = await getTestJwt(app, 'L2_TEAM_MEMBER');

    // Create test item
    const item = await prisma.client.inventoryItem.create({
      data: {
        orgId: TEST_ORG_ID,
        name: 'Test Barcode Item M1111',
        sku: 'M1111-SKU-001',
        unit: 'EA',
        isActive: true,
      },
    });
    testItemId = item.id;

    // Create test location
    const location = await prisma.client.inventoryLocation.create({
      data: {
        orgId: TEST_ORG_ID,
        branchId: TEST_BRANCH_ID,
        name: 'M1111 Test Location',
        locationType: 'STORAGE',
        isActive: true,
      },
    });
    testLocationId = location.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.client.inventoryItemBarcode.deleteMany({
      where: { itemId: testItemId },
    });
    await prisma.client.inventoryItem.deleteMany({
      where: { sku: 'M1111-SKU-001' },
    });
    await prisma.client.inventoryLocation.deleteMany({
      where: { name: 'M1111 Test Location' },
    });
    await app.close();
  });

  // ============================================
  // Feature Group A: Barcode CRUD
  // ============================================

  describe('Barcode CRUD', () => {
    it('should create item barcode (L4+)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/items/${testItemId}/barcodes`)
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({
          value: '1234567890123',
          format: 'EAN13',
          isPrimary: true,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.value).toBe('1234567890123');
      expect(res.body.format).toBe('EAN13');
      expect(res.body.isPrimary).toBe(true);
      testBarcodeId = res.body.id;
    });

    it('should reject duplicate barcode value in same org (H2)', async () => {
      await request(app.getHttpServer())
        .post(`/inventory/items/${testItemId}/barcodes`)
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({
          value: '1234567890123', // Same as above
          format: 'EAN13',
        })
        .expect(409); // Conflict
    });

    it('should list item barcodes', async () => {
      const res = await request(app.getHttpServer())
        .get(`/inventory/items/${testItemId}/barcodes`)
        .set('Authorization', `Bearer ${adminJwt}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].value).toBe('1234567890123');
    });

    it('should allow L2 to read barcodes', async () => {
      const res = await request(app.getHttpServer())
        .get(`/inventory/items/${testItemId}/barcodes`)
        .set('Authorization', `Bearer ${teamMemberJwt}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should deny L2 from creating barcodes', async () => {
      await request(app.getHttpServer())
        .post(`/inventory/items/${testItemId}/barcodes`)
        .set('Authorization', `Bearer ${teamMemberJwt}`)
        .send({
          value: '9999999999999',
          format: 'EAN13',
        })
        .expect(403);
    });
  });

  // ============================================
  // Feature Group B: Barcode Resolution
  // ============================================

  describe('Barcode Resolution (H1: Org Scoping)', () => {
    it('should resolve barcode to item', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/barcodes/resolve?value=1234567890123')
        .set('Authorization', `Bearer ${adminJwt}`)
        .expect(200);

      expect(res.body.type).toBe('ITEM');
      expect(res.body.itemId).toBe(testItemId);
      expect(res.body.name).toBe('Test Barcode Item M1111');
      expect(res.body.isActive).toBe(true);
    });

    it('should return 404 for unknown barcode', async () => {
      await request(app.getHttpServer())
        .get('/inventory/barcodes/resolve?value=UNKNOWN999')
        .set('Authorization', `Bearer ${adminJwt}`)
        .expect(404);
    });

    it('should normalize barcode (trim whitespace)', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/barcodes/resolve?value=%20%201234567890123%20%20')
        .set('Authorization', `Bearer ${adminJwt}`)
        .expect(200);

      expect(res.body.itemId).toBe(testItemId);
    });
  });

  // ============================================
  // Feature Group C: Fast Ops
  // ============================================

  describe('Fast Receive', () => {
    it('should fast receive by barcode', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/ops/receive')
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({
          branchId: TEST_BRANCH_ID,
          locationId: testLocationId,
          barcodeValue: '1234567890123',
          qty: 10,
          notes: 'E2E test receive',
        })
        .expect(201);

      expect(res.body.itemId).toBe(testItemId);
      expect(res.body.ledgerEntryId).toBeDefined();
      expect(res.body.receivedQty).toBe('10');
      expect(parseFloat(res.body.newOnHand)).toBeGreaterThanOrEqual(10);
    });

    it('should support idempotent receive', async () => {
      const idempotencyKey = `test-idempotency-${Date.now()}`;

      // First call
      const res1 = await request(app.getHttpServer())
        .post('/inventory/ops/receive')
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({
          branchId: TEST_BRANCH_ID,
          locationId: testLocationId,
          barcodeValue: '1234567890123',
          qty: 5,
          idempotencyKey,
        })
        .expect(201);

      // Second call with same key
      const res2 = await request(app.getHttpServer())
        .post('/inventory/ops/receive')
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({
          branchId: TEST_BRANCH_ID,
          locationId: testLocationId,
          barcodeValue: '1234567890123',
          qty: 5,
          idempotencyKey,
        })
        .expect(201);

      expect(res2.body.idempotent).toBe(true);
      expect(res2.body.ledgerEntryId).toBe(res1.body.ledgerEntryId);
    });
  });

  describe('Fast Waste (H3: Lot Status Check)', () => {
    it('should fast waste by barcode', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/ops/waste')
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({
          branchId: TEST_BRANCH_ID,
          locationId: testLocationId,
          barcodeValue: '1234567890123',
          qty: 2,
          reason: 'Damaged',
          notes: 'E2E test waste',
        })
        .expect(201);

      expect(res.body.itemId).toBe(testItemId);
      expect(res.body.ledgerEntryId).toBeDefined();
      expect(res.body.wastedQty).toBe('2');
    });

    it('should require L3+ for waste', async () => {
      await request(app.getHttpServer())
        .post('/inventory/ops/waste')
        .set('Authorization', `Bearer ${teamMemberJwt}`)
        .send({
          branchId: TEST_BRANCH_ID,
          locationId: testLocationId,
          barcodeValue: '1234567890123',
          qty: 1,
        })
        .expect(403);
    });
  });

  describe('Fast Transfer', () => {
    let secondLocationId: string;

    beforeAll(async () => {
      const location = await prisma.client.inventoryLocation.create({
        data: {
          orgId: TEST_ORG_ID,
          branchId: TEST_BRANCH_ID,
          name: 'M1111 Transfer Target',
          locationType: 'STORAGE',
          isActive: true,
        },
      });
      secondLocationId = location.id;
    });

    afterAll(async () => {
      await prisma.client.inventoryLocation.deleteMany({
        where: { name: 'M1111 Transfer Target' },
      });
    });

    it('should fast transfer by barcode', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/ops/transfer')
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({
          fromLocationId: testLocationId,
          toLocationId: secondLocationId,
          barcodeValue: '1234567890123',
          qty: 3,
          notes: 'E2E test transfer',
        })
        .expect(201);

      expect(res.body.itemId).toBe(testItemId);
      expect(res.body.fromLedgerEntryId).toBeDefined();
      expect(res.body.toLedgerEntryId).toBeDefined();
      expect(res.body.transferredQty).toBe('3');
    });
  });

  // ============================================
  // Feature Group D: Fast Stocktake Scan (H4)
  // ============================================

  describe('Fast Stocktake Scan (H4: Upsert Line)', () => {
    beforeAll(async () => {
      // Create a stocktake session
      const session = await prisma.client.stocktakeSession.create({
        data: {
          orgId: TEST_ORG_ID,
          branchId: TEST_BRANCH_ID,
          locationId: testLocationId,
          name: 'M1111 Test Stocktake',
          status: 'IN_PROGRESS',
          blindCount: false,
          totalLines: 0,
        },
      });
      testStocktakeSessionId = session.id;
    });

    afterAll(async () => {
      await prisma.client.stocktakeLine.deleteMany({
        where: { sessionId: testStocktakeSessionId },
      });
      await prisma.client.stocktakeSession.deleteMany({
        where: { id: testStocktakeSessionId },
      });
    });

    it('should create stocktake line on first scan', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/ops/stocktake/${testStocktakeSessionId}/scan`)
        .set('Authorization', `Bearer ${teamMemberJwt}`)
        .send({
          barcodeValue: '1234567890123',
          countedQty: 15,
        })
        .expect(201);

      expect(res.body.isNew).toBe(true);
      expect(res.body.itemId).toBe(testItemId);
      expect(res.body.countedQty).toBe('15');
    });

    it('should update existing line on rescan (H4 upsert)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/ops/stocktake/${testStocktakeSessionId}/scan`)
        .set('Authorization', `Bearer ${teamMemberJwt}`)
        .send({
          barcodeValue: '1234567890123',
          countedQty: 20, // Different quantity
        })
        .expect(201);

      expect(res.body.isUpdate).toBe(true);
      expect(res.body.countedQty).toBe('20');
    });
  });

  // ============================================
  // Feature Group E: Export (H6)
  // ============================================

  describe('Barcode Export (H6: Hash Verification)', () => {
    it('should export barcodes as CSV with hash', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/barcodes/export')
        .set('Authorization', `Bearer ${adminJwt}`)
        .expect(200)
        .expect('Content-Type', /text\/csv/);

      expect(res.headers['x-content-hash']).toBeDefined();
      expect(res.headers['x-content-hash']).toHaveLength(64); // SHA256 hex
      expect(res.text).toContain('value,format,type');
    });

    it('should require L4+ for export', async () => {
      await request(app.getHttpServer())
        .get('/inventory/barcodes/export')
        .set('Authorization', `Bearer ${teamMemberJwt}`)
        .expect(403);
    });
  });

  // ============================================
  // Feature Group F: Barcode Deletion
  // ============================================

  describe('Barcode Deletion', () => {
    it('should delete barcode', async () => {
      await request(app.getHttpServer())
        .delete(`/inventory/items/${testItemId}/barcodes/${testBarcodeId}`)
        .set('Authorization', `Bearer ${adminJwt}`)
        .expect(200);

      // Verify deleted
      await request(app.getHttpServer())
        .get('/inventory/barcodes/resolve?value=1234567890123')
        .set('Authorization', `Bearer ${adminJwt}`)
        .expect(404);
    });
  });
});
