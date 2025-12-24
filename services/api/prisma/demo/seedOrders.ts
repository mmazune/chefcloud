/**
 * V2.1.1 Patch - Seed Open Orders for POS
 * 
 * Creates realistic open orders to make POS "alive" with:
 * - Tapas: 3-8 open orders created in last 24h
 * - Cafesserie: 2-5 open orders per branch in last 24h
 * - Deterministic and idempotent
 */

import { PrismaClient } from '@prisma/client';

interface OrderSeedConfig {
  orgId: string;
  branchId: string;
  userId: string; // waiter/cashier who created the order
  hoursAgo: number;
  items: Array<{ menuItemId: string; quantity: number; price: number }>;
  tableLabel?: string;
  status: 'NEW' | 'SENT' | 'SERVED';
}

const TAPAS_ORG_ID = '00000000-0000-4000-8000-000000000001';
const TAPAS_BRANCH_ID = '00000000-0000-4000-8000-000000000101';

const CAFESSERIE_ORG_ID = '00000000-0000-4000-8000-000000000002';
const CAFESSERIE_BRANCH_IDS = [
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000202',
  '00000000-0000-4000-8000-000000000203',
  '00000000-0000-4000-8000-000000000204',
];

/**
 * Seed open orders for Tapas
 */
async function seedTapasOpenOrders(prisma: PrismaClient): Promise<void> {
  console.log('  🍷 Seeding Tapas open orders...');

  // Get waiter user
  const waiter = await prisma.user.findFirst({
    where: { email: 'waiter@tapas.demo.local' },
  });

  if (!waiter) {
    console.log('    ⚠️  Waiter not found, skipping Tapas orders');
    return;
  }

  // Get some menu items for Tapas
  const menuItems = await prisma.menuItem.findMany({
    where: { branchId: TAPAS_BRANCH_ID },
    take: 10,
    select: { id: true, name: true, price: true },
  });

  if (menuItems.length === 0) {
    console.log('    ⚠️  No menu items found, skipping Tapas orders');
    return;
  }

  // Define 5 open orders for Tapas (deterministic)
  const tapasOrders: OrderSeedConfig[] = [
    {
      orgId: TAPAS_ORG_ID,
      branchId: TAPAS_BRANCH_ID,
      userId: waiter.id,
      hoursAgo: 2,
      tableLabel: 'Table 5',
      status: 'SENT',
      items: [
        { menuItemId: menuItems[0].id, quantity: 2, price: Number(menuItems[0].price) },
        { menuItemId: menuItems[1].id, quantity: 1, price: Number(menuItems[1].price) },
      ],
    },
    {
      orgId: TAPAS_ORG_ID,
      branchId: TAPAS_BRANCH_ID,
      userId: waiter.id,
      hoursAgo: 1.5,
      tableLabel: 'Table 8',
      status: 'SENT',
      items: [
        { menuItemId: menuItems[2].id, quantity: 3, price: Number(menuItems[2].price) },
      ],
    },
    {
      orgId: TAPAS_ORG_ID,
      branchId: TAPAS_BRANCH_ID,
      userId: waiter.id,
      hoursAgo: 0.5,
      tableLabel: 'Table 12',
      status: 'NEW',
      items: [
        { menuItemId: menuItems[3].id, quantity: 1, price: Number(menuItems[3].price) },
        { menuItemId: menuItems[4].id, quantity: 2, price: Number(menuItems[4].price) },
      ],
    },
    {
      orgId: TAPAS_ORG_ID,
      branchId: TAPAS_BRANCH_ID,
      userId: waiter.id,
      hoursAgo: 0.25,
      tableLabel: 'Table 3',
      status: 'NEW',
      items: [
        { menuItemId: menuItems[5].id, quantity: 1, price: Number(menuItems[5].price) },
      ],
    },
    {
      orgId: TAPAS_ORG_ID,
      branchId: TAPAS_BRANCH_ID,
      userId: waiter.id,
      hoursAgo: 3,
      tableLabel: 'Bar 2',
      status: 'SERVED',
      items: [
        { menuItemId: menuItems[6].id, quantity: 4, price: Number(menuItems[6].price) },
        { menuItemId: menuItems[7].id, quantity: 2, price: Number(menuItems[7].price) },
      ],
    },
  ];

  for (const orderConfig of tapasOrders) {
    await createOpenOrder(prisma, orderConfig);
  }

  console.log(`    ✅ Created ${tapasOrders.length} open orders for Tapas`);
}

/**
 * Seed open orders for Cafesserie (multi-branch)
 */
async function seedCafesserieOpenOrders(prisma: PrismaClient): Promise<void> {
  console.log('  ☕ Seeding Cafesserie open orders...');

  // Get waiter user
  const waiter = await prisma.user.findFirst({
    where: { email: 'waiter@cafesserie.demo.local' },
  });

  if (!waiter) {
    console.log('    ⚠️  Waiter not found, skipping Cafesserie orders');
    return;
  }

  let totalOrders = 0;

  // Create 2-3 orders per branch
  for (const branchId of CAFESSERIE_BRANCH_IDS) {
    const menuItems = await prisma.menuItem.findMany({
      where: { branchId },
      take: 6,
      select: { id: true, name: true, price: true },
    });

    if (menuItems.length === 0) {
      console.log(`    ⚠️  No menu items found for branch ${branchId}, skipping`);
      continue;
    }

    const branchOrders: OrderSeedConfig[] = [
      {
        orgId: CAFESSERIE_ORG_ID,
        branchId,
        userId: waiter.id,
        hoursAgo: 1,
        tableLabel: 'Table 2',
        status: 'SENT',
        items: [
          { menuItemId: menuItems[0].id, quantity: 2, price: Number(menuItems[0].price) },
          { menuItemId: menuItems[1].id, quantity: 1, price: Number(menuItems[1].price) },
        ],
      },
      {
        orgId: CAFESSERIE_ORG_ID,
        branchId,
        userId: waiter.id,
        hoursAgo: 0.5,
        tableLabel: 'Table 5',
        status: 'NEW',
        items: [
          { menuItemId: menuItems[2].id, quantity: 1, price: Number(menuItems[2].price) },
        ],
      },
    ];

    for (const orderConfig of branchOrders) {
      await createOpenOrder(prisma, orderConfig);
      totalOrders++;
    }
  }

  console.log(`    ✅ Created ${totalOrders} open orders for Cafesserie`);
}

/**
 * Helper to create a single open order
 */
async function createOpenOrder(
  prisma: PrismaClient,
  config: OrderSeedConfig
): Promise<void> {
  const createdAt = new Date();
  createdAt.setHours(createdAt.getHours() - config.hoursAgo);

  // Calculate totals
  const subtotal = config.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const tax = Math.round(subtotal * 0.18); // 18% VAT
  const total = subtotal + tax;

  // Generate order number
  const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Create order
  const order = await prisma.order.create({
    data: {
      branchId: config.branchId,
      userId: config.userId,
      orderNumber,
      status: config.status,
      serviceType: 'DINE_IN',
      subtotal: String(subtotal),
      tax: String(tax),
      total: String(total),
      createdAt,
      updatedAt: createdAt,
      metadata: config.tableLabel ? { tableLabel: config.tableLabel } : {},
    },
  });

  // Create order items
  for (const item of config.items) {
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: String(item.price), // Unit price
        subtotal: String(item.price * item.quantity),
      },
    });
  }
}

/**
 * Main function to seed all open orders
 */
export async function seedOpenOrders(prisma: PrismaClient): Promise<void> {
  console.log('\n🍽️  Seeding Open Orders for POS...');

  // Delete existing open orders first (idempotent)
  await prisma.orderItem.deleteMany({
    where: {
      order: {
        status: { in: ['NEW', 'SENT', 'SERVED'] },
      },
    },
  });

  await prisma.order.deleteMany({
    where: {
      status: { in: ['NEW', 'SENT', 'SERVED'] },
    },
  });

  await seedTapasOpenOrders(prisma);
  await seedCafesserieOpenOrders(prisma);

  console.log('✅ Open orders seeded successfully!\n');
}
