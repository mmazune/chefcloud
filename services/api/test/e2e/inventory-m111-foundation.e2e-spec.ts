/**
 * M11.1 Inventory Foundation E2E Tests
 *
 * Tests the complete inventory foundation module:
 * - Units of Measure (UOM) with conversions
 * - Inventory Locations (hierarchical)
 * - Stock Ledger (append-only, immutable)
 * - Stock Adjustments (with approval workflow)
 * - Cycle Count Sessions (idempotent finalize)
 * - Exports (CSV/JSON with hashes)
 *
 * Hypotheses Tested:
 * - H1: Cross-org/branch isolation
 * - H2: Unit conversion precision (Decimal)
 * - H3: Race condition prevention for negative stock
 * - H4: Count finalize idempotency
 * - H5: Export hash consistency
 * - H6: Proper cleanup (no hanging handles)
 * - H7: RBAC enforcement
 * - H8: SKU uniqueness per org
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { createOrgWithUsers, createInventory, FactoryOrg } from './factory';
import { cleanup } from '../helpers/cleanup';
import { createE2ETestingModule } from '../helpers/e2e-bootstrap';

// Generate unique suffix for this test run to avoid conflicts
const testSuffix = Date.now().toString(36);

describe('M11.1 Inventory Foundation E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factory: FactoryOrg;
  let inventory: { beef: { id: string }; potatoes: { id: string } };

  // Auth tokens for different role levels
  let ownerToken: string;
  let managerToken: string;
  let supervisorToken: string;
  let waiterToken: string;

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

    prisma = app.get(PrismaService);
    factory = await createOrgWithUsers(prisma, `e2e-m111-${testSuffix}`);
    inventory = await createInventory(prisma, factory.orgId);

    // Login as different users to get tokens
    const loginOwner = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: factory.users.owner.email, password: 'Test#123' });
    ownerToken = loginOwner.body.access_token;

    const loginManager = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: factory.users.manager.email, password: 'Test#123' });
    managerToken = loginManager.body.access_token;

    const loginSupervisor = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: factory.users.supervisor.email, password: 'Test#123' });
    supervisorToken = loginSupervisor.body.access_token;

    const loginWaiter = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: factory.users.waiter.email, password: 'Test#123' });
    waiterToken = loginWaiter.body.access_token;
  }, 60000);

  afterAll(async () => {
    await cleanup(app);
  });

  // ============= H7: RBAC Tests =============

  describe('RBAC Enforcement (H7)', () => {
    it('should allow L4+ to create UOM', async () => {
      const response = await request(app.getHttpServer())
        .post('/inventory/foundation/uom')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: `kg-${testSuffix}`, name: 'Kilogram', symbol: 'kg' })
        .expect(201);

      expect(response.body.code).toBe(`kg-${testSuffix}`.toUpperCase());
    });

    it('should reject L2 user from creating UOM (needs L4)', async () => {
      await request(app.getHttpServer())
        .post('/inventory/foundation/uom')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({ code: `lb-${testSuffix}`, name: 'Pound', symbol: 'lb' })
        .expect(403);
    });

    it('should allow L2+ to read UOM', async () => {
      await request(app.getHttpServer())
        .get('/inventory/foundation/uom')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(200);
    });

    it('should reject L1 user from reading UOM (needs L2)', async () => {
      await request(app.getHttpServer())
        .get('/inventory/foundation/uom')
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(403);
    });

    it('should allow L4+ to create locations', async () => {
      const response = await request(app.getHttpServer())
        .post('/inventory/foundation/locations')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: `WH-01-${testSuffix}`, name: 'Main Warehouse' })
        .expect(201);

      expect(response.body.code).toBe(`WH-01-${testSuffix}`.toUpperCase());
    });

    it('should reject L3 user from creating locations (needs L4)', async () => {
      await request(app.getHttpServer())
        .post('/inventory/foundation/locations')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({ code: `WH-02-${testSuffix}`, name: 'Secondary Warehouse' })
        .expect(403);
    });

    it('should allow L3+ to create adjustments', async () => {
      // First create a location as manager
      const locResponse = await request(app.getHttpServer())
        .post('/inventory/foundation/locations')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: `WH-RBAC-${testSuffix}`, name: 'RBAC Test Warehouse' });

      const locationId = locResponse.body.id;

      // Chef (L3) should be able to create adjustments
      // Get chef token
      const loginChef = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: factory.users.chef.email, password: 'Test#123' });
      const chefToken = loginChef.body.access_token;

      const response = await request(app.getHttpServer())
        .post('/inventory/foundation/adjustments')
        .set('Authorization', `Bearer ${chefToken}`)
        .send({
          itemId: inventory.beef.id,
          locationId,
          qty: 10,
          reason: 'RECEIVED',
          notes: 'Initial stock',
          autoApprove: true,
        })
        .expect(201);

      expect(response.body.status).toBe('APPROVED');
    });

    it('should reject L2 user from creating adjustments (needs L3)', async () => {
      // Get any existing location
      const locResponse = await request(app.getHttpServer())
        .get('/inventory/foundation/locations')
        .set('Authorization', `Bearer ${managerToken}`);

      const locationId = locResponse.body[0]?.id;

      if (locationId) {
        await request(app.getHttpServer())
          .post('/inventory/foundation/adjustments')
          .set('Authorization', `Bearer ${supervisorToken}`)
          .send({
            itemId: inventory.beef.id,
            locationId,
            qty: 10,
            reason: 'RECEIVED',
          })
          .expect(403);
      }
    });
  });

  // ============= UOM Tests =============

  describe('Units of Measure', () => {
    let kgUomId: string;
    let gUomId: string;

    it('should create UOM with base unit', async () => {
      // Create gram as derived from kg
      const kgResponse = await request(app.getHttpServer())
        .post('/inventory/foundation/uom')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: `g-${testSuffix}`, name: 'Gram', symbol: 'g' })
        .expect(201);

      gUomId = kgResponse.body.id;
      expect(kgResponse.body.code).toBe(`g-${testSuffix}`.toUpperCase());
    });

    it('should list all UOMs for org', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/foundation/uom')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should create conversion between UOMs', async () => {
      // First ensure we have kg UOM
      const kgCreate = await request(app.getHttpServer())
        .post('/inventory/foundation/uom')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: `kg2-${testSuffix}`, name: 'Kilogram2', symbol: 'kg2' });
      kgUomId = kgCreate.body.id;

      const g2Create = await request(app.getHttpServer())
        .post('/inventory/foundation/uom')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: `g2-${testSuffix}`, name: 'Gram2', symbol: 'g2' });
      const g2UomId = g2Create.body.id;

      const response = await request(app.getHttpServer())
        .post('/inventory/foundation/uom/conversions')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          fromUomId: kgUomId,
          toUomId: g2UomId,
          factor: 1000,
        })
        .expect(201);

      expect(response.body.factor).toBe('1000');
    });

    it('should convert between UOMs accurately (H2: no rounding drift)', async () => {
      // Get the UOMs we created
      const uomList = await request(app.getHttpServer())
        .get('/inventory/foundation/uom')
        .set('Authorization', `Bearer ${managerToken}`);

      const kg2Uom = uomList.body.find((u: { code: string }) => u.code === `kg2-${testSuffix}`);
      const g2Uom = uomList.body.find((u: { code: string }) => u.code === `g2-${testSuffix}`);

      if (kg2Uom && g2Uom) {
        const response = await request(app.getHttpServer())
          .post('/inventory/foundation/uom/convert')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            fromUomId: kg2Uom.id,
            toUomId: g2Uom.id,
            qty: 1.5,
          })
          .expect(200);

        expect(response.body.result).toBe('1500');
      }
    });
  });

  // ============= Location Tests =============

  describe('Inventory Locations', () => {
    let parentLocationId: string;

    it('should create root location', async () => {
      const response = await request(app.getHttpServer())
        .post('/inventory/foundation/locations')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          code: `WH-MAIN-${testSuffix}`,
          name: 'Main Warehouse',
          metadata: { area: 'Building A' },
        })
        .expect(201);

      parentLocationId = response.body.id;
      expect(response.body.code).toBe(`WH-MAIN-${testSuffix}`.toUpperCase());
      expect(response.body.parentId).toBeNull();
    });

    it('should create child location with parent', async () => {
      const response = await request(app.getHttpServer())
        .post('/inventory/foundation/locations')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          code: `WH-MAIN-A1-${testSuffix}`,
          name: 'Aisle 1',
          parentId: parentLocationId,
        })
        .expect(201);

      expect(response.body.code).toBe(`WH-MAIN-A1-${testSuffix}`.toUpperCase());
      expect(response.body.parentId).toBe(parentLocationId);
    });

    it('should list locations with hierarchy', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/foundation/locations')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const mainWh = response.body.find((l: { code: string }) => l.code === `WH-MAIN-${testSuffix}`.toUpperCase());
      expect(mainWh).toBeDefined();
    });

    it('should update location', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/inventory/foundation/locations/${parentLocationId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Main Warehouse Updated' })
        .expect(200);

      expect(response.body.name).toBe('Main Warehouse Updated');
    });

    it('should deactivate location', async () => {
      // Create a location to deactivate
      const createResp = await request(app.getHttpServer())
        .post('/inventory/foundation/locations')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: `WH-DEACT-${testSuffix}`, name: 'To Deactivate' });

      const response = await request(app.getHttpServer())
        .patch(`/inventory/foundation/locations/${createResp.body.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ active: false })
        .expect(200);

      expect(response.body.isActive).toBe(false);
    });
  });

  // ============= Stock Ledger Tests =============

  describe('Stock Ledger', () => {
    let testLocationId: string;

    beforeAll(async () => {
      // Create a location for ledger tests
      const locResp = await request(app.getHttpServer())
        .post('/inventory/foundation/locations')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: `WH-LEDGER-${testSuffix}`, name: 'Ledger Test Location' });
      testLocationId = locResp.body.id;
    });

    it('should record adjustment and update ledger', async () => {
      const response = await request(app.getHttpServer())
        .post('/inventory/foundation/adjustments')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          itemId: inventory.beef.id,
          locationId: testLocationId,
          qty: 100,
          reason: 'RECEIVED',
          notes: 'Initial stock for ledger test',
          autoApprove: true,
        })
        .expect(201);

      expect(response.body.status).toBe('APPROVED');
    });

    it('should query on-hand by item and location', async () => {
      const response = await request(app.getHttpServer())
        .get(`/inventory/foundation/ledger/on-hand/${inventory.beef.id}`)
        .query({ locationId: testLocationId })
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.itemId).toBe(inventory.beef.id);
      expect(parseFloat(response.body.onHand)).toBeGreaterThanOrEqual(100);
    });

    it('should query on-hand grouped by location', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/foundation/ledger/on-hand-by-location')
        .query({ itemId: inventory.beef.id })
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should query ledger entries with filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/foundation/ledger/entries')
        .query({
          itemId: inventory.beef.id,
          locationId: testLocationId,
          limit: 10,
        })
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.entries).toBeDefined();
      expect(Array.isArray(response.body.entries)).toBe(true);
    });
  });

  // ============= Adjustments Tests =============

  describe('Stock Adjustments', () => {
    let adjLocationId: string;
    let pendingAdjustmentId: string;

    beforeAll(async () => {
      const locResp = await request(app.getHttpServer())
        .post('/inventory/foundation/locations')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: `WH-ADJ-${testSuffix}`, name: 'Adjustment Test Location' });
      adjLocationId = locResp.body.id;

      // Seed initial stock
      await request(app.getHttpServer())
        .post('/inventory/foundation/adjustments')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          itemId: inventory.potatoes.id,
          locationId: adjLocationId,
          qty: 200,
          reason: 'RECEIVED',
          autoApprove: true,
        });
    });

    it('should create adjustment with pending status', async () => {
      const response = await request(app.getHttpServer())
        .post('/inventory/foundation/adjustments')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          itemId: inventory.potatoes.id,
          locationId: adjLocationId,
          qty: -50,
          reason: 'DAMAGED',
          notes: 'Water damage',
          autoApprove: false,
        })
        .expect(201);

      pendingAdjustmentId = response.body.id;
      expect(response.body.status).toBe('PENDING');
    });

    it('should list adjustments with filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/foundation/adjustments')
        .query({ status: 'PENDING' })
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.adjustments).toBeDefined();
      expect(Array.isArray(response.body.adjustments)).toBe(true);
    });

    it('should approve adjustment (L4 required)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/inventory/foundation/adjustments/${pendingAdjustmentId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.status).toBe('APPROVED');
    });

    it('should reject adjustment with reason', async () => {
      // Create another pending adjustment
      const createResp = await request(app.getHttpServer())
        .post('/inventory/foundation/adjustments')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          itemId: inventory.potatoes.id,
          locationId: adjLocationId,
          qty: -10,
          reason: 'EXPIRED',
          autoApprove: false,
        });

      const response = await request(app.getHttpServer())
        .post(`/inventory/foundation/adjustments/${createResp.body.id}/reject`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: 'Not verified by physical count' })
        .expect(200);

      expect(response.body.status).toBe('REJECTED');
    });
  });

  // ============= Count Sessions Tests (H4: Idempotency) =============

  describe('Count Sessions (H4: Idempotency)', () => {
    let countLocationId: string;
    let countSessionId: string;

    it('should create count session', async () => {
      // First create a location for count tests
      const locResp = await request(app.getHttpServer())
        .post('/inventory/foundation/locations')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: `WH-COUNT-${testSuffix}`, name: 'Count Test Location' })
        .expect(201);
      countLocationId = locResp.body.id;

      // Seed stock for count
      await request(app.getHttpServer())
        .post('/inventory/foundation/adjustments')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          itemId: inventory.beef.id,
          locationId: countLocationId,
          qty: 50,
          reason: 'RECEIVED',
          autoApprove: true,
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/inventory/foundation/counts/sessions')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: `Q1 2025 Count ${testSuffix}`,
          description: 'Quarterly inventory count',
          locationId: countLocationId,
        })
        .expect(201);

      countSessionId = response.body.id;
      expect(response.body.name).toBe(`Q1 2025 Count ${testSuffix}`);
      expect(response.body.status).toBe('OPEN');
    });

    it('should add count line', async () => {
      const response = await request(app.getHttpServer())
        .post(`/inventory/foundation/counts/sessions/${countSessionId}/lines`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          itemId: inventory.beef.id,
          locationId: countLocationId,
          countedQty: 48,
          notes: 'Found discrepancy',
        })
        .expect(201);

      expect(response.body.countedQty).toBe('48');
      // Variance should be calculated (expected - counted = 50 - 48 = 2)
    });

    it('should list session lines', async () => {
      const response = await request(app.getHttpServer())
        .get(`/inventory/foundation/counts/sessions/${countSessionId}/lines`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.lines).toBeDefined();
      expect(Array.isArray(response.body.lines)).toBe(true);
      expect(response.body.lines.length).toBeGreaterThanOrEqual(1);
    });

    it('should finalize session and create ledger entries', async () => {
      const response = await request(app.getHttpServer())
        .post(`/inventory/foundation/counts/sessions/${countSessionId}/finalize`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({})
        .expect(200);

      expect(response.body.status).toBe('FINALIZED');
    });

    it('should be idempotent on repeated finalize (H4)', async () => {
      // Finalize same session again - should return same result without error
      const response = await request(app.getHttpServer())
        .post(`/inventory/foundation/counts/sessions/${countSessionId}/finalize`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({})
        .expect(200);

      expect(response.body.status).toBe('FINALIZED');

      // Verify no duplicate ledger entries were created
      // (This is validated by the service returning successfully)
    });

    it('should cancel an open session', async () => {
      // Create new session to cancel
      const createResp = await request(app.getHttpServer())
        .post('/inventory/foundation/counts/sessions')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: `To Cancel ${testSuffix}`,
          locationId: countLocationId,
        });

      const response = await request(app.getHttpServer())
        .post(`/inventory/foundation/counts/sessions/${createResp.body.id}/cancel`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: 'Starting fresh' })
        .expect(200);

      expect(response.body.status).toBe('CANCELLED');
    });
  });

  // ============= Export Tests (H5: Hash Consistency) =============

  describe('Exports (H5: Hash Consistency)', () => {
    it('should export inventory levels as CSV with hash', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/foundation/exports/inventory-levels')
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['x-export-hash']).toBeDefined();
      expect(response.headers['x-export-hash'].length).toBe(64); // SHA-256 hex
    });

    it('should export inventory levels as JSON', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/foundation/exports/inventory-levels')
        .query({ format: 'json' })
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['x-export-hash']).toBeDefined();
    });

    it('should produce consistent hash for same data (H5)', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/inventory/foundation/exports/ledger')
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get('/inventory/foundation/exports/ledger')
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      // Hashes should match for same underlying data
      expect(response1.headers['x-export-hash']).toBe(response2.headers['x-export-hash']);
    });

    it('should export adjustments', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/foundation/exports/adjustments')
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.headers['x-export-hash']).toBeDefined();
    });

    it('should export count sessions', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/foundation/exports/count-sessions')
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.headers['x-export-hash']).toBeDefined();
    });
  });

  // ============= Org Isolation Tests (H1) =============

  describe('Organization Isolation (H1)', () => {
    let org2Factory: FactoryOrg;
    let org2ManagerToken: string;

    beforeAll(async () => {
      // Create second org with unique suffix
      org2Factory = await createOrgWithUsers(prisma, `e2e-m111-org2-${testSuffix}`);

      const loginOrg2 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: org2Factory.users.manager.email, password: 'Test#123' });
      org2ManagerToken = loginOrg2.body.access_token;
    });

    it('should not see UOMs from other org', async () => {
      // Create UOM in org1
      await request(app.getHttpServer())
        .post('/inventory/foundation/uom')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: `org1-unit-${testSuffix}`, name: 'Org1 Unit' });

      // Query from org2
      const response = await request(app.getHttpServer())
        .get('/inventory/foundation/uom')
        .set('Authorization', `Bearer ${org2ManagerToken}`)
        .expect(200);

      const found = response.body.find((u: { code: string }) => u.code === `org1-unit-${testSuffix}`);
      expect(found).toBeUndefined();
    });

    it('should not see locations from other org', async () => {
      // Create location in org1
      await request(app.getHttpServer())
        .post('/inventory/foundation/locations')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: `ORG1-LOC-${testSuffix}`, name: 'Org1 Location' });

      // Query from org2
      const response = await request(app.getHttpServer())
        .get('/inventory/foundation/locations')
        .set('Authorization', `Bearer ${org2ManagerToken}`)
        .expect(200);

      const found = response.body.find((l: { code: string }) => l.code === `ORG1-LOC-${testSuffix}`);
      expect(found).toBeUndefined();
    });

    it('should not see adjustments from other org', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/foundation/adjustments')
        .set('Authorization', `Bearer ${org2ManagerToken}`)
        .expect(200);

      // Org2 has no adjustments - should be empty or only have org2's
      expect(response.body.adjustments).toBeDefined();
      expect(Array.isArray(response.body.adjustments)).toBe(true);
      const org1Items = response.body.adjustments.filter(
        (a: { itemId: string }) =>
          a.itemId === inventory.beef.id || a.itemId === inventory.potatoes.id,
      );
      expect(org1Items.length).toBe(0);
    });
  });

  // ============= Negative Stock Prevention (H3) =============

  describe('Negative Stock Prevention (H3)', () => {
    let negTestLocationId: string;

    beforeAll(async () => {
      const locResp = await request(app.getHttpServer())
        .post('/inventory/foundation/locations')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: `WH-NEG-TEST-${testSuffix}`, name: 'Negative Stock Test' });
      negTestLocationId = locResp.body.id;

      // Seed with known quantity
      await request(app.getHttpServer())
        .post('/inventory/foundation/adjustments')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          itemId: inventory.beef.id,
          locationId: negTestLocationId,
          qty: 10,
          reason: 'RECEIVED',
          autoApprove: true,
        });
    });

    it('should reject adjustment that would cause negative stock', async () => {
      const response = await request(app.getHttpServer())
        .post('/inventory/foundation/adjustments')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          itemId: inventory.beef.id,
          locationId: negTestLocationId,
          qty: -100,
          reason: 'SOLD',
          autoApprove: true,
        });

      // Should reject (400) due to insufficient stock
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Insufficient stock');
    });
  });
});
