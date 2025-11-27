import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CostInsightResponse, FranchiseCostInsightsResponse } from './dto/cost-insight.dto';
import { BudgetCategory, CostInsightSeverity } from '@chefcloud/db';

@Injectable()
export class CostInsightsService {
  private readonly logger = new Logger(CostInsightsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Generate cost-cutting insights for a branch based on budget variance patterns
   */
  async generateInsights(
    branchId: string,
    periodMonths: number = 3,
  ): Promise<CostInsightResponse[]> {
    this.logger.log({ branchId, periodMonths }, 'Generating cost insights');

    const insights: CostInsightResponse[] = [];
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12

    // Get branch info
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true, orgId: true },
    });

    if (!branch) {
      return [];
    }

    // Get budgets for the last N months
    const budgets = await this.prisma.client.opsBudget.findMany({
      where: {
        branchId,
        OR: this.generateMonthRanges(currentYear, currentMonth, periodMonths),
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    // Group budgets by category
    const byCategory = budgets.reduce(
      (acc: any, b: any) => {
        if (!acc[b.category]) {
          acc[b.category] = [];
        }
        acc[b.category].push(b);
        return acc;
      },
      {} as Record<BudgetCategory, any[]>,
    );

    // Analyze each category
    for (const [category, categoryBudgets] of Object.entries(byCategory)) {
      const typedCategory = category as BudgetCategory;
      const budgets = categoryBudgets as any[];

      const monthsOverBudget = budgets.filter(
        (b: any) => Number(b.actualAmount) > Number(b.budgetAmount) * 1.1, // 10% threshold
      ).length;

      if (monthsOverBudget >= 2) {
        // Chronic overspend detected
        const totalBudget = budgets.reduce(
          (sum: number, b: any) => sum + Number(b.budgetAmount),
          0,
        );
        const totalActual = budgets.reduce(
          (sum: number, b: any) => sum + Number(b.actualAmount),
          0,
        );
        const variance = totalActual - totalBudget;
        const variancePercent = totalBudget > 0 ? (variance / totalBudget) * 100 : 0;

        // Determine severity
        let severity: CostInsightSeverity = 'LOW';
        if (variancePercent > 30) {
          severity = 'HIGH';
        } else if (variancePercent > 15) {
          severity = 'MEDIUM';
        }

        // Generate specific suggestion based on category
        const suggestion = this.generateCategorySuggestion(typedCategory, variancePercent);

        // Create insight (would normally save to DB, but for now return directly)
        insights.push({
          id: `insight-${branchId}-${category}-${Date.now()}`,
          branchId,
          branchName: branch.name,
          category: typedCategory,
          severity,
          reason: `${category} spending exceeded budget by ${variancePercent.toFixed(1)}% over the last ${periodMonths} months (${monthsOverBudget} months over budget).`,
          suggestion,
          supportingMetrics: {
            budgetAmount: totalBudget,
            actualAmount: totalActual,
            variance,
            variancePercent,
            monthsOverBudget,
            monthsAnalyzed: budgets.length,
          },
          createdAt: new Date(),
        });
      }
    }

    // Sort by severity (HIGH first) and variance percent
    insights.sort((a, b) => {
      const severityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      const severityDiff =
        severityOrder[b.severity as keyof typeof severityOrder] -
        severityOrder[a.severity as keyof typeof severityOrder];
      if (severityDiff !== 0) return severityDiff;
      return (
        (b.supportingMetrics.variancePercent || 0) - (a.supportingMetrics.variancePercent || 0)
      );
    });

    return insights;
  }

  /**
   * Get franchise-wide cost insights
   */
  async getFranchiseInsights(
    orgId: string,
    periodMonths: number = 3,
  ): Promise<FranchiseCostInsightsResponse> {
    this.logger.log({ orgId, periodMonths }, 'Generating franchise cost insights');

    const branches = await this.prisma.branch.findMany({
      where: { orgId },
      select: { id: true, name: true },
    });

    const allInsights: CostInsightResponse[] = [];
    const byBranch: FranchiseCostInsightsResponse['byBranch'] = [];

    for (const branch of branches) {
      const branchInsights = await this.generateInsights(branch.id, periodMonths);
      allInsights.push(...branchInsights);

      const potentialSavings = branchInsights.reduce(
        (sum, insight) => sum + (insight.supportingMetrics.variance || 0),
        0,
      );

      byBranch.push({
        branchId: branch.id,
        branchName: branch.name,
        insightCount: branchInsights.length,
        potentialSavings,
      });
    }

    const totalPotentialSavings = allInsights.reduce(
      (sum, insight) => sum + (insight.supportingMetrics.variance || 0),
      0,
    );

    const today = new Date();
    const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    return {
      period,
      totalPotentialSavings,
      insights: allInsights.slice(0, 20), // Top 20 insights
      byBranch,
    };
  }

  /**
   * Generate category-specific cost-cutting suggestions
   */
  private generateCategorySuggestion(category: BudgetCategory, variancePercent: number): string {
    const suggestions: Record<BudgetCategory, string> = {
      STOCK:
        'Review supplier contracts and negotiate better rates. Implement stricter portion control. Analyze wastage patterns and adjust ordering quantities.',
      PAYROLL:
        'Optimize staff scheduling based on peak hours. Consider cross-training employees. Review overtime patterns and adjust shifts.',
      SERVICE_PROVIDERS:
        'Renegotiate contracts with service providers. Compare quotes from alternative vendors. Consider bundling services for better rates.',
      UTILITIES:
        'Audit energy usage patterns. Install energy-efficient equipment. Review utility contracts for better rates. Implement conservation measures.',
      RENT: 'Renegotiate lease terms. Consider relocating if variance continues. Explore subleasing unused space.',
      MARKETING:
        'Review ROI of marketing campaigns. Focus on high-performing channels. Leverage low-cost digital marketing alternatives.',
      MISC: 'Categorize miscellaneous expenses properly. Identify and eliminate unnecessary recurring costs. Establish approval process for misc spending.',
    };

    const baseSuggestion =
      suggestions[category] || 'Review spending patterns and identify areas for cost reduction.';

    if (variancePercent > 30) {
      return `URGENT: ${baseSuggestion} Consider immediate action to bring costs under control.`;
    } else if (variancePercent > 15) {
      return `${baseSuggestion} Implement changes within the next billing cycle.`;
    }

    return baseSuggestion;
  }

  /**
   * Generate month ranges for querying budgets over the last N months
   */
  private generateMonthRanges(
    currentYear: number,
    currentMonth: number,
    periodMonths: number,
  ): { year: number; month: number }[] {
    const ranges: { year: number; month: number }[] = [];

    for (let i = 0; i < periodMonths; i++) {
      let month = currentMonth - i;
      let year = currentYear;

      while (month <= 0) {
        month += 12;
        year -= 1;
      }

      ranges.push({ year, month });
    }

    return ranges;
  }
}
