import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WaiterMetricsService } from '../staff/waiter-metrics.service';
import { WaiterMetrics } from '../staff/dto/waiter-metrics.dto';

/**
 * M5: Anti-Theft Service
 *
 * Analyzes waiter metrics against configurable thresholds to flag risky behavior.
 */
@Injectable()
export class AntiTheftService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WaiterMetricsService))
    private readonly waiterMetrics: WaiterMetricsService,
  ) {}

  /**
   * Get anti-theft summary: risky staff flagged by threshold violations
   */
  async getAntiTheftSummary(
    orgId: string,
    branchId?: string,
    shiftId?: string,
    from?: Date,
    to?: Date,
  ): Promise<{
    flaggedStaff: Array<{
      metrics: WaiterMetrics;
      violations: Array<{
        metric: string;
        value: number;
        threshold: number;
        severity: 'WARN' | 'CRITICAL';
      }>;
      riskScore: number;
    }>;
    thresholds: AntiTheftThresholds;
    summary: {
      totalStaff: number;
      flaggedCount: number;
      criticalCount: number;
    };
  }> {
    // Get thresholds from org settings
    const thresholds = await this.getThresholds(orgId);

    // Get metrics
    const metrics = await this.waiterMetrics.getWaiterMetrics({
      orgId,
      branchId,
      shiftId,
      from,
      to,
    });

    // Analyze each waiter
    const flaggedStaff = metrics
      .map((m) => {
        const violations: any[] = [];

        // Check void rate (voids / orders)
        const voidRate = m.orderCount > 0 ? m.voidCount / m.orderCount : 0;
        if (voidRate > thresholds.maxVoidRate) {
          violations.push({
            metric: 'voidRate',
            value: voidRate,
            threshold: thresholds.maxVoidRate,
            severity: voidRate > thresholds.maxVoidRate * 1.5 ? 'CRITICAL' : 'WARN',
          });
        }

        // Check discount rate (discounts / orders)
        const discountRate = m.orderCount > 0 ? m.discountCount / m.orderCount : 0;
        if (discountRate > thresholds.maxDiscountRate) {
          violations.push({
            metric: 'discountRate',
            value: discountRate,
            threshold: thresholds.maxDiscountRate,
            severity: discountRate > thresholds.maxDiscountRate * 1.5 ? 'CRITICAL' : 'WARN',
          });
        }

        // Check no-drinks rate
        if (m.noDrinksRate > thresholds.maxNoDrinksRate) {
          violations.push({
            metric: 'noDrinksRate',
            value: m.noDrinksRate,
            threshold: thresholds.maxNoDrinksRate,
            severity: m.noDrinksRate > thresholds.maxNoDrinksRate * 1.5 ? 'CRITICAL' : 'WARN',
          });
        }

        // Check anomaly score
        if (m.anomalyScore && m.anomalyScore > thresholds.maxAnomalyScore) {
          violations.push({
            metric: 'anomalyScore',
            value: m.anomalyScore,
            threshold: thresholds.maxAnomalyScore,
            severity: m.anomalyScore > thresholds.maxAnomalyScore * 1.5 ? 'CRITICAL' : 'WARN',
          });
        }

        // Calculate risk score (sum of violation severities)
        const riskScore = violations.reduce((sum, v) => {
          return sum + (v.severity === 'CRITICAL' ? 2 : 1);
        }, 0);

        return {
          metrics: m,
          violations,
          riskScore,
        };
      })
      .filter((f) => f.violations.length > 0) // Only flagged staff
      .sort((a, b) => b.riskScore - a.riskScore); // Highest risk first

    const criticalCount = flaggedStaff.filter((f) =>
      f.violations.some((v) => v.severity === 'CRITICAL'),
    ).length;

    return {
      flaggedStaff,
      thresholds,
      summary: {
        totalStaff: metrics.length,
        flaggedCount: flaggedStaff.length,
        criticalCount,
      },
    };
  }

  /**
   * Get anti-theft thresholds from org settings
   */
  private async getThresholds(orgId: string): Promise<AntiTheftThresholds> {
    const settings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId },
      select: { anomalyThresholds: true },
    });

    const thresholds = (settings?.anomalyThresholds || {}) as any;

    return {
      maxVoidRate: thresholds.maxVoidRate || 0.15, // 15% of orders
      maxDiscountRate: thresholds.maxDiscountRate || 0.25, // 25% of orders
      maxNoDrinksRate: thresholds.maxNoDrinksRate || thresholds.noDrinksWarnRate || 0.4, // 40%
      maxAnomalyScore: thresholds.maxAnomalyScore || 10,
    };
  }
}

export interface AntiTheftThresholds {
  maxVoidRate: number;
  maxDiscountRate: number;
  maxNoDrinksRate: number;
  maxAnomalyScore: number;
}
