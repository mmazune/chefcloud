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
}
