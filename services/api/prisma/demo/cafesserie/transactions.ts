/**
 * Cafesserie Transaction Seeding
 * 
 * Seeds 180 days of realistic orders and payments for Cafesserie (4 branches).
 * Pattern: Cafe chain with morning/lunch peaks, steady weekdays.
 */

import { PrismaClient } from '@prisma/client';
import {
  BRANCH_CAFE_VILLAGE_MALL_ID,
  BRANCH_CAFE_ACACIA_MALL_ID,
  BRANCH_CAFE_ARENA_MALL_ID,
  BRANCH_CAFE_MOMBASA_ID,
  ORG_CAFESSERIE_ID,
  CAFESSERIE_BRANCHES,
} from '../constants';
import { createSeededRandom } from '../generate/seededRng';
import { dateRangeLastNDays, dailyOrderCount } from '../generate/timeSeries';
import { generateDailyOrders, insertOrders, MenuItem } from '../generate/orders';

/**
 * Payment method weights for Cafesserie (cafe chain):
 * Cash 35%, Card 20%, Mobile Money 45%
 */
const CAFE_PAYMENT_WEIGHTS = {
  CASH: 35,
  CARD: 20,
  MOMO: 45,
};

/**
 * Base daily order count for weekdays (per branch)
 */
const CAFE_BASE_DAILY_ORDERS = 60;

/**
 * Top seller menu item names for cafes
 */
const CAFE_TOP_SELLERS = [
  'Cappuccino',
  'Latte',
  'Americano',
  'Espresso',
  'Flat White',
  'Croissant',
  'Chocolate Muffin',
  'Blueberry Muffin',
  'Cinnamon Roll',
  'Avocado Toast',
  'Club Sandwich',
  'Caesar Salad',
  'Chicken Wrap',
  'Fresh Orange Juice',
  'Bottled Water',
];

/**
 * Seed Cafesserie transactions for the last 180 days across 4 branches
 */
export async function seedCafesserieTransactions(prisma: PrismaClient): Promise<void> {
  console.log('  ☕ Seeding Cafesserie transactions (180 days, 4 branches)...');

  const branchIds = [
    BRANCH_CAFE_VILLAGE_MALL_ID,
    BRANCH_CAFE_ACACIA_MALL_ID,
    BRANCH_CAFE_ARENA_MALL_ID,
    BRANCH_CAFE_MOMBASA_ID,
  ];

  // Get a waiter/cashier user for orders
  const cashier = await prisma.user.findFirst({
    where: {
      orgId: ORG_CAFESSERIE_ID,
      roleLevel: 'L2',
    },
  });

  if (!cashier) {
    console.error('    ❌ No cashier user found for Cafesserie');
    return;
  }

  // Generate date range (last 180 days)
  const dates = dateRangeLastNDays(180);

  let grandTotalOrders = 0;
  let grandTotalItems = 0;
  let grandTotalPayments = 0;
  let grandTotalRefunds = 0;

  // Process each branch
  for (let branchIndex = 0; branchIndex < branchIds.length; branchIndex++) {
    const branchId = branchIds[branchIndex];
    const branchName = CAFESSERIE_BRANCHES[branchIndex].name;

    console.log(`\n    📍 Branch: ${branchName}`);

    // Get menu items for this branch
    const menuItems = await prisma.menuItem.findMany({
      where: { branchId },
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
      console.warn(`      ⚠️  No menu items found for branch ${branchName}`);
      continue;
    }

    console.log(`      ℹ️  Found ${menuItems.length} menu items`);

    // Transform to MenuItem format
    const items: MenuItem[] = menuItems.map(item => ({
      id: item.id,
      name: item.name,
      price: Number(item.price),
      category: item.category?.name,
    }));

    // Get top seller IDs for this branch
    const topSellerIds = items
      .filter(item => CAFE_TOP_SELLERS.includes(item.name))
      .map(item => item.id);

    console.log(`      ℹ️  Identified ${topSellerIds.length} top sellers`);

    // Create RNG specific to this branch for deterministic but varied results
    const rng = createSeededRandom(`cafesserie-transactions-${branchIndex}`);

    let branchTotalOrders = 0;
    let branchTotalItems = 0;
    let branchTotalPayments = 0;
    let branchTotalRefunds = 0;

    // Generate orders for each day
    for (const date of dates) {
      const orderCount = dailyOrderCount(CAFE_BASE_DAILY_ORDERS, date, rng, 'cafe');
      
      const orders = generateDailyOrders(
        branchId,
        cashier.id,
        date,
        orderCount,
        rng,
        'cafe',
        items,
        CAFE_PAYMENT_WEIGHTS,
        topSellerIds,
      );

      // Insert orders into database
      const stats = await insertOrders(prisma, orders, branchId, cashier.id);
      
      branchTotalOrders += stats.orderCount;
      branchTotalItems += stats.itemCount;
      branchTotalPayments += stats.paymentCount;
      branchTotalRefunds += stats.refundCount;
    }

    console.log(`      ✅ Created ${branchTotalOrders} orders`);
    console.log(`      ✅ Created ${branchTotalItems} order items`);
    console.log(`      ✅ Created ${branchTotalPayments} payments`);
    console.log(`      ✅ Created ${branchTotalRefunds} refunds`);

    grandTotalOrders += branchTotalOrders;
    grandTotalItems += branchTotalItems;
    grandTotalPayments += branchTotalPayments;
    grandTotalRefunds += branchTotalRefunds;
  }

  console.log(`\n    🎯 GRAND TOTALS (all 4 branches):`);
  console.log(`       Orders: ${grandTotalOrders}`);
  console.log(`       Items: ${grandTotalItems}`);
  console.log(`       Payments: ${grandTotalPayments}`);
  console.log(`       Refunds: ${grandTotalRefunds}`);
}
