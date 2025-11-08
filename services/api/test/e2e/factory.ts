import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

/**
 * E2E Test Data Factory
 * Hermetic seed data for parallel E2E test execution.
 * Each factory function is idempotent (upsert) and returns IDs for test use.
 * 
 * IMPORTANT: All functions accept PrismaClient from DI (TestingModule).
 * Do NOT create new PrismaClient() instances.
 */

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
  });
}

export interface FactoryOrg {
  orgId: string;
  branchId: string;
  users: {
    owner: { id: string; email: string; token?: string };
    manager: { id: string; email: string; token?: string };
    supervisor: { id: string; email: string; token?: string };
    waiter: { id: string; email: string; token?: string };
    chef: { id: string; email: string; token?: string };
  };
}

/**
 * Get stable seed IDs for E2E tests
 */
export function getSeedIds(slug: string) {
  return {
    orgId: `org-${slug}`,
    branchId: `branch-${slug}`,
    floorPlanId: `floor-${slug}`,
    users: {
      ownerId: `user-owner-${slug}`,
      managerId: `user-manager-${slug}`,
      supervisorId: `user-supervisor-${slug}`,
      waiterId: `user-waiter-${slug}`,
      chefId: `user-chef-${slug}`,
    },
    menuItems: {
      burgerId: `item-burger-${slug}`,
      friesId: `item-fries-${slug}`,
      colaId: `item-cola-${slug}`,
    },
  };
}

/**
 * Create org + branch + users (L1-L5)
 * @param prisma PrismaClient from DI (TestingModule)
 * @param slug Unique org slug (e.g., 'test-org-pos')
 */
export async function createOrgWithUsers(
  prisma: PrismaClient,
  slug: string,
): Promise<FactoryOrg> {
  // Create org
  const org = await prisma.org.upsert({
    where: { slug },
    update: {},
    create: {
      name: `Test Org ${slug}`,
      slug,
    },
  });

  // Create org settings
  await prisma.orgSettings.upsert({
    where: { orgId: org.id },
    update: {},
    create: {
      orgId: org.id,
      vatPercent: 18.0,
      currency: 'UGX',
      platformAccess: {
        WAITER: { desktop: true, web: false, mobile: false },
        CASHIER: { desktop: true, web: false, mobile: false },
        SUPERVISOR: { desktop: true, web: false, mobile: false },
        HEAD_CHEF: { desktop: true, web: false, mobile: true },
        MANAGER: { desktop: false, web: true, mobile: true },
        OWNER: { desktop: false, web: true, mobile: true },
      },
    },
  });

  // Create branch
  const branch = await prisma.branch.upsert({
    where: { id: `${slug}-branch` },
    update: {},
    create: {
      id: `${slug}-branch`,
      orgId: org.id,
      name: 'Main Branch',
      address: 'Kampala, Uganda',
      timezone: 'Africa/Kampala',
    },
  });

  // Create users
  const owner = await prisma.user.upsert({
    where: { email: `owner-${slug}@test.local` },
    update: {},
    create: {
      email: `owner-${slug}@test.local`,
      passwordHash: await hashPassword('Test#123'),
      firstName: 'Owner',
      lastName: slug,
      roleLevel: 'L5',
      orgId: org.id,
      branchId: branch.id,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: `manager-${slug}@test.local` },
    update: {},
    create: {
      email: `manager-${slug}@test.local`,
      passwordHash: await hashPassword('Test#123'),
      firstName: 'Manager',
      lastName: slug,
      roleLevel: 'L4',
      orgId: org.id,
      branchId: branch.id,
    },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: `supervisor-${slug}@test.local` },
    update: {},
    create: {
      email: `supervisor-${slug}@test.local`,
      passwordHash: await hashPassword('Test#123'),
      firstName: 'Supervisor',
      lastName: slug,
      roleLevel: 'L2',
      orgId: org.id,
      branchId: branch.id,
    },
  });

  const waiter = await prisma.user.upsert({
    where: { email: `waiter-${slug}@test.local` },
    update: {},
    create: {
      email: `waiter-${slug}@test.local`,
      passwordHash: await hashPassword('Test#123'),
      firstName: 'Waiter',
      lastName: slug,
      roleLevel: 'L1',
      orgId: org.id,
      branchId: branch.id,
    },
  });

  const chef = await prisma.user.upsert({
    where: { email: `chef-${slug}@test.local` },
    update: {},
    create: {
      email: `chef-${slug}@test.local`,
      passwordHash: await hashPassword('Test#123'),
      firstName: 'Chef',
      lastName: slug,
      roleLevel: 'L3',
      orgId: org.id,
      branchId: branch.id,
    },
  });

  return {
    orgId: org.id,
    branchId: branch.id,
    users: {
      owner: { id: owner.id, email: owner.email },
      manager: { id: manager.id, email: manager.email },
      supervisor: { id: supervisor.id, email: supervisor.email },
      waiter: { id: waiter.id, email: waiter.email },
      chef: { id: chef.id, email: chef.email },
    },
  };
}

/**
 * Create menu items (burger, fries, cola)
 */
export async function createMenu(
  prisma: PrismaClient,
  orgId: string,
  branchId: string,
) {
  const burger = await prisma.menuItem.upsert({
    where: { id: `burger-${orgId}` },
    update: {},
    create: {
      id: `burger-${orgId}`,
      branchId,
      name: 'Burger',
      itemType: 'FOOD',
      price: 15000,
      isAvailable: true,
    },
  });

  const fries = await prisma.menuItem.upsert({
    where: { id: `fries-${orgId}` },
    update: {},
    create: {
      id: `fries-${orgId}`,
      branchId,
      name: 'Fries',
      itemType: 'FOOD',
      price: 5000,
      isAvailable: true,
    },
  });

  const cola = await prisma.menuItem.upsert({
    where: { id: `cola-${orgId}` },
    update: {},
    create: {
      id: `cola-${orgId}`,
      branchId,
      name: 'Cola',
      itemType: 'DRINK',
      price: 3000,
      isAvailable: true,
    },
  });

  return { burger, fries, cola };
}

/**
 * Create floor plan with 2 tables
 */
export async function createFloor(
  prisma: PrismaClient,
  orgId: string,
  branchId: string,
) {
  const floorPlan = await prisma.floorPlan.upsert({
    where: { id: `floor-e2e-${orgId}` },
    update: {},
    create: {
      id: `floor-e2e-${orgId}`,
      orgId,
      name: 'Main Floor',
      isActive: true,
      data: {
        version: 1,
        grid: { rows: 8, cols: 10 },
        tables: [
          { id: 'T1', x: 1, y: 1, seats: 4 },
          { id: 'T2', x: 3, y: 1, seats: 2 },
        ],
      },
    },
  });

  const table1 = await prisma.table.upsert({
    where: { id: `table1-${branchId}` },
    update: {},
    create: {
      id: `table1-${branchId}`,
      orgId,
      branchId,
      floorPlanId: floorPlan.id,
      label: 'T1',
      capacity: 4,
      status: 'AVAILABLE',
      metadata: { x: 0, y: 0 },
    },
  });

  const table2 = await prisma.table.upsert({
    where: { id: `table2-${branchId}` },
    update: {},
    create: {
      id: `table2-${branchId}`,
      orgId,
      branchId,
      floorPlanId: floorPlan.id,
      label: 'T2',
      capacity: 2,
      status: 'AVAILABLE',
      metadata: { x: 100, y: 0 },
    },
  });

  return { floorPlan, table1, table2 };
}

/**
 * Create inventory items (beef, potatoes)
 */
export async function createInventory(prisma: PrismaClient, orgId: string) {
  const beef = await prisma.inventoryItem.upsert({
    where: { id: `beef-${orgId}` },
    update: {},
    create: {
      id: `beef-${orgId}`,
      orgId,
      name: 'Beef',
      sku: 'BEEF-001',
      unit: 'kg',
      reorderLevel: 20,
      reorderQty: 50,
    },
  });

  const potatoes = await prisma.inventoryItem.upsert({
    where: { id: `potatoes-${orgId}` },
    update: {},
    create: {
      id: `potatoes-${orgId}`,
      orgId,
      name: 'Potatoes',
      sku: 'POT-001',
      unit: 'kg',
      reorderLevel: 30,
      reorderQty: 100,
    },
  });

  return { beef, potatoes };
}

/**
 * Create event (concert, sports match)
 */
export async function createEvent(
  prisma: PrismaClient,
  orgId: string,
  branchId: string,
) {
  const event = await prisma.event.upsert({
    where: { id: `event-${orgId}` },
    update: {},
    create: {
      id: `event-${orgId}`,
      orgId,
      branchId,
      slug: `e2e-event-${orgId}`,
      title: 'Test Event',
      description: 'E2E test event',
      startsAt: new Date('2025-12-01T18:00:00Z'),
      endsAt: new Date('2025-12-01T23:00:00Z'),
      isPublished: true,
    },
  });

  return event;
}

/**
 * Create chart of accounts for accounting tests
 */
export async function createChartOfAccounts(
  prisma: PrismaClient,
  orgId: string,
) {
  const accounts = [
    { code: '1100', name: 'Cash', type: 'ASSET' },
    { code: '1200', name: 'Accounts Receivable', type: 'ASSET' },
    { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
    { code: '3000', name: 'Equity', type: 'EQUITY' },
    { code: '4000', name: 'Sales Revenue', type: 'REVENUE' },
    { code: '5000', name: 'Cost of Goods Sold', type: 'COGS' },
    { code: '6000', name: 'Operating Expenses', type: 'EXPENSE' },
  ];

  const created = [];
  for (const acc of accounts) {
    const account = await prisma.account.upsert({
      where: { orgId_code: { orgId, code: acc.code } },
      update: {},
      create: {
        orgId,
        code: acc.code,
        name: acc.name,
        type: acc.type,
      },
    });
    created.push(account);
  }

  return created;
}

/**
 * Clean up test data for a specific org
 */
export async function cleanupOrg(prisma: PrismaClient, orgId: string) {
  await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
}

/**
 * Disconnect Prisma client (now a no-op since we use DI'd client)
 * Kept for backward compatibility with existing tests.
 */
export async function disconnect(prisma?: PrismaClient) {
  if (prisma) {
    await prisma.$disconnect();
  }
}
