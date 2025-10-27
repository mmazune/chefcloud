/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RecipesService } from './recipes.service';
import { UpsertRecipeDto } from './recipes.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('inventory/recipes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RecipesController {
  constructor(private recipesService: RecipesService) {}

  @Post(':menuItemId')
  @Roles('L4')
  async upsertRecipe(@Param('menuItemId') menuItemId: string, @Body() dto: UpsertRecipeDto): Promise<any> {
    return this.recipesService.upsertRecipe(menuItemId, dto);
  }

  @Get(':menuItemId')
  @Roles('L3')
  async getRecipe(@Param('menuItemId') menuItemId: string): Promise<any> {
    return this.recipesService.getRecipe(menuItemId);
  }
}
