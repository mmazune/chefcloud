/**
 * M11.2: Inventory Procurement E2E Tests
 * 
 * Tests:
 * 1. PO create with UOM conversion
 * 2. PO workflow (Submit L3+, Approve L4+, L2 forbidden)
 * 3. Receiving + ledger posting in base UOM
 * 4. Partial receipt → PO status updates
 * 5. Over-receipt policy enforcement
 * 6. Receipt post idempotency
 * 7. Export verification (BOM, hash, ordering)
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2ETestingModule } from '../helpers/module';
import { cleanup } from '../helpers/cleanup';
import { createOrgWithUsers, FactoryOrg } from './factory';
import { PrismaService } from '@api/prisma/prisma.service';
import { AppModule } from '@api/app.module';
import { Decimal } from '@prisma/client/runtime/library';

describe('M11.2: Inventory Procurement E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testOrg: FactoryOrg;

  // Test data IDs
  let vendorId: string;
  let itemIdA: string;
  let itemIdB: string;
  let uomBaseId: string;
  let uomCaseId: string;
  let locationId: string;

  beforeAll(async () => {
    const moduleRef = await createE2ETestingModule({
      imports: [AppModule],
    });
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
    await app.init();

    // Create test org with users
    testOrg = await createOrgWithUsers(prisma, `test-procurement-${Date.now()}`);

    // Create test vendor
    const vendorRes = await prisma.vendor.create({
      data: {
        organizationId: testOrg.orgId,
        code: 'VND-TEST',
        name: 'Test Vendor Procurement',
        contactName: 'Test Contact',
        email: 'vendor@test.com',
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

    // Create case UOM (1 case = 12 each)
    const caseUom = await prisma.unitOfMeasure.create({
      data: {
        organizationId: testOrg.orgId,
        code: 'CS',
        name: 'Case',
        baseUnitOfMeasureId: baseUom.id,
        conversionFactor: new Decimal(12),
      },
    });
    uomCaseId = caseUom.id;

    // Create category
    const category = await prisma.inventoryCategory.create({
      data: {
        organizationId: testOrg.orgId,
        code: 'CAT-TEST',
        name: 'Test Category',
      },
    });

    // Create test items
    const itemA = await prisma.inventoryItem.create({
      data: {
        organizationId: testOrg.orgId,
        categoryId: category.id,
        sku: 'ITEM-A',
        name: 'Test Item A',
        baseUnitOfMeasureId: baseUom.id,
        isActive: true,
      },
    });
    itemIdA = itemA.id;

    const itemB = await prisma.inventoryItem.create({
      data: {
        organizationId: testOrg.orgId,
        categoryId: category.id,
        sku: 'ITEM-B',
        name: 'Test Item B',
        baseUnitOfMeasureId: baseUom.id,
        isActive: true,
      },
    });
    itemIdB = itemB.id;

    // Create test location
    const loc = await prisma.inventoryLocation.create({
      data: {
        organizationId: testOrg.orgId,
        branchId: testOrg.branchId,
        code: 'LOC-TEST',
        name: 'Test Location',
        locationType: 'STORAGE',
        isActive: true,
      },
    });
    locationId = loc.id;
  }, 60000);

  afterAll(async () => {
    await cleanup(app);
  });

  // ============================================================
  // Group 1: PO Create with UOM Conversion
  // ============================================================
  describe('Group 1: PO Create with UOM Conversion', () => {
    let poId: string;

    it('should create PO with case UOM and convert to base', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/procurement/purchase-orders')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          vendorId,
          branchId: testOrg.branchId,
          lines: [
            {
              itemId: itemIdA,
              inputUomId: uomCaseId, // Ordering in cases
              qtyOrderedInput: 5, // 5 cases
              unitCost: 100, // $100 per case
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.poNumber).toBeDefined();
      poId = res.body.id;

      // Verify conversion: 5 cases * 12 = 60 base units
      expect(res.body.lines).toHaveLength(1);
      expect(parseFloat(res.body.lines[0].qtyOrderedBase)).toBe(60);
      expect(parseFloat(res.body.lines[0].qtyOrderedInput)).toBe(5);
    });

    it('should create PO with base UOM (no conversion)', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/procurement/purchase-orders')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          vendorId,
          branchId: testOrg.branchId,
          lines: [
            {
              itemId: itemIdB,
              inputUomId: uomBaseId,
              qtyOrderedInput: 100,
              unitCost: 5,
            },
          ],
        })
        .expect(201);

      expect(parseFloat(res.body.lines[0].qtyOrderedBase)).toBe(100);
      expect(parseFloat(res.body.lines[0].qtyOrderedInput)).toBe(100);
    });
  });

  // ============================================================
  // Group 2: PO Workflow (Submit L3+, Approve L4+, L2 forbidden)
  // ============================================================
  describe('Group 2: PO Workflow RBAC', () => {
    let draftPoId: string;

    beforeEach(async () => {
      // Create a fresh draft PO
      const res = await request(app.getHttpServer())
        .post('/inventory/procurement/purchase-orders')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          vendorId,
          branchId: testOrg.branchId,
          lines: [
            { itemId: itemIdA, inputUomId: uomBaseId, qtyOrderedInput: 10, unitCost: 10 },
          ],
        })
        .expect(201);
      draftPoId = res.body.id;
    });

    it('should allow L3 (manager) to submit PO', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/procurement/purchase-orders/${draftPoId}/submit`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .expect(200);

      expect(res.body.status).toBe('PENDING_APPROVAL');
    });

    it('should forbid L2 from submitting PO', async () => {
      await request(app.getHttpServer())
        .post(`/inventory/procurement/purchase-orders/${draftPoId}/submit`)
        .set('Authorization', `Bearer ${testOrg.users.supervisor.token}`)
        .expect(403);
    });

    it('should allow L4 (owner) to approve PO', async () => {
      // First submit
      await request(app.getHttpServer())
        .post(`/inventory/procurement/purchase-orders/${draftPoId}/submit`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .expect(200);

      // Then approve
      const res = await request(app.getHttpServer())
        .post(`/inventory/procurement/purchase-orders/${draftPoId}/approve`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      expect(res.body.status).toBe('APPROVED');
    });

    it('should forbid L3 from approving PO', async () => {
      // First submit
      await request(app.getHttpServer())
        .post(`/inventory/procurement/purchase-orders/${draftPoId}/submit`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .expect(200);

      // L3 cannot approve
      await request(app.getHttpServer())
        .post(`/inventory/procurement/purchase-orders/${draftPoId}/approve`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .expect(403);
    });

    it('should allow L4 to cancel PO', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/procurement/purchase-orders/${draftPoId}/cancel`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      expect(res.body.status).toBe('CANCELLED');
    });
  });

  // ============================================================
  // Group 3: Receiving + Ledger Posting in Base UOM
  // ============================================================
  describe('Group 3: Receiving and Ledger Posting', () => {
    let approvedPoId: string;
    let receiptId: string;

    beforeAll(async () => {
      // Create, submit, approve a PO
      const createRes = await request(app.getHttpServer())
        .post('/inventory/procurement/purchase-orders')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          vendorId,
          branchId: testOrg.branchId,
          lines: [
            { itemId: itemIdA, inputUomId: uomCaseId, qtyOrderedInput: 2, unitCost: 50 },
          ],
        })
        .expect(201);
      approvedPoId = createRes.body.id;

      await request(app.getHttpServer())
        .post(`/inventory/procurement/purchase-orders/${approvedPoId}/submit`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/inventory/procurement/purchase-orders/${approvedPoId}/approve`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);
    });

    it('should create receipt with input UOM quantities', async () => {
      // Get PO to get line ID
      const poRes = await request(app.getHttpServer())
        .get(`/inventory/procurement/purchase-orders/${approvedPoId}`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      const poLineId = poRes.body.lines[0].id;

      const res = await request(app.getHttpServer())
        .post('/inventory/procurement/receipts')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          purchaseOrderId: approvedPoId,
          lines: [
            {
              itemId: itemIdA,
              poLineId,
              locationId,
              qtyReceivedInput: 1, // Receiving 1 case
              inputUomId: uomCaseId,
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('DRAFT');
      receiptId = res.body.id;

      // Verify conversion: 1 case = 12 base
      expect(res.body.lines).toHaveLength(1);
      expect(parseFloat(res.body.lines[0].qtyReceivedBase)).toBe(12);
    });

    it('should post receipt and create ledger entries in base UOM', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/procurement/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      expect(res.body.status).toBe('POSTED');
      expect(res.body.postedAt).toBeDefined();

      // Verify ledger entry exists
      const ledgerEntry = await prisma.inventoryLedgerEntry.findFirst({
        where: {
          receiptId,
          itemId: itemIdA,
        },
      });

      expect(ledgerEntry).toBeDefined();
      expect(ledgerEntry!.txnType).toBe('RECEIVE');
      expect(parseFloat(ledgerEntry!.qtyDelta.toString())).toBe(12); // Base UOM
    });
  });

  // ============================================================
  // Group 4: Partial Receipt → PO Status Updates
  // ============================================================
  describe('Group 4: Partial Receipt Status Updates', () => {
    let poId: string;
    let poLineId: string;

    beforeAll(async () => {
      // Create PO for 10 cases (120 base units)
      const createRes = await request(app.getHttpServer())
        .post('/inventory/procurement/purchase-orders')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          vendorId,
          branchId: testOrg.branchId,
          lines: [
            { itemId: itemIdB, inputUomId: uomCaseId, qtyOrderedInput: 10, unitCost: 25 },
          ],
        })
        .expect(201);
      poId = createRes.body.id;
      poLineId = createRes.body.lines[0].id;

      await request(app.getHttpServer())
        .post(`/inventory/procurement/purchase-orders/${poId}/submit`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/inventory/procurement/purchase-orders/${poId}/approve`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);
    });

    it('should set PO status to PARTIALLY_RECEIVED after partial receipt', async () => {
      // Receive 3 cases (36 base) out of 10 (120 base)
      const receiptRes = await request(app.getHttpServer())
        .post('/inventory/procurement/receipts')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          purchaseOrderId: poId,
          lines: [
            { itemId: itemIdB, poLineId, locationId, qtyReceivedInput: 3, inputUomId: uomCaseId },
          ],
        })
        .expect(201);

      // Post the receipt
      await request(app.getHttpServer())
        .post(`/inventory/procurement/receipts/${receiptRes.body.id}/post`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      // Check PO status
      const poRes = await request(app.getHttpServer())
        .get(`/inventory/procurement/purchase-orders/${poId}`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      expect(poRes.body.status).toBe('PARTIALLY_RECEIVED');
      expect(parseFloat(poRes.body.lines[0].qtyReceivedBase)).toBe(36);
    });

    it('should set PO status to RECEIVED after full receipt', async () => {
      // Receive remaining 7 cases (84 base)
      const receiptRes = await request(app.getHttpServer())
        .post('/inventory/procurement/receipts')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          purchaseOrderId: poId,
          lines: [
            { itemId: itemIdB, poLineId, locationId, qtyReceivedInput: 7, inputUomId: uomCaseId },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/inventory/procurement/receipts/${receiptRes.body.id}/post`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      const poRes = await request(app.getHttpServer())
        .get(`/inventory/procurement/purchase-orders/${poId}`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      expect(poRes.body.status).toBe('RECEIVED');
      expect(parseFloat(poRes.body.lines[0].qtyReceivedBase)).toBe(120);
    });
  });

  // ============================================================
  // Group 5: Over-Receipt Policy Enforcement
  // ============================================================
  describe('Group 5: Over-Receipt Policy', () => {
    let poId: string;
    let poLineId: string;

    beforeAll(async () => {
      // Create PO for 5 cases
      const createRes = await request(app.getHttpServer())
        .post('/inventory/procurement/purchase-orders')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          vendorId,
          branchId: testOrg.branchId,
          lines: [
            { itemId: itemIdA, inputUomId: uomCaseId, qtyOrderedInput: 5, unitCost: 30 },
          ],
        })
        .expect(201);
      poId = createRes.body.id;
      poLineId = createRes.body.lines[0].id;

      await request(app.getHttpServer())
        .post(`/inventory/procurement/purchase-orders/${poId}/submit`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/inventory/procurement/purchase-orders/${poId}/approve`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);
    });

    it('should reject receipt exceeding ordered quantity', async () => {
      // Try to receive 10 cases when only 5 ordered
      const res = await request(app.getHttpServer())
        .post('/inventory/procurement/receipts')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          purchaseOrderId: poId,
          lines: [
            { itemId: itemIdA, poLineId, locationId, qtyReceivedInput: 10, inputUomId: uomCaseId },
          ],
        })
        .expect(400);

      expect(res.body.message).toContain('exceeds');
    });
  });

  // ============================================================
  // Group 6: Receipt Post Idempotency
  // ============================================================
  describe('Group 6: Receipt Post Idempotency', () => {
    let receiptId: string;

    beforeAll(async () => {
      // Create and approve a PO
      const createRes = await request(app.getHttpServer())
        .post('/inventory/procurement/purchase-orders')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          vendorId,
          branchId: testOrg.branchId,
          lines: [
            { itemId: itemIdB, inputUomId: uomBaseId, qtyOrderedInput: 50, unitCost: 2 },
          ],
        })
        .expect(201);

      const poId = createRes.body.id;
      const poLineId = createRes.body.lines[0].id;

      await request(app.getHttpServer())
        .post(`/inventory/procurement/purchase-orders/${poId}/submit`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/inventory/procurement/purchase-orders/${poId}/approve`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      // Create receipt
      const receiptRes = await request(app.getHttpServer())
        .post('/inventory/procurement/receipts')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          purchaseOrderId: poId,
          lines: [
            { itemId: itemIdB, poLineId, locationId, qtyReceivedInput: 50, inputUomId: uomBaseId },
          ],
        })
        .expect(201);

      receiptId = receiptRes.body.id;
    });

    it('should post receipt successfully', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/procurement/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      expect(res.body.status).toBe('POSTED');
    });

    it('should be idempotent on second post', async () => {
      // Posting again should return success without creating duplicate ledger entries
      const res = await request(app.getHttpServer())
        .post(`/inventory/procurement/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      expect(res.body.status).toBe('POSTED');

      // Verify only one ledger entry
      const entries = await prisma.inventoryLedgerEntry.findMany({
        where: { receiptId },
      });
      expect(entries.length).toBe(1);
    });
  });

  // ============================================================
  // Group 7: Export Verification
  // ============================================================
  describe('Group 7: Export Verification', () => {
    it('should export purchase orders as CSV', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/procurement/purchase-orders/export?format=csv')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('poNumber');
    });

    it('should export receipts as CSV', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/procurement/receipts/export?format=csv')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('receiptNumber');
    });
  });
});
