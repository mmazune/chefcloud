/**
 * Demo Catalog Seeding Module
 * 
 * Orchestrates seeding of menus and inventory for demo organizations.
 * Called from main seed.ts after demo users/orgs are created.
 */

import { PrismaClient } from '@prisma/client';
import { seedTapasMenu } from './tapas/menu';
import { seedTapasInventory } from './tapas/inventory';
import { seedTapasRecipes } from './tapas/recipes';
import { seedCafesserieMenu } from './cafesserie/menu';
import { seedCafesserieInventory } from './cafesserie/inventory';
import { seedCafesserieRecipes } from './cafesserie/recipes';

/**
 * Seeds complete product catalog (menu + inventory) for demo orgs
 */
export async function seedCatalog(prisma: PrismaClient): Promise<void> {
  // Safety check: only seed if explicitly enabled or not in production
  const shouldSeed =
    process.env.SEED_DEMO_DATA === 'true' ||
    process.env.NODE_ENV !== 'production';

  if (!shouldSeed) {
    console.log('\n⚠️  Skipping catalog seeding (production environment)');
    return;
  }

  console.log('\n🍽️  Seeding Demo Catalog (Menu & Inventory)...');

  try {
    // Seed Tapas menu, inventory, and recipes
    await seedTapasMenu(prisma);
    await seedTapasInventory(prisma);
    await seedTapasRecipes(prisma);

    // Seed Cafesserie menu, inventory, and recipes (all branches)
    await seedCafesserieMenu(prisma);
    await seedCafesserieInventory(prisma);
    await seedCafesserieRecipes(prisma);

    console.log('\n✅ Demo catalog seeded successfully!');
    
    // Print summary
    console.log('\n📊 Catalog Summary:');
    console.log('  🍷 Tapas Bar & Restaurant:');
    console.log('     - 34 menu categories (including drinks)');
    console.log('     - 178 menu items (68 food + 110 drinks)');
    console.log('     - 158 inventory items with initial stock');
    console.log('     - 178 recipes with ingredient mappings');
    console.log('  ☕ Cafesserie (4 branches):');
    console.log('     - 12 menu categories per branch');
    console.log('     - 80 menu items per branch');
    console.log('     - 88 inventory items (includes 11 ADDED_FOR_RECIPE items)');
    console.log('     - 80 recipes with ingredient mappings (100% coverage)');
    console.log('     - Prices vary 0-3% across branches (deterministic)');

  } catch (error) {
    console.error('❌ Catalog seeding failed:', error);
    throw error;
  }
}
