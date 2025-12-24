import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DemoHealthResponse } from './debug.controller';

@Injectable()
export class DebugService {
  private readonly logger = new Logger(DebugService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Aggregate demo health data for an organization.
   * IMPORTANT: Orders do NOT have orgId directly - must filter via branch.orgId.
   */
  async getDemoHealth(
    orgId: string,
    userBranchId: string | null,
    filterBranchId: string | null,
    fromDate: Date,
    toDate: Date,
  ): Promise<DemoHealthResponse> {
    const warnings: string[] = [];

    // 1. Get org info
    const org = await this.prisma.client.org.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });

    if (!org) {
      throw new Error(`Organization ${orgId} not found`);
    }

    // 2. Get all branches for this org
    const branches = await this.prisma.client.branch.findMany({
      where: { orgId },
      select: { id: true, name: true },
    });

    const branchIds = branches.map((b) => b.id);
    const branchCount = branches.length;

    // If filterBranchId specified, validate it belongs to org
    let targetBranchIds = branchIds;
    if (filterBranchId) {
      if (!branchIds.includes(filterBranchId)) {
        warnings.push(`branchId ${filterBranchId} does not belong to org ${orgId}`);
      } else {
        targetBranchIds = [filterBranchId];
      }
    }

    // Validate userBranchId
    const userBranchValid = !userBranchId || branchIds.includes(userBranchId);
    if (userBranchId && !userBranchValid) {
      warnings.push(`User's branchId ${userBranchId} is not in org's branches`);
    }

    // 3. Orders (via branch.orgId relationship)
    const orders = await this.prisma.client.order.findMany({
      where: {
        branch: { orgId },
        ...(filterBranchId ? { branchId: filterBranchId } : {}),
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        branchId: true,
      },
    });

    const ordersInRange = orders.filter(
      (o) => o.createdAt >= fromDate && o.createdAt <= toDate,
    );

    const ordersByStatus: Record<string, number> = {};
    orders.forEach((o) => {
      ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;
    });

    const orderDates = orders.map((o) => o.createdAt).sort((a, b) => a.getTime() - b.getTime());
    const earliestCreatedAt = orderDates.length > 0 ? orderDates[0].toISOString() : null;
    const latestCreatedAt =
      orderDates.length > 0 ? orderDates[orderDates.length - 1].toISOString() : null;

    // 4. Order Items
    const orderIds = orders.map((o) => o.id);
    const orderItemCount = await this.prisma.client.orderItem.count({
      where: { orderId: { in: orderIds } },
    });

    // 5. Payments
    const payments = await this.prisma.client.payment.findMany({
      where: { orderId: { in: orderIds } },
      select: { id: true, method: true, status: true },
    });

    const paymentsByMethod: Record<string, number> = {};
    const paymentsByStatus: Record<string, number> = {};
    payments.forEach((p) => {
      paymentsByMethod[p.method] = (paymentsByMethod[p.method] || 0) + 1;
      paymentsByStatus[p.status] = (paymentsByStatus[p.status] || 0) + 1;
    });

    // 6. Feedback
    const feedback = await this.prisma.client.feedback.findMany({
      where: {
        order: { branch: { orgId } },
        ...(filterBranchId ? { order: { branchId: filterBranchId } } : {}),
      },
      select: { id: true, score: true },
    });

    const avgScore =
      feedback.length > 0
        ? feedback.reduce((sum, f) => sum + (f.score || 0), 0) / feedback.length
        : null;

    // 7. Inventory - aggregate stock from StockBatch
    const inventoryItems = await this.prisma.client.inventoryItem.findMany({
      where: {
        orgId,
      },
      select: {
        id: true,
        reorderLevel: true,
        stockBatches: {
          where: {
            branchId: { in: targetBranchIds },
          },
          select: { remainingQty: true },
        },
      },
    });

    const lowCount = inventoryItems.filter((i) => {
      const totalQty = i.stockBatches.reduce(
        (sum, b) => sum + Number(b.remainingQty),
        0,
      );
      return totalQty <= Number(i.reorderLevel) && totalQty > 0;
    }).length;
    const criticalCount = inventoryItems.filter((i) => {
      const totalQty = i.stockBatches.reduce(
        (sum, b) => sum + Number(b.remainingQty),
        0,
      );
      return totalQty === 0;
    }).length;

    // 8. Menu Items & Categories - count via branchIds
    const menuItemCount = await this.prisma.client.menuItem.count({
      where: { branchId: { in: branchIds } },
    });

    const categoriesCount = await this.prisma.client.menuItem.groupBy({
      by: ['categoryId'],
      where: {
        branchId: { in: branchIds },
        categoryId: { not: null },
      },
    }).then((groups) => groups.length);

    // 9. Service Providers - count via branches
    const serviceProviderCount = await this.prisma.client.serviceProvider.count({
      where: { branchId: { in: branchIds } },
    });

    // 10. Reservations
    const reservationCount = await this.prisma.client.reservation.count({
      where: {
        branchId: { in: targetBranchIds },
      },
    });

    // 11. Anomalies
    const anomalies = await this.prisma.client.anomalyEvent.findMany({
      where: {
        branch: { orgId },
        ...(filterBranchId ? { branchId: filterBranchId } : {}),
      },
      select: { id: true, severity: true },
    });

    const anomaliesBySeverity: Record<string, number> = {};
    anomalies.forEach((a) => {
      anomaliesBySeverity[a.severity] = (anomaliesBySeverity[a.severity] || 0) + 1;
    });

    // 12. Shifts
    const shifts = await this.prisma.client.shift.findMany({
      where: {
        branchId: { in: targetBranchIds },
      },
      select: { id: true, closedAt: true },
    });

    const openShiftCount = shifts.filter((s) => s.closedAt === null).length;

    // 13. Users
    const users = await this.prisma.client.user.findMany({
      where: { orgId },
      select: { id: true, roleLevel: true },
    });

    const usersByRole: Record<string, number> = {};
    users.forEach((u) => {
      usersByRole[u.roleLevel] = (usersByRole[u.roleLevel] || 0) + 1;
    });

    // 14. Per-branch breakdown (if no specific branch filter)
    let perBranch: DemoHealthResponse['perBranch'] = undefined;
    if (!filterBranchId && branchCount > 1) {
      perBranch = await Promise.all(
        branches.map(async (branch) => {
          const branchOrders = orders.filter((o) => o.branchId === branch.id);
          const branchOrderIds = branchOrders.map((o) => o.id);
          const branchOrderItems = await this.prisma.client.orderItem.count({
            where: { orderId: { in: branchOrderIds } },
          });
          const branchPayments = await this.prisma.client.payment.count({
            where: { orderId: { in: branchOrderIds } },
          });
          return {
            branchId: branch.id,
            branchName: branch.name,
            orders: branchOrders.length,
            orderItems: branchOrderItems,
            payments: branchPayments,
          };
        }),
      );
    }

    // Diagnostics
    if (orders.length === 0) {
      warnings.push('No orders found - dashboard will show zeros');
    }
    if (ordersInRange.length === 0 && orders.length > 0) {
      warnings.push(
        `${orders.length} orders exist but NONE in date range ${fromDate.toISOString()} to ${toDate.toISOString()}. Check order createdAt dates.`,
      );
    }
    if (menuItemCount === 0) {
      warnings.push('No menu items - cannot create orderItems or show top items');
    }
    if (branchCount === 0) {
      warnings.push('No branches - critical issue');
    }

    this.logger.log(
      `Demo health for org ${orgId}: ${orders.length} orders, ${orderItemCount} orderItems, ${payments.length} payments`,
    );

    return {
      timestamp: new Date().toISOString(),
      orgId: org.id,
      orgName: org.name,
      activeBranchId: userBranchId,
      branchCount,
      branchIds,
      branches,
      orders: {
        total: orders.length,
        byStatus: ordersByStatus,
        earliestCreatedAt,
        latestCreatedAt,
        inDateRange: ordersInRange.length,
      },
      orderItems: {
        count: orderItemCount,
      },
      payments: {
        count: payments.length,
        byMethod: paymentsByMethod,
        byStatus: paymentsByStatus,
      },
      feedback: {
        count: feedback.length,
        avgScore,
      },
      inventory: {
        itemCount: inventoryItems.length,
        lowCount,
        criticalCount,
      },
      menu: {
        itemCount: menuItemCount,
        categoriesCount,
      },
      serviceProviders: {
        count: serviceProviderCount,
      },
      reservations: {
        count: reservationCount,
      },
      anomalies: {
        count: anomalies.length,
        bySeverity: anomaliesBySeverity,
      },
      shifts: {
        count: shifts.length,
        openCount: openShiftCount,
      },
      users: {
        count: users.length,
        byRole: usersByRole,
      },
      perBranch,
      diagnostics: {
        userBranchId,
        userBranchValid,
        dateRangeUsed: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        },
        warnings,
      },
    };
  }
}
