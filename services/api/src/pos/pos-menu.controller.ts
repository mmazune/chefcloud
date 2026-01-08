import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { PosMenuService } from './pos-menu.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { User } from '../me/user.decorator';

@Controller('pos')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@SkipThrottle()
export class PosMenuController {
  constructor(private posMenuService: PosMenuService) {}

  /**
   * M13.2: Get available menu items for POS ordering
   * Returns items with modifiers, respecting availability rules
   */
  @Get('menu')
  @Roles('L1')
  async getMenu(
    @User() user: { orgId: string; branchId: string },
    @Query('at') atIso?: string,
  ): Promise<unknown> {
    return this.posMenuService.getAvailableMenuForPOS(user.orgId, user.branchId, atIso);
  }

  /**
   * M13.2: Export orders to CSV
   */
  @Get('export/orders.csv')
  @Roles('L2')
  async exportOrdersCsv(
    @User() user: { orgId: string; branchId?: string },
    @Query('branchId') branchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Res() res?: Response,
  ): Promise<void> {
    const targetBranch = branchId ?? user.branchId;
    const { content, hash } = await this.posMenuService.exportOrdersCsv(
      user.orgId,
      targetBranch,
      startDate,
      endDate,
    );

    res?.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res?.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    res?.setHeader('X-Content-Hash', hash);
    res?.send(content);
  }
}
