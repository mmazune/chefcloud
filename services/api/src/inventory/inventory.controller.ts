/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Post, Get, Body, UseGuards, Req, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto } from './inventory.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('inventory')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Post('items')
  @Roles('L4')
  async createItem(@Req() req: any, @Body() dto: CreateInventoryItemDto): Promise<any> {
    return this.inventoryService.createItem(req.user.orgId, dto);
  }

  @Get('items')
  @Roles('L3')
  async getItems(@Req() req: any): Promise<any> {
    return this.inventoryService.getItems(req.user.orgId);
  }

  @Get('levels')
  @Roles('L3')
  async getLevels(@Req() req: any, @Query('branchId') branchId?: string): Promise<any> {
    return this.inventoryService.getOnHandLevels(req.user.orgId, branchId);
  }

  @Post('adjustments')
  @Roles('L3')
  async createAdjustment(
    @Req() req: any,
    @Body() dto: { itemId: string; deltaQty: number; reason: string },
  ): Promise<any> {
    return this.inventoryService.createAdjustment(
      req.user.orgId,
      req.user.branchId,
      dto.itemId,
      dto.deltaQty,
      dto.reason,
      req.user.id,
    );
  }
}
