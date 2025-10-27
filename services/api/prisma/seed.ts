import { prisma } from '@chefcloud/db';
import * as argon2 from 'argon2';

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
  });
}

async function main() {
  console.log('🌱 Starting database seed...');

  // Create Org
  const org = await prisma.org.upsert({
    where: { slug: 'demo-restaurant' },
    update: {},
    create: {
      name: 'Demo Restaurant',
      slug: 'demo-restaurant',
    },
  });
  console.log(`✅ Created org: ${org.name}`);

  // Create Org Settings
  await prisma.orgSettings.upsert({
    where: { orgId: org.id },
    update: {},
    create: {
      orgId: org.id,
      vatPercent: 18.0,
      currency: 'UGX',
    },
  });

  // Create Branch
  const branch = await prisma.branch.upsert({
    where: { id: 'main-branch' },
    update: {},
    create: {
      id: 'main-branch',
      orgId: org.id,
      name: 'Main Branch',
      address: 'Kampala, Uganda',
      timezone: 'Africa/Kampala',
    },
  });
  console.log(`✅ Created branch: ${branch.name}`);

  // Create Users
  const users = [
    {
      email: 'owner@demo.local',
      password: 'Owner#123',
      firstName: 'Alice',
      lastName: 'Owner',
      roleLevel: 'L5',
      employeeCode: null,
      pin: null,
      badgeId: null,
    },
    {
      email: 'manager@demo.local',
      password: 'Manager#123',
      firstName: 'Bob',
      lastName: 'Manager',
      roleLevel: 'L4',
      employeeCode: 'MGR001',
      pin: '1234',
      badgeId: null,
    },
    {
      email: 'supervisor@demo.local',
      password: 'Supervisor#123',
      firstName: 'Charlie',
      lastName: 'Supervisor',
      roleLevel: 'L2',
      employeeCode: 'SUP001',
      pin: null,
      badgeId: null,
    },
    {
      email: 'cashier@demo.local',
      password: 'Cashier#123',
      firstName: 'Diana',
      lastName: 'Cashier',
      roleLevel: 'L2',
      employeeCode: 'CASH001',
      pin: null,
      badgeId: 'CASHIER001',
    },
    {
      email: 'waiter@demo.local',
      password: 'Waiter#123',
      firstName: 'Eve',
      lastName: 'Waiter',
      roleLevel: 'L1',
      employeeCode: 'W001',
      pin: null,
      badgeId: null,
    },
  ];

  for (const userData of users) {
    const passwordHash = await hashPassword(userData.password);
    const pinHash = userData.pin ? await hashPassword(userData.pin) : null;

    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        passwordHash,
        pinHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
        roleLevel: userData.roleLevel as 'L1' | 'L2' | 'L3' | 'L4' | 'L5',
        orgId: org.id,
        branchId: branch.id,
      },
    });

    console.log(`✅ Created user: ${user.email} (${user.roleLevel})`);

    // Create employee profile if needed
    if (userData.employeeCode) {
      await prisma.employeeProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          employeeCode: userData.employeeCode,
          badgeId: userData.badgeId,
        },
      });
      console.log(`  └─ Employee code: ${userData.employeeCode}`);
      if (userData.badgeId) {
        console.log(`  └─ Badge ID: ${userData.badgeId}`);
      }
    }
  }

  // Create Device
  const deviceKey = `dk_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  const device = await prisma.device.upsert({
    where: { deviceKey },
    update: {},
    create: {
      name: 'Main Terminal',
      orgId: org.id,
      branchId: branch.id,
      deviceKey,
    },
  });

  console.log(`\n✅ Created device: ${device.name}`);
  console.log(`📱 Device Key: ${device.deviceKey}`);

  // Create TaxCategory
  const taxCategory = await prisma.taxCategory.upsert({
    where: { id: 'tax-18' },
    update: {},
    create: {
      id: 'tax-18',
      orgId: org.id,
      name: 'VAT 18%',
      rate: 18.0,
    },
  });
  console.log(`\n✅ Created tax category: ${taxCategory.name}`);

  // Create Menu Items
  const burger = await prisma.menuItem.create({
    data: {
      branchId: branch.id,
      name: 'Burger',
      itemType: 'FOOD',
      station: 'GRILL',
      price: 18000,
      taxCategoryId: taxCategory.id,
    },
  });
  console.log(`✅ Created menu item: ${burger.name} (${burger.id})`);

  const fries = await prisma.menuItem.create({
    data: {
      branchId: branch.id,
      name: 'Fries',
      itemType: 'FOOD',
      station: 'FRYER',
      price: 7000,
      taxCategoryId: taxCategory.id,
    },
  });
  console.log(`✅ Created menu item: ${fries.name} (${fries.id})`);

  const coke = await prisma.menuItem.create({
    data: {
      branchId: branch.id,
      name: 'Coke',
      itemType: 'DRINK',
      station: 'BAR',
      price: 4000,
      taxCategoryId: taxCategory.id,
    },
  });
  console.log(`✅ Created menu item: ${coke.name} (${coke.id})`);

  // Create Modifier Group
  const burgerOptions = await prisma.modifierGroup.create({
    data: {
      orgId: org.id,
      name: 'Burger Options',
      min: 0,
      max: 2,
      required: false,
      options: {
        create: [
          { name: 'Add Cheese', priceDelta: 2000 },
          { name: 'No Onions', priceDelta: 0 },
        ],
      },
    },
    include: { options: true },
  });
  console.log(`✅ Created modifier group: ${burgerOptions.name}`);
  burgerOptions.options.forEach((opt) => {
    console.log(`  └─ ${opt.name} (+${opt.priceDelta})`);
  });

  // Attach modifier group to burger
  await prisma.menuItemOnGroup.create({
    data: {
      itemId: burger.id,
      groupId: burgerOptions.id,
    },
  });
  console.log(`✅ Attached modifier group to Burger`);

  // Clean up old inventory data before seeding
  await prisma.recipeIngredient.deleteMany({});
  await prisma.wastage.deleteMany({});
  await prisma.stockBatch.deleteMany({});
  await prisma.goodsReceiptLine.deleteMany({});
  await prisma.goodsReceipt.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.inventoryItem.deleteMany({});
  await prisma.supplier.deleteMany({});

  // Create Supplier
  const supplier = await prisma.supplier.create({
    data: {
      orgId: org.id,
      name: 'City Foods',
      contact: 'John Supplier',
      email: 'john@cityfoods.local',
      phone: '+256700000000',
    },
  });
  console.log(`\n✅ Created supplier: ${supplier.name} (${supplier.id})`);

  // Create Inventory Items
  const bunItem = await prisma.inventoryItem.create({
    data: {
      orgId: org.id,
      sku: 'BUN-001',
      name: 'Burger Bun',
      unit: 'piece',
      category: 'bread',
      reorderLevel: 50,
      reorderQty: 100,
    },
  });
  console.log(`✅ Created inventory item: ${bunItem.name} (SKU: ${bunItem.sku})`);

  const pattyItem = await prisma.inventoryItem.create({
    data: {
      orgId: org.id,
      sku: 'PATTY-001',
      name: 'Beef Patty',
      unit: 'piece',
      category: 'meat',
      reorderLevel: 30,
      reorderQty: 80,
    },
  });
  console.log(`✅ Created inventory item: ${pattyItem.name} (SKU: ${pattyItem.sku})`);

  const potatoItem = await prisma.inventoryItem.create({
    data: {
      orgId: org.id,
      sku: 'POTATO-001',
      name: 'Potatoes',
      unit: 'kg',
      category: 'vegetable',
      reorderLevel: 20,
      reorderQty: 50,
    },
  });
  console.log(`✅ Created inventory item: ${potatoItem.name} (SKU: ${potatoItem.sku})`);

  const cheeseItem = await prisma.inventoryItem.create({
    data: {
      orgId: org.id,
      sku: 'CHEESE-001',
      name: 'Cheese Slice',
      unit: 'kg',
      category: 'dairy',
      reorderLevel: 5,
      reorderQty: 10,
    },
  });
  console.log(`✅ Created inventory item: ${cheeseItem.name} (SKU: ${cheeseItem.sku})`);

  const cokeBottle = await prisma.inventoryItem.create({
    data: {
      orgId: org.id,
      sku: 'COKE-001',
      name: 'Coke Bottle 500ml',
      unit: 'bottle',
      category: 'beverage',
      reorderLevel: 100,
      reorderQty: 200,
    },
  });
  console.log(`✅ Created inventory item: ${cokeBottle.name} (SKU: ${cokeBottle.sku})`);

  // Create Stock Batches
  await prisma.stockBatch.create({
    data: {
      orgId: org.id,
      branchId: branch.id,
      itemId: bunItem.id,
      receivedQty: 200,
      remainingQty: 200,
      unitCost: 500,
      receivedAt: new Date(),
    },
  });
  console.log(`✅ Created stock batch for ${bunItem.name} (200 pieces)`);

  await prisma.stockBatch.create({
    data: {
      orgId: org.id,
      branchId: branch.id,
      itemId: pattyItem.id,
      receivedQty: 150,
      remainingQty: 150,
      unitCost: 2000,
      receivedAt: new Date(),
    },
  });
  console.log(`✅ Created stock batch for ${pattyItem.name} (150 pieces)`);

  await prisma.stockBatch.create({
    data: {
      orgId: org.id,
      branchId: branch.id,
      itemId: potatoItem.id,
      receivedQty: 50,
      remainingQty: 50,
      unitCost: 3000,
      receivedAt: new Date(),
    },
  });
  console.log(`✅ Created stock batch for ${potatoItem.name} (50 kg)`);

  await prisma.stockBatch.create({
    data: {
      orgId: org.id,
      branchId: branch.id,
      itemId: cheeseItem.id,
      receivedQty: 10,
      remainingQty: 10,
      unitCost: 8000,
      receivedAt: new Date(),
    },
  });
  console.log(`✅ Created stock batch for ${cheeseItem.name} (10 kg)`);

  await prisma.stockBatch.create({
    data: {
      orgId: org.id,
      branchId: branch.id,
      itemId: cokeBottle.id,
      receivedQty: 300,
      remainingQty: 300,
      unitCost: 1500,
      receivedAt: new Date(),
    },
  });
  console.log(`✅ Created stock batch for ${cokeBottle.name} (300 bottles)`);

  // Create Recipes
  // Burger recipe: 1 bun + 1 patty
  await prisma.recipeIngredient.createMany({
    data: [
      {
        menuItemId: burger.id,
        itemId: bunItem.id,
        qtyPerUnit: 1,
        wastePct: 2,
      },
      {
        menuItemId: burger.id,
        itemId: pattyItem.id,
        qtyPerUnit: 1,
        wastePct: 5,
      },
      {
        // Add cheese only if "Add Cheese" modifier selected
        menuItemId: burger.id,
        itemId: cheeseItem.id,
        qtyPerUnit: 0.05, // 50g
        wastePct: 0,
        modifierOptionId: burgerOptions.options.find((o) => o.name === 'Add Cheese')?.id,
      },
    ],
  });
  console.log(`✅ Created recipe for ${burger.name} (1 bun, 1 patty, optional cheese)`);

  // Fries recipe: 0.2 kg potatoes
  await prisma.recipeIngredient.create({
    data: {
      menuItemId: fries.id,
      itemId: potatoItem.id,
      qtyPerUnit: 0.2,
      wastePct: 10,
    },
  });
  console.log(`✅ Created recipe for ${fries.name} (0.2 kg potatoes)`);

  // Coke recipe: 1 bottle
  await prisma.recipeIngredient.create({
    data: {
      menuItemId: coke.id,
      itemId: cokeBottle.id,
      qtyPerUnit: 1,
      wastePct: 0,
    },
  });
  console.log(`✅ Created recipe for ${coke.name} (1 bottle)`);

  // Create FloorPlan and Tables
  const floorPlan = await prisma.floorPlan.create({
    data: {
      orgId: org.id,
      name: 'Main',
      data: { layout: 'grid' },
    },
  });
  console.log(`\n✅ Created floor plan: ${floorPlan.name} (${floorPlan.id})`);

  for (let i = 1; i <= 4; i++) {
    const table = await prisma.table.upsert({
      where: {
        branchId_label: {
          branchId: branch.id,
          label: `Table ${i}`,
        },
      },
      update: {},
      create: {
        branchId: branch.id,
        orgId: org.id,
        floorPlanId: floorPlan.id,
        label: `Table ${i}`,
        capacity: 4,
        status: 'AVAILABLE',
      },
    });
    console.log(`  └─ ${table.label} (${table.id})`);
  }

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📝 Test Credentials:');
  console.log('Owner:      owner@demo.local / Owner#123');
  console.log('Manager:    manager@demo.local / Manager#123 (PIN: 1234, Code: MGR001)');
  console.log('Supervisor: supervisor@demo.local / Supervisor#123');
  console.log('Cashier:    cashier@demo.local / Cashier#123 (Badge: CASHIER001)');
  console.log('Waiter:     waiter@demo.local / Waiter#123 (Code: W001)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
