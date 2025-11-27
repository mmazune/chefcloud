import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface CsvRow {
  category?: string;
  item_name: string;
  item_sku?: string;
  unit: string;
  base_cost?: number;
  reorder_level?: number;
  reorder_qty?: number;
  // Recipe fields (optional)
  recipe_parent_sku?: string;
  recipe_qty?: number;
  waste_pct?: number;
}

export interface ImportResult {
  itemsCreated: number;
  itemsUpdated: number;
  recipesCreated: number;
  errors: Array<{ row: number; error: string }>;
}

@Injectable()
export class CsvImportService {
  private readonly logger = new Logger(CsvImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Import inventory items and recipes from CSV data
   */
  async importFromCsv(orgId: string, branchId: string, rows: CsvRow[]): Promise<ImportResult> {
    this.logger.log(`Importing ${rows.length} rows for org ${orgId}, branch ${branchId}`);

    const result: ImportResult = {
      itemsCreated: 0,
      itemsUpdated: 0,
      recipesCreated: 0,
      errors: [],
    };

    // Pass 1: Create/update inventory items
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      try {
        // Validate required fields
        if (!row.item_name || !row.unit) {
          result.errors.push({
            row: rowNum,
            error: 'Missing required fields: item_name or unit',
          });
          continue;
        }

        // Generate SKU if not provided
        const sku =
          row.item_sku ||
          row.item_name
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '-')
            .substring(0, 20) +
            '-' +
            rowNum;

        // Check if item exists
        const existing = await this.prisma.client.inventoryItem.findFirst({
          where: {
            orgId,
            sku,
          },
        });

        if (existing) {
          // Update
          await this.prisma.client.inventoryItem.update({
            where: { id: existing.id },
            data: {
              name: row.item_name,
              unit: row.unit,
              category: row.category || 'Uncategorized',
              reorderLevel: row.reorder_level || 0,
              reorderQty: row.reorder_qty || 0,
              updatedAt: new Date(),
            },
          });
          result.itemsUpdated++;
        } else {
          // Create
          await this.prisma.client.inventoryItem.create({
            data: {
              orgId,
              sku,
              name: row.item_name,
              unit: row.unit,
              category: row.category || 'Uncategorized',
              reorderLevel: row.reorder_level || 0,
              reorderQty: row.reorder_qty || 0,
              isActive: true,
            },
          });
          result.itemsCreated++;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        result.errors.push({
          row: rowNum,
          error: `Failed to import item: ${errorMsg}`,
        });
      }
    }

    // Pass 2: Create recipes
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      if (!row.recipe_parent_sku || !row.recipe_qty) {
        continue; // Not a recipe row
      }

      try {
        // Find parent menu item
        const menuItem = await this.prisma.client.menuItem.findFirst({
          where: {
            branchId,
            name: row.recipe_parent_sku, // Using name as lookup
          },
        });

        if (!menuItem) {
          result.errors.push({
            row: rowNum,
            error: `Menu item with SKU ${row.recipe_parent_sku} not found. Create menu items first.`,
          });
          continue;
        }

        // Find ingredient item
        const sku =
          row.item_sku ||
          row.item_name
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '-')
            .substring(0, 20) +
            '-' +
            rowNum;

        const ingredient = await this.prisma.client.inventoryItem.findFirst({
          where: {
            orgId,
            sku,
          },
        });

        if (!ingredient) {
          result.errors.push({
            row: rowNum,
            error: `Ingredient with SKU ${sku} not found`,
          });
          continue;
        }

        // Check if recipe already exists
        const existingRecipe = await this.prisma.client.recipeIngredient.findFirst({
          where: {
            menuItemId: menuItem.id,
            itemId: ingredient.id,
          },
        });

        if (!existingRecipe) {
          await this.prisma.client.recipeIngredient.create({
            data: {
              menuItemId: menuItem.id,
              itemId: ingredient.id,
              qtyPerUnit: row.recipe_qty,
              wastePct: row.waste_pct || 0,
            },
          });
          result.recipesCreated++;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        result.errors.push({
          row: rowNum,
          error: `Failed to create recipe: ${errorMsg}`,
        });
      }
    }

    this.logger.log(
      `Import complete: ${result.itemsCreated} items created, ${result.itemsUpdated} updated, ${result.recipesCreated} recipes created, ${result.errors.length} errors`,
    );

    return result;
  }

  /**
   * Validate CSV structure
   */
  validateCsvStructure(rows: any[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(rows) || rows.length === 0) {
      errors.push('CSV must contain at least one row');
      return { valid: false, errors };
    }

    // Check required columns in first row
    const firstRow = rows[0];
    if (!firstRow.item_name) {
      errors.push('Missing required column: item_name');
    }
    if (!firstRow.unit) {
      errors.push('Missing required column: unit');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
