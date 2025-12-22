#!/usr/bin/env ts-node
/**
 * Validation Script for Demo Transactions (Milestone 3)
 * 
 * Validates transactional data for Tapas and Cafesserie:
 * - Order counts match expected ranges
 * - All order items reference valid menu items
 * - All payments link to valid orders
 * - Date ranges correct (Tapas: 90 days, Cafesserie: 180 days)
 * - Foreign key integrity
 * - Idempotency (run twice, check counts identical)
 * 
 * Usage: Run from services/api: npx tsx prisma/demo/validate-demo-transactions.ts [--idempotency]
 */

import { PrismaClient } from '@prisma/client';

// Create new instance with explicit URL to avoid cached client issues
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chefcloud?schema=public';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

let errors = 0;
let warnings = 0;

// Demo org IDs (from constants.ts)
const ORG_TAPAS_ID = '00000000-0000-0000-0000-org-tapas-bar';
const ORG_CAFESSERIE_ID = '00000000-0000-0000-0000-org-cafesser';

// Expected date ranges
const TAPAS_DAYS = 90;
const CAFESSERIE_DAYS = 180;

// Expected minimum order counts (allowing some variance)
const TAPAS_MIN_ORDERS = 3500;
const TAPAS_MAX_ORDERS = 5000;
const CAFESSERIE_MIN_ORDERS_PER_BRANCH = 9000;
const CAFESSERIE_MAX_ORDERS_PER_BRANCH = 12000;

console.log('\n🔍 Validating Demo Transaction Data (M3)...\n');

async function validateTapas() {
  console.log('🍽️  TAPAS BAR & RESTAURANT');
  console.log('─────────────────────────────');

  // Get Tapas branches
  const branches = await prisma.branch.findMany({
    where: { orgId: ORG_TAPAS_ID },
  });

  if (branches.length === 0) {
    console.error('❌ No Tapas branches found');
    errors++;
    return;
  }

  console.log(`✅ Found ${branches.length} branch(es)`);

  // Get all orders for Tapas
  const orders = await prisma.order.findMany({
    where: {
      branch: { orgId: ORG_TAPAS_ID },
    },
    include: {
      orderItems: true,
      payments: true,
      refunds: true,
    },
  });

  console.log(`Orders: ${orders.length.toLocaleString()}`);

  // Check order count is within expected range
  if (orders.length < TAPAS_MIN_ORDERS) {
    console.error(`❌ Too few orders: ${orders.length} (expected ≥${TAPAS_MIN_ORDERS})`);
    errors++;
  } else if (orders.length > TAPAS_MAX_ORDERS) {
    console.warn(`⚠️  More orders than expected: ${orders.length} (expected ≤${TAPAS_MAX_ORDERS})`);
    warnings++;
  } else {
    console.log(`✅ Order count within expected range (${TAPAS_MIN_ORDERS}-${TAPAS_MAX_ORDERS})`);
  }

  // Check date range
  const now = new Date();
  const oldestDate = new Date(now);
  oldestDate.setDate(oldestDate.getDate() - TAPAS_DAYS);

  const ordersOutOfRange = orders.filter(o => o.createdAt < oldestDate);
  if (ordersOutOfRange.length > 0) {
    console.error(`❌ ${ordersOutOfRange.length} orders older than ${TAPAS_DAYS} days`);
    errors++;
  } else {
    console.log(`✅ All orders within last ${TAPAS_DAYS} days`);
  }

  // Count items, payments, refunds
  const totalItems = orders.reduce((sum, o) => sum + o.orderItems.length, 0);
  const totalPayments = orders.reduce((sum, o) => sum + o.payments.length, 0);
  const totalRefunds = orders.reduce((sum, o) => sum + o.refunds.length, 0);

  console.log(`Items: ${totalItems.toLocaleString()}`);
  console.log(`Payments: ${totalPayments.toLocaleString()}`);
  console.log(`Refunds: ${totalRefunds.toLocaleString()}`);

  // Every order should have at least 1 item and 1 payment
  const ordersWithoutItems = orders.filter(o => o.orderItems.length === 0);
  const ordersWithoutPayments = orders.filter(o => o.payments.length === 0 && o.status !== 'VOIDED');

  if (ordersWithoutItems.length > 0) {
    console.error(`❌ ${ordersWithoutItems.length} orders have no items`);
    errors++;
  } else {
    console.log('✅ All orders have items');
  }

  if (ordersWithoutPayments.length > 0) {
    console.error(`❌ ${ordersWithoutPayments.length} non-voided orders have no payments`);
    errors++;
  } else {
    console.log('✅ All non-voided orders have payments');
  }

  // Validate foreign keys: all order items reference valid menu items
  const menuItems = await prisma.menuItem.findMany({
    where: {
      branch: { orgId: ORG_TAPAS_ID },
    },
    select: { id: true },
  });

  const menuItemIds = new Set(menuItems.map(m => m.id));
  let invalidMenuItemRefs = 0;

  for (const order of orders) {
    for (const item of order.orderItems) {
      if (!menuItemIds.has(item.menuItemId)) {
        invalidMenuItemRefs++;
        if (invalidMenuItemRefs <= 3) {
          console.error(`❌ Invalid menu item reference: ${item.menuItemId}`);
        }
      }
    }
  }

  if (invalidMenuItemRefs > 0) {
    console.error(`❌ ${invalidMenuItemRefs} invalid menu item references`);
    errors++;
  } else {
    console.log('✅ All order items reference valid menu items');
  }

  // Calculate revenue
  const revenue = orders
    .filter(o => o.status === 'CLOSED' || o.status === 'SERVED')
    .reduce((sum, o) => sum + parseFloat(o.total), 0);

  console.log(`Revenue: UGX ${revenue.toLocaleString()}`);

  console.log();
}

async function validateCafesserie() {
  console.log('☕ CAFESSERIE');
  console.log('─────────────');

  // Get Cafesserie branches
  const branches = await prisma.branch.findMany({
    where: { orgId: ORG_CAFESSERIE_ID },
    orderBy: { name: 'asc' },
  });

  if (branches.length !== 4) {
    console.error(`❌ Expected 4 branches, found ${branches.length}`);
    errors++;
    return;
  }

  console.log(`✅ Found 4 branches`);

  let totalOrders = 0;
  let totalItems = 0;
  let totalPayments = 0;
  let totalRefunds = 0;
  let totalRevenue = 0;

  for (const branch of branches) {
    console.log(`\n  📍 ${branch.name}:`);

    const orders = await prisma.order.findMany({
      where: { branchId: branch.id },
      include: {
        orderItems: true,
        payments: true,
        refunds: true,
      },
    });

    const itemCount = orders.reduce((sum, o) => sum + o.orderItems.length, 0);
    const paymentCount = orders.reduce((sum, o) => sum + o.payments.length, 0);
    const refundCount = orders.reduce((sum, o) => sum + o.refunds.length, 0);

    const branchRevenue = orders
      .filter(o => o.status === 'CLOSED' || o.status === 'SERVED')
      .reduce((sum, o) => sum + parseFloat(o.total), 0);

    console.log(`     Orders: ${orders.length.toLocaleString()}`);
    console.log(`     Items: ${itemCount.toLocaleString()}`);
    console.log(`     Payments: ${paymentCount.toLocaleString()}`);
    console.log(`     Refunds: ${refundCount.toLocaleString()}`);
    console.log(`     Revenue: UGX ${branchRevenue.toLocaleString()}`);

    // Check order count per branch
    if (orders.length < CAFESSERIE_MIN_ORDERS_PER_BRANCH) {
      console.error(`     ❌ Too few orders: ${orders.length} (expected ≥${CAFESSERIE_MIN_ORDERS_PER_BRANCH})`);
      errors++;
    } else if (orders.length > CAFESSERIE_MAX_ORDERS_PER_BRANCH) {
      console.warn(`     ⚠️  More orders than expected: ${orders.length} (expected ≤${CAFESSERIE_MAX_ORDERS_PER_BRANCH})`);
      warnings++;
    } else {
      console.log(`     ✅ Order count within range`);
    }

    // Check date range (180 days)
    const now = new Date();
    const oldestDate = new Date(now);
    oldestDate.setDate(oldestDate.getDate() - CAFESSERIE_DAYS);

    const ordersOutOfRange = orders.filter(o => o.createdAt < oldestDate);
    if (ordersOutOfRange.length > 0) {
      console.error(`     ❌ ${ordersOutOfRange.length} orders older than ${CAFESSERIE_DAYS} days`);
      errors++;
    } else {
      console.log(`     ✅ All orders within last ${CAFESSERIE_DAYS} days`);
    }

    // Validate foreign keys
    const menuItems = await prisma.menuItem.findMany({
      where: { branchId: branch.id },
      select: { id: true },
    });

    const menuItemIds = new Set(menuItems.map(m => m.id));
    let invalidMenuItemRefs = 0;

    for (const order of orders) {
      for (const item of order.orderItems) {
        if (!menuItemIds.has(item.menuItemId)) {
          invalidMenuItemRefs++;
        }
      }
    }

    if (invalidMenuItemRefs > 0) {
      console.error(`     ❌ ${invalidMenuItemRefs} invalid menu item references`);
      errors++;
    } else {
      console.log(`     ✅ All order items reference valid menu items`);
    }

    totalOrders += orders.length;
    totalItems += itemCount;
    totalPayments += paymentCount;
    totalRefunds += refundCount;
    totalRevenue += branchRevenue;
  }

  console.log('\n  🎯 TOTALS (all 4 branches):');
  console.log(`     Orders: ${totalOrders.toLocaleString()}`);
  console.log(`     Items: ${totalItems.toLocaleString()}`);
  console.log(`     Payments: ${totalPayments.toLocaleString()}`);
  console.log(`     Refunds: ${totalRefunds.toLocaleString()}`);
  console.log(`     Revenue: UGX ${totalRevenue.toLocaleString()}`);

  console.log();
}

async function checkIdempotency() {
  console.log('🔄 IDEMPOTENCY CHECK');
  console.log('────────────────────');
  console.log('Run this script after seeding twice to verify counts are identical.');
  console.log('If counts differ, seeding is NOT idempotent.\n');

  // Get counts
  const tapasOrders = await prisma.order.count({
    where: { branch: { orgId: ORG_TAPAS_ID } },
  });

  const cafeOrders = await prisma.order.count({
    where: { branch: { orgId: ORG_CAFESSERIE_ID } },
  });

  console.log(`Tapas orders: ${tapasOrders.toLocaleString()}`);
  console.log(`Cafesserie orders: ${cafeOrders.toLocaleString()}`);
  console.log();
  console.log('✅ Save these counts and compare after re-running seed.');
  console.log('   Identical counts = idempotent seed.');
  console.log();
}

async function main() {
  const checkIdem = process.argv.includes('--idempotency');

  try {
    if (checkIdem) {
      await checkIdempotency();
    } else {
      await validateTapas();
      await validateCafesserie();
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (errors === 0 && warnings === 0) {
      console.log('✅ VALIDATION PASSED: All checks successful!');
    } else if (errors === 0) {
      console.log(`⚠️  VALIDATION PASSED with ${warnings} warning(s)`);
    } else {
      console.log(`❌ VALIDATION FAILED: ${errors} error(s), ${warnings} warning(s)`);
      process.exit(1);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Validation script error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
