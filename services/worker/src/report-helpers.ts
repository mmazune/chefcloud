/**
 * M4: Report Generation Helpers for Worker
 * 
 * Implements real report generation queries matching the API service.
 * Uses direct Prisma queries since worker can't import NestJS services.
 */

import { PrismaClient } from '@chefcloud/db';
import { ShiftEndReport } from './types/report-types';

/**
 * Generate a comprehensive shift-end report with REAL data
 */
export async function generateShiftEndReport(
  prisma: PrismaClient,
  shiftId: string,
): Promise<ShiftEndReport> {
  // Get shift details
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      branch: true,
      openedBy: { select: { id: true, firstName: true, lastName: true } },
      closedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!shift) {
    throw new Error(`Shift ${shiftId} not found`);
  }

  if (!shift.closedAt) {
    throw new Error(`Shift ${shiftId} is still open`);
  }

  const period = { startedAt: shift.openedAt, closedAt: shift.closedAt };
  const { branchId, orgId } = shift;

  // Generate all report sections in parallel
  const [sales, service, stock, kdsMetrics, staff, anomalies] = await Promise.all([
    generateSalesReport(prisma, branchId, period),
    generateServiceReport(prisma, orgId, branchId, period),
    generateStockReport(prisma, branchId, period),
    generateKdsReport(prisma, branchId, period),
    generateStaffReport(prisma, branchId, period),
    generateAnomaliesReport(prisma, branchId, period),
  ]);

  return {
    shiftId: shift.id,
    branchName: shift.branch.name,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt,
    openedBy: `${shift.openedBy.firstName} ${shift.openedBy.lastName}`,
    closedBy: shift.closedBy 
      ? `${shift.closedBy.firstName} ${shift.closedBy.lastName}`
      : null,
    sales,
    service,
    stock,
    kdsMetrics,
    staff,
    anomalies,
  };
}

/**
 * Generate sales report section - REAL implementation
 */
async function generateSalesReport(
  prisma: PrismaClient,
  branchId: string,
  period: { startedAt: Date; closedAt: Date },
): Promise<ShiftEndReport['sales']> {
  // Get all closed/served orders in period
  const orders = await prisma.order.findMany({
    where: {
      branchId,
      createdAt: { gte: period.startedAt, lte: period.closedAt },
      status: { in: ['CLOSED', 'SERVED'] },
    },
    include: {
      orderItems: {
        include: {
          menuItem: {
            include: {
              category: true,
            },
          },
        },
      },
      payments: true,
    },
  });

  const totalOrders = orders.length;
  const totalSales = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

  // Sales by category
  const categoryMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  
  orders.forEach((order) => {
    order.orderItems.forEach((item) => {
      const cat = item.menuItem.category?.name || 'Uncategorized';
      const existing = categoryMap.get(cat) || { name: cat, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += Number(item.subtotal);
      categoryMap.set(cat, existing);
    });
  });

  // Sales by item (top 20)
  const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  
  orders.forEach((order) => {
    order.orderItems.forEach((item) => {
      const itemId = item.menuItemId;
      const existing = itemMap.get(itemId) || {
        name: item.menuItem.name,
        quantity: 0,
        revenue: 0,
      };
      existing.quantity += item.quantity;
      existing.revenue += Number(item.subtotal);
      itemMap.set(itemId, existing);
    });
  });

  const byItem = Array.from(itemMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  // Sales by payment method
  const paymentMap = new Map<string, { method: string; count: number; amount: number }>();
  
  orders.forEach((order) => {
    order.payments.forEach((payment) => {
      const method = payment.method;
      const existing = paymentMap.get(method) || { method, count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += Number(payment.amount);
      paymentMap.set(method, existing);
    });
  });

  return {
    totalSales,
    totalOrders,
    avgOrderValue,
    tips: 0, // TODO: Add tip field to Order model
    byCategory: Array.from(categoryMap.values()),
    byItem,
    byPaymentMethod: Array.from(paymentMap.values()),
  };
}

/**
 * Generate service report section - REAL implementation using waiter metrics
 */
async function generateServiceReport(
  prisma: PrismaClient,
  orgId: string,
  branchId: string,
  period: { startedAt: Date; closedAt: Date },
): Promise<ShiftEndReport['service']> {
  // Get all orders with user (waiter) info
  const orders = await prisma.order.findMany({
    where: {
      branchId,
      createdAt: { gte: period.startedAt, lte: period.closedAt },
      status: { in: ['CLOSED', 'SERVED'] },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Get void events for this period
  const voidEvents = await prisma.auditEvent.findMany({
    where: {
      branch: { orgId },
      branchId,
      action: 'VOID',
      createdAt: { gte: period.startedAt, lte: period.closedAt },
    },
    select: {
      userId: true,
      metadata: true,
    },
  });

  // Get discounts for this period
  const discounts = await prisma.discount.findMany({
    where: {
      orgId,
      order: {
        branchId,
        createdAt: { gte: period.startedAt, lte: period.closedAt },
      },
    },
    select: {
      createdById: true,
      value: true,
    },
  });

  // Build waiter stats
  const waiterMap = new Map<
    string,
    {
      waiterId: string;
      waiterName: string;
      ordersServed: number;
      totalSales: number;
      avgOrderValue: number;
      voidCount: number;
      voidValue: number;
      discountCount: number;
      discountValue: number;
      noDrinksCount: number;
    }
  >();

  // Aggregate orders by waiter
  orders.forEach((order) => {
    const userId = order.userId;
    if (!userId || !order.user) return;

    if (!waiterMap.has(userId)) {
      waiterMap.set(userId, {
        waiterId: userId,
        waiterName: `${order.user.firstName} ${order.user.lastName}`,
        ordersServed: 0,
        totalSales: 0,
        avgOrderValue: 0,
        voidCount: 0,
        voidValue: 0,
        discountCount: 0,
        discountValue: 0,
        noDrinksCount: 0,
      });
    }

    const stats = waiterMap.get(userId)!;
    stats.ordersServed += 1;
    stats.totalSales += Number(order.total);

    // Check for NO_DRINKS anomaly flag
    const flags = (order.anomalyFlags || []) as string[];
    if (flags.includes('NO_DRINKS')) {
      stats.noDrinksCount += 1;
    }
  });

  // Add void stats
  voidEvents.forEach((voidEvent) => {
    const userId = voidEvent.userId;
    if (!userId) return;

    const stats = waiterMap.get(userId);
    if (stats) {
      stats.voidCount += 1;
      if (
        voidEvent.metadata &&
        typeof voidEvent.metadata === 'object' &&
        'amount' in voidEvent.metadata
      ) {
        stats.voidValue += parseFloat(String(voidEvent.metadata.amount));
      }
    }
  });

  // Add discount stats
  discounts.forEach((discount) => {
    const userId = discount.createdById;
    const stats = waiterMap.get(userId);
    if (stats) {
      stats.discountCount += 1;
      stats.discountValue += Number(discount.value);
    }
  });

  // Calculate averages
  const waiters = Array.from(waiterMap.values()).map((w) => ({
    ...w,
    avgOrderValue: w.ordersServed > 0 ? w.totalSales / w.ordersServed : 0,
  }));

  return { waiters };
}

/**
 * Generate stock report section - REAL implementation using wastage data
 */
async function generateStockReport(
  prisma: PrismaClient,
  branchId: string,
  period: { startedAt: Date; closedAt: Date },
): Promise<ShiftEndReport['stock']> {
  // Get wastage records for this period
  const wastageRecords = await prisma.wastage.findMany({
    where: {
      branchId,
      createdAt: { gte: period.startedAt, lte: period.closedAt },
    },
    select: {
      qty: true,
      // Note: wastage cost needs to be calculated using WAC
      // For now, estimate at 5000 UGX per unit (simplified)
    },
  });

  const totalWastageValue = wastageRecords.reduce(
    (sum, w) => sum + Number(w.qty) * 5000,
    0
  );

  // Get low stock items using StockBatch for branch-specific stock
  const lowStockBatches = await prisma.stockBatch.findMany({
    where: {
      branchId,
      remainingQty: { gt: 0 },
    },
    include: {
      item: {
        select: {
          name: true,
          reorderLevel: true,
        },
      },
    },
  });

  // Aggregate by item
  const itemStockMap = new Map<string, { itemName: string; currentStock: number; reorderLevel: number }>();
  
  lowStockBatches.forEach((batch) => {
    const itemKey = batch.itemId;
    if (!itemStockMap.has(itemKey)) {
      itemStockMap.set(itemKey, {
        itemName: batch.item.name,
        currentStock: 0,
        reorderLevel: Number(batch.item.reorderLevel),
      });
    }
    itemStockMap.get(itemKey)!.currentStock += Number(batch.remainingQty);
  });

  // Filter to only items below reorder level
  const lowStock = Array.from(itemStockMap.values())
    .filter((item) => item.currentStock <= item.reorderLevel)
    .slice(0, 10);

  return {
    totalUsageValue: 0, // TODO: Calculate from stock movements
    totalVarianceValue: 0, // TODO: Calculate from reconciliation
    totalWastageValue,
    lowStockItems: lowStock,
  };
}

/**
 * Generate KDS metrics section - REAL implementation
 */
async function generateKdsReport(
  prisma: PrismaClient,
  branchId: string,
  period: { startedAt: Date; closedAt: Date },
): Promise<ShiftEndReport['kdsMetrics']> {
  // Get KDS tickets for this period
  const tickets = await prisma.kdsTicket.findMany({
    where: {
      order: {
        branchId,
      },
      createdAt: { gte: period.startedAt, lte: period.closedAt },
    },
    select: {
      station: true,
      sentAt: true,
      readyAt: true,
    },
  });

  const totalTickets = tickets.length;

  // Calculate SLA status for each ticket
  // Green = ready within 5 min, Orange = 5-10 min, Red = >10 min
  let greenCount = 0;
  let orangeCount = 0;
  let redCount = 0;

  const stationStats = new Map<string, { station: string; green: number; orange: number; red: number }>();

  tickets.forEach((ticket) => {
    if (!ticket.readyAt) return; // Skip incomplete tickets

    const durationMin = (ticket.readyAt.getTime() - ticket.sentAt.getTime()) / (1000 * 60);
    let status: 'green' | 'orange' | 'red';

    if (durationMin <= 5) {
      status = 'green';
      greenCount++;
    } else if (durationMin <= 10) {
      status = 'orange';
      orangeCount++;
    } else {
      status = 'red';
      redCount++;
    }

    // Station stats
    const station = ticket.station || 'Unknown';
    if (!stationStats.has(station)) {
      stationStats.set(station, { station, green: 0, orange: 0, red: 0 });
    }
    stationStats.get(station)![status]++;
  });

  const greenPct = totalTickets > 0 ? (greenCount / totalTickets) * 100 : 0;
  const orangePct = totalTickets > 0 ? (orangeCount / totalTickets) * 100 : 0;
  const redPct = totalTickets > 0 ? (redCount / totalTickets) * 100 : 0;

  return {
    totalTickets,
    slaMetrics: { greenPct, orangePct, redPct },
    byStation: Array.from(stationStats.values()),
  };
}

/**
 * Generate staff performance section - REAL implementation
 */
async function generateStaffReport(
  prisma: PrismaClient,
  branchId: string,
  period: { startedAt: Date; closedAt: Date },
): Promise<ShiftEndReport['staff']> {
  // Get orders grouped by user (waiter)
  const orders = await prisma.order.findMany({
    where: {
      branchId,
      createdAt: { gte: period.startedAt, lte: period.closedAt },
      status: { in: ['CLOSED', 'SERVED'] },
    },
    select: {
      userId: true,
      total: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Aggregate by user
  const userStats = new Map<string, { userId: string; userName: string; totalSales: number }>();

  orders.forEach((order) => {
    if (!order.userId || !order.user) return;

    if (!userStats.has(order.userId)) {
      userStats.set(order.userId, {
        userId: order.userId,
        userName: `${order.user.firstName} ${order.user.lastName}`,
        totalSales: 0,
      });
    }

    userStats.get(order.userId)!.totalSales += Number(order.total);
  });

  // Sort by sales and take top 5
  const topPerformers = Array.from(userStats.values())
    .sort((a, b) => b.totalSales - a.totalSales)
    .slice(0, 5)
    .map((user) => ({
      userId: user.userId,
      userName: user.userName,
      metric: 'Total Sales',
      value: user.totalSales,
    }));

  return {
    topPerformers,
    needsImprovement: [], // TODO: Implement based on high void/discount rates
  };
}

/**
 * Generate anomalies section - REAL implementation
 */
async function generateAnomaliesReport(
  prisma: PrismaClient,
  branchId: string,
  period: { startedAt: Date; closedAt: Date },
): Promise<ShiftEndReport['anomalies']> {
  // Get anomaly events for this period
  const anomalyEvents = await prisma.anomalyEvent.findMany({
    where: {
      branchId,
      occurredAt: { gte: period.startedAt, lte: period.closedAt },
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    take: 20, // Limit to most recent 20
    orderBy: {
      occurredAt: 'desc',
    },
  });

  return anomalyEvents.map((event) => ({
    orderId: event.orderId || 'Unknown',
    type: event.type,
    description: event.details ? JSON.stringify(event.details) : event.type,
    severity: event.severity,
    userId: event.user
      ? `${event.user.firstName} ${event.user.lastName}`
      : 'Unknown',
    timestamp: event.occurredAt,
  }));
}
