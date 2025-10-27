/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('daily')
  @Roles('L3')
  async getDailySummary(@Req() req: any, @Query('date') date?: string): Promise<any> {
    return this.analyticsService.getDailySummary(req.user.branchId, date);
  }

  @Get('top-items')
  @Roles('L3')
  async getTopItems(@Req() req: any, @Query('limit') limit?: string): Promise<any> {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.analyticsService.getTopItems(req.user.branchId, limitNum);
  }
}
