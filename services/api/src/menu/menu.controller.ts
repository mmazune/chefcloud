/**
 * M13.1: Menu Foundation Controller
 * 
 * Endpoints:
 * - Categories: CRUD (L3+ write, L2+ read)
 * - Items: CRUD (L3+ write, L2+ read)
 * - Modifiers: CRUD (L4+ write, L2+ read)
 * - Availability: CRUD (L4+ write, L2+ read)
 * - Export: CSV (L4+)
 */
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import { MenuService } from './menu.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  CreateModifierGroupDto,
  UpdateModifierGroupDto,
  CreateModifierOptionDto,
  UpdateModifierOptionDto,
  CreateAvailabilityRuleDto,
  UpdateAvailabilityRuleDto,
  AttachModifierGroupDto,
} from './menu.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { User } from '../me/user.decorator';

interface AuthUser {
  orgId: string;
  branchId: string;
}

@Controller('menu')
@UseGuards(AuthGuard('jwt'), OrgScopeGuard, RolesGuard)
@SkipThrottle()
export class MenuController {
  constructor(private menuService: MenuService) {}

  // ===== Categories =====

  @Post('categories')
  @Roles('L3')
  async createCategory(
    @Body() dto: CreateCategoryDto,
    @User() user: AuthUser,
  ): Promise<unknown> {
    return this.menuService.createCategory(dto, user.orgId, user.branchId);
  }

  @Get('categories')
  @Roles('L2')
  async getCategories(
    @User() user: AuthUser,
    @Query('branchId') branchId?: string,
  ): Promise<unknown> {
    return this.menuService.getCategories(user.orgId, branchId || user.branchId);
  }

  @Get('categories/:id')
  @Roles('L2')
  async getCategory(
    @Param('id') id: string,
    @User() user: AuthUser,
  ): Promise<unknown> {
    return this.menuService.getCategory(id, user.orgId);
  }

  @Patch('categories/:id')
  @Roles('L3')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @User() user: AuthUser,
  ): Promise<unknown> {
    return this.menuService.updateCategory(id, dto, user.orgId);
  }

  // ===== Menu Items =====
  // Note: Static routes before parameterized routes (H6)

  @Get('items/available')
  @Roles('L2')
  async getAvailableItems(
    @User() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('at') at?: string,
  ): Promise<unknown> {
    return this.menuService.getAvailableItems(
      user.orgId,
      branchId || user.branchId,
      at,
    );
  }

  @Post('items')
  @Roles('L3')
  async createMenuItem(
    @Body() dto: CreateMenuItemDto,
    @User() user: AuthUser,
  ): Promise<unknown> {
    return this.menuService.createMenuItem(dto, user.orgId, user.branchId);
  }

  @Get('items')
  @Roles('L2')
  async getMenuItems(
    @User() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('activeOnly') activeOnly?: string,
  ): Promise<unknown> {
    return this.menuService.getMenuItems(
      user.orgId,
      branchId || user.branchId,
      categoryId,
      activeOnly !== 'false',
    );
  }

  @Get('items/:id')
  @Roles('L2')
  async getMenuItem(
    @Param('id') id: string,
    @User() user: AuthUser,
  ): Promise<unknown> {
    return this.menuService.getMenuItem(id, user.orgId);
  }

  @Patch('items/:id')
  @Roles('L3')
  async updateMenuItem(
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemDto,
    @User() user: AuthUser,
  ): Promise<unknown> {
    return this.menuService.updateMenuItem(id, dto, user.orgId);
  }

  @Post('items/:id/modifier-groups')
  @Roles('L4')
  async attachModifierGroup(
    @Param('id') itemId: string,
    @Body() dto: AttachModifierGroupDto,
    @User() user: AuthUser,
  ): Promise<unknown> {
    return this.menuService.attachModifierGroup(itemId, dto, user.orgId);
  }

  @Delete('items/:id/modifier-groups/:groupId')
  @Roles('L4')
  @HttpCode(HttpStatus.NO_CONTENT)
  async detachModifierGroup(
    @Param('id') itemId: string,
    @Param('groupId') groupId: string,
    @User() user: AuthUser,
  ): Promise<void> {
    await this.menuService.detachModifierGroup(itemId, groupId, user.orgId);
  }

  // ===== Modifier Groups =====

  @Post('modifier-groups')
  @Roles('L4')
  async createModifierGroup(
    @Body() dto: CreateModifierGroupDto,
    @User() user: AuthUser,
  ): Promise<unknown> {
    return this.menuService.createModifierGroup(dto, user.orgId);
  }

  @Get('modifier-groups')
  @Roles('L2')
  async getModifierGroups(
    @User() user: AuthUser,
    @Query('activeOnly') activeOnly?: string,
  ): Promise<unknown> {
    return this.menuService.getModifierGroups(user.orgId, activeOnly !== 'false');
  }

  @Get('modifier-groups/:id')
  @Roles('L2')
  async getModifierGroup(
    @Param('id') id: string,
    @User() user: AuthUser,
  ): Promise<unknown> {
    return this.menuService.getModifierGroup(id, user.orgId);
  }

  @Patch('modifier-groups/:id')
  @Roles('L4')
  async updateModifierGroup(
    @Param('id') id: string,
    @Body() dto: UpdateModifierGroupDto,
    @User() user: AuthUser,
  ): Promise<unknown> {
    return this.menuService.updateModifierGroup(id, dto, user.orgId);
  }

  // ===== Modifier Options =====

  @Post('modifier-options')
  @Roles('L4')
  async createModifierOption(
    @Body() dto: CreateModifierOptionDto,
    @User() user: AuthUser,
  ): Promise<unknown> {
    return this.menuService.createModifierOption(dto, user.orgId);
  }

  @Patch('modifier-options/:id')
  @Roles('L4')
  async updateModifierOption(
    @Param('id') id: string,
    @Body() dto: UpdateModifierOptionDto,
    @User() user: AuthUser,
  ): Promise<unknown> {
    return this.menuService.updateModifierOption(id, dto, user.orgId);
  }

  // ===== Availability Rules =====

  @Post('availability-rules')
  @Roles('L4')
  async createAvailabilityRule(
    @Body() dto: CreateAvailabilityRuleDto,
    @User() user: AuthUser,
  ): Promise<unknown> {
    return this.menuService.createAvailabilityRule(dto, user.orgId);
  }

  @Get('availability-rules')
  @Roles('L2')
  async getAvailabilityRules(
    @User() user: AuthUser,
    @Query('branchId') branchId?: string,
  ): Promise<unknown> {
    return this.menuService.getAvailabilityRules(user.orgId, branchId);
  }

  @Patch('availability-rules/:id')
  @Roles('L4')
  async updateAvailabilityRule(
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityRuleDto,
    @User() user: AuthUser,
  ): Promise<unknown> {
    return this.menuService.updateAvailabilityRule(id, dto, user.orgId);
  }

  // ===== Exports =====

  @Get('export/items.csv')
  @Roles('L4')
  async exportItemsCsv(
    @User() user: AuthUser,
    @Query('branchId') branchId: string | undefined,
    @Res() res: Response,
  ) {
    const { content, hash } = await this.menuService.exportItemsCsv(
      user.orgId,
      branchId,
    );

    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="menu-items-${date}.csv"`);
    res.setHeader('X-Nimbus-Export-Hash', hash);
    res.send(content);
  }

  @Get('export/modifiers.csv')
  @Roles('L4')
  async exportModifiersCsv(
    @User() user: AuthUser,
    @Res() res: Response,
  ) {
    const { content, hash } = await this.menuService.exportModifiersCsv(user.orgId);

    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="modifiers-${date}.csv"`);
    res.setHeader('X-Nimbus-Export-Hash', hash);
    res.send(content);
  }
}
