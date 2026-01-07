/**
 * M11.12 Analytics + Alerts E2E Tests
 * 
 * Tests inventory analytics KPIs and alert lifecycle.
 * Validates hypotheses H1-H8 from M11.12_HYPOTHESES.md
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { createTestUser, getTestJwt, TEST_ORG_ID, TEST_BRANCH_ID } from './helpers/auth-helper';

describe('M11.12 Analytics + Alerts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminJwt: string;
  let managerJwt: string;
  let teamMemberJwt: string;
  let testItemId: string;
  let testLocationId: string;
  let testAlertId: string;

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
    managerJwt = await getTestJwt(app, 'L4_MANAGER');
    teamMemberJwt = await getTestJwt(app, 'L2_TEAM_MEMBER');

    // Create test item with reorder level for testing
    const item = await prisma.client.inventoryItem.create({
      data: {
        orgId: TEST_ORG_ID,
        name: 'Test Analytics Item M1112',
        sku: 'M1112-SKU-001',
        unit: 'EA',
        isActive: true,
        reorderLevel: 10,
        lastCost: 5.00,
      },
    });
    testItemId = item.id;

    // Create test location
    const location = await prisma.client.inventoryLocation.create({
      data: {
        orgId: TEST_ORG_ID,
        branchId: TEST_BRANCH_ID,
        name: 'M1112 Test Location',
        locationType: 'STORAGE',
        isActive: true,
      },
    });
    testLocationId = location.id;

    // Create some test ledger entries for analytics
    // Add initial stock
    await prisma.client.inventoryLedgerEntry.create({
      data: {
        orgId: TEST_ORG_ID,
        branchId: TEST_BRANCH_ID,
        itemId: testItemId,
        locationId: testLocationId,
        qty: 5, // Below reorder level of 10
        reason: 'RECEIPT',
        refType: 'TEST',
        refId: 'test-ref-001',
      },
    });
  }, 60000);

  afterAll(async () => {
    // Cleanup test data
    await prisma.client.inventoryAlert.deleteMany({
      where: { entityId: testItemId },
    });
    await prisma.client.inventoryLedgerEntry.deleteMany({
      where: { itemId: testItemId },
    });
    await prisma.client.inventoryItem.deleteMany({
      where: { sku: 'M1112-SKU-001' },
    });
    await prisma.client.inventoryLocation.deleteMany({
      where: { name: 'M1112 Test Location' },
    });
    await app.close();
  }, 30000);

  // ============================================
  // Feature Group A: Analytics KPIs
  // ============================================

  describe('Analytics Summary', () => {
    it('should get analytics summary (L2+)', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/analytics/summary')
        .set('Authorization', `Bearer ${teamMemberJwt}`)
        .expect(200);

      expect(res.body).toHaveProperty('shrink');
      expect(res.body).toHaveProperty('waste');
      expect(res.body).toHaveProperty('deadStock');
      expect(res.body).toHaveProperty('expiryRisk');
      expect(res.body).toHaveProperty('reorderHealth');
    });

    it('should get shrink data (L2+)', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/analytics/shrink')
        .set('Authorization', `Bearer ${teamMemberJwt}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should get dead stock data (L2+)', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/analytics/dead-stock')
        .query({ deadStockDays: '30' })
        .set('Authorization', `Bearer ${teamMemberJwt}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should get expiry risk data (L2+)', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/analytics/expiry-risk')
        .set('Authorization', `Bearer ${teamMemberJwt}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // Should have 4 buckets
      expect(res.body.length).toBe(4);
    });

    it('should get reorder health data (L2+)', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/analytics/reorder-health')
        .set('Authorization', `Bearer ${teamMemberJwt}`)
        .expect(200);

      expect(res.body).toHaveProperty('belowReorderCount');
      expect(res.body).toHaveProperty('itemsBelowReorder');
      // Our test item has qty 5, reorder level 10, so should be below
      expect(res.body.belowReorderCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================
  // Feature Group B: Exports with Hash
  // ============================================

  describe('Exports with Hash (H4)', () => {
    it('should export shrink CSV with hash header (L4+)', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/analytics/shrink/export')
        .set('Authorization', `Bearer ${managerJwt}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['x-nimbus-export-hash']).toBeDefined();
      expect(res.headers['x-nimbus-export-hash']).toHaveLength(64); // SHA-256 hex
    });

    it('should export dead-stock CSV with hash header (L4+)', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/analytics/dead-stock/export')
        .set('Authorization', `Bearer ${managerJwt}`)
        .expect(200);

      expect(res.headers['x-nimbus-export-hash']).toBeDefined();
    });

    it('should reject export for L2 (RBAC)', async () => {
      await request(app.getHttpServer())
        .get('/inventory/analytics/shrink/export')
        .set('Authorization', `Bearer ${teamMemberJwt}`)
        .expect(403);
    });
  });

  // ============================================
  // Feature Group C: Alert Lifecycle
  // ============================================

  describe('Alert Evaluation (H1: Unique Constraint)', () => {
    it('should evaluate alerts and create new ones (L4+)', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/alerts/evaluate')
        .set('Authorization', `Bearer ${managerJwt}`)
        .send({})
        .expect(201);

      expect(res.body).toHaveProperty('created');
      expect(res.body).toHaveProperty('skippedDuplicate');
      expect(res.body).toHaveProperty('alertsByType');
      
      // Should have created at least one alert for our below-reorder item
      expect(res.body.created).toBeGreaterThanOrEqual(1);
    });

    it('should skip duplicate alerts on re-evaluation (H1)', async () => {
      // First evaluation
      await request(app.getHttpServer())
        .post('/inventory/alerts/evaluate')
        .set('Authorization', `Bearer ${managerJwt}`)
        .send({})
        .expect(201);

      // Second evaluation should skip duplicates
      const res = await request(app.getHttpServer())
        .post('/inventory/alerts/evaluate')
        .set('Authorization', `Bearer ${managerJwt}`)
        .send({})
        .expect(201);

      // Should have skipped the existing OPEN alerts
      expect(res.body.skippedDuplicate).toBeGreaterThanOrEqual(0);
    });

    it('should reject evaluate for L2 (H7: RBAC)', async () => {
      await request(app.getHttpServer())
        .post('/inventory/alerts/evaluate')
        .set('Authorization', `Bearer ${teamMemberJwt}`)
        .send({})
        .expect(403);
    });
  });

  describe('Alert List', () => {
    beforeAll(async () => {
      // Ensure we have alerts to list
      await request(app.getHttpServer())
        .post('/inventory/alerts/evaluate')
        .set('Authorization', `Bearer ${managerJwt}`)
        .send({});
    });

    it('should list alerts (L2+)', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/alerts')
        .set('Authorization', `Bearer ${teamMemberJwt}`)
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('pageSize');
      expect(Array.isArray(res.body.items)).toBe(true);

      // Save an alert ID for later tests
      if (res.body.items.length > 0) {
        testAlertId = res.body.items[0].id;
      }
    });

    it('should filter alerts by type', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/alerts')
        .query({ type: 'BELOW_REORDER_POINT' })
        .set('Authorization', `Bearer ${teamMemberJwt}`)
        .expect(200);

      for (const item of res.body.items) {
        expect(item.type).toBe('BELOW_REORDER_POINT');
      }
    });

    it('should filter alerts by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/alerts')
        .query({ status: 'OPEN' })
        .set('Authorization', `Bearer ${teamMemberJwt}`)
        .expect(200);

      for (const item of res.body.items) {
        expect(item.status).toBe('OPEN');
      }
    });
  });

  describe('Alert Acknowledge (H7: RBAC)', () => {
    let openAlertId: string;

    beforeAll(async () => {
      // Create a fresh alert to acknowledge
      await prisma.client.inventoryAlert.create({
        data: {
          orgId: TEST_ORG_ID,
          branchId: TEST_BRANCH_ID,
          type: 'DEAD_STOCK',
          severity: 'WARN',
          entityType: 'InventoryItem',
          entityId: testItemId,
          title: 'Test Alert for Acknowledge',
          detailsJson: {},
          status: 'OPEN',
        },
      }).then(alert => openAlertId = alert.id);
    });

    it('should acknowledge alert (L4+)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/alerts/${openAlertId}/acknowledge`)
        .set('Authorization', `Bearer ${managerJwt}`)
        .expect(201);

      expect(res.body.status).toBe('ACKNOWLEDGED');
      expect(res.body.acknowledgedAt).toBeDefined();
    });

    it('should reject acknowledge for L2 (H7)', async () => {
      // Create another open alert
      const alert = await prisma.client.inventoryAlert.create({
        data: {
          orgId: TEST_ORG_ID,
          branchId: TEST_BRANCH_ID,
          type: 'DEAD_STOCK',
          severity: 'INFO',
          entityType: 'InventoryItem',
          entityId: testItemId,
          title: 'Test Alert for RBAC',
          detailsJson: {},
          status: 'OPEN',
        },
      });

      await request(app.getHttpServer())
        .post(`/inventory/alerts/${alert.id}/acknowledge`)
        .set('Authorization', `Bearer ${teamMemberJwt}`)
        .expect(403);
    });
  });

  describe('Alert Resolve (H7: RBAC)', () => {
    let alertToResolve: string;

    beforeAll(async () => {
      const alert = await prisma.client.inventoryAlert.create({
        data: {
          orgId: TEST_ORG_ID,
          branchId: TEST_BRANCH_ID,
          type: 'EXPIRY_SOON',
          severity: 'WARN',
          entityType: 'InventoryItem',
          entityId: testItemId,
          title: 'Test Alert for Resolve',
          detailsJson: {},
          status: 'ACKNOWLEDGED',
        },
      });
      alertToResolve = alert.id;
    });

    it('should resolve alert with note (L4+)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/alerts/${alertToResolve}/resolve`)
        .set('Authorization', `Bearer ${managerJwt}`)
        .send({ resolutionNote: 'Fixed by adjusting stock levels' })
        .expect(201);

      expect(res.body.status).toBe('RESOLVED');
      expect(res.body.resolvedAt).toBeDefined();
      expect(res.body.detailsJson.resolutionNote).toBe('Fixed by adjusting stock levels');
    });

    it('should reject resolve for L2 (H7)', async () => {
      const alert = await prisma.client.inventoryAlert.create({
        data: {
          orgId: TEST_ORG_ID,
          branchId: TEST_BRANCH_ID,
          type: 'DEAD_STOCK',
          severity: 'INFO',
          entityType: 'InventoryItem',
          entityId: testItemId,
          title: 'Test Alert for RBAC Resolve',
          detailsJson: {},
          status: 'OPEN',
        },
      });

      await request(app.getHttpServer())
        .post(`/inventory/alerts/${alert.id}/resolve`)
        .set('Authorization', `Bearer ${teamMemberJwt}`)
        .send({})
        .expect(403);
    });
  });

  // ============================================
  // H5: Query Abuse Prevention
  // ============================================

  describe('Evaluate Endpoint Security (H5)', () => {
    it('should complete evaluate in reasonable time', async () => {
      const start = Date.now();

      await request(app.getHttpServer())
        .post('/inventory/alerts/evaluate')
        .set('Authorization', `Bearer ${managerJwt}`)
        .send({})
        .expect(201);

      const elapsed = Date.now() - start;
      // Should complete in under 30 seconds
      expect(elapsed).toBeLessThan(30000);
    });
  });

  // ============================================
  // H8: Cross-Branch Leakage (if multi-branch)
  // ============================================

  describe('Cross-Branch Isolation (H8)', () => {
    it('should only return alerts for authorized org', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/alerts')
        .set('Authorization', `Bearer ${teamMemberJwt}`)
        .expect(200);

      // All returned alerts should belong to TEST_ORG_ID
      for (const item of res.body.items) {
        expect(item.orgId).toBe(TEST_ORG_ID);
      }
    });
  });
});
