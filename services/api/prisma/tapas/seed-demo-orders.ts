import { prisma } from '@chefcloud/db';
import { Decimal } from '@prisma/client/runtime/library';

// Demo org and branch IDs (Demo Restaurant - the org that owner@demo.local belongs to)
const DEMO_ORG_ID = 'cmjh5gyt2000012arpwsjwttf';
const MAIN_BRANCH_ID = 'main-branch';

// Get a random element from array
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Get random number between min and max
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate random decimal for money amounts
function randomMoney(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

async function seedOrders() {
  console.log('🧾 Seeding orders for Demo Restaurant...');

  // Get users for attribution
  const users = await prisma.user.findMany({
    where: { orgId: DEMO_ORG_ID },
    select: { id: true, firstName: true },
    take: 10,
  });

  if (users.length === 0) {
    console.log('  ⚠️ No users found for Demo Restaurant org');
    return;
  }

  // Check for tables - create one if none exist
  let table = await prisma.table.findFirst({
    where: { branchId: MAIN_BRANCH_ID },
  });

  if (!table) {
    table = await prisma.table.create({
      data: {
        branchId: MAIN_BRANCH_ID,
        number: 1,
        name: 'Table 1',
        capacity: 4,
        zone: 'Main Floor',
        status: 'AVAILABLE',
      },
    });
    console.log('  ✅ Created table: Table 1');
  }

  const orders: any[] = [];
  const now = new Date();

  // Generate orders for the last 30 days
  for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
    // 15-40 orders per day
    const ordersPerDay = randomBetween(15, 40);

    for (let i = 0; i < ordersPerDay; i++) {
      const orderDate = new Date(now);
      orderDate.setDate(orderDate.getDate() - daysAgo);
      orderDate.setHours(randomBetween(10, 22), randomBetween(0, 59), randomBetween(0, 59));

      const user = randomChoice(users);
      const subtotal = randomMoney(35000, 250000);
      const tax = subtotal * 0.18;
      const discount = Math.random() > 0.8 ? randomMoney(5000, 30000) : 0;
      const total = subtotal + tax - discount;

      orders.push({
        branchId: MAIN_BRANCH_ID,
        tableId: table.id,
        userId: user.id,
        orderNumber: `ORD-${daysAgo.toString().padStart(2, '0')}-${i.toString().padStart(3, '0')}`,
        status: 'CLOSED',
        serviceType: randomChoice(['DINE_IN', 'DINE_IN', 'DINE_IN', 'TAKEAWAY']),
        subtotal: new Decimal(subtotal),
        tax: new Decimal(tax),
        discount: new Decimal(discount),
        total: new Decimal(total),
        createdAt: orderDate,
        updatedAt: orderDate,
      });
    }
  }

  // Delete existing orders for this branch
  await prisma.order.deleteMany({
    where: { branchId: MAIN_BRANCH_ID },
  });

  // Insert new orders
  for (const order of orders) {
    await prisma.order.create({
      data: order,
    });
  }

  console.log(`  ✅ Created ${orders.length} orders`);
}

async function seedPayments() {
  console.log('💳 Seeding payments for orders...');

  // Get orders
  const orders = await prisma.order.findMany({
    where: { branchId: MAIN_BRANCH_ID },
    select: { id: true, total: true, createdAt: true },
  });

  const paymentMethods = ['CASH', 'CASH', 'CARD', 'MOMO', 'MOMO'];

  // Delete existing payments for this branch
  await prisma.payment.deleteMany({
    where: { order: { branchId: MAIN_BRANCH_ID } },
  });

  // Create payment for each order
  for (const order of orders) {
    await prisma.payment.create({
      data: {
        orderId: order.id,
        amount: order.total,
        method: randomChoice(paymentMethods),
        status: 'COMPLETED',
        createdAt: order.createdAt,
      },
    });
  }

  console.log(`  ✅ Created ${orders.length} payments`);
}

async function main() {
  console.log('🚀 Starting order data seed for Demo Restaurant...\n');

  try {
    await seedOrders();
    await seedPayments();

    console.log('\n✅ All order data seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
