/**
 * Tapas Menu Seeding Module
 * 
 * Seeds menu categories and items for Tapas Bar & Restaurant from deterministic JSON data.
 * All data is idempotent and uses stable SKUs for deduplication.
 */

import { PrismaClient } from '@prisma/client';
import { BRANCH_TAPAS_MAIN_ID, ORG_TAPAS_ID } from '../constants';
import menuData from '../data/tapas-menu.json';

/**
 * Seeds Tapas menu categories and items
 */
export async function seedTapasMenu(prisma: PrismaClient): Promise<void> {
  console.log('  📋 Seeding Tapas menu...');

  // Get Tapas branch
  const branch = await prisma.branch.findUnique({
    where: { id: BRANCH_TAPAS_MAIN_ID },
  });

  if (!branch) {
    console.error('    ❌ Tapas branch not found');
    return;
  }

  // Get or create tax category
  const taxCategory = await prisma.taxCategory.upsert({
    where: { id: 'tax-tapas-18' },
    update: {},
    create: {
      id: 'tax-tapas-18',
      orgId: ORG_TAPAS_ID,
      name: 'VAT 18%',
      rate: 18.0,
    },
  });

  // Create categories - map category names to DB IDs
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
          sortOrder: catData.displayOrder,
          isActive: true,
        },
      });
    } else {
      // Create new
      category = await prisma.category.create({
        data: {
          orgId: ORG_TAPAS_ID,
          branchId: branch.id,
          name: catData.name,
          sortOrder: catData.displayOrder,
          isActive: true,
        },
      });
    }
    
    // Map category name to its DB ID for item lookups
    categoryMap.set(catData.name, category.id);
  }
  
  console.log(`    ✅ Created ${menuData.categories.length} categories`);

  // Create menu items
  let itemCount = 0;
  
  for (const itemData of menuData.items) {
    const categoryId = categoryMap.get(itemData.category);
    
    if (!categoryId) {
      console.warn(`    ⚠️  Category '${itemData.category}' not found for item ${itemData.sku}`);
      continue;
    }

    // Use SKU-based upsert for idempotency
    // Since schema doesn't have a unique constraint on SKU + branchId, we'll use a combination approach
    // First, try to find by name + branchId, then create or update
    const existingItem = await prisma.menuItem.findFirst({
      where: {
        branchId: branch.id,
        name: itemData.name,
      },
    });

    if (existingItem) {
      await prisma.menuItem.update({
        where: { id: existingItem.id },
        data: {
          categoryId,
          description: itemData.description,
          itemType: itemData.itemType as 'FOOD' | 'DRINK',
          station: itemData.station as any,
          price: itemData.price,
          taxCategoryId: taxCategory.id,
          isAvailable: true,
          metadata: { sku: itemData.sku },
        },
      });
    } else {
      await prisma.menuItem.create({
        data: {
          orgId: ORG_TAPAS_ID,
          branchId: branch.id,
          categoryId,
          name: itemData.name,
          description: itemData.description,
          itemType: itemData.itemType as 'FOOD' | 'DRINK',
          station: itemData.station as any,
          price: itemData.price,
          taxCategoryId: taxCategory.id,
          isAvailable: true,
          metadata: { sku: itemData.sku },
        },
      });
    }
    
    itemCount++;
  }

  console.log(`    ✅ Created/updated ${itemCount} menu items`);
}
