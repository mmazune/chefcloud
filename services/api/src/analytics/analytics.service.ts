/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDailySummary(branchId: string, date?: string): Promise<any> {
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const orders = await this.prisma.client.order.findMany({
      where: {
        branchId,
        createdAt: { gte: startOfDay, lte: endOfDay },
        status: { in: ['CLOSED', 'SERVED'] },
      },
      include: {
        orderItems: { include: { menuItem: true } },
        payments: true,
      },
    });

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Top items
    const itemCounts = new Map<string, { name: string; count: number; revenue: number }>();
    orders.forEach((order) => {
      order.orderItems.forEach((item: any) => {
        const existing = itemCounts.get(item.menuItemId) || {
          name: item.menuItem.name,
          count: 0,
          revenue: 0,
        };
        existing.count += item.quantity;
        existing.revenue += Number(item.subtotal);
        itemCounts.set(item.menuItemId, existing);
      });
    });

    const topItems = Array.from(itemCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      date: targetDate.toISOString().split('T')[0],
      summary: {
        totalRevenue,
        totalOrders,
        avgOrderValue,
      },
      topItems,
    };
  }

  async getTopItems(branchId: string, limit = 10, includeCostData = false): Promise<any> {
    // Simple aggregation - get top items by quantity sold
    const items = await this.prisma.client.orderItem.groupBy({
      by: ['menuItemId'],
      where: {
        order: {
          branchId,
          status: { in: ['CLOSED', 'SERVED'] },
        },
      },
      _sum: {
        quantity: true,
        subtotal: true,
        ...(includeCostData && {
          costTotal: true,
          marginTotal: true,
        }),
      },
      _count: true,
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: limit,
    });

    // Fetch menu item details
    const itemIds = items.map((i) => i.menuItemId);
    const menuItems = await this.prisma.client.menuItem.findMany({
      where: { id: { in: itemIds } },
    });

    const menuItemMap = new Map(menuItems.map((item: any) => [item.id, item]));

    return items.map((item: any) => {
      const menuItem: any = menuItemMap.get(item.menuItemId);
      const baseData = {
        id: item.menuItemId,
        name: menuItem?.name || 'Unknown',
        totalQuantity: item._sum.quantity,
        orderCount: item._count,
        totalRevenue: item._sum.subtotal ? Number(item._sum.subtotal) : 0,
      };

      // Only include cost/margin if requested
      if (includeCostData && item._sum.costTotal !== null && item._sum.marginTotal !== null) {
        const totalCost = Number(item._sum.costTotal);
        const totalMargin = Number(item._sum.marginTotal);
        const totalRevenue = baseData.totalRevenue;
        const marginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

        return {
          ...baseData,
          totalCost,
          totalMargin,
          marginPct: Number(marginPct.toFixed(2)),
        };
      }

      return baseData;
    });
  }

  // Anti-theft analytics
  async getStaffVoids(from: string, to: string, branchId?: string) {
    const startDate = new Date(from);
    const endDate = new Date(to);

    const voidedOrders = await this.prisma.client.order.findMany({
      where: {
        status: 'VOIDED',
        createdAt: { gte: startDate, lte: endDate },
        ...(branchId && { branchId }),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const voidsByUser = new Map<
      string,
      { userId: string; name: string; voidCount: number; totalAmount: number }
    >();

    voidedOrders.forEach((order) => {
      const userId = order.userId;
      const existing = voidsByUser.get(userId) || {
        userId,
        name: `${order.user.firstName} ${order.user.lastName}`,
        voidCount: 0,
        totalAmount: 0,
      };
      existing.voidCount += 1;
      existing.totalAmount += Number(order.total);
      voidsByUser.set(userId, existing);
    });

    return Array.from(voidsByUser.values()).sort((a, b) => b.voidCount - a.voidCount);
  }

  async getStaffDiscounts(from: string, to: string, branchId?: string) {
    const startDate = new Date(from);
    const endDate = new Date(to);

    const discounts = await this.prisma.client.discount.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        ...(branchId && { order: { branchId } }),
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const discountsByUser = new Map<
      string,
      {
        userId: string;
        name: string;
        discountCount: number;
        totalAmount: number;
      }
    >();

    discounts.forEach((discount) => {
      const userId = discount.createdById;
      const existing = discountsByUser.get(userId) || {
        userId,
        name: `${discount.createdBy.firstName} ${discount.createdBy.lastName}`,
        discountCount: 0,
        totalAmount: 0,
      };
      existing.discountCount += 1;
      existing.totalAmount += Number(discount.value);
      discountsByUser.set(userId, existing);
    });

    return Array.from(discountsByUser.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }

  async getNoDrinksRate(from: string, to: string, branchId?: string) {
    const startDate = new Date(from);
    const endDate = new Date(to);

    const orders = await this.prisma.client.order.findMany({
      where: {
        status: 'CLOSED',
        createdAt: { gte: startDate, lte: endDate },
        ...(branchId && { branchId }),
      },
      include: {
        orderItems: {
          include: {
            menuItem: { include: { category: true } },
          },
        },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const statsByUser = new Map<
      string,
      { userId: string; name: string; totalOrders: number; noDrinkOrders: number }
    >();

    orders.forEach((order) => {
      const userId = order.userId;
      const existing = statsByUser.get(userId) || {
        userId,
        name: `${order.user.firstName} ${order.user.lastName}`,
        totalOrders: 0,
        noDrinkOrders: 0,
      };
      existing.totalOrders += 1;

      // Check if order has any DRINK category items
      const hasDrinks = order.orderItems.some(
        (item: any) => item.menuItem?.category?.type === 'DRINK',
      );
      if (!hasDrinks) {
        existing.noDrinkOrders += 1;
      }

      statsByUser.set(userId, existing);
    });

    return Array.from(statsByUser.values()).map((stat) => ({
      ...stat,
      noDrinkRate:
        stat.totalOrders > 0 ? ((stat.noDrinkOrders / stat.totalOrders) * 100).toFixed(2) : '0.00',
    }));
  }

  async getLateVoids(from: string, to: string, thresholdMin: number, branchId?: string) {
    const startDate = new Date(from);
    const endDate = new Date(to);

    const voidedOrders = await this.prisma.client.order.findMany({
      where: {
        status: 'VOIDED',
        createdAt: { gte: startDate, lte: endDate },
        ...(branchId && { branchId }),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Filter for late voids (voided > thresholdMin after created)
    const lateVoids = voidedOrders
      .map((order) => {
        const createdAt = order.createdAt.getTime();
        const updatedAt = order.updatedAt.getTime();
        const minutesSinceCreated = (updatedAt - createdAt) / (1000 * 60);

        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          userId: order.userId,
          userName: `${order.user.firstName} ${order.user.lastName}`,
          total: Number(order.total),
          createdAt: order.createdAt,
          voidedAt: order.updatedAt,
          minutesSinceCreated: Math.round(minutesSinceCreated),
        };
      })
      .filter((v) => v.minutesSinceCreated >= thresholdMin)
      .sort((a, b) => b.minutesSinceCreated - a.minutesSinceCreated);

    return lateVoids;
  }

  async getAnomalies(branchId: string, limit = 50): Promise<any> {
    const anomalies = await this.prisma.client.anomalyEvent.findMany({
      where: { branchId },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });

    return anomalies.map((anomaly) => ({
      id: anomaly.id,
      type: anomaly.type,
      severity: anomaly.severity,
      description: (anomaly.details as any)?.message || `Anomaly of type ${anomaly.type}`,
      createdAt: anomaly.occurredAt,
    }));
  }

  /**
   * Get daily metrics for analytics dashboard (sales, avg check, NPS)
   * Returns time-series data for the specified date range
   */
  async getDailyMetrics(
    orgId: string,
    from: string,
    to: string,
    branchId?: string,
  ): Promise<any[]> {
    const startDate = new Date(from);
    const endDate = new Date(to);

    // Ensure dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return [];
    }

    // Limit to 90 days max
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      endDate.setTime(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);
    }

    // Query orders for the period
    const orders = await this.prisma.client.order.findMany({
      where: {
        orgId,
        ...(branchId && { branchId }),
        createdAt: { gte: startDate, lte: endDate },
        status: { in: ['CLOSED', 'SERVED'] },
      },
      select: {
        id: true,
        total: true,
        createdAt: true,
      },
    });

    // Query feedback (NPS) for the period
    const feedback = await this.prisma.client.feedback.findMany({
      where: {
        orgId,
        ...(branchId && { branchId }),
        createdAt: { gte: startDate, lte: endDate },
        score: { not: null },
      },
      select: {
        score: true,
        createdAt: true,
      },
    });

    // Group by date
    const metricsByDate = new Map<
      string,
      { totalSales: number; ordersCount: number; npsScores: number[] }
    >();

    orders.forEach((order) => {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      const existing = metricsByDate.get(dateKey) || {
        totalSales: 0,
        ordersCount: 0,
        npsScores: [],
      };
      existing.totalSales += Number(order.total);
      existing.ordersCount += 1;
      metricsByDate.set(dateKey, existing);
    });

    feedback.forEach((fb) => {
      const dateKey = fb.createdAt.toISOString().split('T')[0];
      const existing = metricsByDate.get(dateKey) || {
        totalSales: 0,
        ordersCount: 0,
        npsScores: [],
      };
      if (fb.score !== null) {
        existing.npsScores.push(fb.score);
      }
      metricsByDate.set(dateKey, existing);
    });

    // Convert to array and calculate metrics
    const result: any[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const data = metricsByDate.get(dateKey) || {
        totalSales: 0,
        ordersCount: 0,
        npsScores: [],
      };

      const avgCheck = data.ordersCount > 0 ? data.totalSales / data.ordersCount : 0;
      const nps =
        data.npsScores.length > 0
          ? data.npsScores.reduce((sum, score) => sum + score, 0) / data.npsScores.length
          : null;

      result.push({
        date: dateKey,
        totalSales: Math.round(data.totalSales * 100) / 100,
        ordersCount: data.ordersCount,
        avgCheck: Math.round(avgCheck * 100) / 100,
        nps: nps !== null ? Math.round(nps * 10) / 10 : null,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  /**
   * M25-S4: Get risk summary for analytics dashboard
   */
  async getRiskSummary(params: {
    orgId: string;
    branchId?: string | null;
    from: Date;
    to: Date;
  }): Promise<any> {
    const { orgId, branchId, from, to } = params;

    const where: any = {
      orgId,
      occurredAt: { gte: from, lte: to },
    };

    if (branchId) {
      where.branchId = branchId;
    }

    // Get all anomaly events for the period
    const events = await this.prisma.client.anomalyEvent.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const totalEvents = events.length;

    // Count by severity
    const bySeverity = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    events.forEach((e) => {
      const severity = e.severity.toUpperCase();
      if (severity in bySeverity) {
        bySeverity[severity as keyof typeof bySeverity]++;
      } else if (severity === 'INFO' || severity === 'WARN') {
        // Map INFO/WARN to LOW/MEDIUM
        bySeverity[severity === 'INFO' ? 'LOW' : 'MEDIUM']++;
      }
    });

    // Count by type
    const byTypeMap = new Map<string, number>();
    events.forEach((e) => {
      byTypeMap.set(e.type, (byTypeMap.get(e.type) || 0) + 1);
    });
    const byType = Array.from(byTypeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    // Count by branch
    const byBranchMap = new Map<
      string,
      { branchId: string; branchName: string; count: number; criticalCount: number }
    >();
    events.forEach((e) => {
      if (e.branchId && e.branch) {
        const key = e.branchId;
        if (!byBranchMap.has(key)) {
          byBranchMap.set(key, {
            branchId: e.branchId,
            branchName: e.branch.name,
            count: 0,
            criticalCount: 0,
          });
        }
        const entry = byBranchMap.get(key)!;
        entry.count++;
        if (e.severity === 'CRITICAL') {
          entry.criticalCount++;
        }
      }
    });
    const byBranch = Array.from(byBranchMap.values()).sort(
      (a, b) => b.criticalCount - a.criticalCount || b.count - a.count,
    );

    // Count by staff
    const byStaffMap = new Map<
      string,
      {
        employeeId: string;
        name: string;
        branchName: string;
        count: number;
        criticalCount: number;
      }
    >();
    events.forEach((e) => {
      if (e.userId && e.user) {
        const key = e.userId;
        if (!byStaffMap.has(key)) {
          byStaffMap.set(key, {
            employeeId: e.userId,
            name: `${e.user.firstName} ${e.user.lastName}`,
            branchName: e.branch?.name || 'Unknown',
            count: 0,
            criticalCount: 0,
          });
        }
        const entry = byStaffMap.get(key)!;
        entry.count++;
        if (e.severity === 'CRITICAL') {
          entry.criticalCount++;
        }
      }
    });
    const topStaff = Array.from(byStaffMap.values())
      .sort((a, b) => b.criticalCount - a.criticalCount || b.count - a.count)
      .slice(0, 10); // Top 10 staff with most risk events

    return {
      totalEvents,
      bySeverity,
      byType,
      byBranch,
      topStaff,
    };
  }

  /**
   * M25-S4: Get individual risk events for analytics dashboard
   */
  async getRiskEvents(params: {
    orgId: string;
    branchId?: string | null;
    from: Date;
    to: Date;
    severity?: string | null;
  }): Promise<any[]> {
    const { orgId, branchId, from, to, severity } = params;

    const where: any = {
      orgId,
      occurredAt: { gte: from, lte: to },
    };

    if (branchId) {
      where.branchId = branchId;
    }

    if (severity) {
      where.severity = severity;
    }

    const events = await this.prisma.client.anomalyEvent.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take: 100, // Limit to most recent 100 events
    });

    return events.map((e) => ({
      id: e.id,
      occurredAt: e.occurredAt.toISOString(),
      branchName: e.branch?.name || 'Unknown',
      employeeName: e.user ? `${e.user.firstName} ${e.user.lastName}` : null,
      type: e.type,
      severity: e.severity,
      description: this.formatAnomalyDescription(e.type, e.details),
    }));
  }

  /**
   * Format anomaly event description
   */
  private formatAnomalyDescription(type: string, details: any): string {
    if (!details) return type.replace(/_/g, ' ').toLowerCase();

    switch (type) {
      case 'NO_DRINKS':
        return 'Order with no drinks';
      case 'LATE_VOID':
        return `Void after ${details.minutesAfterClose || '?'} minutes`;
      case 'HEAVY_DISCOUNT':
        return `Discount ${details.percentage || '?'}%`;
      case 'VOID_SPIKE':
        return 'Unusual void activity';
      default:
        return type.replace(/_/g, ' ').toLowerCase();
    }
  }
}
