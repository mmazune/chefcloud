/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getXReport(branchId: string): Promise<any> {
    // X Report: Current shift summary without closing
    const shift = await this.prisma.client.shift.findFirst({
      where: { branchId, closedAt: null },
      include: {
        openedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!shift) {
      return { error: 'No open shift found' };
    }

    // Get orders since shift opened
    const orders = await this.prisma.client.order.findMany({
      where: {
        branchId,
        createdAt: { gte: shift.openedAt },
        status: { in: ['CLOSED', 'SERVED'] },
      },
      include: {
        payments: true,
        discounts: true,
        refunds: true,
      },
    });

    const totalSales = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalDiscount = orders.reduce((sum, o) => sum + Number(o.discount), 0);
    const cashPayments = orders.flatMap((o) => o.payments).filter((p) => p.method === 'CASH');
    const totalCash = cashPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    // Calculate refunds
    const allRefunds = orders.flatMap((o) => o.refunds).filter((r) => r.status === 'COMPLETED');
    const totalRefunds = allRefunds.reduce((sum, r) => sum + Number(r.amount), 0);

    // Count post-close voids (orders with metadata.voidedPostClose = true)
    const postCloseVoids = orders.filter(
      (o) =>
        o.metadata &&
        typeof o.metadata === 'object' &&
        (o.metadata as any).voidedPostClose === true,
    );
    const postCloseVoidCount = postCloseVoids.length;
    const postCloseVoidTotal = postCloseVoids.reduce((sum, o) => sum + Number(o.total), 0);

    return {
      type: 'X_REPORT',
      shift: {
        id: shift.id,
        openedAt: shift.openedAt,
        openedBy: `${shift.openedBy.firstName} ${shift.openedBy.lastName}`,
        openingFloat: Number(shift.openingFloat),
      },
      summary: {
        orderCount: orders.length,
        totalSales,
        totalDiscount,
        totalCash,
        totalRefunds,
        postCloseVoidCount,
        postCloseVoidTotal,
      },
      generatedAt: new Date(),
    };
  }

  async getZReport(branchId: string, shiftId: string): Promise<any> {
    // Z Report: Shift close summary
    const shift = await this.prisma.client.shift.findUnique({
      where: { id: shiftId },
      include: {
        openedBy: { select: { firstName: true, lastName: true } },
        closedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!shift) {
      return { error: 'Shift not found' };
    }

    if (!shift.closedAt) {
      return { error: 'Shift is still open' };
    }

    // Get all orders for this shift
    const orders = await this.prisma.client.order.findMany({
      where: {
        branchId,
        createdAt: { gte: shift.openedAt, lte: shift.closedAt },
        status: { in: ['CLOSED', 'SERVED'] },
      },
      include: {
        payments: true,
        discounts: true,
        refunds: true,
      },
    });

    const totalSales = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalDiscount = orders.reduce((sum, o) => sum + Number(o.discount), 0);

    const paymentsByMethod = {
      CASH: 0,
      CARD: 0,
      MOMO: 0,
    };

    orders
      .flatMap((o) => o.payments)
      .forEach((p) => {
        paymentsByMethod[p.method] += Number(p.amount);
      });

    // Calculate refunds
    const allRefunds = orders.flatMap((o) => o.refunds).filter((r) => r.status === 'COMPLETED');
    const totalRefunds = allRefunds.reduce((sum, r) => sum + Number(r.amount), 0);

    // Count post-close voids
    const postCloseVoids = orders.filter(
      (o) =>
        o.metadata &&
        typeof o.metadata === 'object' &&
        (o.metadata as any).voidedPostClose === true,
    );
    const postCloseVoidCount = postCloseVoids.length;
    const postCloseVoidTotal = postCloseVoids.reduce((sum, o) => sum + Number(o.total), 0);

    return {
      type: 'Z_REPORT',
      shift: {
        id: shift.id,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        openedBy: `${shift.openedBy.firstName} ${shift.openedBy.lastName}`,
        closedBy: shift.closedBy
          ? `${shift.closedBy.firstName} ${shift.closedBy.lastName}`
          : undefined,
        openingFloat: Number(shift.openingFloat),
        declaredCash: Number(shift.declaredCash),
        overShort: Number(shift.overShort),
      },
      summary: {
        orderCount: orders.length,
        totalSales,
        totalDiscount,
        paymentsByMethod,
        totalRefunds,
        postCloseVoidCount,
        postCloseVoidTotal,
      },
      generatedAt: new Date(),
    };
  }
}
