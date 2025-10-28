import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MenuService } from './menu.service';
import { CreateMenuItemDto, CreateModifierGroupDto } from './menu.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { User } from '../me/user.decorator';

@Controller('menu')
@UseGuards(AuthGuard('jwt'), OrgScopeGuard, RolesGuard)
export class MenuController {
  constructor(private menuService: MenuService) {}

  @Post('items')
  @Roles('L4')
  async createMenuItem(
    @Body() dto: CreateMenuItemDto,
    @User() user: { branchId: string },
  ): Promise<unknown> {
    return this.menuService.createMenuItem(dto, user.branchId);
  }

  @Get('items')
  @Roles('L1')
  async getMenuItems(@User() user: { branchId: string }): Promise<unknown> {
    return this.menuService.getMenuItems(user.branchId);
  }

  @Get('items/:id')
  @Roles('L1')
  async getMenuItem(
    @Param('id') id: string,
    @User() user: { orgId: string; branchId: string },
  ): Promise<unknown> {
    return this.menuService.getMenuItem(id, user.orgId);
  }

  @Post('modifier-groups')
  @Roles('L4')
  async createModifierGroup(
    @Body() dto: CreateModifierGroupDto,
    @User() user: { orgId: string },
  ): Promise<unknown> {
    return this.menuService.createModifierGroup(dto, user.orgId);
  }

  @Post('items/:id/groups/:groupId')
  @Roles('L4')
  async attachGroupToItem(
    @Param('id') itemId: string,
    @Param('groupId') groupId: string,
  ): Promise<unknown> {
    return this.menuService.attachGroupToItem(itemId, groupId);
  }
}
