/**
 * E2E Precondition Helpers - Fail-fast when required data is missing
 *
 * These helpers check for required test preconditions and throw immediately
 * with diagnostic information if data is missing, preventing infinite hangs.
 *
 * Usage:
 *   await requireTapasOrg(prisma);
 *   await requireBadges(prisma, { orgSlug: TAPAS_ORG_SLUG, minCount: 1 });
 */

import { PrismaClient } from '@chefcloud/db';
import { TAPAS_ORG_SLUG, CAFESSERIE_ORG_SLUG } from './e2e-demo-constants';

export class PreconditionError extends Error {
  constructor(
    public readonly check: string,
    public readonly activeDataset: string,
    public readonly details: Record<string, any>,
  ) {
    super(
      `Precondition failed: ${check}\n` +
        `Active dataset: ${activeDataset}\n` +
        `Details: ${JSON.stringify(details, null, 2)}\n` +
        `\nPossible fixes:\n` +
        `1. Run setup with correct dataset: E2E_DATASET=${activeDataset} pnpm test:e2e:setup\n` +
        `2. Run setup with ALL datasets: E2E_DATASET=ALL pnpm test:e2e:setup\n` +
        `3. Check that seed data matches test expectations\n`,
    );
    this.name = 'PreconditionError';
  }
}

function getActiveDataset(): string {
  return process.env.E2E_DATASET || 'DEMO_TAPAS';
}

/**
 * Require that Tapas demo org exists with basic data
 */
export async function requireTapasOrg(prisma: PrismaClient): Promise<void> {
  const org = await prisma.org.findFirst({
    where: { slug: TAPAS_ORG_SLUG },
    include: { branches: true },
  });

  if (!org) {
    throw new PreconditionError('requireTapasOrg', getActiveDataset(), {
      expected: `Org with slug "${TAPAS_ORG_SLUG}"`,
      found: null,
    });
  }

  if (org.branches.length === 0) {
    throw new PreconditionError('requireTapasOrg', getActiveDataset(), {
      expected: 'At least 1 branch for Tapas org',
      found: `Org exists but has ${org.branches.length} branches`,
    });
  }
}

/**
 * Require that Cafesserie franchise org exists with multiple branches
 */
export async function requireCafesserieFranchise(
  prisma: PrismaClient,
  options: { minBranches?: number } = {},
): Promise<void> {
  const { minBranches = 2 } = options;

  const org = await prisma.org.findFirst({
    where: { slug: CAFESSERIE_ORG_SLUG },
    include: { branches: true },
  });

  if (!org) {
    throw new PreconditionError('requireCafesserieFranchise', getActiveDataset(), {
      expected: `Org with slug "${CAFESSERIE_ORG_SLUG}"`,
      found: null,
    });
  }

  if (org.branches.length < minBranches) {
    throw new PreconditionError('requireCafesserieFranchise', getActiveDataset(), {
      expected: `At least ${minBranches} branches`,
      found: `Org exists but has ${org.branches.length} branches`,
    });
  }
}

/**
 * Require that badges exist for authentication tests
 */
export async function requireBadges(
  prisma: PrismaClient,
  options: { orgSlug?: string; minCount?: number } = {},
): Promise<void> {
  const { orgSlug = TAPAS_ORG_SLUG, minCount = 1 } = options;

  const org = await prisma.org.findFirst({
    where: { slug: orgSlug },
  });

  if (!org) {
    throw new PreconditionError('requireBadges', getActiveDataset(), {
      expected: `Org with slug "${orgSlug}"`,
      found: null,
    });
  }

  const badgeCount = await prisma.badgeAsset.count({
    where: { orgId: org.id },
  });

  if (badgeCount < minCount) {
    throw new PreconditionError('requireBadges', getActiveDataset(), {
      expected: `At least ${minCount} badges for org "${orgSlug}"`,
      found: `${badgeCount} badges`,
    });
  }
}

/**
 * Require that menu items exist for POS tests
 */
export async function requireMenuItems(
  prisma: PrismaClient,
  options: { orgSlug?: string; itemNames?: string[] } = {},
): Promise<void> {
  const { orgSlug = TAPAS_ORG_SLUG, itemNames = [] } = options;

  const org = await prisma.org.findFirst({
    where: { slug: orgSlug },
    include: { branches: true },
  });

  if (!org) {
    throw new PreconditionError('requireMenuItems', getActiveDataset(), {
      expected: `Org with slug "${orgSlug}"`,
      found: null,
    });
  }

  const branchIds = org.branches.map((b) => b.id);
  const menuItemCount = await prisma.menuItem.count({
    where: { branchId: { in: branchIds } },
  });

  if (menuItemCount === 0) {
    throw new PreconditionError('requireMenuItems', getActiveDataset(), {
      expected: 'At least 1 menu item',
      found: `${menuItemCount} menu items`,
    });
  }

  // If specific items are required, check for them
  if (itemNames.length > 0) {
    const items = await prisma.menuItem.findMany({
      where: {
        branchId: { in: branchIds },
        name: { in: itemNames },
      },
    });

    const foundNames = items.map((i) => i.name);
    const missingNames = itemNames.filter((n) => !foundNames.includes(n));

    if (missingNames.length > 0) {
      throw new PreconditionError('requireMenuItems', getActiveDataset(), {
        expected: itemNames,
        found: foundNames,
        missing: missingNames,
      });
    }
  }
}

/**
 * Require that tables/floor plan exist for POS tests
 */
export async function requireFloorPlan(
  prisma: PrismaClient,
  options: { orgSlug?: string } = {},
): Promise<void> {
  const { orgSlug = TAPAS_ORG_SLUG } = options;

  const org = await prisma.org.findFirst({
    where: { slug: orgSlug },
    include: { branches: true },
  });

  if (!org) {
    throw new PreconditionError('requireFloorPlan', getActiveDataset(), {
      expected: `Org with slug "${orgSlug}"`,
      found: null,
    });
  }

  const branchIds = org.branches.map((b) => b.id);
  const tableCount = await prisma.table.count({
    where: { branchId: { in: branchIds } },
  });

  if (tableCount === 0) {
    throw new PreconditionError('requireFloorPlan', getActiveDataset(), {
      expected: 'At least 1 table',
      found: `${tableCount} tables`,
    });
  }
}

/**
 * Require that inventory items exist for costing/recipe tests
 */
export async function requireInventory(
  prisma: PrismaClient,
  options: { orgSlug?: string; minCount?: number } = {},
): Promise<void> {
  const { orgSlug = TAPAS_ORG_SLUG, minCount = 1 } = options;

  const org = await prisma.org.findFirst({
    where: { slug: orgSlug },
  });

  if (!org) {
    throw new PreconditionError('requireInventory', getActiveDataset(), {
      expected: `Org with slug "${orgSlug}"`,
      found: null,
    });
  }

  const inventoryCount = await prisma.inventoryItem.count({
    where: { orgId: org.id },
  });

  if (inventoryCount < minCount) {
    throw new PreconditionError('requireInventory', getActiveDataset(), {
      expected: `At least ${minCount} inventory items`,
      found: `${inventoryCount} inventory items`,
    });
  }
}

/**
 * Require that users exist with proper credentials for auth tests
 */
export async function requireUsers(
  prisma: PrismaClient,
  options: { orgSlug?: string; minCount?: number; roles?: string[] } = {},
): Promise<void> {
  const { orgSlug = TAPAS_ORG_SLUG, minCount = 1, roles = [] } = options;

  const org = await prisma.org.findFirst({
    where: { slug: orgSlug },
  });

  if (!org) {
    throw new PreconditionError('requireUsers', getActiveDataset(), {
      expected: `Org with slug "${orgSlug}"`,
      found: null,
    });
  }

  const userCount = await prisma.user.count({
    where: {
      orgId: org.id,
      ...(roles.length > 0 ? { role: { in: roles } } : {}),
    },
  });

  if (userCount < minCount) {
    throw new PreconditionError('requireUsers', getActiveDataset(), {
      expected: `At least ${minCount} users${roles.length > 0 ? ` with roles ${roles.join(',')}` : ''}`,
      found: `${userCount} users`,
    });
  }
}

/**
 * Require that branches exist for multi-branch tests
 */
export async function requireBranches(
  prisma: PrismaClient,
  options: { orgSlug?: string; minCount?: number } = {},
): Promise<void> {
  const { orgSlug = TAPAS_ORG_SLUG, minCount = 1 } = options;

  const org = await prisma.org.findFirst({
    where: { slug: orgSlug },
    include: { branches: true },
  });

  if (!org) {
    throw new PreconditionError('requireBranches', getActiveDataset(), {
      expected: `Org with slug "${orgSlug}"`,
      found: null,
    });
  }

  if (org.branches.length < minCount) {
    throw new PreconditionError('requireBranches', getActiveDataset(), {
      expected: `At least ${minCount} branches`,
      found: `${org.branches.length} branches`,
    });
  }
}
