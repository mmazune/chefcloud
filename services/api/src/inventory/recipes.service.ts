/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpsertRecipeDto } from './recipes.dto';

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  async upsertRecipe(menuItemId: string, dto: UpsertRecipeDto): Promise<any> {
    // Delete existing ingredients
    await this.prisma.client.recipeIngredient.deleteMany({
      where: { menuItemId },
    });

    // Create new ingredients
    const ingredients = await this.prisma.client.recipeIngredient.createMany({
      data: dto.ingredients.map((ing) => ({
        menuItemId,
        itemId: ing.itemId,
        qtyPerUnit: ing.qtyPerUnit,
        wastePct: ing.wastePct || 0,
        modifierOptionId: ing.modifierOptionId,
      })),
    });

    return ingredients;
  }

  async getRecipe(menuItemId: string): Promise<any> {
    return this.prisma.client.recipeIngredient.findMany({
      where: { menuItemId },
      include: {
        item: { select: { id: true, name: true, unit: true } },
        modifierOption: { select: { id: true, name: true } },
      },
    });
  }
}
