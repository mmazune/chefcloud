import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CostingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get Weighted Average Cost (WAC) for an inventory item.
   * WAC = sum(unitCost * remainingQty) / sum(remainingQty) across active batches.
   */
  async getWac(inventoryItemId: string): Promise<number> {
    const batches = await this.prisma.client.stockBatch.findMany({
      where: {
        itemId: inventoryItemId,
        remainingQty: { gt: 0 },
      },
      select: {
        unitCost: true,
        remainingQty: true,
      },
    });

    if (batches.length === 0) {
      return 0;
    }

    let totalCostQty = 0;
    let totalQty = 0;

    for (const batch of batches) {
      const cost = Number(batch.unitCost);
      const qty = Number(batch.remainingQty);
      totalCostQty += cost * qty;
      totalQty += qty;
    }

    return totalQty > 0 ? totalCostQty / totalQty : 0;
  }

  /**
   * Get recipe cost for a menu item including modifiers.
   * Supports micro-ingredients by rounding to 4 decimal places before multiplication.
   */
  async getRecipeCost(
    menuItemId: string,
    modifiers?: Array<{ id: string; selected: boolean }>,
  ): Promise<number> {
        // Fetch the recipe
    const recipeIngredients = await this.prisma.client.recipeIngredient.findMany({
      where: {
        menuItemId,
        modifierOptionId: null,
      },
      select: {
        itemId: true,
        qtyPerUnit: true,
      },
    });

    let totalCost = 0;

    // Base recipe cost
    for (const ingredient of recipeIngredients) {
      const wac = await this.getWac(ingredient.itemId);
      const qty = Number(ingredient.qtyPerUnit);
      totalCost += wac * qty;
    }

    // Add modifier ingredients if selected
    if (modifiers && modifiers.length > 0) {
      const selectedModifierIds = modifiers
        .filter((m) => m.selected)
        .map((m) => m.id);

      if (selectedModifierIds.length > 0) {
        const modifierRecipes = await this.prisma.client.recipeIngredient.findMany({
          where: {
            menuItemId: { in: selectedModifierIds },
          },
          select: {
            itemId: true,
            qtyPerUnit: true,
          },
        });

        for (const recipe of modifierRecipes) {
          const wac = await this.getWac(recipe.itemId);
          const qty = Number(recipe.qtyPerUnit);
          
          // Round WAC to 4 decimal places
          const roundedWac = Math.round(wac * 10000) / 10000;
          const lineCost = roundedWac * qty;
          
          totalCost += lineCost;
        }
      }
    }

    return totalCost;
  }

  /**
   * Calculate cost and margin for an order item.
   */
  async calculateItemCosting(params: {
    menuItemId: string;
    quantity: number;
    unitPrice: number;
    modifiersPrice: number;
    discount: number;
    modifiers?: Array<{ id: string; selected: boolean }>;
  }): Promise<{
    costUnit: number;
    costTotal: number;
    marginTotal: number;
    marginPct: number;
  }> {
    const { menuItemId, quantity, unitPrice, modifiersPrice, discount, modifiers } = params;

    const costUnit = await this.getRecipeCost(menuItemId, modifiers);
    const costTotal = costUnit * quantity;

    // Calculate line net revenue
    const lineNet = unitPrice * quantity + modifiersPrice - discount;

    // Calculate margin
    const marginTotal = lineNet - costTotal;
    const marginPct = lineNet > 0 ? (marginTotal / lineNet) * 100 : 0;

    return {
      costUnit,
      costTotal,
      marginTotal,
      marginPct,
    };
  }
}
