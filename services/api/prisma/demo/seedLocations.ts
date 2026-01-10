/**
 * Demo Inventory Locations Seeding Module
 *
 * Seeds default InventoryLocation records for demo organizations.
 * These are required for inventory operations like waste, receipts, transfers.
 *
 * IDEMPOTENCY: Uses upsert with unique (branchId, code) constraint.
 */

import { PrismaClient } from '@prisma/client';
import {
  ORG_TAPAS_ID,
  ORG_CAFESSERIE_ID,
  BRANCH_TAPAS_MAIN_ID,
  BRANCH_CAFE_VILLAGE_MALL_ID,
  BRANCH_CAFE_ACACIA_MALL_ID,
  BRANCH_CAFE_ARENA_MALL_ID,
  BRANCH_CAFE_MOMBASA_ID,
  // Location IDs
  LOC_TAPAS_MAIN_ID,
  LOC_TAPAS_KITCHEN_ID,
  LOC_TAPAS_BAR_ID,
  LOC_CAFE_VM_MAIN_ID,
  LOC_CAFE_AM_MAIN_ID,
  LOC_CAFE_ARM_MAIN_ID,
  LOC_CAFE_MOM_MAIN_ID,
} from './constants';

interface LocationData {
  id: string;
  orgId: string;
  branchId: string;
  code: string;
  name: string;
  locationType: string;
}

const TAPAS_LOCATIONS: LocationData[] = [
  {
    id: LOC_TAPAS_MAIN_ID,
    orgId: ORG_TAPAS_ID,
    branchId: BRANCH_TAPAS_MAIN_ID,
    code: 'MAIN',
    name: 'Main Storage',
    locationType: 'STORAGE',
  },
  {
    id: LOC_TAPAS_KITCHEN_ID,
    orgId: ORG_TAPAS_ID,
    branchId: BRANCH_TAPAS_MAIN_ID,
    code: 'KITCHEN',
    name: 'Kitchen',
    locationType: 'PRODUCTION',
  },
  {
    id: LOC_TAPAS_BAR_ID,
    orgId: ORG_TAPAS_ID,
    branchId: BRANCH_TAPAS_MAIN_ID,
    code: 'BAR',
    name: 'Bar Storage',
    locationType: 'STORAGE',
  },
];

const CAFESSERIE_LOCATIONS: LocationData[] = [
  {
    id: LOC_CAFE_VM_MAIN_ID,
    orgId: ORG_CAFESSERIE_ID,
    branchId: BRANCH_CAFE_VILLAGE_MALL_ID,
    code: 'MAIN',
    name: 'Main Storage',
    locationType: 'STORAGE',
  },
  {
    id: LOC_CAFE_AM_MAIN_ID,
    orgId: ORG_CAFESSERIE_ID,
    branchId: BRANCH_CAFE_ACACIA_MALL_ID,
    code: 'MAIN',
    name: 'Main Storage',
    locationType: 'STORAGE',
  },
  {
    id: LOC_CAFE_ARM_MAIN_ID,
    orgId: ORG_CAFESSERIE_ID,
    branchId: BRANCH_CAFE_ARENA_MALL_ID,
    code: 'MAIN',
    name: 'Main Storage',
    locationType: 'STORAGE',
  },
  {
    id: LOC_CAFE_MOM_MAIN_ID,
    orgId: ORG_CAFESSERIE_ID,
    branchId: BRANCH_CAFE_MOMBASA_ID,
    code: 'MAIN',
    name: 'Main Storage',
    locationType: 'STORAGE',
  },
];

/**
 * Seeds InventoryLocation records for Tapas org
 */
async function seedTapasLocations(prisma: PrismaClient): Promise<void> {
  console.log('  📍 Seeding Tapas inventory locations...');

  for (const loc of TAPAS_LOCATIONS) {
    await prisma.inventoryLocation.upsert({
      where: {
        id: loc.id,
      },
      update: {
        name: loc.name,
        locationType: loc.locationType,
      },
      create: loc,
    });
  }

  console.log(`    ✅ Created/updated ${TAPAS_LOCATIONS.length} Tapas locations`);
}

/**
 * Seeds InventoryLocation records for Cafesserie org
 */
async function seedCafesserieLocations(prisma: PrismaClient): Promise<void> {
  console.log('  📍 Seeding Cafesserie inventory locations...');

  for (const loc of CAFESSERIE_LOCATIONS) {
    await prisma.inventoryLocation.upsert({
      where: {
        id: loc.id,
      },
      update: {
        name: loc.name,
        locationType: loc.locationType,
      },
      create: loc,
    });
  }

  console.log(`    ✅ Created/updated ${CAFESSERIE_LOCATIONS.length} Cafesserie locations`);
}

/**
 * Main function to seed all inventory locations
 */
export async function seedInventoryLocations(prisma: PrismaClient): Promise<void> {
  console.log('\n📍 Seeding Inventory Locations...');

  await seedTapasLocations(prisma);
  await seedCafesserieLocations(prisma);

  console.log('  ✅ Inventory locations seeded for all branches');
}
