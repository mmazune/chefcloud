import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

/**
 * E2E Test for E27-s1: Costing & Profit Engine
 *
 * Tests the complete flow:
 * 1. Create order with items (burger + cheese modifier, fries)
 * 2. Close order to trigger costing calculation
 * 3. Verify cost/margin data appears in analytics endpoint
 * 4. Verify RBAC visibility (L4+ sees cost data, L3 doesn't unless showCostToChef=true)
 */
describe('E27 - Costing & Profit Engine (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let managerToken: string;
  let chefToken: string;
  let branchId: string;
  let orgId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    // Cleanup
    await prisma.client.orderItem.deleteMany({ where: { order: { branchId } } });
    await prisma.client.payment.deleteMany({ where: { order: { branchId } } });
    await prisma.client.order.deleteMany({ where: { branchId } });
    await prisma.client.stockBatch.deleteMany({ where: { branch: { orgId } } });
    await prisma.client.recipeIngredient.deleteMany({});
    await prisma.client.menuItem.deleteMany({ where: { branch: { orgId } } });
    await prisma.client.inventoryItem.deleteMany({ where: { org: { id: orgId } } });
    await prisma.client.branch.deleteMany({ where: { orgId } });
    await prisma.client.user.deleteMany({ where: { orgId } });
    await prisma.client.orgSettings.deleteMany({ where: { orgId } });
    await prisma.client.org.deleteMany({ where: { id: orgId } });

    await app.close();
  });

  async function setupTestData() {
    // Create org
    const org = await prisma.client.org.create({
      data: {
        name: 'E27 Test Org',
        subdomain: 'e27-test',
        isSandbox: true,
      },
    });
    orgId = org.id;

    // Create org settings with showCostToChef=false (default)
    await prisma.client.orgSettings.create({
      data: {
        orgId,
        showCostToChef: false,
      },
    });

    // Create branch
    const branch = await prisma.client.branch.create({
      data: {
        name: 'Test Branch',
        orgId,
        isActive: true,
      },
    });
    branchId = branch.id;

    // Create manager user (L4)
    const manager = await prisma.client.user.create({
      data: {
        email: 'manager-e27@test.com',
        firstName: 'Manager',
        lastName: 'User',
        orgId,
        branchId,
        roleLevel: 'L4',
        role: 'MANAGER',
        passwordHash: 'dummy',
      },
    });

    // Create chef user (L3)
    const chef = await prisma.client.user.create({
      data: {
        email: 'chef-e27@test.com',
        firstName: 'Chef',
        lastName: 'User',
        orgId,
        branchId,
        roleLevel: 'L3',
        role: 'CHEF',
        passwordHash: 'dummy',
      },
    });

    // Generate tokens (simplified - in real app would use auth service)
    managerToken = `Bearer mock-token-manager-${manager.id}`;
    chefToken = `Bearer mock-token-chef-${chef.id}`;

    // Create inventory items
    const beefPatty = await prisma.client.inventoryItem.create({
      data: {
        name: 'Beef Patty',
        orgId,
        sku: 'BEEF-001',
        unit: 'pc',
      },
    });

    const cheese = await prisma.client.inventoryItem.create({
      data: {
        name: 'Cheese Slice',
        orgId,
        sku: 'CHEESE-001',
        unit: 'pc',
      },
    });

    const potato = await prisma.client.inventoryItem.create({
      data: {
        name: 'Potato',
        orgId,
        sku: 'POTATO-001',
        unit: 'kg',
      },
    });

    // Create stock batches with costs
    await prisma.client.stockBatch.create({
      data: {
        branchId,
        inventoryItemId: beefPatty.id,
        batchNumber: 'B001',
        initialQty: 100,
        remainingQty: 100,
        unitCost: 150, // UGX 150 per patty
        receivedAt: new Date('2025-10-01'),
      },
    });

    await prisma.client.stockBatch.create({
      data: {
        branchId,
        inventoryItemId: cheese.id,
        batchNumber: 'C001',
        initialQty: 200,
        remainingQty: 200,
        unitCost: 50, // UGX 50 per slice
        receivedAt: new Date('2025-10-01'),
      },
    });

    await prisma.client.stockBatch.create({
      data: {
        branchId,
        inventoryItemId: potato.id,
        batchNumber: 'P001',
        initialQty: 50,
        remainingQty: 50,
        unitCost: 2000, // UGX 2,000 per kg
        receivedAt: new Date('2025-10-01'),
      },
    });

    // Create menu items
    const burger = await prisma.client.menuItem.create({
      data: {
        name: 'Burger',
        branchId,
        price: 5000, // UGX 5,000
        isAvailable: true,
      },
    });

    const cheeseModifier = await prisma.client.menuItem.create({
      data: {
        name: 'Add Cheese',
        branchId,
        price: 1000, // UGX 1,000
        isAvailable: true,
      },
    });

    const fries = await prisma.client.menuItem.create({
      data: {
        name: 'French Fries',
        branchId,
        price: 3000, // UGX 3,000
        isAvailable: true,
      },
    });

    // Create recipes
    await prisma.client.recipeIngredient.create({
      data: {
        menuItemId: burger.id,
        itemId: beefPatty.id,
        quantity: 1, // 1 patty per burger
        isModifier: false,
      },
    });

    await prisma.client.recipeIngredient.create({
      data: {
        menuItemId: cheeseModifier.id,
        itemId: cheese.id,
        quantity: 1, // 1 slice per cheese modifier
        isModifier: true,
      },
    });

    await prisma.client.recipeIngredient.create({
      data: {
        menuItemId: fries.id,
        itemId: potato.id,
        quantity: 0.15, // 150g = 0.15 kg per serving
        isModifier: false,
      },
    });
  }

  describe('Costing calculation on order close', () => {
    it('should calculate cost and margin when closing an order', async () => {
      // Step 1: Create order with burger + cheese modifier and fries
      const orderResponse = await request(app.getHttpServer())
        .post('/pos/orders')
        .send({
          branchId,
          tableNumber: 'T1',
          items: [
            {
              menuItemId: await getMenuItemId('Burger'),
              quantity: 2,
              modifiers: [
                {
                  menuItemId: await getMenuItemId('Add Cheese'),
                  quantity: 1,
                },
              ],
            },
            {
              menuItemId: await getMenuItemId('French Fries'),
              quantity: 1,
              modifiers: [],
            },
          ],
        })
        .expect(201);

      const orderId = orderResponse.body.id;

      // Step 2: Close the order (triggers costing calculation)
      await request(app.getHttpServer())
        .post(`/pos/orders/${orderId}/close`)
        .send({
          paymentMethod: 'CASH',
          amountTendered: 20000,
        })
        .expect(200);

      // Step 3: Verify OrderItem has cost/margin data
      const orderItems = await prisma.client.orderItem.findMany({
        where: { orderId },
      });

      // Burger with cheese modifier
      const burgerItem = orderItems.find(
        (item) => item.metadata && (item.metadata as any).modifiers?.length > 0,
      );
      expect(burgerItem).toBeDefined();
      expect(burgerItem!.quantity).toBe(2);
      expect(burgerItem!.costUnit).not.toBeNull();
      expect(burgerItem!.costTotal).not.toBeNull();
      expect(burgerItem!.marginTotal).not.toBeNull();
      expect(burgerItem!.marginPct).not.toBeNull();

      // Cost per burger with cheese: 150 (beef) + 50 (cheese) = 200
      expect(Number(burgerItem!.costUnit)).toBe(200);
      expect(Number(burgerItem!.costTotal)).toBe(400); // 200 * 2

      // Fries
      const friesItem = orderItems.find(
        (item) => !item.metadata || (item.metadata as any).modifiers?.length === 0,
      );
      expect(friesItem).toBeDefined();
      expect(friesItem!.quantity).toBe(1);
      expect(Number(friesItem!.costUnit)).toBe(300); // 2000 * 0.15
      expect(Number(friesItem!.costTotal)).toBe(300);
    });
  });

  describe('Analytics RBAC - Cost data visibility', () => {
    it('should include cost data for MANAGER (L4) role', async () => {
      // Mock JWT authentication - in real scenario, would use proper auth
      // For now, we'll directly test the analytics endpoint assuming auth works

      const response = await request(app.getHttpServer())
        .get('/analytics/top-items?limit=10')
        .set('Authorization', managerToken)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // Should have cost/margin fields
      const topItem = response.body[0];
      if (topItem) {
        expect(topItem).toHaveProperty('totalCost');
        expect(topItem).toHaveProperty('totalMargin');
        expect(topItem).toHaveProperty('marginPct');
      }
    });

    it('should exclude cost data for CHEF (L3) when showCostToChef=false', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/top-items?limit=10')
        .set('Authorization', chefToken)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // Should NOT have cost/margin fields
      const topItem = response.body[0];
      if (topItem) {
        expect(topItem).not.toHaveProperty('totalCost');
        expect(topItem).not.toHaveProperty('totalMargin');
        expect(topItem).not.toHaveProperty('marginPct');
      }
    });

    it('should include cost data for CHEF (L3) when showCostToChef=true', async () => {
      // Update org settings
      await prisma.client.orgSettings.update({
        where: { orgId },
        data: { showCostToChef: true },
      });

      const response = await request(app.getHttpServer())
        .get('/analytics/top-items?limit=10')
        .set('Authorization', chefToken)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // Should NOW have cost/margin fields
      const topItem = response.body[0];
      if (topItem) {
        expect(topItem).toHaveProperty('totalCost');
        expect(topItem).toHaveProperty('totalMargin');
        expect(topItem).toHaveProperty('marginPct');
      }

      // Reset for other tests
      await prisma.client.orgSettings.update({
        where: { orgId },
        data: { showCostToChef: false },
      });
    });
  });

  // Helper function
  async function getMenuItemId(name: string): Promise<string> {
    const item = await prisma.client.menuItem.findFirst({
      where: { name, branchId },
    });
    return item!.id;
  }
});
