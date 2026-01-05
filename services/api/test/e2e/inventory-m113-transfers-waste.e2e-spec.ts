/**
 * M11.3: Inventory Transfers + Waste E2E Tests
 * 
 * Tests:
 * 1. Transfer create with lines
 * 2. Transfer ship creates TRANSFER_OUT ledger entries
 * 3. Transfer receive creates TRANSFER_IN ledger entries
 * 4. Transfer receive idempotency
 * 5. Transfer void from DRAFT only
 * 6. Transfer ship rejects negative stock
 * 7. Waste create and post
 * 8. Waste post idempotency
 * 9. Waste post rejects negative stock
 * 10. CSV export with BOM and hash
 * 11. RBAC enforcement
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2ETestingModule } from '../helpers/module';
import { cleanup } from '../helpers/cleanup';
import { createOrgWithUsers, FactoryOrg } from './factory';
import { PrismaService } from '@api/prisma/prisma.service';
import { AppModule } from '@api/app.module';
import { Decimal } from '@prisma/client/runtime/library';

describe('M11.3: Inventory Transfers + Waste E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testOrg: FactoryOrg;

  // Test data IDs
  let itemIdA: string;
  let itemIdB: string;
  let fromLocationId: string;
  let toLocationId: string;
  let branchIdA: string;
  let branchIdB: string;

  beforeAll(async () => {
    const moduleRef = await createE2ETestingModule({
      imports: [AppModule],
    });
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
    await app.init();

    // Create test org with users
    testOrg = await createOrgWithUsers(prisma, `test-transfers-waste-${Date.now()}`);

    branchIdA = testOrg.branchId;

    // Create second branch for inter-branch transfers
    const branchB = await prisma.branch.create({
      data: {
        orgId: testOrg.orgId,
        name: 'Branch B',
      },
    });
    branchIdB = branchB.id;

    // Create base UOM
    const baseUom = await prisma.unitOfMeasure.create({
      data: {
        organizationId: testOrg.orgId,
        code: 'EA',
        name: 'Each',
        conversionFactor: new Decimal(1),
      },
    });

    // Create category
    const category = await prisma.inventoryCategory.create({
      data: {
        organizationId: testOrg.orgId,
        code: 'CAT-TRF',
        name: 'Transfer Test Category',
      },
    });

    // Create test items
    const itemA = await prisma.inventoryItem.create({
      data: {
        organizationId: testOrg.orgId,
        categoryId: category.id,
        sku: 'TRF-ITEM-A',
        name: 'Transfer Test Item A',
        baseUnitOfMeasureId: baseUom.id,
        isActive: true,
      },
    });
    itemIdA = itemA.id;

    const itemB = await prisma.inventoryItem.create({
      data: {
        organizationId: testOrg.orgId,
        categoryId: category.id,
        sku: 'TRF-ITEM-B',
        name: 'Transfer Test Item B',
        baseUnitOfMeasureId: baseUom.id,
        isActive: true,
      },
    });
    itemIdB = itemB.id;

    // Create test locations
    const locFrom = await prisma.inventoryLocation.create({
      data: {
        organizationId: testOrg.orgId,
        branchId: branchIdA,
        code: 'LOC-FROM',
        name: 'Source Location',
        locationType: 'STORAGE',
        isActive: true,
      },
    });
    fromLocationId = locFrom.id;

    const locTo = await prisma.inventoryLocation.create({
      data: {
        organizationId: testOrg.orgId,
        branchId: branchIdB,
        code: 'LOC-TO',
        name: 'Destination Location',
        locationType: 'STORAGE',
        isActive: true,
      },
    });
    toLocationId = locTo.id;

    // Seed initial stock for item A at fromLocation (100 units)
    await prisma.inventoryLedgerEntry.create({
      data: {
        orgId: testOrg.orgId,
        branchId: branchIdA,
        itemId: itemIdA,
        locationId: fromLocationId,
        qty: new Decimal(100),
        reason: 'INITIAL',
        sourceType: 'MANUAL',
        notes: 'Initial stock for transfer tests',
      },
    });

    // Seed initial stock for item B at fromLocation (50 units)
    await prisma.inventoryLedgerEntry.create({
      data: {
        orgId: testOrg.orgId,
        branchId: branchIdA,
        itemId: itemIdB,
        locationId: fromLocationId,
        qty: new Decimal(50),
        reason: 'INITIAL',
        sourceType: 'MANUAL',
        notes: 'Initial stock for waste tests',
      },
    });
  }, 60000);

  afterAll(async () => {
    await cleanup(app);
  });

  // ============================================================
  // Group 1: Transfer Create with Lines
  // ============================================================
  describe('Group 1: Transfer Create', () => {
    let transferId: string;

    it('should create a draft transfer with lines', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/transfers')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          fromBranchId: branchIdA,
          toBranchId: branchIdB,
          notes: 'Test transfer',
          lines: [
            {
              itemId: itemIdA,
              fromLocationId,
              toLocationId,
              qtyShipped: 10,
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.transferNumber).toMatch(/^TRF-/);
      expect(res.body.lines).toHaveLength(1);
      expect(parseFloat(res.body.lines[0].qtyShipped)).toBe(10);
      transferId = res.body.id;
    });

    it('should reject transfer with zero qty', async () => {
      await request(app.getHttpServer())
        .post('/inventory/transfers')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          fromBranchId: branchIdA,
          toBranchId: branchIdB,
          lines: [{ itemId: itemIdA, fromLocationId, toLocationId, qtyShipped: 0 }],
        })
        .expect(400);
    });

    it('should reject transfer with no lines', async () => {
      await request(app.getHttpServer())
        .post('/inventory/transfers')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          fromBranchId: branchIdA,
          toBranchId: branchIdB,
          lines: [],
        })
        .expect(400);
    });
  });

  // ============================================================
  // Group 2: Transfer Ship creates TRANSFER_OUT ledger entries
  // ============================================================
  describe('Group 2: Transfer Ship', () => {
    let transferId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/transfers')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          fromBranchId: branchIdA,
          toBranchId: branchIdB,
          lines: [{ itemId: itemIdA, fromLocationId, toLocationId, qtyShipped: 5 }],
        });
      transferId = res.body.id;
    });

    it('should ship transfer and create TRANSFER_OUT ledger entries', async () => {
      const ledgerCountBefore = await prisma.inventoryLedgerEntry.count({
        where: { sourceType: 'TRANSFER', sourceId: transferId },
      });
      expect(ledgerCountBefore).toBe(0);

      const res = await request(app.getHttpServer())
        .post(`/inventory/transfers/${transferId}/ship`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(201);

      expect(res.body.transfer.status).toBe('IN_TRANSIT');
      expect(res.body.ledgerEntryCount).toBe(1);

      // Verify ledger entry
      const ledgerEntries = await prisma.inventoryLedgerEntry.findMany({
        where: { sourceType: 'TRANSFER', sourceId: transferId },
      });
      expect(ledgerEntries).toHaveLength(1);
      expect(ledgerEntries[0].reason).toBe('TRANSFER_OUT');
      expect(parseFloat(ledgerEntries[0].qty.toString())).toBe(-5); // Negative for outgoing
    });

    it('should reject ship on non-DRAFT transfer', async () => {
      // Ship first
      await request(app.getHttpServer())
        .post(`/inventory/transfers/${transferId}/ship`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(201);

      // Try to ship again
      await request(app.getHttpServer())
        .post(`/inventory/transfers/${transferId}/ship`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(400);
    });
  });

  // ============================================================
  // Group 3: Transfer Receive creates TRANSFER_IN ledger entries
  // ============================================================
  describe('Group 3: Transfer Receive', () => {
    let transferId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/inventory/transfers')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          fromBranchId: branchIdA,
          toBranchId: branchIdB,
          lines: [{ itemId: itemIdA, fromLocationId, toLocationId, qtyShipped: 3 }],
        });
      transferId = createRes.body.id;

      // Ship the transfer
      await request(app.getHttpServer())
        .post(`/inventory/transfers/${transferId}/ship`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`);
    });

    it('should receive transfer and create TRANSFER_IN ledger entries', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/transfers/${transferId}/receive`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(201);

      expect(res.body.transfer.status).toBe('RECEIVED');
      expect(res.body.isAlreadyReceived).toBe(false);
      expect(res.body.ledgerEntryCount).toBe(1);

      // Verify ledger entries
      const ledgerEntries = await prisma.inventoryLedgerEntry.findMany({
        where: { sourceType: 'TRANSFER', sourceId: transferId },
        orderBy: { createdAt: 'asc' },
      });
      expect(ledgerEntries).toHaveLength(2);
      expect(ledgerEntries[0].reason).toBe('TRANSFER_OUT');
      expect(ledgerEntries[1].reason).toBe('TRANSFER_IN');
      expect(parseFloat(ledgerEntries[1].qty.toString())).toBe(3); // Positive for incoming
    });
  });

  // ============================================================
  // Group 4: Transfer Receive Idempotency
  // ============================================================
  describe('Group 4: Transfer Receive Idempotency', () => {
    let transferId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/inventory/transfers')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          fromBranchId: branchIdA,
          toBranchId: branchIdB,
          lines: [{ itemId: itemIdA, fromLocationId, toLocationId, qtyShipped: 2 }],
        });
      transferId = createRes.body.id;

      await request(app.getHttpServer())
        .post(`/inventory/transfers/${transferId}/ship`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`);

      await request(app.getHttpServer())
        .post(`/inventory/transfers/${transferId}/receive`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`);
    });

    it('should return idempotent response on double receive', async () => {
      const ledgerCountBefore = await prisma.inventoryLedgerEntry.count({
        where: { sourceType: 'TRANSFER', sourceId: transferId },
      });

      const res = await request(app.getHttpServer())
        .post(`/inventory/transfers/${transferId}/receive`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(201);

      expect(res.body.isAlreadyReceived).toBe(true);
      expect(res.body.ledgerEntryCount).toBe(0);

      const ledgerCountAfter = await prisma.inventoryLedgerEntry.count({
        where: { sourceType: 'TRANSFER', sourceId: transferId },
      });
      expect(ledgerCountAfter).toBe(ledgerCountBefore);
    });
  });

  // ============================================================
  // Group 5: Transfer Void from DRAFT only
  // ============================================================
  describe('Group 5: Transfer Void', () => {
    it('should void DRAFT transfer', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/inventory/transfers')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          fromBranchId: branchIdA,
          toBranchId: branchIdB,
          lines: [{ itemId: itemIdA, fromLocationId, toLocationId, qtyShipped: 1 }],
        });

      const res = await request(app.getHttpServer())
        .post(`/inventory/transfers/${createRes.body.id}/void`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(201);

      expect(res.body.status).toBe('VOID');
    });

    it('should reject void on IN_TRANSIT transfer', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/inventory/transfers')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          fromBranchId: branchIdA,
          toBranchId: branchIdB,
          lines: [{ itemId: itemIdA, fromLocationId, toLocationId, qtyShipped: 1 }],
        });

      await request(app.getHttpServer())
        .post(`/inventory/transfers/${createRes.body.id}/ship`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`);

      await request(app.getHttpServer())
        .post(`/inventory/transfers/${createRes.body.id}/void`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(400);
    });
  });

  // ============================================================
  // Group 6: Transfer Ship rejects negative stock
  // ============================================================
  describe('Group 6: Negative Stock Prevention on Ship', () => {
    it('should reject ship when insufficient stock', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/inventory/transfers')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          fromBranchId: branchIdA,
          toBranchId: branchIdB,
          lines: [{ itemId: itemIdA, fromLocationId, toLocationId, qtyShipped: 10000 }], // More than available
        });

      await request(app.getHttpServer())
        .post(`/inventory/transfers/${createRes.body.id}/ship`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(400);
    });
  });

  // ============================================================
  // Group 7: Waste Create and Post
  // ============================================================
  describe('Group 7: Waste Create and Post', () => {
    let wasteId: string;

    it('should create draft waste document', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/waste')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          branchId: branchIdA,
          reason: 'DAMAGED',
          notes: 'Test waste',
          lines: [
            {
              itemId: itemIdB,
              locationId: fromLocationId,
              qty: 5,
              unitCost: 10.50,
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.wasteNumber).toMatch(/^WST-/);
      expect(res.body.reason).toBe('DAMAGED');
      wasteId = res.body.id;
    });

    it('should post waste and create WASTE ledger entries', async () => {
      // Create waste
      const createRes = await request(app.getHttpServer())
        .post('/inventory/waste')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          branchId: branchIdA,
          reason: 'EXPIRED',
          lines: [{ itemId: itemIdB, locationId: fromLocationId, qty: 3 }],
        });
      wasteId = createRes.body.id;

      const ledgerCountBefore = await prisma.inventoryLedgerEntry.count({
        where: { sourceType: 'WASTAGE', sourceId: wasteId },
      });
      expect(ledgerCountBefore).toBe(0);

      const res = await request(app.getHttpServer())
        .post(`/inventory/waste/${wasteId}/post`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(201);

      expect(res.body.waste.status).toBe('POSTED');
      expect(res.body.isAlreadyPosted).toBe(false);
      expect(res.body.ledgerEntryCount).toBe(1);

      // Verify ledger entry
      const ledgerEntries = await prisma.inventoryLedgerEntry.findMany({
        where: { sourceType: 'WASTAGE', sourceId: wasteId },
      });
      expect(ledgerEntries).toHaveLength(1);
      expect(ledgerEntries[0].reason).toBe('WASTAGE');
      expect(parseFloat(ledgerEntries[0].qty.toString())).toBe(-3); // Negative for waste
    });
  });

  // ============================================================
  // Group 8: Waste Post Idempotency
  // ============================================================
  describe('Group 8: Waste Post Idempotency', () => {
    let wasteId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/inventory/waste')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          branchId: branchIdA,
          reason: 'OTHER',
          lines: [{ itemId: itemIdB, locationId: fromLocationId, qty: 2 }],
        });
      wasteId = createRes.body.id;

      await request(app.getHttpServer())
        .post(`/inventory/waste/${wasteId}/post`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`);
    });

    it('should return idempotent response on double post', async () => {
      const ledgerCountBefore = await prisma.inventoryLedgerEntry.count({
        where: { sourceType: 'WASTAGE', sourceId: wasteId },
      });

      const res = await request(app.getHttpServer())
        .post(`/inventory/waste/${wasteId}/post`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(201);

      expect(res.body.isAlreadyPosted).toBe(true);
      expect(res.body.ledgerEntryCount).toBe(0);

      const ledgerCountAfter = await prisma.inventoryLedgerEntry.count({
        where: { sourceType: 'WASTAGE', sourceId: wasteId },
      });
      expect(ledgerCountAfter).toBe(ledgerCountBefore);
    });
  });

  // ============================================================
  // Group 9: Waste Post rejects negative stock
  // ============================================================
  describe('Group 9: Negative Stock Prevention on Waste Post', () => {
    it('should reject post when insufficient stock', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/inventory/waste')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          branchId: branchIdA,
          reason: 'THEFT',
          lines: [{ itemId: itemIdB, locationId: fromLocationId, qty: 10000 }], // More than available
        });

      await request(app.getHttpServer())
        .post(`/inventory/waste/${createRes.body.id}/post`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(400);
    });
  });

  // ============================================================
  // Group 10: CSV Export with BOM and Hash
  // ============================================================
  describe('Group 10: CSV Export', () => {
    it('should export transfers with BOM and hash header', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/transfers/export')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['x-nimbus-export-hash']).toBeDefined();
      expect(res.headers['x-nimbus-export-hash']).toMatch(/^[a-f0-9]{64}$/); // SHA-256

      // Check BOM
      expect(res.text.charCodeAt(0)).toBe(0xFEFF);
    });

    it('should export waste with BOM and hash header', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/waste/export')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['x-nimbus-export-hash']).toBeDefined();
      expect(res.headers['x-nimbus-export-hash']).toMatch(/^[a-f0-9]{64}$/);
      expect(res.text.charCodeAt(0)).toBe(0xFEFF);
    });

    it('should produce deterministic hash on repeated calls', async () => {
      const res1 = await request(app.getHttpServer())
        .get('/inventory/transfers/export')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`);

      const res2 = await request(app.getHttpServer())
        .get('/inventory/transfers/export')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`);

      expect(res1.headers['x-nimbus-export-hash']).toBe(res2.headers['x-nimbus-export-hash']);
    });
  });

  // ============================================================
  // Group 11: RBAC Enforcement
  // ============================================================
  describe('Group 11: RBAC', () => {
    it('should allow L2 user to list transfers', async () => {
      await request(app.getHttpServer())
        .get('/inventory/transfers')
        .set('Authorization', `Bearer ${testOrg.users.l2.token}`)
        .expect(200);
    });

    it('should forbid L2 user from creating transfers', async () => {
      await request(app.getHttpServer())
        .post('/inventory/transfers')
        .set('Authorization', `Bearer ${testOrg.users.l2.token}`)
        .send({
          fromBranchId: branchIdA,
          toBranchId: branchIdB,
          lines: [{ itemId: itemIdA, fromLocationId, toLocationId, qtyShipped: 1 }],
        })
        .expect(403);
    });

    it('should forbid L3 user from voiding transfers', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/inventory/transfers')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          fromBranchId: branchIdA,
          toBranchId: branchIdB,
          lines: [{ itemId: itemIdA, fromLocationId, toLocationId, qtyShipped: 1 }],
        });

      await request(app.getHttpServer())
        .post(`/inventory/transfers/${createRes.body.id}/void`)
        .set('Authorization', `Bearer ${testOrg.users.l3.token}`)
        .expect(403);
    });

    it('should forbid L3 user from export', async () => {
      await request(app.getHttpServer())
        .get('/inventory/transfers/export')
        .set('Authorization', `Bearer ${testOrg.users.l3.token}`)
        .expect(403);
    });
  });
});
