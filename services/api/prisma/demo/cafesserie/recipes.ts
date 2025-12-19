/**
 * Cafesserie Recipes Seeding Module
 * 
 * Seeds recipe ingredient mappings for Cafesserie menu items across all branches.
 * Maps each menu item to its required inventory ingredients with proper quantities.
 */

import { PrismaClient } from '@prisma/client';
import { 
  BRANCH_CAFESSERIE_VILLAGE_ID,
  BRANCH_CAFESSERIE_ACACIA_ID,
  BRANCH_CAFESSERIE_ARENA_ID,
  BRANCH_CAFESSERIE_MOMBASA_ID,
  ORG_CAFESSERIE_ID
} from '../constants';
import recipesData from '../data/cafesserie-recipes.json';

const CAFESSERIE_BRANCHES = [
  BRANCH_CAFESSERIE_VILLAGE_ID,
  BRANCH_CAFESSERIE_ACACIA_ID,
  BRANCH_CAFESSERIE_ARENA_ID,
  BRANCH_CAFESSERIE_MOMBASA_ID,
];

/**
 * Seeds Cafesserie recipe ingredients for all branches
 */
export async function seedCafesserieRecipes(prisma: PrismaClient): Promise<void> {
  console.log('  🧪 Seeding Cafesserie recipes...');

  let totalRecipeCount = 0;
  let totalIngredientCount = 0;
  let skippedCount = 0;

  // Seed recipes for each branch
  for (const branchId of CAFESSERIE_BRANCHES) {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      console.warn(`    ⚠️  Branch not found: ${branchId}`);
      continue;
    }

    let branchRecipeCount = 0;
    let branchIngredientCount = 0;

    for (const recipe of recipesData) {
      // Find menu item by name in this branch
      const menuItem = await prisma.menuItem.findFirst({
        where: {
          branchId: branch.id,
          name: recipe.menuName,
        },
      });

      if (!menuItem) {
        // Only warn once (for first branch)
        if (branchId === CAFESSERIE_BRANCHES[0]) {
          console.warn(`    ⚠️  Menu item not found: ${recipe.menuSku} - ${recipe.menuName}`);
          skippedCount++;
        }
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
              orgId: ORG_CAFESSERIE_ID,
              sku: ingredient.inventorySku,
            },
          },
        });

        if (!inventoryItem) {
          if (branchId === CAFESSERIE_BRANCHES[0]) {
            console.warn(`    ⚠️  Inventory item not found: ${ingredient.inventorySku} for ${recipe.menuName}`);
          }
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

        branchIngredientCount++;
      }

      branchRecipeCount++;
    }

    totalRecipeCount += branchRecipeCount;
    totalIngredientCount += branchIngredientCount;

    console.log(`    ✅ ${branch.name}: ${branchRecipeCount} recipes, ${branchIngredientCount} ingredients`);
  }

  console.log(`    ✅ Total: ${totalRecipeCount} recipes with ${totalIngredientCount} ingredient mappings`);
  if (skippedCount > 0) {
    console.log(`    ⚠️  Skipped ${skippedCount} unique recipes (menu items not found)`);
  }
}
