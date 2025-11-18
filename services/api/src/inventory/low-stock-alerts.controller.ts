import { Controller, Get, Patch, Delete, Body, Query, Param, UseGuards, Req } from '@nestjs/common';
import { LowStockAlertsService, LowStockConfigDto } from './low-stock-alerts.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Request } from 'express';

@Controller('inventory/low-stock')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class LowStockAlertsController {
  constructor(private readonly lowStockAlertsService: LowStockAlertsService) {}

  /**
   * Get low-stock alerts for a branch
   * RBAC: OWNER, MANAGER, PROCUREMENT, INVENTORY
   */
  @Get('alerts')
  @Roles('L4', 'L5', 'PROCUREMENT', 'INVENTORY')
  async getAlerts(
    @Req() req: Request & { user: any },
    @Query('branchId') branchId: string,
  ) {
    return this.lowStockAlertsService.detectLowStock(req.user.orgId, branchId);
  }

  /**
   * Get low-stock configuration
   * RBAC: OWNER, MANAGER, PROCUREMENT
   */
  @Get('config')
  @Roles('L4', 'L5', 'PROCUREMENT')
  async getConfig(
    @Req() req: Request & { user: any },
    @Query('branchId') branchId?: string,
  ) {
    return this.lowStockAlertsService.getConfig(req.user.orgId, branchId);
  }

  /**
   * Update or create low-stock configuration
   * RBAC: OWNER, MANAGER, PROCUREMENT
   */
  @Patch('config')
  @Roles('L4', 'L5', 'PROCUREMENT')
  async upsertConfig(
    @Req() req: Request & { user: any },
    @Query('branchId') branchId: string,
    @Body() dto: LowStockConfigDto,
  ) {
    return this.lowStockAlertsService.upsertConfig(
      req.user.orgId,
      branchId || null,
      dto,
    );
  }

  /**
   * Delete a low-stock configuration
   * RBAC: OWNER, MANAGER
   */
  @Delete('config/:configId')
  @Roles('L4', 'L5')
  async deleteConfig(
    @Req() req: Request & { user: any },
    @Param('configId') configId: string,
  ) {
    await this.lowStockAlertsService.deleteConfig(req.user.orgId, configId);
    return { success: true };
  }
}
