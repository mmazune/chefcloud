/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

interface KpisData {
  salesToday: number;
  salesMTD: number;
  paymentsMomo: number;
  paymentsCash: number;
  openOrders: number;
  tablesOccupied: number;
  onShiftNow: number;
  stockAtRisk: number;
  anomaliesToday: number;
  lastUpdate: string;
}

interface CacheEntry {
  kpis: KpisData;
  expiresAt: number;
}

@Injectable()
export class KpisService {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 10000; // 10 seconds

  constructor(private prisma: PrismaService) {}

  async getOrgKpis(orgId: string): Promise<KpisData> {
    const cacheKey = `org:${orgId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.kpis;
    }

    const kpis = await this.computeOrgKpis(orgId);
    this.cache.set(cacheKey, {
      kpis,
      expiresAt: Date.now() + this.TTL_MS,
    });

    return kpis;
  }

  async getBranchKpis(orgId: string, branchId: string): Promise<KpisData> {
    const cacheKey = `branch:${branchId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.kpis;
    }

    const kpis = await this.computeBranchKpis(orgId, branchId);
    this.cache.set(cacheKey, {
      kpis,
      expiresAt: Date.now() + this.TTL_MS,
    });

    return kpis;
  }

  markDirty(orgId: string, branchId?: string): void {
    try {
      if (branchId) {
        this.cache.delete(`branch:${branchId}`);
      }
      this.cache.delete(`org:${orgId}`);
    } catch {
      // Best-effort, no throw
    }
  }

  private async computeOrgKpis(orgId: string): Promise<KpisData> {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Sales today
    const salesToday = await this.prisma.client.order.aggregate({
      where: {
        branch: { orgId },
        status: { in: ['CLOSED', 'SERVED'] },
        createdAt: { gte: startOfDay },
      },
      _sum: { total: true },
    });

    // Sales MTD
    const salesMTD = await this.prisma.client.order.aggregate({
      where: {
        branch: { orgId },
        status: { in: ['CLOSED', 'SERVED'] },
        createdAt: { gte: startOfMonth },
      },
      _sum: { total: true },
    });

    // Payments today
    const payments = await this.prisma.client.payment.groupBy({
      by: ['method'],
      where: {
        order: { branch: { orgId } },
        createdAt: { gte: startOfDay },
      },
      _sum: { amount: true },
    });

    const paymentsMomo = payments.find((p) => p.method === 'MOMO')?._sum.amount || 0;
    const paymentsCash = payments.find((p) => p.method === 'CASH')?._sum.amount || 0;

    // Open orders
    const openOrders = await this.prisma.client.order.count({
      where: {
        branch: { orgId },
        status: { in: ['NEW', 'SENT', 'IN_KITCHEN', 'READY', 'SERVED'] },
      },
    });

    // Tables occupied
    const tablesOccupied = await this.prisma.client.table.count({
      where: {
        floorPlan: { orgId },
        status: 'OCCUPIED',
      },
    });

    // On shift now
    const onShiftNow = await this.prisma.client.shift.count({
      where: {
        branch: { orgId },
        closedAt: null,
      },
    });

    // Stock at risk (below reorder or negative)
    const stockAtRisk = await this.prisma.client.stockBatch.count({
      where: {
        branch: { orgId },
        OR: [{ remainingQty: { lte: 0 } }, { remainingQty: { lte: 5 } }],
      },
    });

    // Anomalies today
    const anomaliesToday = await this.prisma.client.anomalyEvent.count({
      where: {
        orgId,
        occurredAt: { gte: startOfDay },
      },
    });

    return {
      salesToday: Number(salesToday._sum.total || 0),
      salesMTD: Number(salesMTD._sum.total || 0),
      paymentsMomo: Number(paymentsMomo),
      paymentsCash: Number(paymentsCash),
      openOrders,
      tablesOccupied,
      onShiftNow,
      stockAtRisk,
      anomaliesToday,
      lastUpdate: new Date().toISOString(),
    };
  }

  private async computeBranchKpis(_orgId: string, branchId: string): Promise<KpisData> {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const salesToday = await this.prisma.client.order.aggregate({
      where: {
        branchId,
        status: { in: ['CLOSED', 'SERVED'] },
        createdAt: { gte: startOfDay },
      },
      _sum: { total: true },
    });

    const salesMTD = await this.prisma.client.order.aggregate({
      where: {
        branchId,
        status: { in: ['CLOSED', 'SERVED'] },
        createdAt: { gte: startOfMonth },
      },
      _sum: { total: true },
    });

    const payments = await this.prisma.client.payment.groupBy({
      by: ['method'],
      where: {
        order: { branchId },
        createdAt: { gte: startOfDay },
      },
      _sum: { amount: true },
    });

    const paymentsMomo = payments.find((p) => p.method === 'MOMO')?._sum.amount || 0;
    const paymentsCash = payments.find((p) => p.method === 'CASH')?._sum.amount || 0;

    const openOrders = await this.prisma.client.order.count({
      where: {
        branchId,
        status: { in: ['NEW', 'SENT', 'IN_KITCHEN', 'READY', 'SERVED'] },
      },
    });

    const tablesOccupied = await this.prisma.client.table.count({
      where: {
        branchId,
        status: 'OCCUPIED',
      },
    });

    const onShiftNow = await this.prisma.client.shift.count({
      where: {
        branchId,
        closedAt: null,
      },
    });

    const stockAtRisk = await this.prisma.client.stockBatch.count({
      where: {
        branchId,
        OR: [{ remainingQty: { lte: 0 } }, { remainingQty: { lte: 5 } }],
      },
    });

    const anomaliesToday = await this.prisma.client.anomalyEvent.count({
      where: {
        branchId,
        occurredAt: { gte: startOfDay },
      },
    });

    return {
      salesToday: Number(salesToday._sum.total || 0),
      salesMTD: Number(salesMTD._sum.total || 0),
      paymentsMomo: Number(paymentsMomo),
      paymentsCash: Number(paymentsCash),
      openOrders,
      tablesOccupied,
      onShiftNow,
      stockAtRisk,
      anomaliesToday,
      lastUpdate: new Date().toISOString(),
    };
  }
}
