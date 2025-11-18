import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface TemplatePack {
  id: string;
  name: string;
  description: string;
  category: string;
  items: TemplateItem[];
  recipes?: TemplateRecipe[];
}

export interface TemplateItem {
  sku: string;
  name: string;
  unit: string;
  category: string;
  reorderLevel?: number;
  reorderQty?: number;
}

export interface TemplateRecipe {
  menuItemSku: string;
  ingredientSku: string;
  qtyPerUnit: number;
  wastePct?: number;
}

@Injectable()
export class TemplatePacksService {
  private readonly logger = new Logger(TemplatePacksService.name);

  // Built-in template packs
  private readonly PACKS: TemplatePack[] = [
    {
      id: 'tapas-bar-essentials',
      name: 'Tapas Bar Essentials',
      description: 'Essential inventory for a Spanish tapas bar including olives, chorizo, manchego, wines',
      category: 'Bar & Restaurant',
      items: [
        { sku: 'OLIVE-001', name: 'Green Olives', unit: 'kg', category: 'Tapas', reorderLevel: 2, reorderQty: 5 },
        { sku: 'OLIVE-002', name: 'Kalamata Olives', unit: 'kg', category: 'Tapas', reorderLevel: 1.5, reorderQty: 3 },
        { sku: 'CHOR-001', name: 'Chorizo', unit: 'kg', category: 'Meat', reorderLevel: 3, reorderQty: 10 },
        { sku: 'CHEESE-001', name: 'Manchego Cheese', unit: 'kg', category: 'Dairy', reorderLevel: 2, reorderQty: 5 },
        { sku: 'WINE-001', name: 'Rioja Red Wine', unit: 'ltr', category: 'Beverages', reorderLevel: 10, reorderQty: 24 },
        { sku: 'WINE-002', name: 'Albariño White Wine', unit: 'ltr', category: 'Beverages', reorderLevel: 8, reorderQty: 18 },
        { sku: 'OIL-001', name: 'Extra Virgin Olive Oil', unit: 'ltr', category: 'Cooking', reorderLevel: 5, reorderQty: 10 },
        { sku: 'BREAD-001', name: 'Baguette', unit: 'pcs', category: 'Bakery', reorderLevel: 20, reorderQty: 50 },
        { sku: 'TOMA-001', name: 'Cherry Tomatoes', unit: 'kg', category: 'Produce', reorderLevel: 3, reorderQty: 10 },
        { sku: 'GARL-001', name: 'Garlic', unit: 'kg', category: 'Produce', reorderLevel: 1, reorderQty: 3 },
      ],
      recipes: [
        { menuItemSku: 'TAPAS-OLIVES', ingredientSku: 'OLIVE-001', qtyPerUnit: 0.05 },
        { menuItemSku: 'TAPAS-OLIVES', ingredientSku: 'OIL-001', qtyPerUnit: 0.01 },
        { menuItemSku: 'TAPAS-CHORIZO', ingredientSku: 'CHOR-001', qtyPerUnit: 0.08 },
        { menuItemSku: 'TAPAS-CHORIZO', ingredientSku: 'BREAD-001', qtyPerUnit: 0.5 },
      ],
    },
    {
      id: 'cocktail-bar-basics',
      name: 'Cocktail Bar Basics',
      description: 'Basic spirits, mixers and garnishes for a cocktail bar',
      category: 'Bar',
      items: [
        { sku: 'VODKA-001', name: 'Premium Vodka', unit: 'ltr', category: 'Spirits', reorderLevel: 5, reorderQty: 12 },
        { sku: 'GIN-001', name: 'London Dry Gin', unit: 'ltr', category: 'Spirits', reorderLevel: 5, reorderQty: 12 },
        { sku: 'RUM-001', name: 'White Rum', unit: 'ltr', category: 'Spirits', reorderLevel: 4, reorderQty: 10 },
        { sku: 'TEQUILA-001', name: 'Silver Tequila', unit: 'ltr', category: 'Spirits', reorderLevel: 3, reorderQty: 8 },
        { sku: 'WHISKEY-001', name: 'Bourbon Whiskey', unit: 'ltr', category: 'Spirits', reorderLevel: 4, reorderQty: 10 },
        { sku: 'TRIPLE-001', name: 'Triple Sec', unit: 'ltr', category: 'Liqueurs', reorderLevel: 2, reorderQty: 6 },
        { sku: 'TONIC-001', name: 'Tonic Water', unit: 'ltr', category: 'Mixers', reorderLevel: 20, reorderQty: 48 },
        { sku: 'SODA-001', name: 'Soda Water', unit: 'ltr', category: 'Mixers', reorderLevel: 20, reorderQty: 48 },
        { sku: 'LIME-001', name: 'Fresh Limes', unit: 'kg', category: 'Garnish', reorderLevel: 3, reorderQty: 10 },
        { sku: 'MINT-001', name: 'Fresh Mint', unit: 'kg', category: 'Garnish', reorderLevel: 0.5, reorderQty: 2 },
      ],
    },
    {
      id: 'cafe-essentials',
      name: 'Café Essentials',
      description: 'Coffee, pastries and café basics',
      category: 'Café',
      items: [
        { sku: 'COFFEE-001', name: 'Coffee Beans (Arabica)', unit: 'kg', category: 'Coffee', reorderLevel: 5, reorderQty: 20 },
        { sku: 'MILK-001', name: 'Whole Milk', unit: 'ltr', category: 'Dairy', reorderLevel: 20, reorderQty: 50 },
        { sku: 'MILK-002', name: 'Oat Milk', unit: 'ltr', category: 'Dairy Alternative', reorderLevel: 10, reorderQty: 24 },
        { sku: 'SUGAR-001', name: 'White Sugar', unit: 'kg', category: 'Sweeteners', reorderLevel: 5, reorderQty: 20 },
        { sku: 'CROISS-001', name: 'Croissants', unit: 'pcs', category: 'Pastry', reorderLevel: 20, reorderQty: 50 },
        { sku: 'MUFFIN-001', name: 'Blueberry Muffins', unit: 'pcs', category: 'Pastry', reorderLevel: 15, reorderQty: 40 },
        { sku: 'BAGEL-001', name: 'Plain Bagels', unit: 'pcs', category: 'Bakery', reorderLevel: 15, reorderQty: 40 },
        { sku: 'CREAM-001', name: 'Cream Cheese', unit: 'kg', category: 'Dairy', reorderLevel: 2, reorderQty: 5 },
      ],
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List available template packs
   */
  listPacks(): TemplatePack[] {
    return this.PACKS.map((pack) => ({
      id: pack.id,
      name: pack.name,
      description: pack.description,
      category: pack.category,
      items: [],
      recipes: [],
    }));
  }

  /**
   * Get a specific pack
   */
  getPack(packId: string): TemplatePack | null {
    return this.PACKS.find((p) => p.id === packId) || null;
  }

  /**
   * Apply a template pack to a branch (idempotent)
   */
  async applyPack(
    orgId: string,
    branchId: string,
    packId: string,
  ): Promise<{ created: number; updated: number; errors: string[] }> {
    const pack = this.getPack(packId);
    if (!pack) {
      throw new BadRequestException(`Template pack ${packId} not found`);
    }

    this.logger.log(`Applying template pack ${pack.name} to branch ${branchId}`);

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    // Process items
    for (const templateItem of pack.items) {
      try {
        const existing = await this.prisma.client.inventoryItem.findFirst({
          where: {
            orgId,
            sku: templateItem.sku,
          },
        });

        if (existing) {
          // Update if different
          await this.prisma.client.inventoryItem.update({
            where: { id: existing.id },
            data: {
              name: templateItem.name,
              unit: templateItem.unit,
              category: templateItem.category,
              reorderLevel: templateItem.reorderLevel || 0,
              reorderQty: templateItem.reorderQty || 0,
              updatedAt: new Date(),
            },
          });
          updated++;
        } else {
          // Create new
          await this.prisma.client.inventoryItem.create({
            data: {
              orgId,
              sku: templateItem.sku,
              name: templateItem.name,
              unit: templateItem.unit,
              category: templateItem.category,
              reorderLevel: templateItem.reorderLevel || 0,
              reorderQty: templateItem.reorderQty || 0,
              isActive: true,
            },
          });
          created++;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to process item ${templateItem.sku}: ${errorMsg}`);
      }
    }

    // Process recipes if included
    if (pack.recipes) {
      for (const templateRecipe of pack.recipes) {
        try {
          // Find menu item (would need to be created separately or exist)
          const menuItem = await this.prisma.client.menuItem.findFirst({
            where: {
              branchId,
              name: templateRecipe.menuItemSku, // Using name as lookup since MenuItems don't have orgId
            },
          });

          const ingredient = await this.prisma.client.inventoryItem.findFirst({
            where: {
              orgId,
              sku: templateRecipe.ingredientSku,
            },
          });

          if (menuItem && ingredient) {
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
                  qtyPerUnit: templateRecipe.qtyPerUnit,
                  wastePct: templateRecipe.wastePct || 0,
                },
              });
            }
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          errors.push(`Failed to process recipe: ${errorMsg}`);
        }
      }
    }

    this.logger.log(
      `Template pack applied: ${created} created, ${updated} updated, ${errors.length} errors`,
    );

    return { created, updated, errors };
  }
}
