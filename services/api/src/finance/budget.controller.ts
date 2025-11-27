import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BudgetService } from './budget.service';
import { CostInsightsService } from './cost-insights.service';
import { CreateBudgetDto } from './dto/budget.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RemindersService } from '../service-providers/reminders.service';

@Controller('finance/budgets')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class BudgetController {
  constructor(
    private readonly budgetService: BudgetService,
    private readonly costInsightsService: CostInsightsService,
    private readonly remindersService: RemindersService,
  ) {}

  /**
   * Set budget for a specific category and period
   * @rbac L4+ (Regional Manager, Franchise Owner)
   */
  @Post()
  @Roles('L4', 'L5')
  @HttpCode(HttpStatus.CREATED)
  async setBudget(@Request() req: any, @Body() dto: CreateBudgetDto) {
    const orgId = req.user.orgId;
    return this.budgetService.setBudget(orgId, dto);
  }

  /**
   * Get budgets for a specific branch and period
   * @rbac L3+ (Procurement, Accountant)
   */
  @Get()
  @Roles('L3', 'L4', 'L5')
  async getBudgets(
    @Request() req: any,
    @Query('branchId') branchId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const orgId = req.user.orgId;

    if (!branchId || !year || !month) {
      throw new BadRequestException('branchId, year, and month are required');
    }

    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);

    if (isNaN(yearNum) || isNaN(monthNum)) {
      throw new BadRequestException('year and month must be valid numbers');
    }

    return this.budgetService.getBudgets(orgId, branchId, yearNum, monthNum);
  }

  /**
   * Get budget summary for a branch and period
   * @rbac L3+ (Procurement, Accountant)
   */
  @Get('summary')
  @Roles('L3', 'L4', 'L5')
  async getBudgetSummary(
    @Request() req: any,
    @Query('branchId') branchId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const orgId = req.user.orgId;

    if (!branchId || !year || !month) {
      throw new BadRequestException('branchId, year, and month are required');
    }

    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);

    if (isNaN(yearNum) || isNaN(monthNum)) {
      throw new BadRequestException('year and month must be valid numbers');
    }

    return this.budgetService.getBudgetSummary(orgId, branchId, yearNum, monthNum);
  }

  /**
   * Get franchise-wide budget summary
   * @rbac L4+ (Regional Manager, Franchise Owner)
   */
  @Get('franchise')
  @Roles('L4', 'L5')
  async getFranchiseBudgetSummary(
    @Request() req: any,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const orgId = req.user.orgId;

    if (!year || !month) {
      throw new BadRequestException('year and month are required');
    }

    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);

    if (isNaN(yearNum) || isNaN(monthNum)) {
      throw new BadRequestException('year and month must be valid numbers');
    }

    return this.budgetService.getFranchiseBudgetSummary(orgId, yearNum, monthNum);
  }

  /**
   * Manually trigger budget actuals update
   * @rbac L4+ (Regional Manager, Franchise Owner)
   */
  @Post('update-actuals')
  @Roles('L4', 'L5')
  @HttpCode(HttpStatus.OK)
  async updateBudgetActuals(
    @Request() _req: any,
    @Body() body: { branchId: string; year: number; month: number },
  ) {
    const { branchId, year, month } = body;

    if (!branchId || !year || !month) {
      throw new BadRequestException('branchId, year, and month are required');
    }

    return this.budgetService.updateBudgetActuals(branchId, year, month);
  }

  /**
   * Get cost-cutting insights for a branch
   * @rbac L3+ (Procurement, Accountant)
   */
  @Get('insights')
  @Roles('L3', 'L4', 'L5')
  async getCostInsights(
    @Request() _req: any,
    @Query('branchId') branchId?: string,
    @Query('periodMonths') periodMonths?: string,
  ) {
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }

    const months = periodMonths ? parseInt(periodMonths, 10) : 3;

    if (isNaN(months) || months < 1 || months > 12) {
      throw new BadRequestException('periodMonths must be between 1 and 12');
    }

    return this.costInsightsService.generateInsights(branchId, months);
  }

  /**
   * Get franchise-wide cost insights
   * @rbac L4+ (Regional Manager, Franchise Owner)
   */
  @Get('insights/franchise')
  @Roles('L4', 'L5')
  async getFranchiseCostInsights(
    @Request() req: any,
    @Query('periodMonths') periodMonths?: string,
  ) {
    const orgId = req.user.orgId;
    const months = periodMonths ? parseInt(periodMonths, 10) : 3;

    if (isNaN(months) || months < 1 || months > 12) {
      throw new BadRequestException('periodMonths must be between 1 and 12');
    }

    return this.costInsightsService.getFranchiseInsights(orgId, months);
  }

  /**
   * M24-S3: Get service reminders summary for a branch
   * @rbac L3+ (Procurement, Accountant)
   */
  @Get('reminders/summary')
  @Roles('L3', 'L4', 'L5')
  async getRemindersSummary(
    @Request() req: any,
    @Query('branchId') branchId?: string,
    @Query('days') days?: string,
  ) {
    const orgId = req.user.orgId;
    
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }

    // Get summary statistics
    const summary = await this.remindersService.getReminderSummary(orgId, branchId);

    // Get upcoming reminders (within next N days, default 30)
    const daysAhead = days ? parseInt(days, 10) : 30;
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + daysAhead);

    const upcoming = await this.remindersService.getReminders(
      orgId,
      branchId,
      undefined, // status
      undefined, // severity
      today,
      endDate,
    );

    return {
      branchId,
      days: daysAhead,
      counts: {
        overdue: summary.overdue,
        dueToday: summary.dueToday,
        dueSoon: summary.dueSoon,
        total: summary.total,
      },
      totalOutstanding: summary.totalAmount,
      upcoming: upcoming.slice(0, 10).map((r) => ({
        id: r.id,
        providerName: r.providerName || 'Unknown Provider',
        category: r.providerCategory || 'OTHER',
        dueDate: r.dueDate,
        amount: r.contractAmount || 0,
        severity: r.severity,
      })),
    };
  }
}
