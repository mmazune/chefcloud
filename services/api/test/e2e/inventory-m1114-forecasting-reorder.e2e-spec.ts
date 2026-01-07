/**
 * M11.14: Demand Forecasting + Reorder Optimization E2E Tests
 * 
 * Tests:
 * 1. Demand Series extraction (H1: demand-only reasons, H8: timezone)
 * 2. Forecast snapshot generation (H4: idempotent, H9: deterministic)
 * 3. Optimization run creation (H5: in-transit, H10: partial receipts)
 * 4. Draft PO generation from optimization
 * 5. CSV export with explainability
 * 6. RBAC enforcement (L4+ for write, L2+ for read)
 * 7. Cross-tenant isolation (H2)
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2ETestingModule } from '../helpers/module';
import { cleanup } from '../helpers/cleanup';
import { createOrgWithUsers, FactoryOrg } from './factory';
import { PrismaService } from '@api/prisma/prisma.service';
import { AppModule } from '@api/app.module';
import { Decimal } from '@prisma/client/runtime/library';
import { LedgerEntryReason, LedgerSourceType } from '@api/inventory/inventory-ledger.service';

describe('M11.14: Demand Forecasting + Reorder Optimization E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testOrg: FactoryOrg;
  let testOrg2: FactoryOrg; // For cross-tenant isolation tests

  // Test data IDs
  let vendorId: string;
  let itemId: string;
  let itemId2: string;
  let locationId: string;
  let uomId: string;

  beforeAll(async () => {
    const moduleRef = await createE2ETestingModule({
      imports: [AppModule],
    });
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
    await app.init();

    // Create test orgs with users
    testOrg = await createOrgWithUsers(prisma, `test-m1114-${Date.now()}`);
    testOrg2 = await createOrgWithUsers(prisma, `test-m1114-other-${Date.now()}`);

    // Create vendor
    const vendor = await prisma.vendor.create({
      data: {
        orgId: testOrg.orgId,
        name: 'Forecast Supplier',
      },
    });
    vendorId = vendor.id;

    // Create base UOM
    const uom = await prisma.unitOfMeasure.create({
      data: {
        orgId: testOrg.orgId,
        code: 'EA',
        name: 'Each',
        conversionFactor: new Decimal(1),
      },
    });
    uomId = uom.id;

    // Create test items
    const item1 = await prisma.inventoryItem.create({
      data: {
        orgId: testOrg.orgId,
        sku: 'M1114-ITEM-001',
        name: 'Forecast Test Item 1',
        unit: 'ea',
        uomId: uom.id,
        reorderLevel: new Decimal(50),
        reorderQty: new Decimal(100),
        isActive: true,
      },
    });
    itemId = item1.id;

    const item2 = await prisma.inventoryItem.create({
      data: {
        orgId: testOrg.orgId,
        sku: 'M1114-ITEM-002',
        name: 'Forecast Test Item 2',
        unit: 'ea',
        uomId: uom.id,
        reorderLevel: new Decimal(25),
        reorderQty: new Decimal(50),
        isActive: true,
      },
    });
    itemId2 = item2.id;

    // Create location
    const location = await prisma.inventoryLocation.create({
      data: {
        orgId: testOrg.orgId,
        branchId: testOrg.branchId,
        code: 'MAIN-M1114',
        name: 'Main Storage M1114',
        locationType: 'STORAGE',
        isActive: true,
      },
    });
    locationId = location.id;

    // Create reorder policies
    await prisma.reorderPolicy.create({
      data: {
        orgId: testOrg.orgId,
        branchId: testOrg.branchId,
        inventoryItemId: itemId,
        reorderPointBaseQty: new Decimal(50),
        reorderQtyBaseQty: new Decimal(100),
        preferredVendorId: vendorId,
        leadTimeDays: 3,
        safetyStockDays: 2,
        isActive: true,
      },
    });

    await prisma.reorderPolicy.create({
      data: {
        orgId: testOrg.orgId,
        branchId: testOrg.branchId,
        inventoryItemId: itemId2,
        reorderPointBaseQty: new Decimal(25),
        reorderQtyBaseQty: new Decimal(50),
        preferredVendorId: vendorId,
        leadTimeDays: 5,
        safetyStockDays: 3,
        isActive: true,
      },
    });

    // Create some ledger entries to simulate demand
    // Create entries spread over last 14 days
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const entryDate = new Date(now);
      entryDate.setDate(entryDate.getDate() - i);

      // SALE entries (demand)
      await prisma.inventoryLedgerEntry.create({
        data: {
          orgId: testOrg.orgId,
          branchId: testOrg.branchId,
          itemId: itemId,
          locationId: locationId,
          qty: new Decimal(-10), // 10 units sold per day
          reason: LedgerEntryReason.SALE,
          sourceType: LedgerSourceType.ORDER,
          createdAt: entryDate,
        },
      });

      // PRODUCTION_CONSUME entries (demand)
      await prisma.inventoryLedgerEntry.create({
        data: {
          orgId: testOrg.orgId,
          branchId: testOrg.branchId,
          itemId: itemId,
          locationId: locationId,
          qty: new Decimal(-5), // 5 units consumed per day
          reason: LedgerEntryReason.PRODUCTION_CONSUME,
          sourceType: LedgerSourceType.PRODUCTION,
          createdAt: entryDate,
        },
      });

      // PURCHASE entries (NOT demand - should be excluded)
      await prisma.inventoryLedgerEntry.create({
        data: {
          orgId: testOrg.orgId,
          branchId: testOrg.branchId,
          itemId: itemId,
          locationId: locationId,
          qty: new Decimal(20), // 20 units purchased
          reason: LedgerEntryReason.PURCHASE,
          sourceType: LedgerSourceType.GOODS_RECEIPT,
          createdAt: entryDate,
        },
      });
    }

    // Create initial stock for item 1
    await prisma.inventoryLedgerEntry.create({
      data: {
        orgId: testOrg.orgId,
        branchId: testOrg.branchId,
        itemId: itemId,
        locationId: locationId,
        qty: new Decimal(100), // 100 units on hand
        reason: LedgerEntryReason.INITIAL,
        sourceType: LedgerSourceType.MANUAL,
      },
    });
  });

  afterAll(async () => {
    await cleanup(app);
  });

  // ============================================================================
  // 1. Demand Series Extraction (H1, H8)
  // ============================================================================
  describe('Demand Series Extraction', () => {
    it('should return demand series with only consumption reasons (H1)', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/forecasting/demand-series')
        .query({ windowDays: '14' })
        .set('Authorization', `Bearer ${testOrg.l4Token}`)
        .expect(200);

      expect(response.body.windowDays).toBe(14);
      expect(response.body.itemCount).toBeGreaterThanOrEqual(1);

      // Find item1 series
      const item1Series = response.body.series.find((s: any) => s.itemId === itemId);
      expect(item1Series).toBeDefined();
      
      // Total demand should be 15 units/day * 14 days = 210
      // (10 SALE + 5 PRODUCTION_CONSUME per day)
      expect(item1Series.totalDemand).toBeCloseTo(210, 0);
    });

    it('should return demand summary for dashboard', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/forecasting/demand-summary')
        .query({ windowDays: '14' })
        .set('Authorization', `Bearer ${testOrg.l4Token}`)
        .expect(200);

      expect(response.body.windowDays).toBe(14);
      expect(response.body.itemsWithDemand).toBeGreaterThanOrEqual(1);
      expect(response.body.totalDemandQty).toBeGreaterThan(0);
    });

    it('should be accessible by L2+ users', async () => {
      await request(app.getHttpServer())
        .get('/inventory/forecasting/demand-series')
        .set('Authorization', `Bearer ${testOrg.l2Token}`)
        .expect(200);
    });
  });

  // ============================================================================
  // 2. Forecast Snapshot Generation (H4, H9)
  // ============================================================================
  describe('Forecast Snapshot Generation', () => {
    let snapshotId: string;

    it('should generate forecast snapshots (L4+)', async () => {
      const response = await request(app.getHttpServer())
        .post('/inventory/forecasting/snapshots')
        .send({
          windowDays: 14,
          horizonDays: 14,
        })
        .set('Authorization', `Bearer ${testOrg.l4Token}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.created).toBeGreaterThan(0);
      expect(response.body.snapshotIds).toBeDefined();
      expect(response.body.snapshotIds.length).toBeGreaterThan(0);
      snapshotId = response.body.snapshotIds[0];
    });

    it('should be idempotent - same input returns existing snapshot (H4)', async () => {
      const response = await request(app.getHttpServer())
        .post('/inventory/forecasting/snapshots')
        .send({
          windowDays: 14,
          horizonDays: 14,
        })
        .set('Authorization', `Bearer ${testOrg.l4Token}`)
        .expect(201);

      // Should return existing snapshots, not create new ones
      expect(response.body.created).toBe(0);
      expect(response.body.skipped).toBeGreaterThan(0);
    });

    it('should list snapshots', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/forecasting/snapshots')
        .set('Authorization', `Bearer ${testOrg.l4Token}`)
        .expect(200);

      expect(response.body.snapshots).toBeDefined();
      expect(response.body.snapshots.length).toBeGreaterThan(0);
    });

    it('should get snapshot by ID with forecast data', async () => {
      const response = await request(app.getHttpServer())
        .get(`/inventory/forecasting/snapshots/${snapshotId}`)
        .set('Authorization', `Bearer ${testOrg.l4Token}`)
        .expect(200);

      expect(response.body.id).toBe(snapshotId);
      expect(response.body.avgDailyQty).toBeDefined();
      expect(response.body.forecastTotalQty).toBeDefined();
      expect(response.body.confidenceLow).toBeDefined();
      expect(response.body.confidenceHigh).toBeDefined();
      expect(response.body.deterministicHash).toBeDefined();
    });

    it('should reject invalid window days', async () => {
      await request(app.getHttpServer())
        .post('/inventory/forecasting/snapshots')
        .send({
          windowDays: 10, // Not 7, 14, or 28
          horizonDays: 14,
        })
        .set('Authorization', `Bearer ${testOrg.l4Token}`)
        .expect(400);
    });

    it('should reject L2 user for write operation (RBAC)', async () => {
      await request(app.getHttpServer())
        .post('/inventory/forecasting/snapshots')
        .send({ windowDays: 14 })
        .set('Authorization', `Bearer ${testOrg.l2Token}`)
        .expect(403);
    });

    it('should return valid window options', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/forecasting/windows')
        .set('Authorization', `Bearer ${testOrg.l2Token}`)
        .expect(200);

      expect(response.body.windowDays).toEqual([7, 14, 28]);
    });
  });

  // ============================================================================
  // 3. Optimization Run Generation (H5, H10)
  // ============================================================================
  describe('Optimization Run Generation', () => {
    let runId: string;

    it('should generate optimization run (L4+)', async () => {
      const response = await request(app.getHttpServer())
        .post('/inventory/reorder-optimization/runs')
        .send({
          horizonDays: 14,
        })
        .set('Authorization', `Bearer ${testOrg.l4Token}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.runId).toBeDefined();
      expect(response.body.status).toBe('GENERATED');
      expect(response.body.itemCount).toBeGreaterThan(0);
      runId = response.body.runId;
    });

    it('should be idempotent - same inputs return existing run (H4)', async () => {
      const response = await request(app.getHttpServer())
        .post('/inventory/reorder-optimization/runs')
        .send({
          horizonDays: 14,
        })
        .set('Authorization', `Bearer ${testOrg.l4Token}`)
        .expect(201);

      expect(response.body.runId).toBe(runId);
      expect(response.body.created).toBe(false);
    });

    it('should list optimization runs', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/reorder-optimization/runs')
        .set('Authorization', `Bearer ${testOrg.l4Token}`)
        .expect(200);

      expect(response.body.runs).toBeDefined();
      expect(response.body.runs.length).toBeGreaterThan(0);
    });

    it('should get optimization run detail with lines', async () => {
      const response = await request(app.getHttpServer())
        .get(`/inventory/reorder-optimization/runs/${runId}`)
        .set('Authorization', `Bearer ${testOrg.l4Token}`)
        .expect(200);

      expect(response.body.id).toBe(runId);
      expect(response.body.status).toBe('GENERATED');
      expect(response.body.lines).toBeDefined();
      expect(response.body.lines.length).toBeGreaterThan(0);

      // Check line has explainability fields
      const line = response.body.lines[0];
      expect(line.onHandQty).toBeDefined();
      expect(line.availableQty).toBeDefined();
      expect(line.avgDailyQty).toBeDefined();
      expect(line.targetStockQty).toBeDefined();
      expect(line.suggestedQty).toBeDefined();
      expect(line.reasonCodes).toBeDefined();
      expect(line.explanation).toBeDefined();
    });

    it('should be accessible by L2+ users for read', async () => {
      await request(app.getHttpServer())
        .get(`/inventory/reorder-optimization/runs/${runId}`)
        .set('Authorization', `Bearer ${testOrg.l2Token}`)
        .expect(200);
    });

    it('should reject L2 user for write operation (RBAC)', async () => {
      await request(app.getHttpServer())
        .post('/inventory/reorder-optimization/runs')
        .send({ horizonDays: 14 })
        .set('Authorization', `Bearer ${testOrg.l2Token}`)
        .expect(403);
    });
  });

  // ============================================================================
  // 4. Draft PO Generation
  // ============================================================================
  describe('Draft PO Generation', () => {
    let runId: string;

    beforeAll(async () => {
      // Create a fresh run for PO testing
      const response = await request(app.getHttpServer())
        .post('/inventory/reorder-optimization/runs')
        .send({
          horizonDays: 7, // Different horizon to create new run
        })
        .set('Authorization', `Bearer ${testOrg.l4Token}`);
      
      runId = response.body.runId;
    });

    it('should create draft POs from optimization run (L4+)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/inventory/reorder-optimization/runs/${runId}/pos`)
        .set('Authorization', `Bearer ${testOrg.l4Token}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.poCount).toBeGreaterThanOrEqual(0);
    });

    it('should reject duplicate PO creation', async () => {
      await request(app.getHttpServer())
        .post(`/inventory/reorder-optimization/runs/${runId}/pos`)
        .set('Authorization', `Bearer ${testOrg.l4Token}`)
        .expect(400);
    });
  });

  // ============================================================================
  // 5. Export Functionality
  // ============================================================================
  describe('Export Functionality', () => {
    let runId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/reorder-optimization/runs')
        .set('Authorization', `Bearer ${testOrg.l4Token}`);
      
      runId = response.body.runs[0].id;
    });

    it('should export run as JSON', async () => {
      const response = await request(app.getHttpServer())
        .get(`/inventory/reorder-optimization/runs/${runId}/export`)
        .query({ format: 'json' })
        .set('Authorization', `Bearer ${testOrg.l4Token}`)
        .expect(200);

      expect(response.body.format).toBe('json');
      expect(response.body.run).toBeDefined();
    });

    it('should export run as CSV', async () => {
      const response = await request(app.getHttpServer())
        .get(`/inventory/reorder-optimization/runs/${runId}/export`)
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${testOrg.l4Token}`)
        .expect(200);

      expect(response.body.format).toBe('csv');
      expect(response.body.content).toBeDefined();
      expect(response.body.content).toContain('Item ID');
      expect(response.body.content).toContain('Suggested Qty');
    });
  });

  // ============================================================================
  // 6. Cross-Tenant Isolation (H2)
  // ============================================================================
  describe('Cross-Tenant Isolation (H2)', () => {
    it('should not see other org demand series', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/forecasting/demand-series')
        .set('Authorization', `Bearer ${testOrg2.l4Token}`)
        .expect(200);

      // Should not see items from testOrg
      const item1Series = response.body.series.find((s: any) => s.itemId === itemId);
      expect(item1Series).toBeUndefined();
    });

    it('should not access other org snapshots', async () => {
      // Get snapshot from testOrg
      const orgSnapshots = await request(app.getHttpServer())
        .get('/inventory/forecasting/snapshots')
        .set('Authorization', `Bearer ${testOrg.l4Token}`);

      const snapshotId = orgSnapshots.body.snapshots[0]?.id;
      if (snapshotId) {
        // Try to access from testOrg2
        await request(app.getHttpServer())
          .get(`/inventory/forecasting/snapshots/${snapshotId}`)
          .set('Authorization', `Bearer ${testOrg2.l4Token}`)
          .expect(404);
      }
    });
  });
});
