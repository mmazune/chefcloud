/**
 * Tapas Recipes Seeding Module
 * 
 * Seeds recipe ingredient mappings for Tapas menu items.
 * Maps each menu item to its required inventory ingredients with proper quantities.
 */

import { PrismaClient } from '@prisma/client';
import { BRANCH_TAPAS_MAIN_ID, ORG_TAPAS_ID } from '../constants';
import recipesData from '../data/tapas-recipes.json';

/**
 * Seeds Tapas recipe ingredients
 */
export async function seedTapasRecipes(prisma: PrismaClient): Promise<void> {
  console.log('  🧪 Seeding Tapas recipes...');

  // Get Tapas branch
  const branch = await prisma.branch.findUnique({
    where: { id: BRANCH_TAPAS_MAIN_ID },
  });

  if (!branch) {
    console.error('    ❌ Tapas branch not found');
    return;
  }

  let recipeCount = 0;
  let ingredientCount = 0;
  let skippedCount = 0;

  for (const recipe of recipesData) {
    // Find menu item by SKU (name-based lookup since no SKU field in schema)
    const menuItem = await prisma.menuItem.findFirst({
      where: {
        branchId: branch.id,
        name: recipe.menuName,
      },
    });

    if (!menuItem) {
      console.warn(`    ⚠️  Menu item not found: ${recipe.menuSku} - ${recipe.menuName}`);
      skippedCount++;
      continue;
    }

    // Clear existing recipe ingredients for this menu item (for idempotency)
    await prisma.recipeIngredient.deleteMany({
      where: { menuItemId: menuItem.id },
    });

    // Add each ingredient
    for (const ingredient of recipe.ingredients) {
      // Find inventory item by SKU
      const inventoryItem = await prisma.inventoryItem.findUnique({
        where: {
          orgId_sku: {
            orgId: ORG_TAPAS_ID,
            sku: ingredient.inventorySku,
          },
        },
      });

      if (!inventoryItem) {
        console.warn(`    ⚠️  Inventory item not found: ${ingredient.inventorySku} for ${recipe.menuName}`);
        continue;
      }

      // Create recipe ingredient
      await prisma.recipeIngredient.create({
        data: {
          menuItemId: menuItem.id,
          itemId: inventoryItem.id,
          qtyPerUnit: ingredient.qty,
          wastePct: 0,
        },
      });

      ingredientCount++;
    }

    recipeCount++;
  }

  console.log(`    ✅ Created ${recipeCount} recipes with ${ingredientCount} ingredient mappings`);
  if (skippedCount > 0) {
    console.log(`    ⚠️  Skipped ${skippedCount} recipes (menu items not found)`);
  }
}
