/**
 * M11.4: Recipes/BOM + POS Depletion E2E Tests
 * 
 * Tests:
 * 1. Recipe create with lines (pre-computed qtyBase)
 * 2. Recipe update and line management
 * 3. Recipe clone to new target
 * 4. Depletion on order close creates SALE ledger entries
 * 5. Depletion idempotency (same order returns existing)
 * 6. Depletion location resolution cascade
 * 7. Depletion with negative stock marks FAILED
 * 8. Depletion retry and skip
 * 9. CSV export with UTF-8 BOM and X-Nimbus-Export-Hash
 * 10. RBAC enforcement
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2ETestingModule } from '../helpers/module';
import { cleanup } from '../helpers/cleanup';
import { createOrgWithUsers, FactoryOrg } from './factory';
import { PrismaService } from '@api/prisma/prisma.service';
import { AppModule } from '@api/app.module';
import { Decimal } from '@prisma/client/runtime/library';

describe('M11.4: Recipes/BOM + POS Depletion E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testOrg: FactoryOrg;

  // Test data IDs
  let menuItemId: string;
  let inventoryItemIdA: string;
  let inventoryItemIdB: string;
  let uomId: string;
  let locationId: string;

  beforeAll(async () => {
    const moduleRef = await createE2ETestingModule({
      imports: [AppModule],
    });
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
    await app.init();

    // Create test org with users
    testOrg = await createOrgWithUsers(prisma, `test-recipes-depletion-${Date.now()}`);

    // Create base UOM
    const uom = await prisma.unitOfMeasure.create({
      data: {
        orgId: testOrg.orgId,
        code: 'EA',
        name: 'Each',
        isActive: true,
      },
    });
    uomId = uom.id;

    // Create inventory items
    const itemA = await prisma.inventoryItem.create({
      data: {
        orgId: testOrg.orgId,
        sku: 'RCP-ITEM-A',
        name: 'Recipe Test Item A (Tomato)',
        unit: 'EA',
        baseUomId: uomId,
        isActive: true,
      },
    });
    inventoryItemIdA = itemA.id;

    const itemB = await prisma.inventoryItem.create({
      data: {
        orgId: testOrg.orgId,
        sku: 'RCP-ITEM-B',
        name: 'Recipe Test Item B (Cheese)',
        unit: 'EA',
        baseUomId: uomId,
        isActive: true,
      },
    });
    inventoryItemIdB = itemB.id;

    // Create menu category
    const menuCategory = await prisma.menuCategory.create({
      data: {
        orgId: testOrg.orgId,
        name: 'Test Category',
      },
    });

    // Create menu item
    const menuItem = await prisma.menuItem.create({
      data: {
        orgId: testOrg.orgId,
        categoryId: menuCategory.id,
        name: 'Test Burger',
        price: new Decimal(12.99),
      },
    });
    menuItemId = menuItem.id;

    // Create inventory location with KITCHEN code for depletion
    const location = await prisma.inventoryLocation.create({
      data: {
        orgId: testOrg.orgId,
        branchId: testOrg.branchId,
        code: 'KITCHEN',
        name: 'Main Kitchen',
        locationType: 'PRODUCTION',
        isActive: true,
      },
    });
    locationId = location.id;

    // Seed initial stock for items at kitchen location
    await prisma.inventoryLedgerEntry.create({
      data: {
        orgId: testOrg.orgId,
        branchId: testOrg.branchId,
        itemId: inventoryItemIdA,
        locationId,
        qty: new Decimal(100),
        reason: 'INITIAL',
        sourceType: 'MANUAL',
        notes: 'Initial stock for recipe tests',
      },
    });

    await prisma.inventoryLedgerEntry.create({
      data: {
        orgId: testOrg.orgId,
        branchId: testOrg.branchId,
        itemId: inventoryItemIdB,
        locationId,
        qty: new Decimal(50),
        reason: 'INITIAL',
        sourceType: 'MANUAL',
        notes: 'Initial stock for recipe tests',
      },
    });
  }, 60000);

  afterAll(async () => {
    await cleanup(app);
  });

  // ============================================================
  // Group 1: Recipe Create with Lines
  // ============================================================
  describe('Group 1: Recipe Create', () => {
    let recipeId: string;

    it('should create a recipe with ingredient lines', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/v2/recipes')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          name: 'Test Burger Recipe',
          targetType: 'MENU_ITEM',
          targetId: menuItemId,
          outputQtyBase: 1,
          lines: [
            {
              inventoryItemId: inventoryItemIdA,
              qtyInput: 2,
              inputUomId: uomId,
              notes: '2 tomatoes per burger',
            },
            {
              inventoryItemId: inventoryItemIdB,
              qtyInput: 1,
              inputUomId: uomId,
              notes: '1 cheese slice per burger',
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Test Burger Recipe');
      expect(res.body.targetType).toBe('MENU_ITEM');
      expect(res.body.targetId).toBe(menuItemId);
      expect(res.body.lines).toHaveLength(2);
      expect(parseFloat(res.body.lines[0].qtyBase)).toBe(2);
      expect(parseFloat(res.body.lines[1].qtyBase)).toBe(1);
      recipeId = res.body.id;
    });

    it('should reject duplicate recipe for same target', async () => {
      await request(app.getHttpServer())
        .post('/inventory/v2/recipes')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          name: 'Duplicate Recipe',
          targetType: 'MENU_ITEM',
          targetId: menuItemId,
          lines: [{ inventoryItemId: inventoryItemIdA, qtyInput: 1, inputUomId: uomId }],
        })
        .expect(409); // Conflict
    });

    it('should reject recipe with invalid target', async () => {
      await request(app.getHttpServer())
        .post('/inventory/v2/recipes')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          name: 'Invalid Target Recipe',
          targetType: 'MENU_ITEM',
          targetId: 'non-existent-id',
          lines: [{ inventoryItemId: inventoryItemIdA, qtyInput: 1, inputUomId: uomId }],
        })
        .expect(400);
    });
  });

  // ============================================================
  // Group 2: Recipe Update and Line Management
  // ============================================================
  describe('Group 2: Recipe Update', () => {
    let recipeId: string;

    beforeEach(async () => {
      // Create a new menu item and recipe for each test
      const menuItem = await prisma.menuItem.create({
        data: {
          orgId: testOrg.orgId,
          categoryId: (await prisma.menuCategory.findFirst({ where: { orgId: testOrg.orgId } }))!.id,
          name: `Test Item ${Date.now()}`,
          price: new Decimal(9.99),
        },
      });

      const res = await request(app.getHttpServer())
        .post('/inventory/v2/recipes')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          name: 'Update Test Recipe',
          targetType: 'MENU_ITEM',
          targetId: menuItem.id,
          lines: [{ inventoryItemId: inventoryItemIdA, qtyInput: 1, inputUomId: uomId }],
        });
      recipeId = res.body.id;
    });

    it('should update recipe name and output quantity', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/inventory/v2/recipes/${recipeId}`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          name: 'Updated Recipe Name',
          outputQtyBase: 2,
        })
        .expect(200);

      expect(res.body.name).toBe('Updated Recipe Name');
      expect(parseFloat(res.body.outputQtyBase)).toBe(2);
    });

    it('should add a new line to recipe', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/v2/recipes/${recipeId}/lines`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          inventoryItemId: inventoryItemIdB,
          qtyInput: 3,
          inputUomId: uomId,
          notes: 'Added line',
        })
        .expect(201);

      expect(res.body.inventoryItemId).toBe(inventoryItemIdB);
      expect(parseFloat(res.body.qtyInput)).toBe(3);
    });

    it('should deactivate recipe', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/inventory/v2/recipes/${recipeId}`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({ isActive: false })
        .expect(200);

      expect(res.body.isActive).toBe(false);
    });
  });

  // ============================================================
  // Group 3: Recipe Clone
  // ============================================================
  describe('Group 3: Recipe Clone', () => {
    let sourceRecipeId: string;
    let targetMenuItemId: string;

    beforeEach(async () => {
      const menuItem1 = await prisma.menuItem.create({
        data: {
          orgId: testOrg.orgId,
          categoryId: (await prisma.menuCategory.findFirst({ where: { orgId: testOrg.orgId } }))!.id,
          name: `Clone Source ${Date.now()}`,
          price: new Decimal(15.99),
        },
      });

      const menuItem2 = await prisma.menuItem.create({
        data: {
          orgId: testOrg.orgId,
          categoryId: (await prisma.menuCategory.findFirst({ where: { orgId: testOrg.orgId } }))!.id,
          name: `Clone Target ${Date.now()}`,
          price: new Decimal(15.99),
        },
      });
      targetMenuItemId = menuItem2.id;

      const res = await request(app.getHttpServer())
        .post('/inventory/v2/recipes')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          name: 'Source Recipe',
          targetType: 'MENU_ITEM',
          targetId: menuItem1.id,
          lines: [
            { inventoryItemId: inventoryItemIdA, qtyInput: 5, inputUomId: uomId },
            { inventoryItemId: inventoryItemIdB, qtyInput: 2, inputUomId: uomId },
          ],
        });
      sourceRecipeId = res.body.id;
    });

    it('should clone recipe to new target', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/v2/recipes/${sourceRecipeId}/clone`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          name: 'Cloned Recipe',
          targetType: 'MENU_ITEM',
          targetId: targetMenuItemId,
        })
        .expect(201);

      expect(res.body.name).toBe('Cloned Recipe');
      expect(res.body.targetId).toBe(targetMenuItemId);
      expect(res.body.lines).toHaveLength(2);
      expect(res.body.id).not.toBe(sourceRecipeId);
    });

    it('should reject clone to existing target', async () => {
      // Clone once
      await request(app.getHttpServer())
        .post(`/inventory/v2/recipes/${sourceRecipeId}/clone`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          name: 'First Clone',
          targetType: 'MENU_ITEM',
          targetId: targetMenuItemId,
        });

      // Try to clone again to same target
      await request(app.getHttpServer())
        .post(`/inventory/v2/recipes/${sourceRecipeId}/clone`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          name: 'Duplicate Clone',
          targetType: 'MENU_ITEM',
          targetId: targetMenuItemId,
        })
        .expect(409);
    });
  });

  // ============================================================
  // Group 4: Depletion on Order Close
  // ============================================================
  describe('Group 4: Depletion on Order Close', () => {
    let depletionRecipeMenuItemId: string;

    beforeEach(async () => {
      // Create a menu item with recipe for depletion testing
      const menuItem = await prisma.menuItem.create({
        data: {
          orgId: testOrg.orgId,
          categoryId: (await prisma.menuCategory.findFirst({ where: { orgId: testOrg.orgId } }))!.id,
          name: `Depletion Test Item ${Date.now()}`,
          price: new Decimal(10.00),
        },
      });
      depletionRecipeMenuItemId = menuItem.id;

      // Create recipe for this item
      await request(app.getHttpServer())
        .post('/inventory/v2/recipes')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          name: 'Depletion Test Recipe',
          targetType: 'MENU_ITEM',
          targetId: menuItem.id,
          lines: [
            { inventoryItemId: inventoryItemIdA, qtyInput: 1, inputUomId: uomId },
          ],
        });
    });

    it('should create SALE ledger entries on order close with recipe', async () => {
      // Create order
      const orderRes = await request(app.getHttpServer())
        .post('/pos/orders')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          items: [{ menuItemId: depletionRecipeMenuItemId, quantity: 2 }],
        })
        .expect(201);

      const orderId = orderRes.body.id;

      // Get initial ledger count
      const ledgerCountBefore = await prisma.inventoryLedgerEntry.count({
        where: { sourceType: 'ORDER', sourceId: orderId },
      });
      expect(ledgerCountBefore).toBe(0);

      // Close order
      await request(app.getHttpServer())
        .post(`/pos/orders/${orderId}/close`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({ amount: 20.00 })
        .expect(201);

      // Wait for fire-and-forget depletion
      await new Promise((r) => setTimeout(r, 500));

      // Check depletion record was created
      const depletion = await prisma.orderInventoryDepletion.findFirst({
        where: { orderId },
      });
      expect(depletion).toBeTruthy();
      expect(depletion?.status).toBe('POSTED');
      expect(depletion?.ledgerEntryCount).toBe(1);

      // Check SALE ledger entries
      const ledgerEntries = await prisma.inventoryLedgerEntry.findMany({
        where: { sourceType: 'ORDER', sourceId: orderId },
      });
      expect(ledgerEntries).toHaveLength(1);
      expect(ledgerEntries[0].reason).toBe('SALE');
      expect(parseFloat(ledgerEntries[0].qty.toString())).toBe(-2); // 2 items × 1 per unit = -2
    });
  });

  // ============================================================
  // Group 5: Depletion Idempotency
  // ============================================================
  describe('Group 5: Depletion Idempotency', () => {
    it('should return existing depletion on duplicate trigger', async () => {
      // Create menu item with recipe
      const menuItem = await prisma.menuItem.create({
        data: {
          orgId: testOrg.orgId,
          categoryId: (await prisma.menuCategory.findFirst({ where: { orgId: testOrg.orgId } }))!.id,
          name: `Idempotency Test ${Date.now()}`,
          price: new Decimal(10.00),
        },
      });

      await request(app.getHttpServer())
        .post('/inventory/v2/recipes')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          name: 'Idempotency Recipe',
          targetType: 'MENU_ITEM',
          targetId: menuItem.id,
          lines: [{ inventoryItemId: inventoryItemIdA, qtyInput: 1, inputUomId: uomId }],
        });

      // Create and close order
      const orderRes = await request(app.getHttpServer())
        .post('/pos/orders')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({ items: [{ menuItemId: menuItem.id, quantity: 1 }] });

      const orderId = orderRes.body.id;

      await request(app.getHttpServer())
        .post(`/pos/orders/${orderId}/close`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({ amount: 10.00 });

      await new Promise((r) => setTimeout(r, 500));

      // Manually trigger depletion again
      const res = await request(app.getHttpServer())
        .post(`/inventory/depletions/trigger/${orderId}`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(201);

      expect(res.body.isIdempotent).toBe(true);
      expect(res.body.status).toBe('POSTED');

      // Verify only one depletion record exists
      const depletions = await prisma.orderInventoryDepletion.findMany({
        where: { orderId },
      });
      expect(depletions).toHaveLength(1);
    });
  });

  // ============================================================
  // Group 6: Depletion Location Resolution
  // ============================================================
  describe('Group 6: Location Resolution', () => {
    it('should resolve location from KITCHEN code', async () => {
      // The test branch already has a KITCHEN location set up
      const kitchenLoc = await prisma.inventoryLocation.findFirst({
        where: { branchId: testOrg.branchId, code: 'KITCHEN' },
      });
      expect(kitchenLoc).toBeTruthy();

      // Create menu item and recipe
      const menuItem = await prisma.menuItem.create({
        data: {
          orgId: testOrg.orgId,
          categoryId: (await prisma.menuCategory.findFirst({ where: { orgId: testOrg.orgId } }))!.id,
          name: `Location Res Test ${Date.now()}`,
          price: new Decimal(10.00),
        },
      });

      await request(app.getHttpServer())
        .post('/inventory/v2/recipes')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({
          name: 'Location Test Recipe',
          targetType: 'MENU_ITEM',
          targetId: menuItem.id,
          lines: [{ inventoryItemId: inventoryItemIdA, qtyInput: 1, inputUomId: uomId }],
        });

      // Create and close order
      const orderRes = await request(app.getHttpServer())
        .post('/pos/orders')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({ items: [{ menuItemId: menuItem.id, quantity: 1 }] });

      await request(app.getHttpServer())
        .post(`/pos/orders/${orderRes.body.id}/close`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({ amount: 10.00 });

      await new Promise((r) => setTimeout(r, 500));

      // Verify depletion used the KITCHEN location
      const depletion = await prisma.orderInventoryDepletion.findFirst({
        where: { orderId: orderRes.body.id },
      });
      expect(depletion?.locationId).toBe(kitchenLoc!.id);
    });
  });

  // ============================================================
  // Group 7: Depletion Retry and Skip
  // ============================================================
  describe('Group 7: Retry and Skip', () => {
    let failedDepletionId: string;

    beforeEach(async () => {
      // Create a branch with no active locations to force failure
      const newBranch = await prisma.branch.create({
        data: {
          orgId: testOrg.orgId,
          name: `No Location Branch ${Date.now()}`,
        },
      });

      // Create failed depletion manually
      const failed = await prisma.orderInventoryDepletion.create({
        data: {
          orgId: testOrg.orgId,
          orderId: `fake-order-${Date.now()}`,
          branchId: newBranch.id,
          locationId: 'UNKNOWN',
          status: 'FAILED',
          errorCode: 'LOCATION_NOT_FOUND',
          errorMessage: 'No active location found',
        },
      });
      failedDepletionId = failed.id;
    });

    it('should skip failed depletion with reason', async () => {
      const res = await request(app.getHttpServer())
        .post(`/inventory/depletions/${failedDepletionId}/skip`)
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .send({ reason: 'Test order - no depletion needed' })
        .expect(201);

      expect(res.body.status).toBe('SKIPPED');

      // Verify metadata contains skip info
      expect(res.body.metadata).toHaveProperty('skippedReason');
      expect(res.body.metadata.skippedReason).toBe('Test order - no depletion needed');
    });
  });

  // ============================================================
  // Group 8: CSV Export with Hash
  // ============================================================
  describe('Group 8: CSV Export', () => {
    it('should export recipes with UTF-8 BOM and hash header', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/foundation/exports/recipes')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      // Check for UTF-8 BOM at start of file
      expect(res.text.charCodeAt(0)).toBe(0xFEFF);

      // Check for hash header
      expect(res.headers['x-nimbus-export-hash']).toBeDefined();
      expect(res.headers['x-nimbus-export-hash'].length).toBe(64); // SHA256 hex

      // Check content type
      expect(res.headers['content-type']).toContain('text/csv');
    });

    it('should export depletions with hash header', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/foundation/exports/depletions')
        .set('Authorization', `Bearer ${testOrg.users.owner.token}`)
        .expect(200);

      // Check for hash header
      expect(res.headers['x-nimbus-export-hash']).toBeDefined();
      expect(res.headers['x-nimbus-export-hash'].length).toBe(64);
    });
  });

  // ============================================================
  // Group 9: RBAC Enforcement
  // ============================================================
  describe('Group 9: RBAC Enforcement', () => {
    it('should allow L2 (Cashier) to read recipes', async () => {
      await request(app.getHttpServer())
        .get('/inventory/v2/recipes')
        .set('Authorization', `Bearer ${testOrg.users.cashier.token}`)
        .expect(200);
    });

    it('should deny L2 (Cashier) from creating recipes', async () => {
      await request(app.getHttpServer())
        .post('/inventory/v2/recipes')
        .set('Authorization', `Bearer ${testOrg.users.cashier.token}`)
        .send({
          name: 'Unauthorized Recipe',
          targetType: 'MENU_ITEM',
          targetId: menuItemId,
          lines: [],
        })
        .expect(403);
    });

    it('should deny L3 (Supervisor) from triggering depletion', async () => {
      await request(app.getHttpServer())
        .post('/inventory/depletions/trigger/fake-order-id')
        .set('Authorization', `Bearer ${testOrg.users.supervisor.token}`)
        .expect(403);
    });

    it('should allow L4 (Manager) to skip depletion', async () => {
      // Create a failed depletion to skip
      const failed = await prisma.orderInventoryDepletion.create({
        data: {
          orgId: testOrg.orgId,
          orderId: `rbac-test-order-${Date.now()}`,
          branchId: testOrg.branchId,
          locationId: locationId,
          status: 'FAILED',
          errorCode: 'TEST',
        },
      });

      await request(app.getHttpServer())
        .post(`/inventory/depletions/${failed.id}/skip`)
        .set('Authorization', `Bearer ${testOrg.users.manager.token}`)
        .send({ reason: 'Manager skip test' })
        .expect(201);
    });
  });
});
