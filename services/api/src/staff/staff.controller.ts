import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { User } from '../me/user.decorator';
import { WaiterMetricsService } from './waiter-metrics.service';
import { WaiterMetrics, RankedWaiter } from './dto/waiter-metrics.dto';

/**
 * M5: Staff Performance & Metrics API
 *
 * Endpoints for waiter metrics, rankings, and anti-theft analysis.
 * RBAC: L4+ (OWNER, MANAGER, ASSISTANT_MANAGER, ACCOUNTANT, FRANCHISE)
 */
@Controller('staff')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class StaffController {
  constructor(private readonly waiterMetrics: WaiterMetricsService) {}

  /**
   * Get raw waiter metrics for a period
   *
   * @param branchId - Required: Branch to query
   * @param shiftId - Optional: Specific shift
   * @param from - Optional: Start date (ISO string)
   * @param to - Optional: End date (ISO string)
   *
   * Must provide either shiftId OR (from + to)
   */
  @Get('waiters/metrics')
  @Roles('L3', 'L4', 'L5')
  async getWaiterMetrics(
    @User() user: { orgId: string },
    @Query('branchId') branchId: string,
    @Query('shiftId') shiftId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<WaiterMetrics[]> {
    if (!branchId) {
      throw new Error('branchId is required');
    }

    if (!shiftId && (!from || !to)) {
      throw new Error('Must provide either shiftId or from/to dates');
    }

    return this.waiterMetrics.getWaiterMetrics({
      orgId: user.orgId,
      branchId,
      shiftId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  /**
   * Get ranked waiters with scores
   *
   * @param branchId - Required: Branch to query
   * @param shiftId - Optional: Specific shift
   * @param from - Optional: Start date (ISO string)
   * @param to - Optional: End date (ISO string)
   *
   * Returns waiters sorted by score (best to worst)
   */
  @Get('waiters/rankings')
  @Roles('L3', 'L4', 'L5')
  async getWaiterRankings(
    @User() user: { orgId: string },
    @Query('branchId') branchId: string,
    @Query('shiftId') shiftId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<RankedWaiter[]> {
    if (!branchId) {
      throw new Error('branchId is required');
    }

    if (!shiftId && (!from || !to)) {
      throw new Error('Must provide either shiftId or from/to dates');
    }

    return this.waiterMetrics.getRankedWaiters({
      orgId: user.orgId,
      branchId,
      shiftId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  /**
   * Get top N performers
   */
  @Get('waiters/top-performers')
  @Roles('L3', 'L4', 'L5')
  async getTopPerformers(
    @User() user: { orgId: string },
    @Query('branchId') branchId: string,
    @Query('limit') limit?: string,
    @Query('shiftId') shiftId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<RankedWaiter[]> {
    const rankings = await this.waiterMetrics.getRankedWaiters({
      orgId: user.orgId,
      branchId,
      shiftId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });

    const limitNum = limit ? parseInt(limit, 10) : 5;
    return rankings.slice(0, limitNum);
  }

  /**
   * Get bottom N performers (risk staff)
   */
  @Get('waiters/risk-staff')
  @Roles('L4', 'L5') // More restricted - only senior management
  async getRiskStaff(
    @User() user: { orgId: string },
    @Query('branchId') branchId: string,
    @Query('limit') limit?: string,
    @Query('shiftId') shiftId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<RankedWaiter[]> {
    const rankings = await this.waiterMetrics.getRankedWaiters({
      orgId: user.orgId,
      branchId,
      shiftId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });

    const limitNum = limit ? parseInt(limit, 10) : 5;
    return rankings.slice(-limitNum).reverse(); // Last N, reversed for worst-first
  }
}
