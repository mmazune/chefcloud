/**
 * Cafesserie Menu Seeding Module
 * 
 * Seeds menu categories and items for all Cafesserie branches from deterministic JSON data.
 * All data is idempotent and uses stable SKUs for deduplication.
 */

import { PrismaClient } from '@prisma/client';
import {
  BRANCH_CAFE_VILLAGE_MALL_ID,
  BRANCH_CAFE_ACACIA_MALL_ID,
  BRANCH_CAFE_ARENA_MALL_ID,
  BRANCH_CAFE_MOMBASA_ID,
  ORG_CAFESSERIE_ID,
} from '../constants';
import menuData from '../data/cafesserie-menu.json';

/**
 * Seeds Cafesserie menu for all branches
 */
export async function seedCafesserieMenu(prisma: PrismaClient): Promise<void> {
  console.log('  📋 Seeding Cafesserie menu...');

  const branchIds = [
    BRANCH_CAFE_VILLAGE_MALL_ID,
    BRANCH_CAFE_ACACIA_MALL_ID,
    BRANCH_CAFE_ARENA_MALL_ID,
    BRANCH_CAFE_MOMBASA_ID,
  ];

  // Get or create tax category
  const taxCategory = await prisma.taxCategory.upsert({
    where: { id: 'tax-cafe-18' },
    update: {},
    create: {
      id: 'tax-cafe-18',
      orgId: ORG_CAFESSERIE_ID,
      name: 'VAT 18%',
      rate: 18.0,
    },
  });

  // Seed each branch (menu items are branch-scoped)
  for (const branchId of branchIds) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    
    if (!branch) {
      console.warn(`    ⚠️  Branch ${branchId} not found`);
      continue;
    }

    // Create categories for this branch
    const categoryMap = new Map<string, string>();
    
    for (const catData of menuData.categories) {
      // Find existing category by branchId + name
      let category = await prisma.category.findFirst({
        where: {
          branchId: branch.id,
          name: catData.name,
        },
      });

      if (category) {
        // Update existing
        category = await prisma.category.update({
          where: { id: category.id },
          data: {
            sortOrder: catData.sortOrder,
            isActive: true,
          },
        });
      } else {
        // Create new
        category = await prisma.category.create({
          data: {
            orgId: ORG_CAFESSERIE_ID,
            branchId: branch.id,
            name: catData.name,
            sortOrder: catData.sortOrder,
            isActive: true,
          },
        });
      }
      
      categoryMap.set(catData.slug, category.id);
    }

    // Create menu items for this branch
    for (const itemData of menuData.items) {
      const categoryId = categoryMap.get(itemData.category);
      
      if (!categoryId) {
        console.warn(`    ⚠️  Category '${itemData.category}' not found for item ${itemData.sku}`);
        continue;
      }

      // Find existing item by name + branchId
      const existingItem = await prisma.menuItem.findFirst({
        where: {
          branchId: branch.id,
          name: itemData.name,
        },
      });

      // Apply small deterministic price variation per branch (0-5%)
      // Use branch ID hash to determine variation (deterministic)
      const branchIndex = branchIds.indexOf(branchId);
      const priceMultiplier = 1 + (branchIndex * 0.01); // 0%, 1%, 2%, 3%
      const adjustedPrice = Math.round(itemData.price * priceMultiplier);

      if (existingItem) {
        await prisma.menuItem.update({
          where: { id: existingItem.id },
          data: {
            categoryId,
            description: itemData.description,
            itemType: itemData.itemType as 'FOOD' | 'DRINK',
            station: itemData.station as any,
            price: adjustedPrice,
            taxCategoryId: taxCategory.id,
            isAvailable: true,
            metadata: { sku: itemData.sku, branch: branch.name },
          },
        });
      } else {
        await prisma.menuItem.create({
          data: {
            orgId: ORG_CAFESSERIE_ID,
            branchId: branch.id,
            categoryId,
            name: itemData.name,
            description: itemData.description,
            itemType: itemData.itemType as 'FOOD' | 'DRINK',
            station: itemData.station as any,
            price: adjustedPrice,
            taxCategoryId: taxCategory.id,
            isAvailable: true,
            metadata: { sku: itemData.sku, branch: branch.name },
          },
        });
      }
    }

    console.log(`    ✅ ${branch.name}: ${menuData.categories.length} categories, ${menuData.items.length} items`);
  }
}
