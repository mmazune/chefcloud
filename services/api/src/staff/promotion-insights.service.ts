/**
 * M22: Promotion Insights Service
 *
 * Thin wrapper around M19 StaffInsightsService to:
 * - Preview promotion candidates
 * - Generate & persist promotion suggestions
 * - Track decision history (ACCEPTED/REJECTED/IGNORED)
 * - Provide aggregated summaries for digests
 *
 * Design: Composition over modification - reuses M19 without changes.
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StaffInsightsService } from './staff-insights.service';
import {
  SuggestionCategory,
  SuggestionStatus,
  SuggestionConfig,
  PromotionSuggestionDTO,
  PromotionSuggestionWithEmployee,
  SuggestionSummary,
} from './dto/promotion-insights.dto';
import { AwardPeriodType, CombinedStaffMetrics } from './dto/staff-insights.dto';
import { differenceInMonths } from 'date-fns';

@Injectable()
export class PromotionInsightsService {
  private readonly logger = new Logger(PromotionInsightsService.name);

  // Default thresholds (can be made configurable via org settings)
  private readonly DEFAULT_CONFIG: Required<SuggestionConfig> = {
    minScoreThreshold: 0.7,
    minTenureMonths: 3,
    maxAbsenceRate: 0.1,
    excludeRiskLevels: ['CRITICAL'],
    categories: [SuggestionCategory.PROMOTION, SuggestionCategory.TRAINING],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly staffInsights: StaffInsightsService,
  ) {}

  /**
   * Preview promotion suggestions without persistence
   */
  async computeSuggestions(query: {
    orgId: string;
    branchId?: string | null;
    periodType: AwardPeriodType;
    from: Date;
    to: Date;
    config?: SuggestionConfig;
  }): Promise<PromotionSuggestionDTO[]> {
    this.logger.log(
      `Computing promotion suggestions for org ${query.orgId}, period ${query.periodType}`,
    );

    const config = { ...this.DEFAULT_CONFIG, ...query.config };
    const period = this.staffInsights['resolvePeriod'](query.periodType, query.from);

    // Get ranked staff from M19
    const insights = await this.staffInsights.getStaffInsights({
      orgId: query.orgId,
      branchId: query.branchId,
      from: period.start,
      to: period.end,
      periodType: query.periodType,
    });

    // Apply M22-specific rules
    const suggestions: PromotionSuggestionDTO[] = [];

    for (const staff of insights.rankings) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: staff.employeeId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          hiredAt: true,
        },
      });

      if (!employee) continue;

      const tenureMonths = differenceInMonths(new Date(), employee.hiredAt);
      const displayName = `${employee.firstName} ${employee.lastName}`;

      // PROMOTION: High performer with tenure
      if (config.categories.includes(SuggestionCategory.PROMOTION)) {
        if (
          staff.compositeScore >= config.minScoreThreshold &&
          tenureMonths >= config.minTenureMonths &&
          (staff.reliabilityMetrics?.attendanceRate || 0) >= 0.9 &&
          !staff.isCriticalRisk // Exclude CRITICAL risk staff
        ) {
          suggestions.push({
            employeeId: staff.employeeId,
            displayName,
            category: SuggestionCategory.PROMOTION,
            scoreAtSuggestion: staff.compositeScore,
            reason: this.generatePromotionReason(staff, tenureMonths),
            metrics: {
              compositeScore: staff.compositeScore,
              performanceScore: staff.performanceScore,
              reliabilityScore: staff.reliabilityScore,
              totalSales: staff.performanceMetrics.totalSales,
              attendanceRate: staff.reliabilityMetrics?.attendanceRate || 0,
            },
          });
        }
      }

      // TRAINING: Low specific metrics
      if (config.categories.includes(SuggestionCategory.TRAINING)) {
        const trainingNeeds = this.detectTrainingNeeds(staff);
        if (trainingNeeds && tenureMonths >= 1) {
          suggestions.push({
            employeeId: staff.employeeId,
            displayName,
            category: SuggestionCategory.TRAINING,
            scoreAtSuggestion: staff.compositeScore,
            reason: trainingNeeds.reason,
            metrics: {
              compositeScore: staff.compositeScore,
              performanceScore: staff.performanceScore,
              reliabilityScore: staff.reliabilityScore,
              totalSales: staff.performanceMetrics.totalSales,
              attendanceRate: staff.reliabilityMetrics?.attendanceRate || 0,
            },
          });
        }
      }

      // PERFORMANCE_REVIEW: Top or bottom 10%
      if (config.categories.includes(SuggestionCategory.PERFORMANCE_REVIEW)) {
        if (staff.compositeScore >= 0.85 || staff.compositeScore <= 0.5) {
          const reviewType = staff.compositeScore >= 0.85 ? 'fast-track' : 'improvement';
          suggestions.push({
            employeeId: staff.employeeId,
            displayName,
            category: SuggestionCategory.PERFORMANCE_REVIEW,
            scoreAtSuggestion: staff.compositeScore,
            reason: this.generateReviewReason(staff, reviewType),
            metrics: {
              compositeScore: staff.compositeScore,
              performanceScore: staff.performanceScore,
              reliabilityScore: staff.reliabilityScore,
              totalSales: staff.performanceMetrics.totalSales,
              attendanceRate: staff.reliabilityMetrics?.attendanceRate || 0,
            },
          });
        }
      }
    }

    this.logger.log(`Generated ${suggestions.length} suggestions for org ${query.orgId}`);
    return suggestions;
  }

  /**
   * Generate and persist suggestions (idempotent)
   */
  async generateAndPersistSuggestions(
    query: {
      orgId: string;
      branchId?: string | null;
      periodType: AwardPeriodType;
      from: Date;
      to: Date;
      config?: SuggestionConfig;
    },
    actor: { userId: string; roles: string[] },
  ): Promise<{
    created: any[];
    updated: any[];
    total: number;
  }> {
    this.logger.log(
      `Persisting promotion suggestions for org ${query.orgId}, actor ${actor.userId}`,
    );

    const suggestions = await this.computeSuggestions(query);
    const period = this.staffInsights['resolvePeriod'](query.periodType, query.from);

    const created = [];
    const updated = [];

    for (const sug of suggestions) {
      const existing = await this.prisma.client.promotionSuggestion.findUnique({
        where: {
          orgId_employeeId_periodType_periodStart_category: {
            orgId: query.orgId,
            employeeId: sug.employeeId,
            periodType: query.periodType,
            periodStart: period.start,
            category: sug.category as any,
          },
        },
      });

      const result = await this.prisma.client.promotionSuggestion.upsert({
        where: {
          orgId_employeeId_periodType_periodStart_category: {
            orgId: query.orgId,
            employeeId: sug.employeeId,
            periodType: query.periodType,
            periodStart: period.start,
            category: sug.category as any,
          },
        },
        create: {
          orgId: query.orgId,
          branchId: query.branchId,
          employeeId: sug.employeeId,
          periodType: query.periodType,
          periodStart: period.start,
          periodEnd: period.end,
          category: sug.category as any,
          scoreAtSuggestion: sug.scoreAtSuggestion,
          insightsSnapshot: sug.metrics as any,
          reason: sug.reason,
          status: 'PENDING',
          createdById: actor.userId,
        },
        update: {
          // Only update if PENDING (preserve ACCEPTED/REJECTED)
          ...(existing?.status === 'PENDING'
            ? {
                scoreAtSuggestion: sug.scoreAtSuggestion,
                insightsSnapshot: sug.metrics as any,
                reason: sug.reason,
              }
            : {}),
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              position: true,
              employeeCode: true,
            },
          },
        },
      });

      if (existing) {
        updated.push(result);
      } else {
        created.push(result);
      }
    }

    this.logger.log(`Created ${created.length}, updated ${updated.length} suggestions`);

    return {
      created,
      updated,
      total: created.length + updated.length,
    };
  }

  /**
   * List suggestions with filters
   */
  async listSuggestions(filter: {
    orgId: string;
    branchId?: string;
    employeeId?: string;
    periodType?: AwardPeriodType;
    category?: SuggestionCategory;
    status?: SuggestionStatus;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
    suggestions: PromotionSuggestionWithEmployee[];
    total: number;
  }> {
    const where: any = { orgId: filter.orgId };

    if (filter.branchId) where.branchId = filter.branchId;
    if (filter.employeeId) where.employeeId = filter.employeeId;
    if (filter.periodType) where.periodType = filter.periodType;
    if (filter.category) where.category = filter.category;
    if (filter.status) where.status = filter.status;
    if (filter.fromDate) where.periodStart = { gte: filter.fromDate };
    if (filter.toDate) where.periodEnd = { lte: filter.toDate };

    const limit = Math.min(filter.limit || 50, 200);
    const offset = filter.offset || 0;

    const [suggestions, total] = await Promise.all([
      this.prisma.client.promotionSuggestion.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              position: true,
              employeeCode: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ periodStart: 'desc' }, { scoreAtSuggestion: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.client.promotionSuggestion.count({ where }),
    ]);

    return { suggestions: suggestions as any, total };
  }

  /**
   * Update suggestion status
   */
  async updateSuggestionStatus(
    suggestionId: string,
    update: {
      status: SuggestionStatus;
      decisionNotes?: string;
    },
    actor: { userId: string; roles: string[] },
  ): Promise<any> {
    const suggestion = await this.prisma.client.promotionSuggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion) {
      throw new NotFoundException('Suggestion not found');
    }

    // Prevent changing from ACCEPTED/REJECTED
    if (['ACCEPTED', 'REJECTED'].includes(suggestion.status)) {
      if (update.status !== suggestion.status) {
        throw new BadRequestException('Cannot change status from ACCEPTED/REJECTED');
      }
    }

    return this.prisma.client.promotionSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: update.status as any,
        statusUpdatedAt: new Date(),
        statusUpdatedById: actor.userId,
        decisionNotes: update.decisionNotes || suggestion.decisionNotes,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
          },
        },
      },
    });
  }

  /**
   * Get aggregated summary for a period (used in digests)
   */
  async getSuggestionSummary(query: {
    orgId: string;
    branchId?: string;
    periodType: AwardPeriodType;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<SuggestionSummary> {
    const where: any = {
      orgId: query.orgId,
      periodType: query.periodType,
      periodStart: query.periodStart,
    };

    if (query.branchId) where.branchId = query.branchId;

    const suggestions = await this.prisma.client.promotionSuggestion.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { scoreAtSuggestion: 'desc' },
      take: 3,
    });

    const byCategoryRaw = await this.prisma.client.promotionSuggestion.groupBy({
      by: ['category'],
      where,
      _count: { category: true },
    });

    const byStatusRaw = await this.prisma.client.promotionSuggestion.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    });

    const byCategory: Record<SuggestionCategory, number> = {
      [SuggestionCategory.PROMOTION]: 0,
      [SuggestionCategory.ROLE_CHANGE]: 0,
      [SuggestionCategory.TRAINING]: 0,
      [SuggestionCategory.PERFORMANCE_REVIEW]: 0,
    };

    const byStatus: Record<SuggestionStatus, number> = {
      [SuggestionStatus.PENDING]: 0,
      [SuggestionStatus.ACCEPTED]: 0,
      [SuggestionStatus.REJECTED]: 0,
      [SuggestionStatus.IGNORED]: 0,
    };

    byCategoryRaw.forEach((g) => {
      byCategory[g.category as SuggestionCategory] = g._count.category;
    });

    byStatusRaw.forEach((g) => {
      byStatus[g.status as SuggestionStatus] = g._count.status;
    });

    return {
      totalSuggestions: suggestions.length,
      byCategory,
      byStatus,
      topSuggestions: suggestions.map((s) => ({
        employeeId: s.employeeId,
        displayName: `${s.employee.firstName} ${s.employee.lastName}`,
        category: s.category as SuggestionCategory,
        score: Number(s.scoreAtSuggestion),
        reason: s.reason,
        status: s.status as SuggestionStatus,
      })),
    };
  }

  // ===== PRIVATE HELPERS =====

  private generatePromotionReason(staff: CombinedStaffMetrics, tenureMonths: number): string {
    const attendance = ((staff.reliabilityMetrics?.attendanceRate || 0) * 100).toFixed(0);
    const rank = staff.compositeScore >= 0.85 ? 'top 15%' : 'top 30%';

    return `Consistently high performer (${rank}) with ${attendance}% attendance rate and ${tenureMonths} months tenure. No disciplinary issues.`;
  }

  private detectTrainingNeeds(staff: CombinedStaffMetrics): { reason: string } | null {
    const avgCheck = staff.performanceMetrics.avgCheckSize;
    const voidRate =
      staff.performanceMetrics.voidCount / (staff.performanceMetrics.orderCount || 1);
    const noDrinksRate = staff.performanceMetrics.noDrinksRate;

    // Low avg check → upselling training
    if (avgCheck > 0 && avgCheck < 15000) {
      return {
        reason: `Average check size (${avgCheck.toFixed(0)} UGX) below target - suggest upselling training to improve customer spend.`,
      };
    }

    // High void rate → POS training
    if (voidRate > 0.05) {
      return {
        reason: `Void rate (${(voidRate * 100).toFixed(1)}%) above acceptable threshold (5%) - suggest POS system training to reduce order errors.`,
      };
    }

    // High no-drinks rate → suggestive selling training
    if (noDrinksRate > 0.1) {
      return {
        reason: `No-drinks rate (${(noDrinksRate * 100).toFixed(1)}%) above target (10%) - suggest suggestive selling training to increase beverage sales.`,
      };
    }

    return null;
  }

  private generateReviewReason(
    staff: CombinedStaffMetrics,
    type: 'fast-track' | 'improvement',
  ): string {
    const score = (staff.compositeScore * 100).toFixed(0);

    if (type === 'fast-track') {
      return `Top 5% performer with composite score ${score}% - recommend for fast-track promotion review and career development discussion.`;
    } else {
      return `Bottom 10% performer with declining metrics over period - recommend improvement plan, coaching, and performance review within 30 days.`;
    }
  }
}
