/**
 * Cafesserie Inventory Seeding Module
 * 
 * Seeds inventory items and initial stock levels for Cafesserie.
 * Items are org-scoped and shared across all branches.
 */

import { PrismaClient } from '@prisma/client';
import { ORG_CAFESSERIE_ID, BRANCH_CAFE_VILLAGE_MALL_ID } from '../constants';
import inventoryData from '../data/cafesserie-inventory.json';

/**
 * Seeds Cafesserie inventory items and stock batches
 */
export async function seedCafesserieInventory(prisma: PrismaClient): Promise<void> {
  console.log('  📦 Seeding Cafesserie inventory...');

  // Get Cafesserie Village branch (main branch for initial stock)
  const branch = await prisma.branch.findUnique({
    where: { id: BRANCH_CAFE_VILLAGE_MALL_ID },
  });

  if (!branch) {
    console.error('    ❌ Cafesserie Village branch not found');
    return;
  }

  let itemCount = 0;
  let stockCount = 0;

  // Create inventory items (org-scoped)
  for (const itemData of inventoryData.items) {
    // Upsert inventory item by SKU
    const inventoryItem = await prisma.inventoryItem.upsert({
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

    itemCount++;

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

        stockCount++;
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

        stockCount++;
      }
    }
  }

  console.log(`    ✅ Created ${itemCount} inventory items with ${stockCount} stock batches`);
}
