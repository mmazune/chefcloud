/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma.service';
import { AccountingService } from '../accounting/accounting.service';
import { BudgetService } from '../finance/budget.service';

@Controller('analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AnalyticsController {
  constructor(
    private analyticsService: AnalyticsService,
    private prisma: PrismaService,
    private accountingService: AccountingService,
    private budgetService: BudgetService,
  ) {}

  @Get('daily')
  @Roles('L3')
  async getDailySummary(@Req() req: any, @Query('date') date?: string): Promise<any> {
    return this.analyticsService.getDailySummary(req.user.branchId, date);
  }

  @Get('top-items')
  @Roles('L3')
  async getTopItems(@Req() req: any, @Query('limit') limit?: string): Promise<any> {
    const limitNum = limit ? parseInt(limit, 10) : 10;

    // Determine if user can see cost data
    const canSeeCost = await this.canUserSeeCostData(req.user);

    return this.analyticsService.getTopItems(req.user.branchId, limitNum, canSeeCost);
  }

  /**
   * Check if user can see cost/margin data based on role or org settings
   * - OWNER (L5), MANAGER (L4), or ACCOUNTANT roles can always see
   * - CHEF (L3) and WAITER (L2) can see if showCostToChef=true in OrgSettings
   */
  private async canUserSeeCostData(user: any): Promise<boolean> {
    // L4+ (MANAGER, OWNER) and ACCOUNTANT can always see
    const roleLevel = parseInt(user.roleLevel.replace('L', ''), 10);
    if (roleLevel >= 4 || user.role === 'ACCOUNTANT') {
      return true;
    }

    // For L3 and below, check OrgSettings
    const orgSettings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId: user.orgId },
    });

    return orgSettings?.showCostToChef || false;
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
  async getAnomalies(@Req() req: any, @Query('limit') limit?: string): Promise<any> {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.analyticsService.getAnomalies(req.user.branchId, limitNum);
  }

  /**
   * GET /analytics/daily-metrics
   * Get daily time-series metrics (sales, avg check, NPS) for analytics dashboard
   * RBAC: L4+ (Manager, Owner, Accountant)
   */
  @Get('daily-metrics')
  @Roles('L4', 'L5', 'ACCOUNTANT')
  async getDailyMetrics(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
  ): Promise<any> {
    return this.analyticsService.getDailyMetrics(
      req.user.orgId,
      from,
      to,
      branchId || req.user.branchId,
    );
  }

  /**
   * GET /analytics/risk-summary
   * Get risk/anti-theft summary for analytics dashboard
   * RBAC: L4+ (Manager, Owner, Accountant)
   * M25-S4: Risk & Anti-Theft Analytics
   */
  @Get('risk-summary')
  @Roles('L4', 'L5', 'ACCOUNTANT')
  async getRiskSummary(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ): Promise<any> {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000); // default last 7 days

    return this.analyticsService.getRiskSummary({
      orgId: req.user.orgId,
      branchId: branchId || null,
      from: fromDate,
      to: toDate,
    });
  }

  /**
   * GET /analytics/risk-events
   * Get individual risk/anomaly events for analytics dashboard
   * RBAC: L4+ (Manager, Owner, Accountant)
   * M25-S4: Risk & Anti-Theft Analytics
   */
  @Get('risk-events')
  @Roles('L4', 'L5', 'ACCOUNTANT')
  async getRiskEvents(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
    @Query('severity') severity?: string,
  ): Promise<any> {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000); // default last 7 days

    return this.analyticsService.getRiskEvents({
      orgId: req.user.orgId,
      branchId: branchId || null,
      from: fromDate,
      to: toDate,
      severity: severity || null,
    });
  }

  /**
   * GET /analytics/financial-summary
   * Get financial health metrics (P&L + budget vs actual) for analytics dashboard
   * RBAC: L4+ (Manager, Owner, Accountant)
   * M25-S3: Financial Health & Profitability Analytics
   */
  @Get('financial-summary')
  @Roles('L4', 'L5', 'ACCOUNTANT')
  async getFinancialSummary(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ): Promise<any> {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000); // default last 30 days

    // Get P&L for the period
    const pnl = await this.accountingService.getProfitAndLoss(
      req.user.orgId,
      fromDate.toISOString(),
      toDate.toISOString(),
    );

    // Get budget summary if branchId and period align with month
    let budget = null;
    if (branchId) {
      const year = toDate.getFullYear();
      const month = toDate.getMonth() + 1;
      try {
        budget = await this.budgetService.getBudgetSummary(
          req.user.orgId,
          branchId,
          year,
          month,
        );
      } catch (err) {
        // No budget data - that's okay
        this.analyticsService['logger']?.warn?.(`No budget data for ${branchId}: ${err}`);
      }
    }

    // Calculate percentages
    const grossMarginPct = pnl.totalRevenue > 0 
      ? ((pnl.grossProfit / pnl.totalRevenue) * 100) 
      : 0;
    const netProfitPct = pnl.totalRevenue > 0 
      ? ((pnl.netProfit / pnl.totalRevenue) * 100) 
      : 0;

    return {
      currency: 'UGX',
      period: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      pnl: {
        revenue: pnl.totalRevenue,
        cogs: pnl.totalCOGS,
        grossMargin: pnl.grossProfit,
        grossMarginPct,
        operatingExpenses: pnl.totalExpenses,
        netProfit: pnl.netProfit,
        netProfitPct,
      },
      budget: budget ? {
        totalBudget: budget.totalBudget,
        totalActual: budget.totalActual,
        varianceAmount: budget.totalVariance,
        variancePct: budget.totalVariancePercent,
        byCategory: budget.byCategory.map((cat) => ({
          category: cat.category,
          budget: cat.budgetAmount,
          actual: cat.actualAmount,
          variance: cat.variance,
          variancePct: cat.variancePercent,
        })),
      } : null,
    };
  }
}
