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

  @Get('staff/voids')
  @Roles('L3')
  async getStaffVoids(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ): Promise<any> {
    return this.analyticsService.getStaffVoids(from, to, req.user.branchId);
  }

  @Get('staff/discounts')
  @Roles('L3')
  async getStaffDiscounts(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ): Promise<any> {
    return this.analyticsService.getStaffDiscounts(from, to, req.user.branchId);
  }

  @Get('orders/no-drinks')
  @Roles('L3')
  async getNoDrinksRate(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ): Promise<any> {
    return this.analyticsService.getNoDrinksRate(from, to, req.user.branchId);
  }

  @Get('late-voids')
  @Roles('L3')
  async getLateVoids(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('thresholdMin') thresholdMin?: string,
  ): Promise<any> {
    const threshold = thresholdMin ? parseInt(thresholdMin, 10) : 5;
    return this.analyticsService.getLateVoids(from, to, threshold, req.user.branchId);
  }

  @Get('anomalies')
  @Roles('L3')
  async getAnomalies(
    @Req() req: any,
    @Query('limit') limit?: string,
  ): Promise<any> {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.analyticsService.getAnomalies(req.user.branchId, limitNum);
  }
}
