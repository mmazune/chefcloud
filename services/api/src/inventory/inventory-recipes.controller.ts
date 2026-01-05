/**
 * M11.4 Inventory Recipes Controller
 * 
 * REST API for recipe (BOM) management:
 * - RBAC: L2+ read, L3+ write
 * - Full CRUD for recipes and lines
 * - Recipe cloning support
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  ParseBoolPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  InventoryRecipesService,
  CreateRecipeDto,
  UpdateRecipeDto,
  CreateRecipeLineDto,
  UpdateRecipeLineDto,
} from './inventory-recipes.service';
import { RecipeTargetType } from '@chefcloud/db';

@Controller('inventory/v2/recipes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class InventoryRecipesController {
  constructor(private readonly recipesService: InventoryRecipesService) {}

  /**
   * Create a new recipe
   */
  @Post()
  @Roles('L3')
  async createRecipe(@Request() req: any, @Body() dto: CreateRecipeDto) {
    return this.recipesService.create(req.user.orgId, req.user.userId, dto);
  }

  /**
   * List recipes with optional filters
   */
  @Get()
  @Roles('L2')
  async listRecipes(
    @Request() req: any,
    @Query('targetType') targetType?: 'MENU_ITEM' | 'INVENTORY_ITEM',
    @Query('targetId') targetId?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @Query('includeLines') includeLines?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    return this.recipesService.list(req.user.orgId, {
      targetType: targetType as RecipeTargetType | undefined,
      targetId,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      search,
      includeLines: includeLines === 'true',
      limit,
      offset,
    });
  }

  /**
   * Get recipe by ID
   */
  @Get(':recipeId')
  @Roles('L2')
  async getRecipe(@Request() req: any, @Param('recipeId') recipeId: string) {
    return this.recipesService.getById(req.user.orgId, recipeId);
  }

  /**
   * Get recipe by target (MENU_ITEM or INVENTORY_ITEM)
   */
  @Get('target/:targetType/:targetId')
  @Roles('L2')
  async getRecipeByTarget(
    @Request() req: any,
    @Param('targetType') targetType: 'MENU_ITEM' | 'INVENTORY_ITEM',
    @Param('targetId') targetId: string,
  ) {
    return this.recipesService.getByTarget(
      req.user.orgId,
      targetType as RecipeTargetType,
      targetId,
    );
  }

  /**
   * Update recipe properties
   */
  @Patch(':recipeId')
  @Roles('L3')
  async updateRecipe(
    @Request() req: any,
    @Param('recipeId') recipeId: string,
    @Body() dto: UpdateRecipeDto,
  ) {
    return this.recipesService.update(req.user.orgId, req.user.userId, recipeId, dto);
  }

  /**
   * Delete recipe
   */
  @Delete(':recipeId')
  @Roles('L4')
  async deleteRecipe(@Request() req: any, @Param('recipeId') recipeId: string) {
    return this.recipesService.delete(req.user.orgId, req.user.userId, recipeId);
  }

  /**
   * Clone recipe to a new target
   */
  @Post(':recipeId/clone')
  @Roles('L3')
  async cloneRecipe(
    @Request() req: any,
    @Param('recipeId') recipeId: string,
    @Body() dto: { name: string; targetType: 'MENU_ITEM' | 'INVENTORY_ITEM'; targetId: string },
  ) {
    return this.recipesService.clone(
      req.user.orgId,
      req.user.userId,
      recipeId,
      dto.name,
      dto.targetType as RecipeTargetType,
      dto.targetId,
    );
  }

  /**
   * Add a line to a recipe
   */
  @Post(':recipeId/lines')
  @Roles('L3')
  async addLine(
    @Request() req: any,
    @Param('recipeId') recipeId: string,
    @Body() dto: CreateRecipeLineDto,
  ) {
    return this.recipesService.addLine(req.user.orgId, req.user.userId, recipeId, dto);
  }

  /**
   * Update a recipe line
   */
  @Patch(':recipeId/lines/:lineId')
  @Roles('L3')
  async updateLine(
    @Request() req: any,
    @Param('recipeId') recipeId: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateRecipeLineDto,
  ) {
    return this.recipesService.updateLine(
      req.user.orgId,
      req.user.userId,
      recipeId,
      lineId,
      dto,
    );
  }

  /**
   * Delete a recipe line
   */
  @Delete(':recipeId/lines/:lineId')
  @Roles('L3')
  async deleteLine(
    @Request() req: any,
    @Param('recipeId') recipeId: string,
    @Param('lineId') lineId: string,
  ) {
    return this.recipesService.deleteLine(req.user.orgId, req.user.userId, recipeId, lineId);
  }
}
