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
import { seedWorkforce } from './seedWorkforce';

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
      OR: [{ slug: { in: demoSlugs } }, { id: { in: demoOrgIds } }],
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

  // M8.4: Delete payment method mappings
  await prisma.paymentMethodMapping.deleteMany({
    where: { orgId: { in: orgIds } },
  });
  console.log(`    ✅ Deleted payment method mappings`);

  // M8.3: Delete vendor payments before bills
  await prisma.vendorPayment.deleteMany({
    where: { orgId: { in: orgIds } },
  });
  console.log(`    ✅ Deleted vendor payments`);

  // M8.3: Delete vendor bills before vendors
  await prisma.vendorBill.deleteMany({
    where: { orgId: { in: orgIds } },
  });
  console.log(`    ✅ Deleted vendor bills`);

  // M8.3: Delete vendors
  await prisma.vendor.deleteMany({
    where: { orgId: { in: orgIds } },
  });
  console.log(`    ✅ Deleted vendors`);

  // M8.3: Delete customer receipts before invoices
  await prisma.customerReceipt.deleteMany({
    where: { orgId: { in: orgIds } },
  });
  console.log(`    ✅ Deleted customer receipts`);

  // M8.3: Delete customer invoices before customer accounts
  await prisma.customerInvoice.deleteMany({
    where: { orgId: { in: orgIds } },
  });
  console.log(`    ✅ Deleted customer invoices`);

  // M8.3: Delete customer accounts
  await prisma.customerAccount.deleteMany({
    where: { orgId: { in: orgIds } },
  });
  console.log(`    ✅ Deleted customer accounts`);

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
        jobRole: userDef.jobRole as any, // M8.1: Populate jobRole for role-specific UX
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
        jobRole: userDef.jobRole as any, // M8.1: Populate jobRole for role-specific UX
        orgId: org.id,
        branchId: firstBranch.id,
        isActive: true,
      },
    });
    console.log(`    ✅ User: ${user.email} (${user.roleLevel}/${user.jobRole || 'no jobRole'})`);
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

  // Derive org prefix from orgId (last segment for uniqueness)
  // e.g., "00000000-0000-4000-8000-000000000001" -> "ORG1"
  // e.g., "00000000-0000-4000-8000-000000000002" -> "ORG2"
  const orgSuffix = orgId.slice(-1);
  const orgPrefix = `ORG${orgSuffix}`;

  // Badge mapping: role-specific badges for canonical MSR flows
  // Badge codes are globally unique in schema, so we prefix with org identifier
  const badgeConfigs = [
    { role: 'manager', code: `${orgPrefix}-MGR001`, badgeId: `${orgPrefix}-MGR001` },
    { role: 'cashier', code: `${orgPrefix}-CASHIER001`, badgeId: `${orgPrefix}-CASHIER001` },
    { role: 'supervisor', code: `${orgPrefix}-SUP001`, badgeId: `${orgPrefix}-SUP001` },
    { role: 'waiter', code: `${orgPrefix}-WAIT001`, badgeId: `${orgPrefix}-WAIT001` },
    { role: 'chef', code: `${orgPrefix}-CHEF001`, badgeId: `${orgPrefix}-CHEF001` },
  ];

  for (const config of badgeConfigs) {
    const user = allUsers.find((u) => u.email.toLowerCase().includes(config.role));

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

    // Create or update employee profile with badge ID
    // This is essential for MSR auth which looks up by employeeProfile.badgeId
    // Use the badge code as employee code to ensure uniqueness
    await prisma.employeeProfile.upsert({
      where: { userId: user.id },
      update: { badgeId: config.badgeId },
      create: {
        userId: user.id,
        employeeCode: config.code, // Use badge code as unique employee code
        badgeId: config.badgeId,
      },
    });

    console.log(`    ✅ Badge ${config.code} → ${user.email}`);
  }
}

/**
 * M8.2: Seed Chart of Accounts for an organization
 * Standard 18-account structure for hospitality
 */
async function seedChartOfAccounts(prisma: PrismaClient, orgId: string): Promise<void> {
  console.log(`    💰 Seeding Chart of Accounts...`);

  const accounts = [
    // Assets (1xxx)
    { code: '1000', name: 'Cash', type: 'ASSET' },
    { code: '1010', name: 'Bank', type: 'ASSET' },
    { code: '1100', name: 'Accounts Receivable', type: 'ASSET' },
    { code: '1200', name: 'Inventory', type: 'ASSET' },
    { code: '1300', name: 'Prepaid Expenses', type: 'ASSET' },
    // Liabilities (2xxx)
    { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' },
    { code: '2100', name: 'GRNI - Goods Received Not Invoiced', type: 'LIABILITY' },
    { code: '2200', name: 'Accrued Expenses', type: 'LIABILITY' },
    // Equity (3xxx)
    { code: '3000', name: "Owner's Equity", type: 'EQUITY' },
    { code: '3100', name: 'Retained Earnings', type: 'EQUITY' },
    // Revenue (4xxx)
    { code: '4000', name: 'Sales Revenue', type: 'REVENUE' },
    { code: '4100', name: 'Service Charges', type: 'REVENUE' },
    { code: '4200', name: 'Inventory Gain', type: 'REVENUE' },
    // COGS (5xxx)
    { code: '5000', name: 'Cost of Goods Sold', type: 'COGS' },
    { code: '5100', name: 'Wastage', type: 'COGS' },
    // Expenses (6xxx)
    { code: '6000', name: 'Payroll Expense', type: 'EXPENSE' },
    { code: '6100', name: 'Utilities', type: 'EXPENSE' },
    { code: '6200', name: 'Waste Expense', type: 'EXPENSE' },
    { code: '6300', name: 'Shrinkage Expense', type: 'EXPENSE' },
    { code: '6400', name: 'Rent', type: 'EXPENSE' },
    { code: '6500', name: 'Supplies', type: 'EXPENSE' },
    { code: '6600', name: 'Marketing', type: 'EXPENSE' },
  ];

  for (const acc of accounts) {
    await prisma.account.upsert({
      where: { orgId_code: { orgId, code: acc.code } },
      update: {},
      create: {
        orgId,
        code: acc.code,
        name: acc.name,
        type: acc.type as 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'COGS' | 'EXPENSE',
        isActive: true,
      },
    });
  }

  console.log(`    ✅ ${accounts.length} accounts created`);

  // M8.4: Seed Payment Method Mappings
  const cashAccount = await prisma.account.findFirst({
    where: { orgId, code: '1000' }, // Cash
  });
  const bankAccount = await prisma.account.findFirst({
    where: { orgId, code: '1010' }, // Bank
  });

  if (cashAccount && bankAccount) {
    const mappings = [
      { method: 'CASH', accountId: cashAccount.id },
      { method: 'CARD', accountId: bankAccount.id },
      { method: 'MOMO', accountId: bankAccount.id },
      { method: 'BANK_TRANSFER', accountId: bankAccount.id },
    ];

    for (const m of mappings) {
      await prisma.paymentMethodMapping.upsert({
        where: { orgId_method: { orgId, method: m.method as 'CASH' | 'CARD' | 'MOMO' | 'BANK_TRANSFER' } },
        update: {},
        create: {
          orgId,
          method: m.method as 'CASH' | 'CARD' | 'MOMO' | 'BANK_TRANSFER',
          accountId: m.accountId,
        },
      });
    }
    console.log(`    ✅ ${mappings.length} payment method mappings created`);
  }
}

/**
 * M8.2: Seed Fiscal Periods for an organization
 */
async function seedFiscalPeriods(prisma: PrismaClient, orgId: string): Promise<void> {
  console.log(`    📅 Seeding Fiscal Periods...`);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

  // Previous quarter (LOCKED)
  const prevQ = currentQuarter === 1 ? 4 : currentQuarter - 1;
  const prevYear = currentQuarter === 1 ? currentYear - 1 : currentYear;
  const prevQStart = new Date(prevYear, (prevQ - 1) * 3, 1);
  const prevQEnd = new Date(prevYear, prevQ * 3, 0);

  // Current quarter (OPEN)
  const currQStart = new Date(currentYear, (currentQuarter - 1) * 3, 1);
  const currQEnd = new Date(currentYear, currentQuarter * 3, 0);

  const periods = [
    {
      id: `00000000-0000-4000-8000-fp${orgId.slice(-4)}01`,
      name: `Q${prevQ} ${prevYear}`,
      startsAt: prevQStart,
      endsAt: prevQEnd,
      status: 'LOCKED' as const,
    },
    {
      id: `00000000-0000-4000-8000-fp${orgId.slice(-4)}02`,
      name: `Q${currentQuarter} ${currentYear}`,
      startsAt: currQStart,
      endsAt: currQEnd,
      status: 'OPEN' as const,
    },
  ];

  for (const p of periods) {
    await prisma.fiscalPeriod.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        orgId,
        name: p.name,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        status: p.status,
        lockedAt: p.status === 'LOCKED' ? new Date() : null,
      },
    });
  }

  console.log(`    ✅ ${periods.length} fiscal periods created`);
}

/**
 * M8.3: Seed Vendors and Vendor Bills for an organization
 * Creates 10+ vendor bills per org (mix of DRAFT, OPEN, PAID, VOID)
 */
async function seedVendorsAndBills(prisma: PrismaClient, orgId: string): Promise<void> {
  console.log(`    📦 Seeding Vendors and Bills...`);

  const vendorData = [
    { id: `00000000-0000-4000-8000-v${orgId.slice(-4)}001`, name: 'Fresh Farms Produce', email: 'billing@freshfarms.ug', phone: '+256700111001', defaultTerms: 'NET30' },
    { id: `00000000-0000-4000-8000-v${orgId.slice(-4)}002`, name: 'Uganda Beverages Ltd', email: 'accounts@ugbev.co.ug', phone: '+256700111002', defaultTerms: 'NET14' },
    { id: `00000000-0000-4000-8000-v${orgId.slice(-4)}003`, name: 'Kampala Cleaning Supplies', email: 'sales@kcs.ug', phone: '+256700111003', defaultTerms: 'NET7' },
    { id: `00000000-0000-4000-8000-v${orgId.slice(-4)}004`, name: 'East African Meats', email: 'orders@eameats.com', phone: '+256700111004', defaultTerms: 'NET14' },
    { id: `00000000-0000-4000-8000-v${orgId.slice(-4)}005`, name: 'Kitchen Equipment Pro', email: 'support@kitchenpro.ug', phone: '+256700111005', defaultTerms: 'NET30' },
  ];

  // Create vendors
  for (const v of vendorData) {
    await prisma.vendor.upsert({
      where: { id: v.id },
      update: {},
      create: {
        id: v.id,
        orgId,
        name: v.name,
        email: v.email,
        phone: v.phone,
        defaultTerms: v.defaultTerms as 'NET7' | 'NET14' | 'NET30',
      },
    });
  }
  console.log(`    ✅ ${vendorData.length} vendors created`);

  // Create 14 vendor bills (mix of statuses including PARTIALLY_PAID for M8.4)
  const now = new Date();
  const billData = [
    { num: 'VB-001', vendorIdx: 0, days: -45, amount: 850000, status: 'PAID', paidAmount: 1003000 }, // total with tax
    { num: 'VB-002', vendorIdx: 1, days: -40, amount: 1200000, status: 'PAID', paidAmount: 1416000 },
    { num: 'VB-003', vendorIdx: 2, days: -35, amount: 350000, status: 'OPEN', paidAmount: 0 },
    { num: 'VB-004', vendorIdx: 3, days: -30, amount: 2500000, status: 'OPEN', paidAmount: 0 },
    { num: 'VB-005', vendorIdx: 4, days: -25, amount: 4500000, status: 'PARTIALLY_PAID', paidAmount: 3000000 }, // M8.4: partial
    { num: 'VB-006', vendorIdx: 0, days: -20, amount: 750000, status: 'PARTIALLY_PAID', paidAmount: 500000 }, // M8.4: partial
    { num: 'VB-007', vendorIdx: 1, days: -15, amount: 980000, status: 'DRAFT', paidAmount: 0 },
    { num: 'VB-008', vendorIdx: 2, days: -10, amount: 425000, status: 'DRAFT', paidAmount: 0 },
    { num: 'VB-009', vendorIdx: 3, days: -5, amount: 1850000, status: 'DRAFT', paidAmount: 0 },
    { num: 'VB-010', vendorIdx: 4, days: -2, amount: 650000, status: 'DRAFT', paidAmount: 0 },
    { num: 'VB-011', vendorIdx: 0, days: -50, amount: 920000, status: 'VOID', paidAmount: 0 },
    { num: 'VB-012', vendorIdx: 1, days: -1, amount: 1100000, status: 'DRAFT', paidAmount: 0 },
    { num: 'VB-013', vendorIdx: 2, days: -18, amount: 680000, status: 'PARTIALLY_PAID', paidAmount: 400000 }, // M8.4
    { num: 'VB-014', vendorIdx: 3, days: -22, amount: 1500000, status: 'OPEN', paidAmount: 0 },
  ];

  for (const bill of billData) {
    const billDate = new Date(now.getTime() + bill.days * 24 * 60 * 60 * 1000);
    const dueDate = new Date(billDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const vendor = vendorData[bill.vendorIdx];
    const billId = `00000000-0000-4000-8000-vb${orgId.slice(-4)}${bill.num.slice(-3)}`;

    await prisma.vendorBill.upsert({
      where: { id: billId },
      update: {},
      create: {
        id: billId,
        orgId,
        vendorId: vendor.id,
        number: bill.num,
        billDate,
        dueDate,
        subtotal: bill.amount,
        tax: Math.round(bill.amount * 0.18),
        total: Math.round(bill.amount * 1.18),
        paidAmount: bill.paidAmount, // M8.4: Track paid amount
        status: bill.status as 'DRAFT' | 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'VOID',
        memo: `${vendor.name} - ${bill.num}`,
      },
    });
  }
  console.log(`    ✅ ${billData.length} vendor bills created`);
}

/**
 * M8.3: Seed Customer Accounts and Invoices for an organization
 * Creates 10+ customer invoices per org (mix of DRAFT, OPEN, PAID, VOID)
 */
async function seedCustomersAndInvoices(prisma: PrismaClient, orgId: string): Promise<void> {
  console.log(`    👥 Seeding Customers and Invoices...`);

  const customerData = [
    { id: `00000000-0000-4000-8000-c${orgId.slice(-4)}001`, name: 'ABC Corporate Events', email: 'events@abccorp.ug', phone: '+256700222001', creditLimit: 5000000 },
    { id: `00000000-0000-4000-8000-c${orgId.slice(-4)}002`, name: 'Uganda Tourism Board', email: 'catering@utb.go.ug', phone: '+256700222002', creditLimit: 10000000 },
    { id: `00000000-0000-4000-8000-c${orgId.slice(-4)}003`, name: 'Serena Hotel Kampala', email: 'partners@serena.co.ug', phone: '+256700222003', creditLimit: 15000000 },
    { id: `00000000-0000-4000-8000-c${orgId.slice(-4)}004`, name: 'Makerere University', email: 'events@mak.ac.ug', phone: '+256700222004', creditLimit: 8000000 },
    { id: `00000000-0000-4000-8000-c${orgId.slice(-4)}005`, name: 'MTN Uganda', email: 'corporate@mtn.co.ug', phone: '+256700222005', creditLimit: 20000000 },
  ];

  // Create customers
  for (const c of customerData) {
    await prisma.customerAccount.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        orgId,
        name: c.name,
        email: c.email,
        phone: c.phone,
        creditLimit: c.creditLimit,
      },
    });
  }
  console.log(`    ✅ ${customerData.length} customers created`);

  // Create 14 customer invoices (mix of statuses including PARTIALLY_PAID for M8.4)
  const now = new Date();
  const invoiceData = [
    { num: 'INV-001', customerIdx: 0, days: -50, amount: 1500000, status: 'PAID', paidAmount: 1770000 }, // total with tax
    { num: 'INV-002', customerIdx: 1, days: -45, amount: 3200000, status: 'PAID', paidAmount: 3776000 },
    { num: 'INV-003', customerIdx: 2, days: -40, amount: 2800000, status: 'PARTIALLY_PAID', paidAmount: 2000000 }, // M8.4
    { num: 'INV-004', customerIdx: 3, days: -35, amount: 1200000, status: 'OPEN', paidAmount: 0 },
    { num: 'INV-005', customerIdx: 4, days: -30, amount: 5500000, status: 'PARTIALLY_PAID', paidAmount: 4000000 }, // M8.4
    { num: 'INV-006', customerIdx: 0, days: -25, amount: 980000, status: 'OPEN', paidAmount: 0 },
    { num: 'INV-007', customerIdx: 1, days: -20, amount: 2100000, status: 'DRAFT', paidAmount: 0 },
    { num: 'INV-008', customerIdx: 2, days: -15, amount: 1750000, status: 'DRAFT', paidAmount: 0 },
    { num: 'INV-009', customerIdx: 3, days: -10, amount: 890000, status: 'DRAFT', paidAmount: 0 },
    { num: 'INV-010', customerIdx: 4, days: -5, amount: 4200000, status: 'DRAFT', paidAmount: 0 },
    { num: 'INV-011', customerIdx: 0, days: -55, amount: 1650000, status: 'VOID', paidAmount: 0 },
    { num: 'INV-012', customerIdx: 1, days: -2, amount: 2950000, status: 'DRAFT', paidAmount: 0 },
    { num: 'INV-013', customerIdx: 2, days: -28, amount: 1400000, status: 'PARTIALLY_PAID', paidAmount: 800000 }, // M8.4
    { num: 'INV-014', customerIdx: 3, days: -32, amount: 2200000, status: 'OPEN', paidAmount: 0 },
  ];

  for (const inv of invoiceData) {
    const invoiceDate = new Date(now.getTime() + inv.days * 24 * 60 * 60 * 1000);
    const dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const customer = customerData[inv.customerIdx];
    const invoiceId = `00000000-0000-4000-8000-ci${orgId.slice(-4)}${inv.num.slice(-3)}`;

    await prisma.customerInvoice.upsert({
      where: { id: invoiceId },
      update: {},
      create: {
        id: invoiceId,
        orgId,
        customerId: customer.id,
        number: inv.num,
        invoiceDate,
        dueDate,
        subtotal: inv.amount,
        tax: Math.round(inv.amount * 0.18),
        total: Math.round(inv.amount * 1.18),
        paidAmount: inv.paidAmount, // M8.4: Track paid amount
        status: inv.status as 'DRAFT' | 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'VOID',
        memo: `${customer.name} - ${inv.num}`,
      },
    });
  }
  console.log(`    ✅ ${invoiceData.length} customer invoices created`);
}

/**
 * Main demo seeding function
 */
export async function seedDemo(prisma: PrismaClient): Promise<void> {
  // Safety check: only seed demo data if explicitly enabled or not in production
  const shouldSeed = process.env.SEED_DEMO_DATA === 'true' || process.env.NODE_ENV !== 'production';

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
  await seedChartOfAccounts(prisma, TAPAS_ORG.id);
  await seedFiscalPeriods(prisma, TAPAS_ORG.id);
  await seedVendorsAndBills(prisma, TAPAS_ORG.id);
  await seedCustomersAndInvoices(prisma, TAPAS_ORG.id);

  // Seed Cafesserie
  await seedOrg(prisma, CAFESSERIE_ORG, CAFESSERIE_BRANCHES, CAFESSERIE_DEMO_USERS);
  await seedChartOfAccounts(prisma, CAFESSERIE_ORG.id);
  await seedFiscalPeriods(prisma, CAFESSERIE_ORG.id);
  await seedVendorsAndBills(prisma, CAFESSERIE_ORG.id);
  await seedCustomersAndInvoices(prisma, CAFESSERIE_ORG.id);

  // Seed workforce data (M10.2)
  await seedWorkforce(prisma);

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
    const pin = (user as { pin?: string }).pin ? ` (PIN: ${(user as { pin?: string }).pin})` : '';
    console.log(`   ${user.email.padEnd(35)} / ${DEMO_PASSWORD}${pin}`);
  });

  console.log('\n📍 Cafesserie:');
  CAFESSERIE_DEMO_USERS.forEach((user) => {
    const pin = (user as { pin?: string }).pin ? ` (PIN: ${(user as { pin?: string }).pin})` : '';
    console.log(`   ${user.email.padEnd(35)} / ${DEMO_PASSWORD}${pin}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Password for all demo users: Demo#123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}
