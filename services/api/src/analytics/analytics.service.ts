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

  async getTopItems(branchId: string, limit = 10): Promise<any> {
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
      return {
        id: item.menuItemId,
        name: menuItem?.name || 'Unknown',
        totalQuantity: item._sum.quantity,
        orderCount: item._count,
      };
    });
  }
}
