/**
 * Demo Seeding Module
 * 
 * Creates deterministic, idempotent demo data for two organizations:
 * - Tapas Bar & Restaurant (1 branch)
 * - Cafesserie (4 branches)
 * 
 * All users share the same password: Demo#123
 * All IDs are deterministic (fixed UUIDs) for consistency across machines.
 * 
 * SAFETY: Only runs if SEED_DEMO_DATA=true or NODE_ENV !== 'production'
 */

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  TAPAS_ORG,
  CAFESSERIE_ORG,
  TAPAS_BRANCHES,
  CAFESSERIE_BRANCHES,
  TAPAS_DEMO_USERS,
  CAFESSERIE_DEMO_USERS,
  DEMO_PASSWORD,
} from './constants';

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
  });
}

/**
 * Deletes old demo data before re-seeding
 * Only removes data for demo org slugs to avoid wiping production data
 * Uses deterministic IDs for safe cleanup
 */
async function cleanupOldDemoData(prisma: PrismaClient): Promise<void> {
  console.log('  🧹 Cleaning up old demo data...');

  const demoSlugs = [TAPAS_ORG.slug, CAFESSERIE_ORG.slug];
  const demoOrgIds = [TAPAS_ORG.id, CAFESSERIE_ORG.id];

  // Find demo orgs by both slug AND deterministic ID for extra safety
  const demoOrgs = await prisma.org.findMany({
    where: {
      OR: [
        { slug: { in: demoSlugs } },
        { id: { in: demoOrgIds } },
      ],
    },
    select: { id: true, slug: true },
  });

  if (demoOrgs.length === 0) {
    console.log('  ℹ️  No existing demo orgs found');
    return;
  }

  const orgIds = demoOrgs.map((org) => org.id);

  // Delete in correct order due to foreign key constraints
  console.log(`  🗑️  Deleting data for ${demoOrgs.length} demo org(s)...`);

  // First get all branch IDs for these orgs
  const branches = await prisma.branch.findMany({
    where: { orgId: { in: orgIds } },
    select: { id: true },
  });
  const branchIds = branches.map((b) => b.id);

  // Delete orders first (V2.1.1 - open orders exist now)
  if (branchIds.length > 0) {
    await prisma.orderItem.deleteMany({
      where: { order: { branchId: { in: branchIds } } },
    });
    await prisma.order.deleteMany({
      where: { branchId: { in: branchIds } },
    });
    console.log(`    ✅ Deleted orders for demo branches`);
  }

  // Delete employee profiles before users (foreign key)
  await prisma.employeeProfile.deleteMany({
    where: { user: { orgId: { in: orgIds } } },
  });
  console.log(`    ✅ Deleted employee profiles`);

  // Delete badge assets (orphaned by employeeProfile deletion)
  await prisma.badgeAsset.deleteMany({
    where: { orgId: { in: orgIds } },
  });
  console.log(`    ✅ Deleted badge assets`);

  // Delete shifts before deleting users (foreign key constraint)
  await prisma.shift.deleteMany({
    where: { orgId: { in: orgIds } },
  });
  console.log(`    ✅ Deleted shifts`);

  // Delete staff awards before deleting users (foreign key constraint)
  await prisma.staffAward.deleteMany({
    where: { orgId: { in: orgIds } },
  });
  console.log(`    ✅ Deleted staff awards`);

  // Users (cascades to many relations via onDelete: Cascade)
  const deletedUsers = await prisma.user.deleteMany({
    where: { orgId: { in: orgIds } },
  });
  console.log(`    ✅ Deleted ${deletedUsers.count} users`);

  // Branches (cascades to tables, floor plans, etc.)
  const deletedBranches = await prisma.branch.deleteMany({
    where: { orgId: { in: orgIds } },
  });
  console.log(`    ✅ Deleted ${deletedBranches.count} branches`);

  // Org settings
  const deletedSettings = await prisma.orgSettings.deleteMany({
    where: { orgId: { in: orgIds } },
  });
  console.log(`    ✅ Deleted ${deletedSettings.count} org settings`);

  // Finally, delete orgs
  const deletedOrgs = await prisma.org.deleteMany({
    where: { id: { in: orgIds } },
  });
  console.log(`    ✅ Deleted ${deletedOrgs.count} orgs`);
}

/**
 * Seeds a single organization with branches and users
 */
async function seedOrg(
  prisma: PrismaClient,
  orgDef: typeof TAPAS_ORG | typeof CAFESSERIE_ORG,
  branches: readonly any[],
  users: readonly any[],
): Promise<void> {
  console.log(`\n  🏢 Seeding ${orgDef.name}...`);

  // Create org (using deterministic ID)
  const org = await prisma.org.upsert({
    where: { id: orgDef.id },
    update: {
      name: orgDef.name,
      slug: orgDef.slug,
    },
    create: {
      id: orgDef.id,
      name: orgDef.name,
      slug: orgDef.slug,
    },
  });
  console.log(`    ✅ Org: ${org.name} (${org.id})`);

  // Create org settings
  await prisma.orgSettings.upsert({
    where: { orgId: org.id },
    update: {
      vatPercent: orgDef.vatPercent,
      currency: orgDef.currency,
    },
    create: {
      orgId: org.id,
      vatPercent: orgDef.vatPercent,
      currency: orgDef.currency,
      platformAccess: {
        WAITER: { desktop: true, web: false, mobile: false },
        CASHIER: { desktop: true, web: false, mobile: false },
        SUPERVISOR: { desktop: true, web: false, mobile: false },
        HEAD_CHEF: { desktop: true, web: false, mobile: true },
        STOCK: { desktop: false, web: true, mobile: true },
        PROCUREMENT: { desktop: false, web: true, mobile: true },
        MANAGER: { desktop: false, web: true, mobile: true },
        ACCOUNTANT: { desktop: false, web: true, mobile: true },
        OWNER: { desktop: false, web: true, mobile: true },
      },
    },
  });

  // Create branches
  for (const branchDef of branches) {
    const branch = await prisma.branch.upsert({
      where: { id: branchDef.id },
      update: {
        name: branchDef.name,
        address: branchDef.address,
        timezone: branchDef.timezone,
      },
      create: {
        id: branchDef.id,
        orgId: org.id,
        name: branchDef.name,
        address: branchDef.address,
        timezone: branchDef.timezone,
      },
    });
    console.log(`    ✅ Branch: ${branch.name}`);
  }

  // Get first branch for user assignment
  const firstBranch = await prisma.branch.findFirst({
    where: { orgId: org.id },
  });

  if (!firstBranch) {
    throw new Error(`No branches found for org ${org.id}`);
  }

  // Hash password once for all users
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // Create users
  for (const userDef of users) {
    const pinHash = userDef.pin ? await hashPassword(userDef.pin) : null;

    const user = await prisma.user.upsert({
      where: { email: userDef.email },
      update: {
        passwordHash,
        pinHash,
        firstName: userDef.firstName,
        lastName: userDef.lastName,
        roleLevel: userDef.roleLevel as any,
        orgId: org.id,
        branchId: firstBranch.id,
        isActive: true,
      },
      create: {
        email: userDef.email,
        passwordHash,
        pinHash,
        firstName: userDef.firstName,
        lastName: userDef.lastName,
        roleLevel: userDef.roleLevel as any,
        orgId: org.id,
        branchId: firstBranch.id,
        isActive: true,
      },
    });
    console.log(`    ✅ User: ${user.email} (${user.roleLevel})`);
  }

  // Seed badges for MSR authentication
  await seedBadges(prisma, org.id, users);
}

/**
 * Seed badge assets for MSR (Multi-Scan Reader) authentication
 * Creates canonical badges tied to specific employees for POS/FOH workflows
 */
async function seedBadges(
  prisma: PrismaClient,
  orgId: string,
  users: readonly any[],
): Promise<void> {
  console.log(`\n  🎫 Seeding Badge Assets for org ${orgId}...`);

  // Get all users with employee profiles
  const allUsers = await prisma.user.findMany({
    where: { orgId },
    include: { employeeProfile: true },
  });

  // Badge mapping: role-specific badges for canonical MSR flows
  const badgeConfigs = [
    { role: 'manager', code: 'MGR001', badgeId: 'MGR001' },
    { role: 'cashier', code: 'CASHIER001', badgeId: 'CASHIER001' },
    { role: 'supervisor', code: 'SUP001', badgeId: 'SUP001' },
    { role: 'waiter', code: 'WAIT001', badgeId: 'WAIT001' },
    { role: 'chef', code: 'CHEF001', badgeId: 'CHEF001' },
  ];

  for (const config of badgeConfigs) {
    const user = allUsers.find((u) =>
      u.email.toLowerCase().includes(config.role),
    );

    if (!user) {
      console.log(`    ⚠️  No ${config.role} user found, skipping badge ${config.code}`);
      continue;
    }

    // Create badge asset
    await prisma.badgeAsset.upsert({
      where: { code: config.code },
      update: {
        orgId,
        state: 'ACTIVE',
        assignedUserId: user.id,
        lastUsedAt: null,
      },
      create: {
        code: config.code,
        orgId,
        state: 'ACTIVE',
        assignedUserId: user.id,
      },
    });

    // Update employee profile with badge ID
    if (user.employeeProfile) {
      await prisma.employeeProfile.update({
        where: { id: user.employeeProfile.id },
        data: { badgeId: config.badgeId },
      });
    }

    console.log(`    ✅ Badge ${config.code} → ${user.email}`);
  }
}

/**
 * Main demo seeding function
 */
export async function seedDemo(prisma: PrismaClient): Promise<void> {
  // Safety check: only seed demo data if explicitly enabled or not in production
  const shouldSeed =
    process.env.SEED_DEMO_DATA === 'true' ||
    process.env.NODE_ENV !== 'production';

  if (!shouldSeed) {
    console.log('\n⚠️  Skipping demo data seeding (production environment)');
    console.log('   Set SEED_DEMO_DATA=true to force demo seeding');
    return;
  }

  console.log('\n🎭 Seeding Demo Organizations...');

  // Clean up old demo data first
  await cleanupOldDemoData(prisma);

  // Seed Tapas Bar & Restaurant
  await seedOrg(prisma, TAPAS_ORG, TAPAS_BRANCHES, TAPAS_DEMO_USERS);

  // Seed Cafesserie
  await seedOrg(prisma, CAFESSERIE_ORG, CAFESSERIE_BRANCHES, CAFESSERIE_DEMO_USERS);

  console.log('\n✅ Demo organizations seeded successfully!');
}

/**
 * Print demo login credentials
 */
export function printDemoCredentials(): void {
  console.log('\n🎭 Demo Login Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📍 Tapas Bar & Restaurant:');
  TAPAS_DEMO_USERS.forEach((user) => {
    const pin = user.pin ? ` (PIN: ${user.pin})` : '';
    console.log(`   ${user.email.padEnd(35)} / ${DEMO_PASSWORD}${pin}`);
  });

  console.log('\n📍 Cafesserie:');
  CAFESSERIE_DEMO_USERS.forEach((user) => {
    const pin = user.pin ? ` (PIN: ${user.pin})` : '';
    console.log(`   ${user.email.padEnd(35)} / ${DEMO_PASSWORD}${pin}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Password for all demo users: Demo#123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}
