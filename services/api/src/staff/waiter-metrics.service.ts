import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  WaiterMetrics,
  WaiterMetricsQuery,
  RankedWaiter,
  WaiterScoringConfig,
  DEFAULT_SCORING_CONFIG,
} from './dto/waiter-metrics.dto';

/**
 * M5: Canonical Waiter Metrics Service
 * 
 * Single source of truth for waiter performance metrics.
 * Used by:
 * - Anti-theft dashboards
 * - Staff rankings
 * - Owner digests
 * - Employee-of-the-month suggestions (future)
 * 
 * All metric calculations are centralized here to ensure consistency.
 */
@Injectable()
export class WaiterMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get raw waiter metrics for a period
   */
  async getWaiterMetrics(query: WaiterMetricsQuery): Promise<WaiterMetrics[]> {
    // Resolve period
    const period = await this.resolvePeriod(query);
    if (!period) {
      throw new Error('Must provide either shiftId or from/to dates');
    }

    const { startedAt, closedAt } = period;

    // Build branch filter
    const branchFilter = query.branchId
      ? { branchId: query.branchId }
      : { branch: { orgId: query.orgId } };

    // Fetch all orders in period
    const orders = await this.prisma.client.order.findMany({
      where: {
        ...branchFilter,
        createdAt: { gte: startedAt, lte: closedAt },
        status: { in: ['CLOSED', 'SERVED', 'VOIDED'] },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Fetch void events
    const voidEvents = await this.prisma.client.auditEvent.findMany({
      where: {
        ...branchFilter,
        action: 'VOID',
        createdAt: { gte: startedAt, lte: closedAt },
      },
      select: {
        userId: true,
        metadata: true,
      },
    });

    // Fetch discounts
    const discounts = await this.prisma.client.discount.findMany({
      where: {
        order: {
          ...branchFilter,
          createdAt: { gte: startedAt, lte: closedAt },
        },
      },
      select: {
        createdById: true,
        value: true,
      },
    });

    // Fetch anomalies
    const anomalies = await this.prisma.client.anomalyEvent.findMany({
      where: {
        ...branchFilter,
        occurredAt: { gte: startedAt, lte: closedAt },
      },
      select: {
        userId: true,
        severity: true,
      },
    });

    // Build metrics map
    const metricsMap = new Map<string, WaiterMetrics>();

    // Aggregate orders
    orders.forEach((order) => {
      const userId = order.userId;
      if (!userId || !order.user) return;

      if (!metricsMap.has(userId)) {
        metricsMap.set(userId, {
          userId,
          displayName: `${order.user.firstName} ${order.user.lastName}`,
          totalSales: 0,
          orderCount: 0,
          avgCheckSize: 0,
          voidCount: 0,
          voidValue: 0,
          discountCount: 0,
          discountValue: 0,
          noDrinksRate: 0,
          anomalyCount: 0,
          periodStart: startedAt,
          periodEnd: closedAt,
        });
      }

      const metrics = metricsMap.get(userId)!;
      
      // Only count non-voided orders for sales
      if (order.status !== 'VOIDED') {
        metrics.totalSales += Number(order.total);
        metrics.orderCount += 1;

        // Check for NO_DRINKS anomaly flag
        const flags = (order.anomalyFlags || []) as string[];
        if (flags.includes('NO_DRINKS')) {
          metrics.noDrinksRate += 1; // Count, will divide later
        }
      }
    });

    // Aggregate voids
    voidEvents.forEach((voidEvent) => {
      const userId = voidEvent.userId;
      if (!userId) return;

      const metrics = metricsMap.get(userId);
      if (metrics) {
        metrics.voidCount += 1;
        if (
          voidEvent.metadata &&
          typeof voidEvent.metadata === 'object' &&
          'amount' in voidEvent.metadata
        ) {
          metrics.voidValue += parseFloat(String(voidEvent.metadata.amount));
        }
      }
    });

    // Aggregate discounts
    discounts.forEach((discount) => {
      const userId = discount.createdById;
      const metrics = metricsMap.get(userId);
      if (metrics) {
        metrics.discountCount += 1;
        metrics.discountValue += Number(discount.value);
      }
    });

    // Aggregate anomalies with severity weighting
    const severityWeights: Record<string, number> = {
      INFO: 1,
      WARN: 2,
      CRITICAL: 3,
    };

    anomalies.forEach((anomaly) => {
      const userId = anomaly.userId;
      if (!userId) return;

      const metrics = metricsMap.get(userId);
      if (metrics) {
        metrics.anomalyCount += 1;
        const weight = severityWeights[anomaly.severity] || 1;
        metrics.anomalyScore = (metrics.anomalyScore || 0) + weight;
      }
    });

    // Calculate derived metrics
    const metricsList = Array.from(metricsMap.values());
    metricsList.forEach((m) => {
      m.avgCheckSize = m.orderCount > 0 ? m.totalSales / m.orderCount : 0;
      m.noDrinksRate = m.orderCount > 0 ? m.noDrinksRate / m.orderCount : 0;
    });

    return metricsList;
  }

  /**
   * Get ranked waiters using scoring algorithm
   */
  async getRankedWaiters(
    query: WaiterMetricsQuery,
    config: WaiterScoringConfig = DEFAULT_SCORING_CONFIG,
  ): Promise<RankedWaiter[]> {
    const metrics = await this.getWaiterMetrics(query);

    if (metrics.length === 0) {
      return [];
    }

    // Normalize metrics for scoring (0-1 scale)
    const maxSales = Math.max(...metrics.map((m) => m.totalSales), 1);
    const maxAvgCheck = Math.max(...metrics.map((m) => m.avgCheckSize), 1);
    const maxVoidValue = Math.max(...metrics.map((m) => m.voidValue), 1);
    const maxDiscountValue = Math.max(...metrics.map((m) => m.discountValue), 1);
    const maxAnomalyScore = Math.max(...metrics.map((m) => m.anomalyScore || 0), 1);

    // Calculate scores
    const scored = metrics.map((m) => {
      // Positive components (normalized 0-1)
      const salesScore = m.totalSales / maxSales;
      const avgCheckScore = m.avgCheckSize / maxAvgCheck;

      // Penalty components (normalized 0-1, then inverted)
      const voidPenalty = m.voidValue / maxVoidValue;
      const discountPenalty = m.discountValue / maxDiscountValue;
      const noDrinksPenalty = m.noDrinksRate; // Already 0-1
      const anomalyPenalty = (m.anomalyScore || 0) / maxAnomalyScore;

      // Weighted score
      const score =
        salesScore * config.salesWeight +
        avgCheckScore * config.avgCheckWeight -
        voidPenalty * config.voidPenalty -
        discountPenalty * config.discountPenalty -
        noDrinksPenalty * config.noDrinksPenalty -
        anomalyPenalty * config.anomalyPenalty;

      return {
        ...m,
        score,
        rank: 0, // Will set after sorting
        scoreComponents: {
          salesScore,
          avgCheckScore,
          voidPenalty,
          discountPenalty,
          noDrinksPenalty,
          anomalyPenalty,
        },
      };
    });

    // Sort by score descending and assign ranks
    scored.sort((a, b) => b.score - a.score);
    scored.forEach((w, index) => {
      w.rank = index + 1;
    });

    return scored;
  }

  /**
   * Resolve period from query
   */
  private async resolvePeriod(
    query: WaiterMetricsQuery,
  ): Promise<{ startedAt: Date; closedAt: Date } | null> {
    if (query.shiftId) {
      const shift = await this.prisma.client.shift.findUnique({
        where: { id: query.shiftId },
        select: { openedAt: true, closedAt: true },
      });
      if (!shift || !shift.closedAt) return null;
      return { startedAt: shift.openedAt, closedAt: shift.closedAt };
    }

    if (query.from && query.to) {
      return { startedAt: query.from, closedAt: query.to };
    }

    return null;
  }
}
