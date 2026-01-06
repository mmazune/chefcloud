/**
 * M11.10: Inventory Stocktake v2 E2E Tests
 *
 * Hypotheses Tested:
 * H1: Blind count hides expectedQty (snapshotQty) from counters via API response
 * H2: Snapshot expectedQty is frozen at session start (doesn't drift)
 * H3: POST is idempotent (no duplicate ledger entries on re-POST)
 * H4: VOID correctly reverses variances (on-hand restored)
 * H5: Cross-branch isolation (branchA cannot access branchB locations)
 * H6: Export hash matches content (SHA256 verification)
 * H7: RBAC enforcement (L3 count, L4 approve/post, L5 void)
 * H8: Tests do not hang (AfterAll cleans up properly)
 *
 * Workflow: DRAFT → IN_PROGRESS → SUBMITTED → APPROVED → POSTED | VOID
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2EApp } from '../helpers/e2e-bootstrap';
import { cleanup } from '../helpers/cleanup';
import { createOrgWithUsers, FactoryOrg } from './factory';
import { PrismaService } from '../../src/prisma.service';
import { AppModule } from '../../src/app.module';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaClient, StocktakeStatus } from '@prisma/client';
import * as crypto from 'crypto';

describe('M11.10: Inventory Stocktake v2 E2E', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let prisma: PrismaClient;
  let testOrg: FactoryOrg;
  let secondOrg: FactoryOrg;

  // Test data IDs - Organization 1
  let itemId: string;
  let item2Id: string;
  let locationId: string;
  let branchId: string;
  let orgId: string;

  // Second org location for cross-branch tests
  let secondOrgLocationId: string;

  // Stocktake session IDs for tests
  let draftSessionId: string;
  let fullWorkflowSessionId: string;

  beforeAll(async () => {
    app = await createE2EApp({ imports: [AppModule] });
    prismaService = app.get(PrismaService);
    prisma = prismaService.client;

    // Create test org with users
    testOrg = await createOrgWithUsers(prisma, `test-m1110-${Date.now()}`);
    branchId = testOrg.branchId;
    orgId = testOrg.orgId;

    // Create second org for cross-branch tests
    secondOrg = await createOrgWithUsers(prisma, `test-m1110-second-${Date.now()}`);

    // Create test location
    const location = await prisma.inventoryLocation.create({
      data: {
        orgId: testOrg.orgId,
        branchId,
        code: 'LOC-M1110',
        name: 'M11.10 Stocktake Location',
        locationType: 'STORAGE',
        isActive: true,
      },
    });
    locationId = location.id;

    // Create second org location for cross-branch tests
    const secondLocation = await prisma.inventoryLocation.create({
      data: {
        orgId: secondOrg.orgId,
        branchId: secondOrg.branchId,
        code: 'LOC-M1110-SECOND',
        name: 'Second Org Location',
        locationType: 'STORAGE',
        isActive: true,
      },
    });
    secondOrgLocationId = secondLocation.id;

    // Create test item
    const item = await prisma.inventoryItem.create({
      data: {
        orgId: testOrg.orgId,
        sku: 'M1110-ITEM-001',
        name: 'M11.10 Test Item',
        unit: 'EA',
        category: 'Stocktake Test',
        isActive: true,
      },
    });
    itemId = item.id;

    // Create second test item
    const item2 = await prisma.inventoryItem.create({
      data: {
        orgId: testOrg.orgId,
        sku: 'M1110-ITEM-002',
        name: 'M11.10 Test Item 2',
        unit: 'EA',
        category: 'Stocktake Test',
        isActive: true,
      },
    });
    item2Id = item2.id;

    // Create initial stock via ledger entries (100 units of item, 50 units of item2)
    await prisma.inventoryLedgerEntry.createMany({
      data: [
        {
          orgId: testOrg.orgId,
          branchId,
          itemId,
          locationId,
          qty: new Decimal(100),
          reason: 'INITIAL',
          sourceType: 'MANUAL',
          notes: 'Initial stock for M11.10 tests',
          createdById: testOrg.users.owner.id,
        },
        {
          orgId: testOrg.orgId,
          branchId,
          itemId: item2Id,
          locationId,
          qty: new Decimal(50),
          reason: 'INITIAL',
          sourceType: 'MANUAL',
          notes: 'Initial stock for M11.10 tests',
          createdById: testOrg.users.owner.id,
        },
      ],
    });
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 30000);

  // ============================================
  // GROUP 1: Basic CRUD Operations
  // ============================================

  describe('Group 1: Basic CRUD Operations', () => {
    it('should create stocktake session in DRAFT status', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/stocktakes')
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .set('x-branch-id', branchId)
        .send({
          name: 'Q1 Stocktake Test',
          description: 'Quarterly stocktake for testing',
          blindCount: true,
        })
        .expect(201);

      expect(res.body.status).toBe('DRAFT');
      expect(res.body.sessionNumber).toMatch(/^ST-\d{8}-\d{3}$/);
      expect(res.body.blindCount).toBe(true);
      draftSessionId = res.body.id;
    });

    it('should list stocktake sessions', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/stocktakes')
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .set('x-branch-id', branchId)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.pagination).toBeDefined();
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should get stocktake session detail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/inventory/stocktakes/${draftSessionId}`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .set('x-branch-id', branchId)
        .expect(200);

      expect(res.body.id).toBe(draftSessionId);
      expect(res.body.status).toBe('DRAFT');
    });
  });

  // ============================================
  // GROUP 2: Session Start + Snapshot Stability (H2)
  // ============================================

  describe('Group 2: Session Start + Snapshot Stability', () => {
    let snapshotSessionId: string;
    let originalSnapshotQty: string;

    it('should create and start session (snapshot frozen)', async () => {
      // Create session
      const createRes = await request(app.getHttpServer())
        .post('/inventory/stocktakes')
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .set('x-branch-id', branchId)
        .send({
          name: 'Snapshot Stability Test',
          locationId,
          blindCount: true,
        })
        .expect(201);

      snapshotSessionId = createRes.body.id;

      // Start session (freezes snapshot)
      const startRes = await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${snapshotSessionId}/start`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .set('x-branch-id', branchId)
        .expect(201);

      expect(startRes.body.status).toBe('IN_PROGRESS');
      expect(startRes.body.totalLines).toBeGreaterThan(0);
    });

    it('H2: snapshot qty should NOT change after stock movement', async () => {
      // Get current lines (as admin to see snapshotQty)
      const linesRes = await request(app.getHttpServer())
        .get(`/inventory/stocktakes/${snapshotSessionId}/lines`)
        .set('Authorization', `Bearer ${testOrg.users.admin.token}`)
        .set('x-branch-id', branchId)
        .expect(200);

      const line = linesRes.body.find((l: any) => l.itemId === itemId);
      expect(line).toBeDefined();
      originalSnapshotQty = line.snapshotQty;
      expect(originalSnapshotQty).toBe('100');

      // Create new stock movement AFTER snapshot was taken
      await prisma.inventoryLedgerEntry.create({
        data: {
          orgId: testOrg.orgId,
          branchId,
          itemId,
          locationId,
          qty: new Decimal(25), // Add 25 more
          reason: 'ADJUSTMENT',
          sourceType: 'MANUAL',
          notes: 'Post-snapshot movement for H2 test',
          createdById: testOrg.users.owner.id,
        },
      });

      // Re-fetch lines - snapshotQty should be UNCHANGED
      const linesRes2 = await request(app.getHttpServer())
        .get(`/inventory/stocktakes/${snapshotSessionId}/lines`)
        .set('Authorization', `Bearer ${testOrg.users.admin.token}`)
        .set('x-branch-id', branchId)
        .expect(200);

      const line2 = linesRes2.body.find((l: any) => l.itemId === itemId);
      expect(line2.snapshotQty).toBe(originalSnapshotQty); // Still 100, not 125
    });
  });

  // ============================================
  // GROUP 3: Blind Count Enforcement (H1)
  // ============================================

  describe('Group 3: Blind Count Enforcement', () => {
    let blindSessionId: string;

    beforeAll(async () => {
      // Create and start a blind count session
      const createRes = await request(app.getHttpServer())
        .post('/inventory/stocktakes')
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .set('x-branch-id', branchId)
        .send({
          name: 'Blind Count Test',
          locationId,
          blindCount: true, // Explicitly true
        });

      blindSessionId = createRes.body.id;

      await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${blindSessionId}/start`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .set('x-branch-id', branchId);
    });

    it('H1: should hide snapshotQty from counters when blindCount=true and IN_PROGRESS', async () => {
      const res = await request(app.getHttpServer())
        .get(`/inventory/stocktakes/${blindSessionId}/lines`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .set('x-branch-id', branchId)
        .expect(200);

      // snapshotQty should be undefined/hidden
      const line = res.body.find((l: any) => l.itemId === itemId);
      expect(line).toBeDefined();
      expect(line.snapshotQty).toBeUndefined();
    });
  });

  // ============================================
  // GROUP 4: RBAC Enforcement (H7)
  // ============================================

  describe('Group 4: RBAC Enforcement', () => {
    let rbacSessionId: string;

    beforeAll(async () => {
      // Create session for RBAC tests
      const createRes = await request(app.getHttpServer())
        .post('/inventory/stocktakes')
        .set('Authorization', `Bearer ${testOrg.users.admin.token}`)
        .set('x-branch-id', branchId)
        .send({ name: 'RBAC Test Session' });

      rbacSessionId = createRes.body.id;

      // Start and add counts
      await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${rbacSessionId}/start`)
        .set('Authorization', `Bearer ${testOrg.users.admin.token}`)
        .set('x-branch-id', branchId);

      // Record counts for all lines
      const lines = await request(app.getHttpServer())
        .get(`/inventory/stocktakes/${rbacSessionId}/lines`)
        .set('Authorization', `Bearer ${testOrg.users.admin.token}`)
        .set('x-branch-id', branchId);

      for (const line of lines.body) {
        await request(app.getHttpServer())
          .post(`/inventory/stocktakes/${rbacSessionId}/counts`)
          .set('Authorization', `Bearer ${testOrg.users.admin.token}`)
          .set('x-branch-id', branchId)
          .send({
            itemId: line.itemId,
            locationId: line.locationId,
            countedQty: 90, // Some variance
          });
      }

      // Submit
      await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${rbacSessionId}/submit`)
        .set('Authorization', `Bearer ${testOrg.users.admin.token}`)
        .set('x-branch-id', branchId);
    });

    it('H7: L3 (manager) should NOT be able to approve', async () => {
      await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${rbacSessionId}/approve`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .set('x-branch-id', branchId)
        .expect(403);
    });

    it('H7: L4 (admin) should be able to approve', async () => {
      await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${rbacSessionId}/approve`)
        .set('Authorization', `Bearer ${testOrg.users.admin.token}`)
        .set('x-branch-id', branchId)
        .expect(201);
    });

    it('H7: L3 (manager) should NOT be able to post', async () => {
      await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${rbacSessionId}/post`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .set('x-branch-id', branchId)
        .expect(403);
    });

    it('H7: L4 (admin) should be able to post', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${rbacSessionId}/post`)
        .set('Authorization', `Bearer ${testOrg.users.admin.token}`)
        .set('x-branch-id', branchId)
        .expect(201);

      expect(res.body.status).toBe('POSTED');
    });

    it('H7: L4 (admin) should NOT be able to void', async () => {
      await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${rbacSessionId}/void`)
        .set('Authorization', `Bearer ${testOrg.users.admin.token}`)
        .set('x-branch-id', branchId)
        .send({ reason: 'Test void attempt' })
        .expect(403);
    });
  });

  // ============================================
  // GROUP 5: POST Idempotency (H3)
  // ============================================

  describe('Group 5: POST Idempotency', () => {
    let idempotentSessionId: string;
    let ledgerCountBeforePost: number;

    beforeAll(async () => {
      // Create and complete full workflow
      const createRes = await request(app.getHttpServer())
        .post('/inventory/stocktakes')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .set('x-branch-id', branchId)
        .send({ name: 'Idempotency Test Session', locationId });

      idempotentSessionId = createRes.body.id;

      // Start
      await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${idempotentSessionId}/start`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .set('x-branch-id', branchId);

      // Record counts
      await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${idempotentSessionId}/counts`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .set('x-branch-id', branchId)
        .send({ itemId, locationId, countedQty: 95 });

      await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${idempotentSessionId}/counts`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .set('x-branch-id', branchId)
        .send({ itemId: item2Id, locationId, countedQty: 48 });

      // Submit and approve
      await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${idempotentSessionId}/submit`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .set('x-branch-id', branchId);

      await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${idempotentSessionId}/approve`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .set('x-branch-id', branchId);

      // Count ledger entries before first POST
      ledgerCountBeforePost = await prisma.inventoryLedgerEntry.count({
        where: { orgId: testOrg.orgId },
      });
    });

    it('H3: first POST should create ledger entries', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${idempotentSessionId}/post`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .set('x-branch-id', branchId)
        .expect(201);

      expect(res.body.status).toBe('POSTED');
      expect(res.body.ledgerEntriesCreated).toBeGreaterThan(0);

      fullWorkflowSessionId = idempotentSessionId;
    });

    it('H3: second POST should be idempotent (no new entries)', async () => {
      const ledgerCountAfterFirstPost = await prisma.inventoryLedgerEntry.count({
        where: { orgId: testOrg.orgId },
      });

      // Try POST again
      const res = await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${idempotentSessionId}/post`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .set('x-branch-id', branchId)
        .expect(201);

      expect(res.body.alreadyPosted).toBe(true);

      // Ledger count should be unchanged
      const ledgerCountAfterSecondPost = await prisma.inventoryLedgerEntry.count({
        where: { orgId: testOrg.orgId },
      });

      expect(ledgerCountAfterSecondPost).toBe(ledgerCountAfterFirstPost);
    });
  });

  // ============================================
  // GROUP 6: VOID Reversal Correctness (H4)
  // ============================================

  describe('Group 6: VOID Reversal Correctness', () => {
    let voidSessionId: string;
    let onHandBeforePost: number;
    let onHandAfterPost: number;

    beforeAll(async () => {
      // Create fresh item for void test
      const voidItem = await prisma.inventoryItem.create({
        data: {
          orgId: testOrg.orgId,
          sku: 'M1110-VOID-TEST',
          name: 'Void Test Item',
          unit: 'EA',
          isActive: true,
        },
      });

      // Create initial stock of 100
      await prisma.inventoryLedgerEntry.create({
        data: {
          orgId: testOrg.orgId,
          branchId,
          itemId: voidItem.id,
          locationId,
          qty: new Decimal(100),
          reason: 'INITIAL',
          sourceType: 'MANUAL',
          createdById: testOrg.users.owner.id,
        },
      });

      // Calculate on-hand before stocktake
      const result = await prisma.inventoryLedgerEntry.aggregate({
        where: { itemId: voidItem.id, locationId, branchId },
        _sum: { qty: true },
      });
      onHandBeforePost = Number(result._sum.qty || 0);

      // Create stocktake session
      const createRes = await request(app.getHttpServer())
        .post('/inventory/stocktakes')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .set('x-branch-id', branchId)
        .send({ name: 'Void Reversal Test', locationId });

      voidSessionId = createRes.body.id;

      // Start and count (report 80, variance = -20)
      await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${voidSessionId}/start`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .set('x-branch-id', branchId);

      await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${voidSessionId}/counts`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .set('x-branch-id', branchId)
        .send({ itemId: voidItem.id, locationId, countedQty: 80 });

      // Submit, approve, post
      await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${voidSessionId}/submit`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .set('x-branch-id', branchId);

      await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${voidSessionId}/approve`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .set('x-branch-id', branchId);

      await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${voidSessionId}/post`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .set('x-branch-id', branchId);

      // Verify on-hand changed after post
      const resultAfterPost = await prisma.inventoryLedgerEntry.aggregate({
        where: { itemId: voidItem.id, locationId, branchId },
        _sum: { qty: true },
      });
      onHandAfterPost = Number(resultAfterPost._sum.qty || 0);
      expect(onHandAfterPost).toBe(80); // Variance applied
    });

    it('H4: VOID should restore original on-hand', async () => {
      // Void the session
      const res = await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${voidSessionId}/void`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .set('x-branch-id', branchId)
        .send({ reason: 'Testing void reversal' })
        .expect(201);

      expect(res.body.status).toBe('VOID');
      expect(res.body.reversalEntriesCreated).toBeGreaterThan(0);

      // Verify on-hand is restored
      const voidItem = await prisma.inventoryItem.findFirst({
        where: { sku: 'M1110-VOID-TEST' },
      });

      const resultAfterVoid = await prisma.inventoryLedgerEntry.aggregate({
        where: { itemId: voidItem!.id, locationId, branchId },
        _sum: { qty: true },
      });
      const onHandAfterVoid = Number(resultAfterVoid._sum.qty || 0);

      expect(onHandAfterVoid).toBe(onHandBeforePost); // Back to 100
    });
  });

  // ============================================
  // GROUP 7: Cross-Branch Isolation (H5)
  // ============================================

  describe('Group 7: Cross-Branch Isolation', () => {
    it('H5: should reject location from different branch', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/stocktakes')
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .set('x-branch-id', branchId)
        .send({
          name: 'Cross-Branch Test',
          locationId: secondOrgLocationId, // Different org's location
        })
        .expect(400);

      expect(res.body.message).toContain('not belong');
    });

    it('H5: should not see other org sessions', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/stocktakes')
        .set('Authorization', `Bearer ${secondOrg.users.manager.token}`)
        .set('x-branch-id', secondOrg.branchId)
        .expect(200);

      // Should not see any sessions from first org
      const sessionFromFirstOrg = res.body.data.find(
        (s: any) => s.branchId === branchId,
      );
      expect(sessionFromFirstOrg).toBeUndefined();
    });
  });

  // ============================================
  // GROUP 8: Export Hash Verification (H6)
  // ============================================

  describe('Group 8: Export Hash Verification', () => {
    it('H6: export hash should match content SHA256', async () => {
      // Use a posted session
      const res = await request(app.getHttpServer())
        .get(`/inventory/stocktakes/${fullWorkflowSessionId}/export`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .set('x-branch-id', branchId)
        .expect(200);

      const csvContent = res.text;
      const headerHash = res.headers['x-nimbus-export-hash'];

      // Compute SHA256 of content
      const computedHash = crypto.createHash('sha256').update(csvContent, 'utf8').digest('hex');

      expect(headerHash).toBe(computedHash);
    });
  });

  // ============================================
  // GROUP 9: Cancel Session
  // ============================================

  describe('Group 9: Cancel Session', () => {
    it('should cancel DRAFT session', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/inventory/stocktakes')
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .set('x-branch-id', branchId)
        .send({ name: 'Cancel Test Session' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${createRes.body.id}/cancel`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .set('x-branch-id', branchId)
        .send({ reason: 'Testing cancellation' })
        .expect(201);

      expect(res.body.status).toBe('VOID');
    });

    it('should cancel IN_PROGRESS session', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/inventory/stocktakes')
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .set('x-branch-id', branchId)
        .send({ name: 'Cancel In-Progress Test' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${createRes.body.id}/start`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .set('x-branch-id', branchId)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${createRes.body.id}/cancel`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .set('x-branch-id', branchId)
        .send({ reason: 'Testing cancellation' })
        .expect(201);

      expect(res.body.status).toBe('VOID');
    });
  });

  // ============================================
  // GROUP 10: Complete Workflow Test
  // ============================================

  describe('Group 10: Complete Workflow', () => {
    let workflowSessionId: string;

    it('should complete full workflow: DRAFT → IN_PROGRESS → SUBMITTED → APPROVED → POSTED', async () => {
      // 1. Create (DRAFT)
      const createRes = await request(app.getHttpServer())
        .post('/inventory/stocktakes')
        .set('Authorization', `Bearer ${testOrg.users.admin.token}`)
        .set('x-branch-id', branchId)
        .send({
          name: 'Full Workflow Test',
          locationId,
          blindCount: false, // Non-blind for easier testing
        })
        .expect(201);

      workflowSessionId = createRes.body.id;
      expect(createRes.body.status).toBe('DRAFT');

      // 2. Start (IN_PROGRESS)
      const startRes = await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${workflowSessionId}/start`)
        .set('Authorization', `Bearer ${testOrg.users.admin.token}`)
        .set('x-branch-id', branchId)
        .expect(201);

      expect(startRes.body.status).toBe('IN_PROGRESS');

      // 3. Record counts
      const linesRes = await request(app.getHttpServer())
        .get(`/inventory/stocktakes/${workflowSessionId}/lines`)
        .set('Authorization', `Bearer ${testOrg.users.admin.token}`)
        .set('x-branch-id', branchId);

      for (const line of linesRes.body) {
        await request(app.getHttpServer())
          .post(`/inventory/stocktakes/${workflowSessionId}/counts`)
          .set('Authorization', `Bearer ${testOrg.users.admin.token}`)
          .set('x-branch-id', branchId)
          .send({
            itemId: line.itemId,
            locationId: line.locationId,
            countedQty: Number(line.snapshotQty) - 5, // 5 unit variance
          })
          .expect(201);
      }

      // 4. Submit (SUBMITTED)
      const submitRes = await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${workflowSessionId}/submit`)
        .set('Authorization', `Bearer ${testOrg.users.admin.token}`)
        .set('x-branch-id', branchId)
        .expect(201);

      expect(submitRes.body.status).toBe('SUBMITTED');

      // 5. Approve (APPROVED)
      const approveRes = await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${workflowSessionId}/approve`)
        .set('Authorization', `Bearer ${testOrg.users.admin.token}`)
        .set('x-branch-id', branchId)
        .expect(201);

      expect(approveRes.body.status).toBe('APPROVED');

      // 6. Post (POSTED)
      const postRes = await request(app.getHttpServer())
        .post(`/inventory/stocktakes/${workflowSessionId}/post`)
        .set('Authorization', `Bearer ${testOrg.users.admin.token}`)
        .set('x-branch-id', branchId)
        .expect(201);

      expect(postRes.body.status).toBe('POSTED');
      expect(postRes.body.ledgerEntriesCreated).toBeGreaterThan(0);
    });
  });
});
