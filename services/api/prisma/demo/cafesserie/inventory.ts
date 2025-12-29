/**
 * Cafesserie Inventory Seeding Module
 * 
 * Seeds inventory items and initial stock levels for Cafesserie.
 * Items are org-scoped and shared across all branches.
 */

import { PrismaClient } from '@prisma/client';
import { 
  ORG_CAFESSERIE_ID, 
  BRANCH_CAFE_VILLAGE_MALL_ID,
  BRANCH_CAFE_ACACIA_MALL_ID,
  BRANCH_CAFE_ARENA_MALL_ID,
  BRANCH_CAFE_MOMBASA_ID,
} from '../constants';
import inventoryData from '../data/cafesserie-inventory.json';

/**
 * Seeds Cafesserie inventory items and stock batches for all branches
 */
export async function seedCafesserieInventory(prisma: PrismaClient): Promise<void> {
  console.log('  📦 Seeding Cafesserie inventory...');

  // Define all Cafesserie branches
  const branchIds = [
    BRANCH_CAFE_VILLAGE_MALL_ID,
    BRANCH_CAFE_ACACIA_MALL_ID,
    BRANCH_CAFE_ARENA_MALL_ID,
    BRANCH_CAFE_MOMBASA_ID,
  ];

  let totalItemCount = 0;
  let totalStockCount = 0;

  // First, create org-scoped inventory items (once)
  for (const itemData of inventoryData.items) {
    // Upsert inventory item by SKU
    await prisma.inventoryItem.upsert({
      where: {
        orgId_sku: {
          orgId: ORG_CAFESSERIE_ID,
          sku: itemData.sku,
        },
      },
      update: {
        name: itemData.name,
        unit: itemData.unit,
        category: itemData.category,
        reorderLevel: itemData.reorderLevel,
        reorderQty: itemData.reorderQty,
        isActive: true,
      },
      create: {
        orgId: ORG_CAFESSERIE_ID,
        sku: itemData.sku,
        name: itemData.name,
        unit: itemData.unit,
        category: itemData.category,
        reorderLevel: itemData.reorderLevel,
        reorderQty: itemData.reorderQty,
        isActive: true,
      },
    });
    totalItemCount++;
  }

  // Then, create stock batches for each branch
  for (const branchId of branchIds) {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      console.error(`    ❌ Branch ${branchId} not found`);
      continue;
    }

    let branchStockCount = 0;

    for (const itemData of inventoryData.items) {
      // Find the inventory item we just upserted
      const inventoryItem = await prisma.inventoryItem.findUnique({
        where: {
          orgId_sku: {
            orgId: ORG_CAFESSERIE_ID,
            sku: itemData.sku,
          },
        },
      });

      if (!inventoryItem) continue;

      // Create initial stock batch if initialStock is defined
      if (itemData.initialStock && itemData.initialStock > 0) {
        // Check if stock batch already exists for this item in this branch
        const existingBatch = await prisma.stockBatch.findFirst({
          where: {
            branchId: branch.id,
            itemId: inventoryItem.id,
            batchNumber: `SEED-${itemData.sku}`,
          },
        });

        if (!existingBatch) {
          await prisma.stockBatch.create({
            data: {
              orgId: ORG_CAFESSERIE_ID,
              branchId: branch.id,
              itemId: inventoryItem.id,
              batchNumber: `SEED-${itemData.sku}`,
              receivedQty: itemData.initialStock,
              remainingQty: itemData.initialStock,
              unitCost: itemData.unitCost,
              receivedAt: new Date(),
            },
          });

          branchStockCount++;
        } else {
          // Update existing batch to refresh stock levels
          await prisma.stockBatch.update({
            where: { id: existingBatch.id },
            data: {
              receivedQty: itemData.initialStock,
              remainingQty: itemData.initialStock,
              unitCost: itemData.unitCost,
            },
          });

          branchStockCount++;
        }
      }
    }

    totalStockCount += branchStockCount;
    console.log(`    ✅ Branch ${branch.name}: ${branchStockCount} stock batches`);
  }

  console.log(`    ✅ Total: ${totalItemCount} inventory items, ${totalStockCount} stock batches across ${branchIds.length} branches`);
}
