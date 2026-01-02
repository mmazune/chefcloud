#!/usr/bin/env node
/**
 * E2E Seed Verification Script
 * 
 * Verifies that the expected dataset has been seeded correctly.
 * Exits with non-zero code if verification fails.
 * 
 * Usage:
 *   export $(cat .env.e2e | xargs) && node scripts/verify-e2e-seed.mjs [DATASET_NAME]
 *   
 * Datasets:
 *   - DEMO_TAPAS (default) - slug: tapas-demo
 *   - DEMO_CAFESSERIE_FRANCHISE - slug: cafesserie-demo
 *   - ALL - verify all datasets
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { prisma } = require('@chefcloud/db');

const dataset = process.argv[2] || process.env.E2E_DATASET || 'DEMO_TAPAS';

console.log(`🔍 Verifying E2E seed for dataset: ${dataset}`);

async function verifyDemoTapas() {
  console.log('\n📊 Checking DEMO_TAPAS dataset...');
  
  // Check org exists
  const org = await prisma.org.findFirst({
    where: { slug: 'tapas-demo' },
    include: { branches: true },
  });
  
  if (!org) {
    console.error('❌ DEMO_TAPAS org not found (expected slug: tapas-demo)');
    return false;
  }
  console.log(`✅ Org found: ${org.name} (${org.id})`);
  
  // Check branch exists
  if (org.branches.length === 0) {
    console.error('❌ No branches found for DEMO_TAPAS');
    return false;
  }
  console.log(`✅ Found ${org.branches.length} branch(es)`);
  
  const branchIds = org.branches.map(b => b.id);
  
  // Check menu items exist (query via branchId since menuItem has branchId, not orgId)
  const menuItemCount = await prisma.menuItem.count({
    where: { branchId: { in: branchIds } },
  });
  
  if (menuItemCount === 0) {
    console.error('❌ No menu items found for DEMO_TAPAS');
    return false;
  }
  console.log(`✅ Found ${menuItemCount} menu items`);
  
  // Check users exist
  const userCount = await prisma.user.count({
    where: { orgId: org.id },
  });
  
  if (userCount < 5) {
    console.error(`❌ Too few users for DEMO_TAPAS (found ${userCount}, expected >= 5)`);
    return false;
  }
  console.log(`✅ Found ${userCount} users`);
  
  // Check inventory items exist
  const inventoryItemCount = await prisma.inventoryItem.count({
    where: { orgId: org.id },
  });
  
  if (inventoryItemCount === 0) {
    console.warn('⚠️  No inventory items found (may be expected for basic seeding)');
  } else {
    console.log(`✅ Found ${inventoryItemCount} inventory items`);
  }
  
  // Check orders/sales exist
  const orderCount = await prisma.order.count({
    where: { branchId: { in: branchIds } },
  });
  
  if (orderCount === 0) {
    console.warn('⚠️  No orders found (may be expected for basic seeding)');
  } else {
    console.log(`✅ Found ${orderCount} orders`);
  }
  
  console.log('✅ DEMO_TAPAS verification passed');
  return true;
}

async function verifyDemoCafesserieFranchise() {
  console.log('\n📊 Checking DEMO_CAFESSERIE_FRANCHISE dataset...');
  
  // Check org exists
  const org = await prisma.org.findFirst({
    where: { slug: 'cafesserie-demo' },
    include: { branches: true },
  });
  
  if (!org) {
    console.error('❌ DEMO_CAFESSERIE org not found (expected slug: cafesserie-demo)');
    return false;
  }
  console.log(`✅ Org found: ${org.name} (${org.id})`);
  
  // Check multiple branches exist
  if (org.branches.length < 2) {
    console.error(`❌ DEMO_CAFESSERIE needs >= 2 branches (found ${org.branches.length})`);
    return false;
  }
  console.log(`✅ Found ${org.branches.length} branches (franchise)`);
  
  const branchIds = org.branches.map(b => b.id);
  
  // Check menu items exist
  const menuItemCount = await prisma.menuItem.count({
    where: { branchId: { in: branchIds } },
  });
  
  if (menuItemCount === 0) {
    console.error('❌ No menu items found for DEMO_CAFESSERIE');
    return false;
  }
  console.log(`✅ Found ${menuItemCount} menu items`);
  
  // Check users exist
  const userCount = await prisma.user.count({
    where: { orgId: org.id },
  });
  
  if (userCount < 5) {
    console.error(`❌ Too few users for DEMO_CAFESSERIE (found ${userCount}, expected >= 5)`);
    return false;
  }
  console.log(`✅ Found ${userCount} users`);
  
  // Check some sales/stock per branch
  const ordersPerBranch = await prisma.order.groupBy({
    by: ['branchId'],
    where: { branchId: { in: branchIds } },
    _count: { id: true },
  });
  
  if (ordersPerBranch.length === 0) {
    console.warn('⚠️  No orders found (may be expected for basic seeding)');
  } else {
    console.log(`✅ Found orders across ${ordersPerBranch.length} branch(es)`);
  }
  
  console.log('✅ DEMO_CAFESSERIE_FRANCHISE verification passed');
  return true;
}

async function main() {
  try {
    let allPassed = true;
    
    if (dataset === 'ALL') {
      allPassed = await verifyDemoTapas() && allPassed;
      allPassed = await verifyDemoCafesserieFranchise() && allPassed;
    } else if (dataset === 'DEMO_TAPAS') {
      allPassed = await verifyDemoTapas();
    } else if (dataset === 'DEMO_CAFESSERIE_FRANCHISE') {
      allPassed = await verifyDemoCafesserieFranchise();
    } else {
      console.error(`❌ Unknown dataset: ${dataset}`);
      console.log('Available datasets: DEMO_TAPAS, DEMO_CAFESSERIE_FRANCHISE, ALL');
      process.exit(1);
    }
    
    if (!allPassed) {
      console.error('\n❌ Verification failed');
      process.exit(1);
    }
    
    console.log('\n✅ All verifications passed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
