/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DashboardsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get void leaderboard - users with most voids
   */
  async getVoidLeaderboard(
    orgId: string,
    from?: Date,
    to?: Date,
    limit = 10,
  ): Promise<any[]> {
    const where: any = {
      branch: { orgId },
      action: 'VOID',
    };

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    const voids = await this.prisma.client.auditEvent.findMany({
      where,
      include: {
        user: true,
      },
    });

    // Group by user
    const userStats = new Map<string, { userId: string; name: string; voids: number; totalVoidUGX: number }>();

    for (const voidEvent of voids) {
      if (!voidEvent.userId) continue;

      const key = voidEvent.userId;
      if (!userStats.has(key)) {
        const userName = voidEvent.user ? `${voidEvent.user.firstName} ${voidEvent.user.lastName}` : 'Unknown';
        userStats.set(key, {
          userId: voidEvent.userId,
          name: userName,
          voids: 0,
          totalVoidUGX: 0,
        });
      }

      const stats = userStats.get(key)!;
      stats.voids++;
      
      // Extract void amount from metadata if available
      if (voidEvent.metadata && typeof voidEvent.metadata === 'object' && 'amount' in voidEvent.metadata) {
        stats.totalVoidUGX += parseFloat(String(voidEvent.metadata.amount));
      }
    }

    return Array.from(userStats.values())
      .sort((a, b) => b.voids - a.voids)
      .slice(0, limit);
  }

  /**
   * Get discount leaderboard - users with most discounts
   */
  async getDiscountLeaderboard(
    orgId: string,
    from?: Date,
    to?: Date,
    limit = 10,
  ): Promise<any[]> {
    const where: any = {
      orgId,
    };

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    const discounts = await this.prisma.client.discount.findMany({
      where,
      include: {
        createdBy: true,
      },
    });

    // Group by user
    const userStats = new Map<string, { userId: string; name: string; discounts: number; totalDiscountUGX: number }>();

    for (const discount of discounts) {
      const key = discount.createdById;
      if (!userStats.has(key)) {
        const userName = `${discount.createdBy.firstName} ${discount.createdBy.lastName}`;
        userStats.set(key, {
          userId: discount.createdById,
          name: userName,
          discounts: 0,
          totalDiscountUGX: 0,
        });
      }

      const stats = userStats.get(key)!;
      stats.discounts++;
      stats.totalDiscountUGX += parseFloat(discount.value.toString());
    }

    return Array.from(userStats.values())
      .sort((a, b) => b.totalDiscountUGX - a.totalDiscountUGX)
      .slice(0, limit);
  }

  /**
   * Get no-drinks rate per waiter
   */
  async getNoDrinksRate(orgId: string, from?: Date, to?: Date): Promise<any[]> {
    const whereDate: any = {};
    if (from || to) {
      whereDate.createdAt = {};
      if (from) whereDate.createdAt.gte = from;
      if (to) whereDate.createdAt.lte = to;
    }

    const orders = await this.prisma.client.order.findMany({
      where: {
        branch: { orgId },
        ...whereDate,
        userId: { not: '' }, // Filter out empty strings
      },
      include: { user: true },
    });

    const byWaiter = new Map<string, { waiterId: string; name: string; orders: number; noDrinks: number }>();

    orders.forEach((o) => {
      const userId = o.userId!;
      if (!byWaiter.has(userId)) {
        const name = o.user ? `${o.user.firstName} ${o.user.lastName}` : 'Unknown';
        byWaiter.set(userId, {
          waiterId: userId,
          name,
          orders: 0,
          noDrinks: 0,
        });
      }
      const entry = byWaiter.get(userId)!;
      entry.orders += 1;
      const flags = (o.anomalyFlags || []) as string[];
      if (flags.includes('NO_DRINKS')) {
        entry.noDrinks += 1;
      }
    });

    return Array.from(byWaiter.values()).map((w) => ({
      ...w,
      total: w.orders,
      rate: w.orders > 0 ? w.noDrinks / w.orders : 0,
    }));
  }

  /**
   * Get late void heatmap - 7x24 matrix (weekday x hour)
   */
  async getLateVoidHeatmap(orgId: string, from?: Date, to?: Date): Promise<{ matrix: number[][] }> {
    const where: any = {
      orgId,
      type: 'LATE_VOID',
    };

    if (from || to) {
      where.occurredAt = {};
      if (from) where.occurredAt.gte = from;
      if (to) where.occurredAt.lte = to;
    }

    const events = await this.prisma.client.anomalyEvent.findMany({
      where,
      select: {
        occurredAt: true,
      },
    });

    // Initialize 7x24 matrix (weekday x hour)
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

    for (const event of events) {
      const date = new Date(event.occurredAt);
      const weekday = date.getUTCDay(); // 0=Sunday, 6=Saturday
      const hour = date.getUTCHours();
      matrix[weekday][hour]++;
    }

    return { matrix };
  }

  /**
   * Get recent anomaly events
   */
  async getRecentAnomalies(orgId: string, limit: number): Promise<any[]> {
    return this.prisma.client.anomalyEvent.findMany({
      where: { orgId },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
  }
}
