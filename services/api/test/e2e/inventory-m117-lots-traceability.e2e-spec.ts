/**
 * M11.7: Inventory Lots + Expiry + Traceability E2E Tests
 *
 * Hypotheses Tested:
 * H1: InventoryLot model stores lot-level data (lotNumber, expiryDate, remainingQty)
 * H2: LotLedgerAllocation links consumption to source (orders, waste, transfers)
 * H3: FEFO allocation depletes soonest-expiring lots first (expiryDate ASC NULLS LAST)
 * H4: Lot-aware transfers track lotId on transfer lines
 * H5: Lot-aware waste tracks lotId on waste lines
 * H6: Traceability API returns full allocation history for a lot
 * H7: Expiring soon report filters lots by threshold days
 * H8: Expired lots are excluded from automatic FEFO allocation
 *
 * Tests:
 * 1. Create lot with expiry date
 * 2. Create lot without expiry (non-perishable)
 * 3. FEFO allocation: earliest expiry consumed first
 * 4. FEFO allocation: null expiry allocated last
 * 5. Expired lots excluded from allocation
 * 6. Quarantine lot blocks allocation
 * 7. Release lot restores allocation eligibility
 * 8. Traceability returns allocation history
 * 9. Expiring soon endpoint with threshold
 * 10. Lot decrement creates LotLedgerAllocation
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2ETestingModule } from '../helpers/module';
import { cleanup } from '../helpers/cleanup';
import { createOrgWithUsers, FactoryOrg } from './factory';
import { PrismaService } from '@api/prisma/prisma.service';
import { AppModule } from '@api/app.module';
import { Decimal } from '@prisma/client/runtime/library';

describe('M11.7: Inventory Lots + Expiry + Traceability E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testOrg: FactoryOrg;

  // Test data IDs
  let itemId: string;
  let locationId: string;
  let branchId: string;
  let uomId: string;
  let categoryId: string;

  // Lot IDs for testing
  let lotExpiresSoon: string;
  let lotExpiresLater: string;
  let lotNoExpiry: string;
  let lotExpired: string;

  beforeAll(async () => {
    const moduleRef = await createE2ETestingModule({
      imports: [AppModule],
    });
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
    await app.init();

    // Create test org with users
    testOrg = await createOrgWithUsers(prisma, `test-lots-m117-${Date.now()}`);
    branchId = testOrg.branchId;

    // Create base UOM
    const uom = await prisma.unitOfMeasure.create({
      data: {
        organizationId: testOrg.orgId,
        code: 'EA',
        name: 'Each',
        conversionFactor: new Decimal(1),
      },
    });
    uomId = uom.id;

    // Create category
    const category = await prisma.inventoryCategory.create({
      data: {
        organizationId: testOrg.orgId,
        code: 'CAT-LOTS',
        name: 'Lot Test Category',
      },
    });
    categoryId = category.id;

    // Create test item
    const item = await prisma.inventoryItem.create({
      data: {
        organizationId: testOrg.orgId,
        categoryId: category.id,
        sku: 'LOT-ITEM-001',
        name: 'Lot Test Item',
        baseUnitOfMeasureId: uom.id,
        isActive: true,
        trackLots: true,
      },
    });
    itemId = item.id;

    // Create test location
    const location = await prisma.inventoryLocation.create({
      data: {
        organizationId: testOrg.orgId,
        branchId,
        code: 'LOC-LOTS',
        name: 'Lot Test Location',
        locationType: 'STORAGE',
        isActive: true,
      },
    });
    locationId = location.id;

    // Create lots with different expiry dates for FEFO testing
    const now = new Date();
    const expiresSoon = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days
    const expiresLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const expired = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

    // Lot 1: Expires soon (5 days)
    const lot1 = await prisma.inventoryLot.create({
      data: {
        orgId: testOrg.orgId,
        branchId,
        itemId,
        locationId,
        lotNumber: 'LOT-EXPIRES-SOON',
        receivedQty: new Decimal(100),
        remainingQty: new Decimal(100),
        expiryDate: expiresSoon,
        status: 'ACTIVE',
        sourceType: 'GOODS_RECEIPT',
        createdById: testOrg.users.owner.id,
      },
    });
    lotExpiresSoon = lot1.id;

    // Lot 2: Expires later (30 days)
    const lot2 = await prisma.inventoryLot.create({
      data: {
        orgId: testOrg.orgId,
        branchId,
        itemId,
        locationId,
        lotNumber: 'LOT-EXPIRES-LATER',
        receivedQty: new Decimal(100),
        remainingQty: new Decimal(100),
        expiryDate: expiresLater,
        status: 'ACTIVE',
        sourceType: 'GOODS_RECEIPT',
        createdById: testOrg.users.owner.id,
      },
    });
    lotExpiresLater = lot2.id;

    // Lot 3: No expiry (non-perishable)
    const lot3 = await prisma.inventoryLot.create({
      data: {
        orgId: testOrg.orgId,
        branchId,
        itemId,
        locationId,
        lotNumber: 'LOT-NO-EXPIRY',
        receivedQty: new Decimal(50),
        remainingQty: new Decimal(50),
        expiryDate: null,
        status: 'ACTIVE',
        sourceType: 'GOODS_RECEIPT',
        createdById: testOrg.users.owner.id,
      },
    });
    lotNoExpiry = lot3.id;

    // Lot 4: Already expired
    const lot4 = await prisma.inventoryLot.create({
      data: {
        orgId: testOrg.orgId,
        branchId,
        itemId,
        locationId,
        lotNumber: 'LOT-EXPIRED',
        receivedQty: new Decimal(25),
        remainingQty: new Decimal(25),
        expiryDate: expired,
        status: 'EXPIRED',
        sourceType: 'GOODS_RECEIPT',
        createdById: testOrg.users.owner.id,
      },
    });
    lotExpired = lot4.id;
  }, 60000);

  afterAll(async () => {
    await cleanup(app);
  });

  // ============================================================
  // Group 1: Lot CRUD
  // ============================================================
  describe('Group 1: Lot CRUD', () => {
    it('should list lots for the organization', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/lots')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .query({ branchId })
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(res.body.items.length).toBeGreaterThanOrEqual(4);
      expect(res.body.items.some((l: any) => l.lotNumber === 'LOT-EXPIRES-SOON')).toBe(true);
    });

    it('should filter lots by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/lots')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .query({ branchId, status: 'ACTIVE' })
        .expect(200);

      expect(res.body.items.every((l: any) => l.status === 'ACTIVE')).toBe(true);
      expect(res.body.items.some((l: any) => l.status === 'EXPIRED')).toBe(false);
    });

    it('should get single lot details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/inventory/lots/${lotExpiresSoon}`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      expect(res.body.lotNumber).toBe('LOT-EXPIRES-SOON');
      expect(res.body.status).toBe('ACTIVE');
      expect(parseFloat(res.body.remainingQty)).toBe(100);
    });
  });

  // ============================================================
  // Group 2: FEFO Allocation (H3, H8)
  // ============================================================
  describe('Group 2: FEFO Allocation', () => {
    it('H3: FEFO allocates earliest expiry first', async () => {
      // Request 50 units - should consume from LOT-EXPIRES-SOON first
      const res = await request(app.getHttpServer())
        .post('/inventory/lots/allocate')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          branchId,
          itemId,
          locationId,
          requestedQty: 50,
          sourceType: 'ORDER',
          sourceId: 'test-order-001',
        })
        .expect(201);

      expect(res.body).toHaveProperty('allocations');
      expect(res.body.allocations.length).toBeGreaterThanOrEqual(1);
      
      // First allocation should be from the earliest expiring lot
      const firstAllocation = res.body.allocations[0];
      expect(firstAllocation.lotNumber).toBe('LOT-EXPIRES-SOON');
      expect(parseFloat(firstAllocation.allocatedQty)).toBe(50);
    });

    it('H3: FEFO continues to next lot when first is depleted', async () => {
      // First, deplete LOT-EXPIRES-SOON (currently has 100 after previous test)
      await prisma.inventoryLot.update({
        where: { id: lotExpiresSoon },
        data: { remainingQty: new Decimal(20) },
      });

      // Request 50 units - should consume 20 from soon, 30 from later
      const res = await request(app.getHttpServer())
        .post('/inventory/lots/allocate')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          branchId,
          itemId,
          locationId,
          requestedQty: 50,
          sourceType: 'ORDER',
          sourceId: 'test-order-002',
        })
        .expect(201);

      expect(res.body.allocations.length).toBe(2);
      
      // First from LOT-EXPIRES-SOON (20 remaining)
      expect(res.body.allocations[0].lotNumber).toBe('LOT-EXPIRES-SOON');
      expect(parseFloat(res.body.allocations[0].allocatedQty)).toBe(20);
      
      // Then from LOT-EXPIRES-LATER
      expect(res.body.allocations[1].lotNumber).toBe('LOT-EXPIRES-LATER');
      expect(parseFloat(res.body.allocations[1].allocatedQty)).toBe(30);
    });

    it('H3: Null expiry lots allocated last', async () => {
      // Reset lots
      await prisma.inventoryLot.updateMany({
        where: { id: { in: [lotExpiresSoon, lotExpiresLater] } },
        data: { remainingQty: new Decimal(0), status: 'DEPLETED' },
      });

      // Request 30 units - should come from LOT-NO-EXPIRY (null expiry = last)
      const res = await request(app.getHttpServer())
        .post('/inventory/lots/allocate')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          branchId,
          itemId,
          locationId,
          requestedQty: 30,
          sourceType: 'ORDER',
          sourceId: 'test-order-003',
        })
        .expect(201);

      expect(res.body.allocations.length).toBe(1);
      expect(res.body.allocations[0].lotNumber).toBe('LOT-NO-EXPIRY');
    });

    it('H8: Expired lots excluded from allocation', async () => {
      // Only LOT-EXPIRED should have remaining stock
      await prisma.inventoryLot.update({
        where: { id: lotNoExpiry },
        data: { remainingQty: new Decimal(0), status: 'DEPLETED' },
      });

      // Request units - should fail because only expired lot has stock
      const res = await request(app.getHttpServer())
        .post('/inventory/lots/allocate')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          branchId,
          itemId,
          locationId,
          requestedQty: 10,
          sourceType: 'ORDER',
          sourceId: 'test-order-004',
        })
        .expect(400);

      expect(res.body.message).toContain('Insufficient');
    });
  });

  // ============================================================
  // Group 3: Quarantine / Release (H8)
  // ============================================================
  describe('Group 3: Quarantine / Release', () => {
    let testLotId: string;

    beforeAll(async () => {
      // Create a fresh lot for quarantine testing
      const lot = await prisma.inventoryLot.create({
        data: {
          orgId: testOrg.orgId,
          branchId,
          itemId,
          locationId,
          lotNumber: `LOT-QUAR-${Date.now()}`,
          receivedQty: new Decimal(50),
          remainingQty: new Decimal(50),
          expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          status: 'ACTIVE',
          sourceType: 'GOODS_RECEIPT',
          createdById: testOrg.users.owner.id,
        },
      });
      testLotId = lot.id;
    });

    it('should quarantine a lot', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/lots/${testLotId}/quarantine`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .expect(200);

      expect(res.body.status).toBe('QUARANTINE');
    });

    it('quarantined lot excluded from FEFO allocation', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/lots/allocate')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          branchId,
          itemId,
          locationId,
          requestedQty: 10,
          sourceType: 'ORDER',
          sourceId: 'test-order-quar',
        });

      // Should not include quarantined lot
      const allocatedLotIds = (res.body.allocations || []).map((a: any) => a.lotId);
      expect(allocatedLotIds).not.toContain(testLotId);
    });

    it('should release a lot from quarantine', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/lots/${testLotId}/release`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .expect(200);

      expect(res.body.status).toBe('ACTIVE');
    });

    it('released lot is eligible for allocation', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/lots/allocate')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          branchId,
          itemId,
          locationId,
          requestedQty: 10,
          sourceType: 'ORDER',
          sourceId: 'test-order-release',
        })
        .expect(201);

      // Should now include the released lot
      const allocatedLotIds = res.body.allocations.map((a: any) => a.lotId);
      expect(allocatedLotIds).toContain(testLotId);
    });
  });

  // ============================================================
  // Group 4: Traceability (H2, H6)
  // ============================================================
  describe('Group 4: Traceability', () => {
    let traceableLotId: string;

    beforeAll(async () => {
      // Create a lot and consume some from it
      const lot = await prisma.inventoryLot.create({
        data: {
          orgId: testOrg.orgId,
          branchId,
          itemId,
          locationId,
          lotNumber: `LOT-TRACE-${Date.now()}`,
          receivedQty: new Decimal(100),
          remainingQty: new Decimal(100),
          expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          status: 'ACTIVE',
          sourceType: 'GOODS_RECEIPT',
          createdById: testOrg.users.owner.id,
        },
      });
      traceableLotId = lot.id;

      // Create some allocation records
      await prisma.lotLedgerAllocation.createMany({
        data: [
          {
            orgId: testOrg.orgId,
            lotId: traceableLotId,
            allocatedQty: new Decimal(20),
            sourceType: 'ORDER',
            sourceId: 'order-trace-001',
            allocationOrder: 1,
          },
          {
            orgId: testOrg.orgId,
            lotId: traceableLotId,
            allocatedQty: new Decimal(10),
            sourceType: 'ORDER',
            sourceId: 'order-trace-002',
            allocationOrder: 1,
          },
          {
            orgId: testOrg.orgId,
            lotId: traceableLotId,
            allocatedQty: new Decimal(5),
            sourceType: 'WASTE',
            sourceId: 'waste-trace-001',
            allocationOrder: 1,
          },
        ],
      });

      // Update lot remaining qty
      await prisma.inventoryLot.update({
        where: { id: traceableLotId },
        data: { remainingQty: new Decimal(65) }, // 100 - 20 - 10 - 5
      });
    });

    it('H6: Traceability returns allocation history', async () => {
      const res = await request(app.getHttpServer())
        .get(`/inventory/lots/${traceableLotId}/traceability`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      expect(res.body).toHaveProperty('lot');
      expect(res.body).toHaveProperty('allocations');
      expect(res.body).toHaveProperty('summary');

      expect(res.body.allocations.length).toBe(3);
      expect(res.body.summary.total).toBe(35);
      expect(res.body.summary.bySourceType.ORDER).toBe(30);
      expect(res.body.summary.bySourceType.WASTE).toBe(5);
    });

    it('H2: LotLedgerAllocation links to source', async () => {
      const res = await request(app.getHttpServer())
        .get(`/inventory/lots/${traceableLotId}/traceability`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      const orderAlloc = res.body.allocations.find((a: any) => a.sourceId === 'order-trace-001');
      expect(orderAlloc).toBeDefined();
      expect(orderAlloc.sourceType).toBe('ORDER');
      expect(parseFloat(orderAlloc.allocatedQty)).toBe(20);
    });
  });

  // ============================================================
  // Group 5: Expiring Soon Report (H7)
  // ============================================================
  describe('Group 5: Expiring Soon Report', () => {
    beforeAll(async () => {
      // Reset lots for expiring soon test
      const now = new Date();
      const expiresSoon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const expiresLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days

      await prisma.inventoryLot.create({
        data: {
          orgId: testOrg.orgId,
          branchId,
          itemId,
          locationId,
          lotNumber: `LOT-SOON-${Date.now()}`,
          receivedQty: new Decimal(50),
          remainingQty: new Decimal(50),
          expiryDate: expiresSoon,
          status: 'ACTIVE',
          sourceType: 'GOODS_RECEIPT',
          createdById: testOrg.users.owner.id,
        },
      });

      await prisma.inventoryLot.create({
        data: {
          orgId: testOrg.orgId,
          branchId,
          itemId,
          locationId,
          lotNumber: `LOT-NOT-SOON-${Date.now()}`,
          receivedQty: new Decimal(50),
          remainingQty: new Decimal(50),
          expiryDate: expiresLater,
          status: 'ACTIVE',
          sourceType: 'GOODS_RECEIPT',
          createdById: testOrg.users.owner.id,
        },
      });
    });

    it('H7: Expiring soon report with 10-day threshold', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/lots/expiring-soon')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .query({ days: 10, branchId })
        .expect(200);

      expect(res.body).toHaveProperty('items');
      
      // Should include lots expiring within 10 days
      const lotNumbers = res.body.items.map((l: any) => l.lotNumber);
      expect(lotNumbers.some((n: string) => n.startsWith('LOT-SOON-'))).toBe(true);
      
      // Should NOT include lots expiring in 60 days
      expect(lotNumbers.some((n: string) => n.startsWith('LOT-NOT-SOON-'))).toBe(false);
    });

    it('H7: Expiring soon report with 90-day threshold', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/lots/expiring-soon')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .query({ days: 90, branchId })
        .expect(200);

      // Should include both lots
      const lotNumbers = res.body.items.map((l: any) => l.lotNumber);
      expect(lotNumbers.some((n: string) => n.startsWith('LOT-SOON-'))).toBe(true);
      expect(lotNumbers.some((n: string) => n.startsWith('LOT-NOT-SOON-'))).toBe(true);
    });
  });

  // ============================================================
  // Group 6: RBAC
  // ============================================================
  describe('Group 6: RBAC', () => {
    it('waiter (L1) cannot quarantine lots', async () => {
      await request(app.getHttpServer())
        .post(`/inventory/lots/${lotExpiresSoon}/quarantine`)
        .set('Authorization', `Bearer ${testOrg.users.waiter.token}`)
        .expect(403);
    });

    it('waiter (L1) can view lots (read-only)', async () => {
      await request(app.getHttpServer())
        .get('/inventory/lots')
        .set('Authorization', `Bearer ${testOrg.users.waiter.token}`)
        .expect(200);
    });

    it('manager (L4) can quarantine and release lots', async () => {
      // Create a test lot
      const lot = await prisma.inventoryLot.create({
        data: {
          orgId: testOrg.orgId,
          branchId,
          itemId,
          locationId,
          lotNumber: `LOT-RBAC-${Date.now()}`,
          receivedQty: new Decimal(10),
          remainingQty: new Decimal(10),
          status: 'ACTIVE',
          sourceType: 'GOODS_RECEIPT',
          createdById: testOrg.users.owner.id,
        },
      });

      await request(app.getHttpServer())
        .post(`/inventory/lots/${lot.id}/quarantine`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/inventory/lots/${lot.id}/release`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .expect(200);
    });
  });
});
