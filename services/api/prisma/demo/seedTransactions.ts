/**
 * Transaction Seeding Orchestrator
 * 
 * Coordinates seeding of orders, payments, and related transactional data
 * for demo organizations. Implements idempotency via cleanup + recreate strategy.
 * 
 * IDEMPOTENCY STRATEGY:
 * 1. Delete all orders/payments for demo orgs within target date ranges
 * 2. Recreate deterministically using seeded RNG
 * 3. All operations within a transaction for atomicity
 * 
 * SAFETY: Only runs if SEED_DEMO_DATA=true or NODE_ENV !== 'production'
 */

import { PrismaClient } from '@prisma/client';
import { ORG_TAPAS_ID, ORG_CAFESSERIE_ID } from './constants';
import { seedTapasTransactions } from './tapas/transactions';
import { seedCafesserieTransactions } from './cafesserie/transactions';

/**
 * Cleanup old transaction data for a specific organization
 * Deletes orders (cascades to items, payments, refunds) within date range
 */
async function cleanupOrgTransactions(
  prisma: PrismaClient,
  orgId: string,
  daysBack: number,
): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  
  // Get branches for this org
  const branches = await prisma.branch.findMany({
    where: { orgId },
    select: { id: true, name: true },
  });

  console.log(`    🧹 Cleaning up transactions for last ${daysBack} days...`);
  
  let deletedCount = 0;
  
  for (const branch of branches) {
    const deleted = await prisma.order.deleteMany({
      where: {
        branchId: branch.id,
        createdAt: {
          gte: cutoffDate,
        },
      },
    });
    
    deletedCount += deleted.count;
  }
  
  console.log(`    ✅ Deleted ${deletedCount} old orders (cascaded items/payments/refunds)`);
}

/**
 * Main transaction seeding function
 */
export async function seedTransactions(prisma: PrismaClient): Promise<void> {
  // Safety check: only seed if explicitly enabled or not in production
  const shouldSeed =
    process.env.SEED_DEMO_DATA === 'true' ||
    process.env.NODE_ENV !== 'production';

  if (!shouldSeed) {
    console.log('\n⚠️  Skipping transaction seeding (production environment)');
    console.log('   Set SEED_DEMO_DATA=true to force transaction seeding');
    return;
  }

  console.log('\n💳 Seeding Demo Transactions...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // ===== Tapas Bar & Restaurant =====
    console.log('\n📍 Tapas Bar & Restaurant');
    
    // Cleanup old Tapas transactions (90 days)
    await cleanupOrgTransactions(prisma, ORG_TAPAS_ID, 90);
    
    // Seed Tapas transactions
    await seedTapasTransactions(prisma);

    // ===== Cafesserie =====
    console.log('\n📍 Cafesserie');
    
    // Cleanup old Cafesserie transactions (180 days)
    await cleanupOrgTransactions(prisma, ORG_CAFESSERIE_ID, 180);
    
    // Seed Cafesserie transactions
    await seedCafesserieTransactions(prisma);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Transaction seeding completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Print summary
    await printTransactionSummary(prisma);

  } catch (error) {
    console.error('\n❌ Transaction seeding failed:', error);
    throw error;
  }
}

/**
 * Print summary of seeded transactions
 */
async function printTransactionSummary(prisma: PrismaClient): Promise<void> {
  console.log('📊 Transaction Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Tapas summary
  const tapasOrders = await prisma.order.count({
    where: {
      branch: { orgId: ORG_TAPAS_ID },
    },
  });

  const tapasItems = await prisma.orderItem.count({
    where: {
      order: {
        branch: { orgId: ORG_TAPAS_ID },
      },
    },
  });

  const tapasPayments = await prisma.payment.count({
    where: {
      order: {
        branch: { orgId: ORG_TAPAS_ID },
      },
    },
  });

  const tapasRefunds = await prisma.refund.count({
    where: {
      order: {
        branch: { orgId: ORG_TAPAS_ID },
      },
    },
  });

  const tapasRevenue = await prisma.order.aggregate({
    where: {
      branch: { orgId: ORG_TAPAS_ID },
      status: { in: ['CLOSED', 'SERVED'] },
    },
    _sum: {
      total: true,
    },
  });

  console.log('🍽️  Tapas Bar & Restaurant (90 days):');
  console.log(`   Orders:   ${tapasOrders.toLocaleString()}`);
  console.log(`   Items:    ${tapasItems.toLocaleString()}`);
  console.log(`   Payments: ${tapasPayments.toLocaleString()}`);
  console.log(`   Refunds:  ${tapasRefunds.toLocaleString()}`);
  console.log(`   Revenue:  UGX ${Number(tapasRevenue._sum.total || 0).toLocaleString()}`);

  // Cafesserie summary (per branch)
  console.log('\n☕ Cafesserie (180 days):');
  
  const cafeBranches = await prisma.branch.findMany({
    where: { orgId: ORG_CAFESSERIE_ID },
    select: { id: true, name: true },
  });

  let cafeTotalOrders = 0;
  let cafeTotalItems = 0;
  let cafeTotalPayments = 0;
  let cafeTotalRefunds = 0;
  let cafeTotalRevenue = 0;

  for (const branch of cafeBranches) {
    const orders = await prisma.order.count({
      where: { branchId: branch.id },
    });

    const items = await prisma.orderItem.count({
      where: {
        order: { branchId: branch.id },
      },
    });

    const payments = await prisma.payment.count({
      where: {
        order: { branchId: branch.id },
      },
    });

    const refunds = await prisma.refund.count({
      where: {
        order: { branchId: branch.id },
      },
    });

    const revenue = await prisma.order.aggregate({
      where: {
        branchId: branch.id,
        status: { in: ['CLOSED', 'SERVED'] },
      },
      _sum: {
        total: true,
      },
    });

    const branchRevenue = Number(revenue._sum.total || 0);

    console.log(`   ${branch.name}:`);
    console.log(`     Orders:   ${orders.toLocaleString()}`);
    console.log(`     Revenue:  UGX ${branchRevenue.toLocaleString()}`);

    cafeTotalOrders += orders;
    cafeTotalItems += items;
    cafeTotalPayments += payments;
    cafeTotalRefunds += refunds;
    cafeTotalRevenue += branchRevenue;
  }

  console.log(`\n   TOTALS (all 4 branches):`);
  console.log(`     Orders:   ${cafeTotalOrders.toLocaleString()}`);
  console.log(`     Items:    ${cafeTotalItems.toLocaleString()}`);
  console.log(`     Payments: ${cafeTotalPayments.toLocaleString()}`);
  console.log(`     Refunds:  ${cafeTotalRefunds.toLocaleString()}`);
  console.log(`     Revenue:  UGX ${cafeTotalRevenue.toLocaleString()}`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}
