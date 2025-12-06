/**
 * M19: Staff Insights Service
 *
 * Combines performance metrics (M5) with reliability metrics (M9) to provide:
 * - Comprehensive staff rankings
 * - Automated employee-of-week/month recommendations
 * - Award history persistence
 *
 * Design: Composition over modification - orchestrates existing services without changing them.
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WaiterMetricsService } from './waiter-metrics.service';
// import { AttendanceService } from '../hr/attendance.service'; // Unused for now
import { AntiTheftService } from '../anti-theft/anti-theft.service';
import {
  AwardPeriodType,
  AwardCategory,
  ReliabilityMetrics,
  CombinedStaffMetrics,
  Period,
  EligibilityRules,
  StaffInsights,
  AwardRecommendation,
} from './dto/staff-insights.dto';
import {
  startOfISOWeek,
  endOfISOWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  getISOWeek,
  getQuarter,
  format,
} from 'date-fns';
import { Prisma } from '@chefcloud/db';

@Injectable()
export class StaffInsightsService {
  private readonly logger = new Logger(StaffInsightsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly waiterMetrics: WaiterMetricsService,
    // private readonly attendance: AttendanceService, // Unused for now
    @Inject(forwardRef(() => AntiTheftService))
    private readonly antiTheft: AntiTheftService,
  ) {}

  /**
   * Get comprehensive staff insights for a period
   */
  async getStaffInsights(query: {
    orgId: string;
    branchId?: string | null;
    from: Date;
    to: Date;
    periodType: AwardPeriodType;
  }): Promise<StaffInsights> {
    this.logger.log(`Getting staff insights for org ${query.orgId}, period ${query.periodType}`);

    const period = this.resolvePeriod(query.periodType, query.from);

    // 1. Get performance metrics from M5
    const performanceRankings = await this.waiterMetrics.getRankedWaiters(
      {
        orgId: query.orgId,
        branchId: query.branchId || undefined,
        from: period.start,
        to: period.end,
      },
      // Use default scoring config
      undefined,
    );

    // 2. Get reliability metrics from M9
    const reliabilityMetrics = await this.getReliabilityMetrics({
      orgId: query.orgId,
      branchId: query.branchId || undefined,
      from: period.start,
      to: period.end,
    });

    // 3. Get risk flags from M5 anti-theft
    const riskSummary = await this.antiTheft.getAntiTheftSummary(
      query.orgId,
      query.branchId || undefined,
      undefined, // shiftId
      period.start,
      period.end,
    );

    // 4. Combine metrics
    const combined = this.combineMetrics(performanceRankings, reliabilityMetrics, riskSummary);

    // 5. Apply eligibility filters
    const eligibilityRules = this.getEligibilityRules(query.periodType);
    const eligible = this.filterEligible(combined, eligibilityRules);

    // 6. Re-rank by composite score
    const finalRankings = this.rankByComposite(eligible);

    return {
      rankings: finalRankings,
      period,
      eligibilityRules,
      summary: {
        totalStaff: combined.length,
        eligibleStaff: finalRankings.length,
        averageScore:
          finalRankings.length > 0
            ? finalRankings.reduce((sum, r) => sum + r.compositeScore, 0) / finalRankings.length
            : 0,
      },
    };
  }

  /**
   * Get award recommendation for a period
   */
  async getAwardRecommendation(
    orgId: string,
    branchId: string | null,
    period: Period,
    category: AwardCategory = AwardCategory.TOP_PERFORMER,
  ): Promise<AwardRecommendation | null> {
    const insights = await this.getStaffInsights({
      orgId,
      branchId,
      from: period.start,
      to: period.end,
      periodType: period.type,
    });

    if (insights.rankings.length === 0) {
      this.logger.warn(`No eligible staff for award in org ${orgId}, period ${period.label}`);
      return null;
    }

    // Select winner based on category
    const winner = this.selectWinnerByCategory(insights.rankings, category);
    const reason = this.generateAwardReason(winner, category);

    return {
      employeeId: winner.employeeId,
      userId: winner.userId,
      displayName: winner.displayName,
      category,
      score: winner.compositeScore,
      rank: 1,
      performanceScore: winner.performanceScore,
      reliabilityScore: winner.reliabilityScore,
      metrics: {
        performance: winner.performanceMetrics,
        reliability: winner.reliabilityMetrics,
      },
      reason,
      periodLabel: period.label,
      eligibilityPassed: true,
    };
  }

  /**
   * Create/persist an award (idempotent)
   */
  async createAward(
    recommendation: AwardRecommendation & { orgId: string; branchId?: string | null },
    period: Period,
    createdById: string,
  ): Promise<any> {
    return this.prisma.staffAward.upsert({
      where: {
        orgId_employeeId_periodType_periodStart_rank: {
          orgId: recommendation.orgId,
          employeeId: recommendation.employeeId,
          periodType: period.type,
          periodStart: period.start,
          rank: recommendation.rank,
        },
      },
      create: {
        orgId: recommendation.orgId,
        branchId: recommendation.branchId,
        employeeId: recommendation.employeeId,
        periodType: period.type,
        periodStart: period.start,
        periodEnd: period.end,
        category: recommendation.category,
        rank: recommendation.rank,
        score: recommendation.score,
        reason: recommendation.reason,
        scoreSnapshot: recommendation.metrics as any,
        createdById,
      },
      update: {
        // Allow re-computing if needed
        score: recommendation.score,
        reason: recommendation.reason,
        scoreSnapshot: recommendation.metrics as any,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            position: true,
          },
        },
      },
    });
  }

  /**
   * List awards with filters
   */
  async listAwards(query: {
    orgId: string;
    branchId?: string;
    employeeId?: string;
    periodType?: AwardPeriodType;
    category?: AwardCategory;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const where: Prisma.StaffAwardWhereInput = {
      orgId: query.orgId,
    };

    if (query.branchId) where.branchId = query.branchId;
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.periodType) where.periodType = query.periodType;
    if (query.category) where.category = query.category;
    if (query.fromDate) where.periodStart = { gte: query.fromDate };
    if (query.toDate) where.periodEnd = { lte: query.toDate };

    return this.prisma.staffAward.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            position: true,
          },
        },
      },
      orderBy: [{ periodStart: 'desc' }, { rank: 'asc' }],
      take: query.limit || 50,
      skip: query.offset || 0,
    });
  }

  /**
   * Resolve period dates from type and reference date
   */
  resolvePeriod(periodType: AwardPeriodType, referenceDate: Date): Period {
    switch (periodType) {
      case AwardPeriodType.WEEK: {
        const weekStart = startOfISOWeek(referenceDate);
        const weekEnd = endOfISOWeek(referenceDate);
        const weekNumber = getISOWeek(referenceDate);
        return {
          type: AwardPeriodType.WEEK,
          start: weekStart,
          end: weekEnd,
          label: `Week ${weekNumber}, ${weekStart.getFullYear()}`,
        };
      }

      case AwardPeriodType.MONTH: {
        const monthStart = startOfMonth(referenceDate);
        const monthEnd = endOfMonth(referenceDate);
        return {
          type: AwardPeriodType.MONTH,
          start: monthStart,
          end: monthEnd,
          label: format(monthStart, 'MMMM yyyy'),
        };
      }

      case AwardPeriodType.QUARTER: {
        const quarterStart = startOfQuarter(referenceDate);
        const quarterEnd = endOfQuarter(referenceDate);
        const quarter = getQuarter(referenceDate);
        return {
          type: AwardPeriodType.QUARTER,
          start: quarterStart,
          end: quarterEnd,
          label: `Q${quarter} ${quarterStart.getFullYear()}`,
        };
      }

      case AwardPeriodType.YEAR: {
        const yearStart = startOfYear(referenceDate);
        const yearEnd = endOfYear(referenceDate);
        return {
          type: AwardPeriodType.YEAR,
          start: yearStart,
          end: yearEnd,
          label: String(yearStart.getFullYear()),
        };
      }
    }
  }

  // ===== Private Helper Methods =====

  private async getReliabilityMetrics(query: {
    orgId: string;
    branchId?: string;
    from: Date;
    to: Date;
  }): Promise<ReliabilityMetrics[]> {
    // Get active employees
    const employees = await this.prisma.employee.findMany({
      where: {
        orgId: query.orgId,
        branchId: query.branchId || undefined,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
      },
    });

    if (employees.length === 0) {
      return [];
    }

    // Get attendance records for period
    const attendanceRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        orgId: query.orgId,
        branchId: query.branchId || undefined,
        date: { gte: query.from, lte: query.to },
        employeeId: { in: employees.map((e) => e.id) },
      },
    });

    // Get scheduled shifts for period
    const dutyShifts = await this.prisma.dutyShift.findMany({
      where: {
        orgId: query.orgId,
        branchId: query.branchId || undefined,
        startsAt: { gte: query.from, lte: query.to },
        userId: { in: employees.map((e) => e.userId).filter((id): id is string => id !== null) },
      },
    });

    // Aggregate per employee
    return employees.map((employee) => {
      const empAttendance = attendanceRecords.filter((a) => a.employeeId === employee.id);
      const empScheduled = dutyShifts.filter((ds) => ds.userId === employee.userId);

      const shiftsScheduled = empScheduled.length;
      const shiftsWorked = empAttendance.filter((a) => a.status === 'PRESENT').length;
      const shiftsAbsent = empAttendance.filter((a) => a.status === 'ABSENT').length;
      const lateCount = empAttendance.filter((a) => a.status === 'LATE').length;
      const leftEarlyCount = empAttendance.filter((a) => a.status === 'LEFT_EARLY').length;
      const coverShiftsCount = empAttendance.filter((a) => a.coveredForEmployeeId !== null).length;

      const attendanceRate = shiftsScheduled > 0 ? shiftsWorked / shiftsScheduled : 0;

      const reliabilityScore = this.calculateReliabilityScore({
        attendanceRate,
        lateCount,
        leftEarlyCount,
        coverShiftsCount,
        shiftsWorked,
      });

      return {
        employeeId: employee.id,
        userId: employee.userId,
        displayName: `${employee.firstName} ${employee.lastName}`,
        shiftsScheduled,
        shiftsWorked,
        shiftsAbsent,
        lateCount,
        leftEarlyCount,
        coverShiftsCount,
        attendanceRate,
        reliabilityScore,
      };
    });
  }

  private calculateReliabilityScore(data: {
    attendanceRate: number;
    lateCount: number;
    leftEarlyCount: number;
    coverShiftsCount: number;
    shiftsWorked: number;
  }): number {
    const { attendanceRate, lateCount, leftEarlyCount, coverShiftsCount, shiftsWorked } = data;

    if (shiftsWorked === 0) return 0;

    const lateRatio = lateCount / shiftsWorked;
    const leftEarlyRatio = leftEarlyCount / shiftsWorked;
    const coverRatio = Math.min(coverShiftsCount / shiftsWorked, 1.0); // Cap at 1.0

    const score =
      attendanceRate * 0.5 - // 50% weight on attendance
      lateRatio * 0.2 - // 20% penalty for late
      leftEarlyRatio * 0.15 + // 15% penalty for leaving early
      coverRatio * 0.1 - // 10% bonus for covering shifts
      (1 - attendanceRate) * 0.05; // 5% penalty for absences

    return Math.max(0, Math.min(1, score)); // Clamp to [0, 1]
  }

  private combineMetrics(
    performanceRankings: any[],
    reliabilityMetrics: ReliabilityMetrics[],
    riskSummary: any,
  ): CombinedStaffMetrics[] {
    const reliabilityMap = new Map(reliabilityMetrics.map((r) => [r.userId, r]));
    const riskMap = new Map(
      (riskSummary.flaggedStaff || []).map((f: any) => [f.metrics.userId, f]),
    );

    return performanceRankings.map((perf) => {
      const reliability =
        reliabilityMap.get(perf.userId) ||
        this.getDefaultReliability(perf.userId, perf.displayName);
      const risk = riskMap.get(perf.userId);

      const compositeScore = this.calculateCompositeScore(perf.score, reliability.reliabilityScore);

      return {
        userId: perf.userId,
        employeeId: reliability.employeeId,
        displayName: perf.displayName,
        performanceScore: perf.score,
        reliabilityScore: reliability.reliabilityScore,
        compositeScore,
        performanceMetrics: perf,
        reliabilityMetrics: reliability,
        riskFlags: (risk as any)?.violations || [],
        isCriticalRisk: (risk as any)?.violations ? (risk as any).violations.some((v: any) => v.severity === 'CRITICAL') : false,
      };
    });
  }

  private getDefaultReliability(userId: string | null, displayName: string): ReliabilityMetrics {
    return {
      employeeId: '',
      userId,
      displayName,
      shiftsScheduled: 0,
      shiftsWorked: 0,
      shiftsAbsent: 0,
      lateCount: 0,
      leftEarlyCount: 0,
      coverShiftsCount: 0,
      attendanceRate: 0,
      reliabilityScore: 0,
    };
  }

  private calculateCompositeScore(performanceScore: number, reliabilityScore: number): number {
    const composite = performanceScore * 0.7 + reliabilityScore * 0.3;
    return Math.max(0, Math.min(1, composite));
  }

  private filterEligible(
    combined: CombinedStaffMetrics[],
    rules: EligibilityRules,
  ): CombinedStaffMetrics[] {
    return combined.filter((staff) => {
      // Must not be critical risk
      if (staff.isCriticalRisk) {
        staff.isEligible = false;
        staff.eligibilityReason = 'Excluded: Critical risk flag';
        return false;
      }

      // Must meet minimum shifts
      if (staff.reliabilityMetrics.shiftsWorked < rules.minShifts) {
        staff.isEligible = false;
        staff.eligibilityReason = `Excluded: Only ${staff.reliabilityMetrics.shiftsWorked} shifts (min ${rules.minShifts})`;
        return false;
      }

      // Must meet absence rate threshold
      if (rules.maxAbsenceRate !== null) {
        const absenceRate =
          staff.reliabilityMetrics.shiftsScheduled > 0
            ? staff.reliabilityMetrics.shiftsAbsent / staff.reliabilityMetrics.shiftsScheduled
            : 0;
        if (absenceRate > rules.maxAbsenceRate) {
          staff.isEligible = false;
          staff.eligibilityReason = `Excluded: ${(absenceRate * 100).toFixed(0)}% absence rate (max ${(rules.maxAbsenceRate * 100).toFixed(0)}%)`;
          return false;
        }
      }

      staff.isEligible = true;
      return true;
    });
  }

  private rankByComposite(combined: CombinedStaffMetrics[]): CombinedStaffMetrics[] {
    // Sort by composite score descending
    const sorted = combined.sort((a, b) => b.compositeScore - a.compositeScore);

    // Assign ranks
    sorted.forEach((staff, index) => {
      staff.rank = index + 1;
    });

    return sorted;
  }

  private getEligibilityRules(periodType: AwardPeriodType): EligibilityRules {
    switch (periodType) {
      case AwardPeriodType.WEEK:
        return {
          minShifts: 3,
          maxAbsenceRate: null,
          requireActiveStatus: true,
          excludeCriticalRisk: true,
        };
      case AwardPeriodType.MONTH:
        return {
          minShifts: 10,
          maxAbsenceRate: 0.2,
          requireActiveStatus: true,
          excludeCriticalRisk: true,
        };
      case AwardPeriodType.QUARTER:
        return {
          minShifts: 30,
          maxAbsenceRate: 0.15,
          requireActiveStatus: true,
          excludeCriticalRisk: true,
        };
      case AwardPeriodType.YEAR:
        return {
          minShifts: 120,
          maxAbsenceRate: 0.15,
          requireActiveStatus: true,
          excludeCriticalRisk: true,
        };
    }
  }

  private selectWinnerByCategory(
    rankings: CombinedStaffMetrics[],
    category: AwardCategory,
  ): CombinedStaffMetrics {
    switch (category) {
      case AwardCategory.TOP_PERFORMER:
        // Already sorted by composite score
        return rankings[0];

      case AwardCategory.HIGHEST_SALES:
        return rankings.sort(
          (a, b) => b.performanceMetrics.totalSales - a.performanceMetrics.totalSales,
        )[0];

      case AwardCategory.BEST_SERVICE:
        return rankings.sort(
          (a, b) => b.performanceMetrics.avgCheckSize - a.performanceMetrics.avgCheckSize,
        )[0];

      case AwardCategory.MOST_RELIABLE:
        return rankings.sort((a, b) => b.reliabilityScore - a.reliabilityScore)[0];

      case AwardCategory.MOST_IMPROVED:
        // TODO: Implement comparison with previous period
        return rankings[0];

      default:
        return rankings[0];
    }
  }

  private generateAwardReason(winner: CombinedStaffMetrics, category: AwardCategory): string {
    const { performanceMetrics: p, reliabilityMetrics: r, riskFlags } = winner;
    const reasons: string[] = [];

    switch (category) {
      case AwardCategory.TOP_PERFORMER:
        reasons.push(`Highest composite score (${winner.compositeScore.toFixed(2)})`);
        reasons.push(`Generated UGX ${p.totalSales.toLocaleString()} in sales`);
        reasons.push(`${(r.attendanceRate * 100).toFixed(0)}% attendance rate`);
        if (p.voidCount === 0) reasons.push('Zero voids');
        if (r.coverShiftsCount > 0)
          reasons.push(`Covered ${r.coverShiftsCount} shift(s) for colleagues`);
        break;

      case AwardCategory.HIGHEST_SALES:
        reasons.push(`Top sales: UGX ${p.totalSales.toLocaleString()}`);
        reasons.push(`${p.orderCount} orders with UGX ${p.avgCheckSize.toFixed(0)} average check`);
        break;

      case AwardCategory.BEST_SERVICE:
        reasons.push(`Highest average check: UGX ${p.avgCheckSize.toFixed(0)}`);
        reasons.push(`${p.orderCount} orders served`);
        break;

      case AwardCategory.MOST_RELIABLE:
        reasons.push(`Perfect reliability: ${(r.reliabilityScore * 100).toFixed(0)}% score`);
        reasons.push(`${r.shiftsWorked}/${r.shiftsScheduled} shifts worked`);
        if (r.lateCount === 0) reasons.push('Never late');
        if (r.coverShiftsCount > 0) reasons.push(`Covered ${r.coverShiftsCount} shifts`);
        break;
    }

    // Note any minor policy issues
    if (riskFlags.length > 0 && !winner.isCriticalRisk) {
      reasons.push('(Note: Minor policy flags present but not disqualifying)');
    }

    return reasons.join('. ') + '.';
  }
}
