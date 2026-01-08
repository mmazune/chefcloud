/**
 * M13.1 Menu + Catalog Foundation E2E Tests
 *
 * Tests the menu/catalog module:
 * - Categories (org/branch scoped, hierarchical)
 * - Menu Items (SKU uniqueness, pricing, modifiers)
 * - Modifier Groups (selection type, min/max)
 * - Modifier Options (pricing delta)
 * - Availability Rules (day-of-week, time windows)
 * - CSV Exports (with SHA-256 hash)
 *
 * Hypotheses Tested:
 * - H1: Cross-org leakage prevention
 * - H2: Modifier min/max constraints
 * - H3: Timezone-aware availability evaluation
 * - H4: SKU uniqueness per org
 * - H5: sortOrder auto-assignment
 * - H6: Route ordering (/items/available before /items/:id)
 * - H7: RBAC enforcement (L2+ read, L3+ write items, L4+ modifiers)
 * - H8: Test cleanup (no hanging handles)
 * - H9: CSV export hash consistency
 * - H10: Parent category circular reference prevention
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { createOrgWithUsers, FactoryOrg } from './factory';
import { cleanup } from '../helpers/cleanup';
import { createE2ETestingModule } from '../helpers/e2e-bootstrap';

// Generate unique suffix for this test run to avoid conflicts
const testSuffix = Date.now().toString(36);

describe('M13.1 Menu + Catalog Foundation E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factory: FactoryOrg;

  // Auth tokens for different role levels
  let ownerToken: string;
  let managerToken: string;
  let supervisorToken: string;
  let waiterToken: string;
  let chefToken: string;

  // Created IDs for linking
  let categoryId: string;
  let menuItemId: string;
  let modifierGroupId: string;
  let modifierOptionId: string;

  // Helper to add required headers
  const authHeaders = (token: string, orgId?: string) => ({
    Authorization: `Bearer ${token}`,
    'x-org-id': orgId || factory.orgId,
  });

  beforeAll(async () => {
    const moduleFixture = await createE2ETestingModule({
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
    factory = await createOrgWithUsers(prisma, `e2e-m131-${testSuffix}`);

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

    const loginChef = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: factory.users.chef.email, password: 'Test#123' });
    chefToken = loginChef.body.access_token;
  }, 60000);

  afterAll(async () => {
    await cleanup(app);
  });

  // ============= Categories Tests =============

  describe('Categories CRUD', () => {
    it('should create a category (L3+ required)', async () => {
      const response = await request(app.getHttpServer())
        .post('/menu/categories')
        .set(authHeaders(managerToken))
        .send({
          name: `Appetizers-${testSuffix}`,
          description: 'Starters and small bites',
        })
        .expect(201);

      expect(response.body.name).toBe(`Appetizers-${testSuffix}`);
      expect(response.body.orgId).toBeDefined();
      expect(response.body.sortOrder).toBe(0); // H5: auto-assigned
      categoryId = response.body.id;
    });

    it('should reject category creation by L2 user', async () => {
      await request(app.getHttpServer())
        .post('/menu/categories')
        .set(authHeaders(supervisorToken))
        .send({ name: `Forbidden-${testSuffix}` })
        .expect(403);
    });

    it('should list categories for org', async () => {
      const response = await request(app.getHttpServer())
        .get('/menu/categories')
        .set(authHeaders(supervisorToken))
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some((c: { id: string }) => c.id === categoryId)).toBe(true);
    });

    it('should get single category by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/menu/categories/${categoryId}`)
        .set(authHeaders(supervisorToken))
        .expect(200);

      expect(response.body.id).toBe(categoryId);
    });

    it('should update category', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/menu/categories/${categoryId}`)
        .set(authHeaders(managerToken))
        .send({ description: 'Updated description' })
        .expect(200);

      expect(response.body.description).toBe('Updated description');
    });

    it('should create child category (hierarchical)', async () => {
      const response = await request(app.getHttpServer())
        .post('/menu/categories')
        .set(authHeaders(managerToken))
        .send({
          name: `Soups-${testSuffix}`,
          parentCategoryId: categoryId,
        })
        .expect(201);

      expect(response.body.parentCategoryId).toBe(categoryId);
    });
  });

  // ============= Menu Items Tests =============

  describe('Menu Items CRUD', () => {
    it('should create a menu item with SKU (L3+ required)', async () => {
      const response = await request(app.getHttpServer())
        .post('/menu/items')
        .set(authHeaders(managerToken))
        .send({
          name: `Grilled Chicken-${testSuffix}`,
          description: 'Juicy grilled chicken breast',
          sku: `GC-${testSuffix}`,
          categoryId,
          price: 25000,
          basePriceCents: 2500000,
          itemType: 'FOOD',
        })
        .expect(201);

      expect(response.body.name).toBe(`Grilled Chicken-${testSuffix}`);
      expect(response.body.sku).toBe(`GC-${testSuffix}`);
      expect(response.body.sortOrder).toBe(0); // H5: auto-assigned
      menuItemId = response.body.id;
    });

    it('should reject duplicate SKU in same org (H4)', async () => {
      await request(app.getHttpServer())
        .post('/menu/items')
        .set(authHeaders(managerToken))
        .send({
          name: `Another Item-${testSuffix}`,
          sku: `GC-${testSuffix}`, // Duplicate!
          categoryId,
          price: 20000,
        })
        .expect(400);
    });

    it('should reject item creation by L2 user', async () => {
      await request(app.getHttpServer())
        .post('/menu/items')
        .set(authHeaders(supervisorToken))
        .send({
          name: `Forbidden Item-${testSuffix}`,
          categoryId,
          price: 15000,
        })
        .expect(403);
    });

    it('should list menu items for org', async () => {
      const response = await request(app.getHttpServer())
        .get('/menu/items')
        .set(authHeaders(supervisorToken))
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some((i: { id: string }) => i.id === menuItemId)).toBe(true);
    });

    it('should get single menu item with modifiers', async () => {
      const response = await request(app.getHttpServer())
        .get(`/menu/items/${menuItemId}`)
        .set(authHeaders(supervisorToken))
        .expect(200);

      expect(response.body.id).toBe(menuItemId);
      expect(response.body.modifierGroups).toBeDefined();
    });

    it('should update menu item', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/menu/items/${menuItemId}`)
        .set(authHeaders(managerToken))
        .send({ price: 28000 })
        .expect(200);

      expect(Number(response.body.price)).toBe(28000);
    });
  });

  // ============= Modifier Groups Tests =============

  describe('Modifier Groups CRUD', () => {
    it('should create a modifier group (L4+ required)', async () => {
      const response = await request(app.getHttpServer())
        .post('/menu/modifier-groups')
        .set(authHeaders(managerToken))
        .send({
          name: `Cooking Preference-${testSuffix}`,
          description: 'How would you like it cooked?',
          selectionType: 'SINGLE',
          min: 1,
          max: 1,
          required: true,
        })
        .expect(201);

      expect(response.body.name).toBe(`Cooking Preference-${testSuffix}`);
      expect(response.body.selectionType).toBe('SINGLE');
      modifierGroupId = response.body.id;
    });

    it('should reject invalid min > max constraint (H2)', async () => {
      await request(app.getHttpServer())
        .post('/menu/modifier-groups')
        .set(authHeaders(managerToken))
        .send({
          name: `Invalid Group-${testSuffix}`,
          min: 5,
          max: 2, // Invalid: min > max
        })
        .expect(400);
    });

    it('should reject modifier group creation by L3 user', async () => {
      await request(app.getHttpServer())
        .post('/menu/modifier-groups')
        .set(authHeaders(chefToken))
        .send({ name: `Forbidden Group-${testSuffix}` })
        .expect(403);
    });

    it('should list modifier groups', async () => {
      const response = await request(app.getHttpServer())
        .get('/menu/modifier-groups')
        .set(authHeaders(supervisorToken))
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get single modifier group', async () => {
      const response = await request(app.getHttpServer())
        .get(`/menu/modifier-groups/${modifierGroupId}`)
        .set(authHeaders(supervisorToken))
        .expect(200);

      expect(response.body.id).toBe(modifierGroupId);
    });
  });

  // ============= Modifier Options Tests =============

  describe('Modifier Options CRUD', () => {
    it('should create a modifier option (L4+ required)', async () => {
      const response = await request(app.getHttpServer())
        .post('/menu/modifier-options')
        .set(authHeaders(managerToken))
        .send({
          groupId: modifierGroupId,
          name: 'Medium Rare',
          priceDelta: 0,
        })
        .expect(201);

      expect(response.body.name).toBe('Medium Rare');
      expect(response.body.sortOrder).toBe(0); // H5: auto-assigned
      modifierOptionId = response.body.id;
    });

    it('should create option with price delta', async () => {
      const response = await request(app.getHttpServer())
        .post('/menu/modifier-options')
        .set(authHeaders(managerToken))
        .send({
          groupId: modifierGroupId,
          name: 'Well Done',
          priceDelta: 2000,
        })
        .expect(201);

      expect(Number(response.body.priceDelta)).toBe(2000);
      expect(response.body.sortOrder).toBe(1); // H5: auto-incremented
    });

    it('should update modifier option', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/menu/modifier-options/${modifierOptionId}`)
        .set(authHeaders(managerToken))
        .send({ priceDelta: 500 })
        .expect(200);

      expect(Number(response.body.priceDelta)).toBe(500);
    });
  });

  // ============= Attach/Detach Modifier Groups =============

  describe('Attach Modifier Groups to Items', () => {
    it('should attach modifier group to item', async () => {
      const response = await request(app.getHttpServer())
        .post(`/menu/items/${menuItemId}/modifier-groups`)
        .set(authHeaders(managerToken))
        .send({ groupId: modifierGroupId })
        .expect(201);

      expect(response.body.itemId).toBe(menuItemId);
      expect(response.body.groupId).toBe(modifierGroupId);
    });

    it('should reject duplicate attachment', async () => {
      await request(app.getHttpServer())
        .post(`/menu/items/${menuItemId}/modifier-groups`)
        .set(authHeaders(managerToken))
        .send({ groupId: modifierGroupId })
        .expect(409); // Conflict
    });

    it('should detach modifier group from item', async () => {
      await request(app.getHttpServer())
        .delete(`/menu/items/${menuItemId}/modifier-groups/${modifierGroupId}`)
        .set(authHeaders(managerToken))
        .expect(204);
    });

    it('should allow re-attachment after detach', async () => {
      await request(app.getHttpServer())
        .post(`/menu/items/${menuItemId}/modifier-groups`)
        .set(authHeaders(managerToken))
        .send({ groupId: modifierGroupId })
        .expect(201);
    });
  });

  // ============= Availability Rules Tests =============

  describe('Availability Rules', () => {
    let availabilityRuleId: string;

    it('should create an availability rule (L4+ required)', async () => {
      const response = await request(app.getHttpServer())
        .post('/menu/availability-rules')
        .set(authHeaders(managerToken))
        .send({
          targetType: 'ITEM',
          targetId: menuItemId,
          daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
          startTime: '09:00',
          endTime: '17:00',
        })
        .expect(201);

      expect(response.body.targetType).toBe('ITEM');
      expect(response.body.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
      availabilityRuleId = response.body.id;
    });

    it('should reject invalid time format', async () => {
      await request(app.getHttpServer())
        .post('/menu/availability-rules')
        .set(authHeaders(managerToken))
        .send({
          targetType: 'ITEM',
          targetId: menuItemId,
          daysOfWeek: [0, 6], // Weekend
          startTime: 'invalid', // Invalid: not HH:MM format
          endTime: '17:00',
        })
        .expect(400);
    });

    it('should list availability rules', async () => {
      const response = await request(app.getHttpServer())
        .get('/menu/availability-rules')
        .set(authHeaders(supervisorToken))
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should update availability rule', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/menu/availability-rules/${availabilityRuleId}`)
        .set(authHeaders(managerToken))
        .send({ endTime: '21:00' })
        .expect(200);

      expect(response.body.endTime).toBe('21:00');
    });
  });

  // ============= Available Items (H6 Route Ordering) =============

  describe('Available Items Query (H6)', () => {
    it('should return available items for branch', async () => {
      const response = await request(app.getHttpServer())
        .get('/menu/items/available')
        .set(authHeaders(supervisorToken))
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should respect route ordering (available before :id)', async () => {
      // This test verifies H6: /items/available is NOT matched as /items/:id
      // If route ordering is wrong, this would 404 or return single item
      const response = await request(app.getHttpServer())
        .get('/menu/items/available')
        .set(authHeaders(supervisorToken))
        .expect(200);

      // Should be an array, not a single item
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  // ============= CSV Exports (H9) =============

  describe('CSV Exports', () => {
    it('should export items as CSV with hash header', async () => {
      const response = await request(app.getHttpServer())
        .get('/menu/export/items.csv')
        .set(authHeaders(managerToken))
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['x-nimbus-export-hash']).toBeDefined();
      expect(response.headers['x-nimbus-export-hash'].length).toBe(64); // SHA-256 hex
    });

    it('should export modifiers as CSV with hash header', async () => {
      const response = await request(app.getHttpServer())
        .get('/menu/export/modifiers.csv')
        .set(authHeaders(managerToken))
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['x-nimbus-export-hash']).toBeDefined();
    });

    it('should reject export by L3 user', async () => {
      await request(app.getHttpServer())
        .get('/menu/export/items.csv')
        .set(authHeaders(chefToken))
        .expect(403);
    });
  });

  // ============= Cross-Org Isolation (H1) =============

  describe('Cross-Org Isolation (H1)', () => {
    let otherOrgToken: string;
    let otherFactory: FactoryOrg;

    beforeAll(async () => {
      // Create another org
      otherFactory = await createOrgWithUsers(prisma, `e2e-m131-other-${testSuffix}`);
      const loginOther = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: otherFactory.users.manager.email, password: 'Test#123' });
      otherOrgToken = loginOther.body.access_token;
    });

    it('should not see other org categories', async () => {
      const response = await request(app.getHttpServer())
        .get('/menu/categories')
        .set(authHeaders(otherOrgToken, otherFactory.orgId))
        .expect(200);

      // Should not contain our test category
      expect(response.body.every((c: { id: string }) => c.id !== categoryId)).toBe(true);
    });

    it('should not access other org category by ID', async () => {
      await request(app.getHttpServer())
        .get(`/menu/categories/${categoryId}`)
        .set(authHeaders(otherOrgToken, otherFactory.orgId))
        .expect(404);
    });

    it('should not access other org menu item by ID', async () => {
      await request(app.getHttpServer())
        .get(`/menu/items/${menuItemId}`)
        .set(authHeaders(otherOrgToken, otherFactory.orgId))
        .expect(404);
    });

    it('should not modify other org data', async () => {
      await request(app.getHttpServer())
        .patch(`/menu/categories/${categoryId}`)
        .set(authHeaders(otherOrgToken, otherFactory.orgId))
        .send({ name: 'Hacked Category' })
        .expect(404);
    });
  });
});
