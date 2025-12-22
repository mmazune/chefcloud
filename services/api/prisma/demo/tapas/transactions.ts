/**
 * Tapas Bar & Restaurant Transaction Seeding
 * 
 * Seeds 90 days of realistic orders and payments for Tapas.
 * Pattern: Bar/restaurant with peaks on Fri/Sat nights, lunch/dinner waves.
 */

import { PrismaClient } from '@prisma/client';
import { BRANCH_TAPAS_MAIN_ID, ORG_TAPAS_ID, TAPAS_DEMO_USERS } from '../constants';
import { createSeededRandom } from '../generate/seededRng';
import { dateRangeLastNDays, dailyOrderCount } from '../generate/timeSeries';
import { generateDailyOrders, insertOrders, MenuItem } from '../generate/orders';

/**
 * Payment method weights for Tapas (bar/restaurant):
 * Cash 45%, Card 25%, Mobile Money 30%
 */
const TAPAS_PAYMENT_WEIGHTS = {
  CASH: 45,
  CARD: 25,
  MOMO: 30,
};

/**
 * Base daily order count for weekdays
 */
const TAPAS_BASE_DAILY_ORDERS = 45;

/**
 * Top seller menu item names (used for weighted selection)
 * Based on typical bar/restaurant favorites
 */
const TAPAS_TOP_SELLERS = [
  'Tapas Classic Beef Burger',
  'Happy Chicken Burger',
  'Pork Ribs',
  'Beef Ribs',
  'NY Strip Steak',
  'English Breakfast',
  'Margarita Flatbread',
  'Buffalo Wings',
  'Bell Lager',
  'Tusker Lager',
  'Nile Special',
  'Club Pilsner',
  'Mojito',
  'Passion Fruit Juice',
  'Coca Cola',
  'Fries',
];

/**
 * Seed Tapas transactions for the last 90 days
 */
export async function seedTapasTransactions(prisma: PrismaClient): Promise<void> {
  console.log('  🍽️  Seeding Tapas transactions (90 days)...');

  // Get Tapas branch
  const branch = await prisma.branch.findUnique({
    where: { id: BRANCH_TAPAS_MAIN_ID },
  });

  if (!branch) {
    console.error('    ❌ Tapas branch not found');
    return;
  }

  // Get menu items for this branch
  const menuItems = await prisma.menuItem.findMany({
    where: { branchId: BRANCH_TAPAS_MAIN_ID },
    select: {
      id: true,
      name: true,
      price: true,
      category: {
        select: {
          name: true,
        },
      },
    },
  });

  if (menuItems.length === 0) {
    console.error('    ❌ No menu items found for Tapas');
    return;
  }

  console.log(`    ℹ️  Found ${menuItems.length} menu items`);

  // Transform to MenuItem format
  const items: MenuItem[] = menuItems.map(item => ({
    id: item.id,
    name: item.name,
    price: Number(item.price),
    category: item.category?.name,
  }));

  // Get top seller IDs
  const topSellerIds = items
    .filter(item => TAPAS_TOP_SELLERS.includes(item.name))
    .map(item => item.id);

  console.log(`    ℹ️  Identified ${topSellerIds.length} top sellers`);

  // Get a waiter user for orders
  const waiter = await prisma.user.findFirst({
    where: {
      orgId: ORG_TAPAS_ID,
      roleLevel: 'L1',
    },
  });

  if (!waiter) {
    console.error('    ❌ No waiter user found for Tapas');
    return;
  }

  // Generate date range (last 90 days)
  const dates = dateRangeLastNDays(90);

  // Create RNG for Tapas transactions
  const rng = createSeededRandom('tapas-transactions');

  let totalOrders = 0;
  let totalItems = 0;
  let totalPayments = 0;
  let totalRefunds = 0;

  // Generate orders for each day
  for (const date of dates) {
    const orderCount = dailyOrderCount(TAPAS_BASE_DAILY_ORDERS, date, rng, 'restaurant');
    
    const orders = generateDailyOrders(
      BRANCH_TAPAS_MAIN_ID,
      waiter.id,
      date,
      orderCount,
      rng,
      'restaurant',
      items,
      TAPAS_PAYMENT_WEIGHTS,
      topSellerIds,
    );

    // Insert orders into database
    const stats = await insertOrders(prisma, orders, BRANCH_TAPAS_MAIN_ID, waiter.id);
    
    totalOrders += stats.orderCount;
    totalItems += stats.itemCount;
    totalPayments += stats.paymentCount;
    totalRefunds += stats.refundCount;
  }

  console.log(`    ✅ Created ${totalOrders} orders`);
  console.log(`    ✅ Created ${totalItems} order items`);
  console.log(`    ✅ Created ${totalPayments} payments`);
  console.log(`    ✅ Created ${totalRefunds} refunds`);
}
