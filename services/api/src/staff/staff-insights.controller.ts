/**
 * M19: Staff Insights Controller
 * 
 * Endpoints for staff insights, awards, and employee-of-period recommendations.
 */

import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { StaffInsightsService } from './staff-insights.service';
import {
  AwardPeriodType,
  AwardCategory,
  StaffInsightsQueryDto,
  GetEmployeeOfPeriodDto,
  CreateAwardDto,
  ListAwardsQueryDto,
} from './dto/staff-insights.dto';

@Controller('staff/insights')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffInsightsController {
  constructor(private readonly staffInsights: StaffInsightsService) {}

  /**
   * GET /staff/insights/rankings
   * Get ranked staff with performance + reliability
   * 
   * Access: L4+ (Managers, Owners, HR, Accountants)
   */
  @Get('rankings')
  @Roles('L4', 'L5', 'HR', 'ACCOUNTANT')
  async getRankings(@CurrentUser() user: any, @Query() query: StaffInsightsQueryDto) {
    const period = query.from && query.to
      ? this.staffInsights.resolvePeriod(query.periodType, new Date(query.from))
      : this.staffInsights.resolvePeriod(query.periodType, new Date());

    return this.staffInsights.getStaffInsights({
      orgId: user.orgId,
      branchId: query.branchId || null,
      from: period.start,
      to: period.end,
      periodType: query.periodType,
    });
  }

  /**
   * GET /staff/insights/employee-of-week
   * GET /staff/insights/employee-of-month
   * GET /staff/insights/employee-of-quarter
   * GET /staff/insights/employee-of-year
   * 
   * Get recommended employee-of-period
   * 
   * Access: L4+ (Managers, Owners, HR)
   */
  @Get('employee-of-:period')
  @Roles('L4', 'L5', 'HR')
  async getEmployeeOfPeriod(
    @CurrentUser() user: any,
    @Param('period') periodParam: string,
    @Query() query: GetEmployeeOfPeriodDto,
  ) {
    const periodType = periodParam.toUpperCase() as AwardPeriodType;

    if (!Object.values(AwardPeriodType).includes(periodType)) {
      throw new BadRequestException(`Invalid period type: ${periodParam}. Use: week, month, quarter, or year`);
    }

    const refDate = query.referenceDate ? new Date(query.referenceDate) : new Date();
    const period = this.staffInsights.resolvePeriod(periodType, refDate);

    const recommendation = await this.staffInsights.getAwardRecommendation(
      user.orgId,
      query.branchId || null,
      period,
      query.category || AwardCategory.TOP_PERFORMER,
    );

    if (!recommendation) {
      throw new NotFoundException('No eligible staff found for this period');
    }

    return recommendation;
  }

  /**
   * POST /staff/insights/awards
   * Create/persist an award
   * 
   * Access: L4+ (Managers, Owners, HR)
   */
  @Post('awards')
  @Roles('L4', 'L5', 'HR')
  async createAward(@CurrentUser() user: any, @Body() dto: CreateAwardDto) {
    const period = this.staffInsights.resolvePeriod(dto.periodType, new Date(dto.referenceDate));

    const recommendation = await this.staffInsights.getAwardRecommendation(
      user.orgId,
      dto.branchId || null,
      period,
      dto.category || AwardCategory.TOP_PERFORMER,
    );

    if (!recommendation) {
      throw new BadRequestException('No eligible staff for award in this period');
    }

    return this.staffInsights.createAward(
      {
        ...recommendation,
        orgId: user.orgId,
        branchId: dto.branchId || null,
      },
      period,
      user.userId,
    );
  }

  /**
   * GET /staff/insights/awards
   * List award history
   * 
   * Access: L4+ (Managers, Owners, HR, Accountants)
   */
  @Get('awards')
  @Roles('L4', 'L5', 'HR', 'ACCOUNTANT')
  async listAwards(@CurrentUser() user: any, @Query() query: ListAwardsQueryDto) {
    return this.staffInsights.listAwards({
      orgId: user.orgId,
      branchId: query.branchId,
      employeeId: query.employeeId,
      periodType: query.periodType,
      category: query.category,
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      toDate: query.toDate ? new Date(query.toDate) : undefined,
      limit: query.limit,
      offset: query.offset,
    });
  }

  /**
   * GET /staff/insights/me
   * Get current user's own insights (staff self-view)
   * 
   * Access: All authenticated users
   */
  @Get('me')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5', 'HR', 'ACCOUNTANT')
  async getMyInsights(@CurrentUser() user: any, @Query() query: StaffInsightsQueryDto) {
    const periodType = query.periodType || AwardPeriodType.MONTH;
    const period = this.staffInsights.resolvePeriod(periodType, new Date());

    // Find employee record for user
    const employee = await this.staffInsights['prisma'].employee.findFirst({
      where: { userId: user.userId, orgId: user.orgId },
    });

    if (!employee) {
      throw new NotFoundException('Employee record not found for current user');
    }

    const insights = await this.staffInsights.getStaffInsights({
      orgId: user.orgId,
      branchId: user.branchId || null,
      from: period.start,
      to: period.end,
      periodType,
    });

    // Filter to just this user
    const myInsight = insights.rankings.find((r) => r.employeeId === employee.id);

    return {
      ...myInsight,
      periodLabel: period.label,
      totalStaff: insights.summary.totalStaff,
      myRank: myInsight?.rank || null,
    };
  }
}
