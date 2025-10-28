import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DashboardsService } from './dashboards.service';
import { User } from '../me/user.decorator';

@Controller('dash')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  /**
   * Void leaderboard - users with most voids
   */
  @Get('leaderboards/voids')
  @Roles('L4', 'L5')
  async getVoidLeaderboard(
    @User() user: { orgId: string },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dashboardsService.getVoidLeaderboard(
      user.orgId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  /**
   * Discount leaderboard - users with most discounts
   */
  @Get('leaderboards/discounts')
  @Roles('L4', 'L5')
  async getDiscountLeaderboard(
    @User() user: { orgId: string },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dashboardsService.getDiscountLeaderboard(
      user.orgId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  /**
   * No-drinks rate per waiter
   */
  @Get('no-drinks-rate')
  @Roles('L4', 'L5')
  async getNoDrinksRate(
    @User() user: { orgId: string },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboardsService.getNoDrinksRate(
      user.orgId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  /**
   * Late void heatmap - 7x24 matrix (weekday x hour)
   */
  @Get('late-void-heatmap')
  @Roles('L4', 'L5')
  async getLateVoidHeatmap(
    @User() user: { orgId: string },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboardsService.getLateVoidHeatmap(
      user.orgId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  /**
   * Recent anomaly events
   */
  @Get('anomalies/recent')
  @Roles('L4', 'L5')
  async getRecentAnomalies(
    @User() user: { orgId: string },
    @Query('limit') limit?: string,
  ) {
    return this.dashboardsService.getRecentAnomalies(
      user.orgId,
      limit ? parseInt(limit, 10) : 100,
    );
  }
}
