/**
 * M22: Promotion Insights Controller
 *
 * API endpoints for promotion suggestions:
 * - Preview suggestions (read-only)
 * - Generate & persist suggestions (L5/HR only)
 * - List historical suggestions
 * - Update suggestion status (L4+/HR)
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PromotionInsightsService } from './promotion-insights.service';
import {
  PreviewSuggestionsQueryDto,
  GenerateSuggestionsDto,
  ListSuggestionsQueryDto,
  UpdateSuggestionStatusDto,
  SuggestionCategory,
  SuggestionStatus,
} from './dto/promotion-insights.dto';
import { AwardPeriodType } from './dto/staff-insights.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RoleLevel } from '@chefcloud/db';

@ApiTags('staff')
@ApiBearerAuth()
@Controller('staff/promotion-suggestions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PromotionInsightsController {
  constructor(private readonly promotionInsights: PromotionInsightsService) {}

  /**
   * GET /staff/promotion-suggestions/preview
   * Preview suggestions without persistence (what-if analysis)
   * RBAC: L4+ (MANAGER, OWNER, HR, ACCOUNTANT)
   */
  @Get('preview')
  @Roles(RoleLevel.L4, RoleLevel.L5)
  @ApiOperation({ summary: 'Preview promotion suggestions without saving' })
  @ApiResponse({ status: 200, description: 'Suggestions computed successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires L4+ role' })
  async previewSuggestions(@Query() query: PreviewSuggestionsQueryDto, @CurrentUser() user: any) {
    const categories = query.categories
      ? query.categories
          .split(',')
          .filter((c) => Object.values(SuggestionCategory).includes(c as any))
      : undefined;

    const config = {
      minScoreThreshold: query.minScore,
      categories: categories as SuggestionCategory[] | undefined,
    };

    const from = query.from ? new Date(query.from) : new Date();
    const to = query.to ? new Date(query.to) : new Date();

    return this.promotionInsights.computeSuggestions({
      orgId: user.orgId,
      branchId: query.branchId || null,
      periodType: query.periodType || AwardPeriodType.WEEK,
      from,
      to,
      config,
    });
  }

  /**
   * POST /staff/promotion-suggestions/generate
   * Generate AND persist suggestions (idempotent)
   * RBAC: L5 (OWNER) or HR
   */
  @Post('generate')
  @Roles(RoleLevel.L5)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate and persist promotion suggestions' })
  @ApiResponse({ status: 201, description: 'Suggestions generated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires L5 role' })
  async generateSuggestions(@Body() body: GenerateSuggestionsDto, @CurrentUser() user: any) {
    const from = body.from ? new Date(body.from) : new Date();
    const to = body.to ? new Date(body.to) : new Date();

    const config = body.config
      ? {
          minScoreThreshold: body.config.minScore,
          minTenureMonths: body.config.minTenureMonths,
          categories: body.config.categories,
        }
      : undefined;

    const result = await this.promotionInsights.generateAndPersistSuggestions(
      {
        orgId: user.orgId,
        branchId: body.branchId || null,
        periodType: body.periodType || AwardPeriodType.WEEK,
        from,
        to,
        config,
      },
      {
        userId: user.id,
        roles: [user.roleLevel],
      },
    );

    // Get summary stats
    const summary = await this.promotionInsights.getSuggestionSummary({
      orgId: user.orgId,
      branchId: body.branchId,
      periodType: body.periodType || AwardPeriodType.WEEK,
      periodStart: from,
      periodEnd: to,
    });

    return {
      created: result.created.map((s: any) => ({
        id: s.id,
        employeeId: s.employeeId,
        displayName: `${s.employee.firstName} ${s.employee.lastName}`,
        category: s.category,
        score: Number(s.scoreAtSuggestion),
        reason: s.reason,
        status: s.status,
        createdAt: s.createdAt,
      })),
      updated: result.updated.map((s: any) => ({
        id: s.id,
        employeeId: s.employeeId,
        displayName: `${s.employee.firstName} ${s.employee.lastName}`,
        category: s.category,
        score: Number(s.scoreAtSuggestion),
        reason: s.reason,
        status: s.status,
        createdAt: s.createdAt,
      })),
      total: result.total,
      summary: {
        byCategory: summary.byCategory,
        byStatus: summary.byStatus,
      },
    };
  }

  /**
   * GET /staff/promotion-suggestions
   * List historical suggestions with filters
   * RBAC: L4+ (MANAGER, OWNER, HR, ACCOUNTANT)
   */
  @Get()
  @Roles(RoleLevel.L4, RoleLevel.L5)
  @ApiOperation({ summary: 'List promotion suggestions with filters' })
  @ApiResponse({ status: 200, description: 'Suggestions retrieved successfully' })
  async listSuggestions(@Query() query: ListSuggestionsQueryDto, @CurrentUser() user: any) {
    const fromDate = query.fromDate ? new Date(query.fromDate) : undefined;
    const toDate = query.toDate ? new Date(query.toDate) : undefined;

    const result = await this.promotionInsights.listSuggestions({
      orgId: user.orgId,
      branchId: query.branchId,
      employeeId: query.employeeId,
      periodType: query.periodType,
      category: query.category,
      status: query.status,
      fromDate,
      toDate,
      limit: query.limit,
      offset: query.offset,
    });

    return {
      suggestions: result.suggestions.map((s) => ({
        id: s.id,
        orgId: s.orgId,
        branchId: s.branchId,
        employeeId: s.employeeId,
        employee: {
          id: s.employee.id,
          firstName: s.employee.firstName,
          lastName: s.employee.lastName,
          position: s.employee.position,
          employeeCode: s.employee.employeeCode,
        },
        branchName: s.branch?.name || null,
        periodType: s.periodType,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        category: s.category,
        scoreAtSuggestion: s.scoreAtSuggestion,
        reason: s.reason,
        status: s.status,
        statusUpdatedAt: s.statusUpdatedAt,
        statusUpdatedById: s.statusUpdatedById,
        decisionNotes: s.decisionNotes,
        createdAt: s.createdAt,
      })),
      total: result.total,
      pagination: {
        limit: query.limit || 50,
        offset: query.offset || 0,
        hasMore: result.total > (query.offset || 0) + (query.limit || 50),
      },
    };
  }

  /**
   * PATCH /staff/promotion-suggestions/:id
   * Update suggestion status (accept/reject/ignore)
   * RBAC: L4+ (MANAGER, OWNER, HR)
   */
  @Patch(':id')
  @Roles(RoleLevel.L4, RoleLevel.L5)
  @ApiOperation({ summary: 'Update suggestion status' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot change from ACCEPTED/REJECTED' })
  @ApiResponse({ status: 404, description: 'Suggestion not found' })
  async updateSuggestionStatus(
    @Param('id') id: string,
    @Body() body: UpdateSuggestionStatusDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.promotionInsights.updateSuggestionStatus(
      id,
      {
        status: body.status || SuggestionStatus.PENDING,
        decisionNotes: body.decisionNotes,
      },
      {
        userId: user.id,
        roles: [user.roleLevel],
      },
    );

    return {
      id: result.id,
      employeeId: result.employeeId,
      displayName: `${result.employee.firstName} ${result.employee.lastName}`,
      category: result.category,
      status: result.status,
      statusUpdatedAt: result.statusUpdatedAt,
      statusUpdatedById: result.statusUpdatedById,
      decisionNotes: result.decisionNotes,
      updatedAt: result.statusUpdatedAt,
    };
  }
}
