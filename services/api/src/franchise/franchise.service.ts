import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface BranchOverview {
  branchId: string;
  branchName: string;
  sales: number;
  grossMargin: number;
  wastePercent: number;
  sla: number;
}

export interface BranchRanking {
  branchId: string;
  branchName: string;
  score: number;
  rank: number;
  metrics: {
    revenue: number;
    margin: number;
    waste: number;
    sla: number;
  };
}

export interface ForecastItemData {
  itemId: string;
  itemName: string;
  forecasts: Array<{
    date: string;
    predictedQty: number;
  }>;
}

export interface ProcurementSuggestion {
  itemId: string;
  itemName: string;
  currentStock: number;
  safetyStock: number;
  suggestedQty: number;
}

@Injectable()
export class FranchiseService {
  constructor(private prisma: PrismaService) {}

  async getOverview(orgId: string, period: string): Promise<BranchOverview[]> {
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const branches = await this.prisma.branch.findMany({
      where: { orgId },
      select: { id: true, name: true },
    });

    const results: BranchOverview[] = [];

    for (const branch of branches) {
      // Get sales from closed orders
      const orders = await this.prisma.order.findMany({
        where: {
          branchId: branch.id,
          status: 'CLOSED',
          updatedAt: { gte: startDate, lte: endDate },
        },
        select: { total: true },
      });

      const sales = orders.reduce((sum, o) => sum + Number(o.total), 0);

      // Get wastage
      const wastage = await this.prisma.wastage.findMany({
        where: {
          branchId: branch.id,
          createdAt: { gte: startDate, lte: endDate },
        },
        select: { qty: true },
      });

      // Estimate cost at 5000 UGX per unit (simplified)
      const totalWaste = wastage.reduce((sum, w) => sum + Number(w.qty) * 5000, 0);

      // Simplified metrics (in production would calculate actual COGS and SLA)
      const grossMargin = sales * 0.65; // Assume 65% margin
      const wastePercent = sales > 0 ? (totalWaste / sales) * 100 : 0;
      const sla = 95; // Placeholder - would calculate from order times

      results.push({
        branchId: branch.id,
        branchName: branch.name,
        sales,
        grossMargin,
        wastePercent,
        sla,
      });
    }

    return results;
  }

  async getRankings(orgId: string, period: string): Promise<BranchRanking[]> {
    // Check if rankings exist
    const existingRanks = await this.prisma.franchiseRank.findMany({
      where: { orgId, period },
      include: { branch: true },
      orderBy: { rank: 'asc' },
    });

    if (existingRanks.length > 0) {
      return existingRanks.map((r) => ({
        branchId: r.branchId,
        branchName: r.branch.name,
        score: Number(r.score),
        rank: r.rank,
        metrics: r.meta as {
          revenue: number;
          margin: number;
          waste: number;
          sla: number;
        },
      }));
    }

    // Generate rankings on the fly
    const overview = await this.getOverview(orgId, period);

    // Get custom weights from org settings, or use defaults
    const orgSettings = await this.prisma.orgSettings.findUnique({
      where: { orgId },
      select: { franchiseWeights: true },
    });

    const weights = orgSettings?.franchiseWeights
      ? (orgSettings.franchiseWeights as {
          revenue: number;
          margin: number;
          waste: number;
          sla: number;
        })
      : { revenue: 0.4, margin: 0.3, waste: -0.2, sla: 0.1 };

    // Calculate scores using custom or default weights
    const maxRevenue = Math.max(...overview.map((b) => b.sales));
    const maxMargin = Math.max(...overview.map((b) => b.grossMargin));

    const scored = overview.map((branch) => {
      const revenueScore = maxRevenue > 0 ? (branch.sales / maxRevenue) * weights.revenue * 100 : 0;
      const marginScore =
        maxMargin > 0 ? (branch.grossMargin / maxMargin) * weights.margin * 100 : 0;
      const wasteScore = branch.wastePercent * weights.waste * 10; // Negative weight
      const slaScore = (branch.sla / 100) * weights.sla * 100;

      const score = revenueScore + marginScore + wasteScore + slaScore;

      return {
        branchId: branch.branchId,
        branchName: branch.branchName,
        score,
        metrics: {
          revenue: branch.sales,
          margin: branch.grossMargin,
          waste: branch.wastePercent,
          sla: branch.sla,
        },
      };
    });

    // Sort and assign ranks
    scored.sort((a, b) => b.score - a.score);
    const ranked = scored.map((s, i) => ({ ...s, rank: i + 1 }));

    return ranked;
  }

  async upsertBudget(
    orgId: string,
    branchId: string,
    period: string,
    data: {
      revenueTarget: number;
      cogsTarget: number;
      expenseTarget: number;
      notes?: string;
    },
  ): Promise<Record<string, unknown>> {
    const budget = await this.prisma.branchBudget.upsert({
      where: {
        orgId_branchId_period: { orgId, branchId, period },
      },
      create: {
        orgId,
        branchId,
        period,
        revenueTarget: data.revenueTarget,
        cogsTarget: data.cogsTarget,
        expenseTarget: data.expenseTarget,
        notes: data.notes,
      },
      update: {
        revenueTarget: data.revenueTarget,
        cogsTarget: data.cogsTarget,
        expenseTarget: data.expenseTarget,
        notes: data.notes,
      },
    });

    return {
      id: budget.id,
      branchId: budget.branchId,
      period: budget.period,
      revenueTarget: Number(budget.revenueTarget),
      cogsTarget: Number(budget.cogsTarget),
      expenseTarget: Number(budget.expenseTarget),
      notes: budget.notes,
    };
  }

  async getBudgets(orgId: string, period: string): Promise<Record<string, unknown>[]> {
    const budgets = await this.prisma.branchBudget.findMany({
      where: { orgId, period },
      include: { branch: { select: { name: true } } },
    });

    return budgets.map((b) => ({
      id: b.id,
      branchId: b.branchId,
      branchName: b.branch.name,
      period: b.period,
      revenueTarget: Number(b.revenueTarget),
      cogsTarget: Number(b.cogsTarget),
      expenseTarget: Number(b.expenseTarget),
      notes: b.notes,
    }));
  }

  async getForecastItems(
    orgId: string,
    period: string,
    _method: string,
  ): Promise<ForecastItemData[]> {
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Get forecast points for the period
    const points = await this.prisma.forecastPoint.findMany({
      where: {
        orgId,
        date: { gte: startDate, lte: endDate },
      },
      include: { item: { select: { name: true } } },
      orderBy: [{ itemId: 'asc' }, { date: 'asc' }],
    });

    // Group by item
    const grouped = points.reduce(
      (acc, p) => {
        if (!acc[p.itemId]) {
          acc[p.itemId] = {
            itemId: p.itemId,
            itemName: p.item.name,
            forecasts: [],
          };
        }
        acc[p.itemId].forecasts.push({
          date: p.date.toISOString().split('T')[0],
          predictedQty: Number(p.predictedQty),
        });
        return acc;
      },
      {} as Record<string, ForecastItemData>,
    );

    return Object.values(grouped);
  }

  async getProcurementSuggestions(
    orgId: string,
    branchId?: string,
  ): Promise<ProcurementSuggestion[]> {
    // Get items below safety stock
    const items = await this.prisma.inventoryItem.findMany({
      where: { orgId, isActive: true },
      select: {
        id: true,
        name: true,
        reorderLevel: true,
        reorderQty: true,
        stockBatches: {
          where: branchId ? { branchId } : {},
          select: { remainingQty: true },
        },
      },
    });

    const suggestions: ProcurementSuggestion[] = [];

    for (const item of items) {
      const currentStock = item.stockBatches.reduce((sum, b) => sum + Number(b.remainingQty), 0);
      const safetyStock = Number(item.reorderLevel);

      if (currentStock < safetyStock) {
        const suggestedQty = Number(item.reorderQty) || safetyStock * 2;
        suggestions.push({
          itemId: item.id,
          itemName: item.name,
          currentStock,
          safetyStock,
          suggestedQty,
        });
      }
    }

    return suggestions;
  }

  // Helper for worker: calculate MA forecast
  async calculateMovingAverage(
    _orgId: string,
    branchId: string,
    itemId: string,
    days: number,
  ): Promise<number> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Count consumed inventory for the item
    const consumed = await this.prisma.client.stockBatch.aggregate({
      where: {
        branchId,
        itemId,
        receivedAt: { gte: startDate, lte: endDate },
      },
      _sum: {
        receivedQty: true,
        remainingQty: true,
      },
    });

    const receivedQty = Number(consumed._sum?.receivedQty || 0);
    const remainingQty = Number(consumed._sum?.remainingQty || 0);
    const consumedTotal = receivedQty - remainingQty;

    return Math.max(0, consumedTotal / days);
  }

  // E22-s3: Central Procurement
  async generateDraftPOs(
    orgId: string,
    userId: string,
    strategy: 'SAFETY_STOCK' | 'FORECAST',
    branchIds?: string[],
  ): Promise<{
    jobId: string;
    drafts: Array<{
      poId: string;
      supplierId: string;
      branchId: string;
      itemsCount: number;
    }>;
  }> {
    // Get suggestions
    const allBranches = branchIds
      ? await this.prisma.branch.findMany({
          where: { orgId, id: { in: branchIds } },
        })
      : await this.prisma.branch.findMany({ where: { orgId } });

    // Collect items below safety stock per branch
    const suggestions: Array<{
      branchId: string;
      itemId: string;
      supplierId: string | null;
      suggestedQty: number;
    }> = [];

    for (const branch of allBranches) {
      const items = await this.prisma.inventoryItem.findMany({
        where: { orgId, isActive: true },
        include: {
          stockBatches: {
            where: { branchId: branch.id },
            select: { remainingQty: true },
          },
        },
      });

      for (const item of items) {
        const currentStock = item.stockBatches.reduce((sum, b) => sum + Number(b.remainingQty), 0);
        const safetyStock = Number(item.reorderLevel);

        if (currentStock < safetyStock) {
          const suggestedQty = Number(item.reorderQty) || safetyStock * 2;

          // Get supplier from metadata (simplified - in production would have item-supplier relation)
          const supplierId = (item.metadata as { supplierId?: string })?.supplierId || null;

          suggestions.push({
            branchId: branch.id,
            itemId: item.id,
            supplierId,
            suggestedQty,
          });
        }
      }
    }

    // Group by supplier + branch
    const grouped = suggestions.reduce(
      (acc, s) => {
        if (!s.supplierId) return acc;
        const key = `${s.supplierId}:${s.branchId}`;
        if (!acc[key]) {
          acc[key] = {
            supplierId: s.supplierId,
            branchId: s.branchId,
            items: [],
          };
        }
        acc[key].items.push({ itemId: s.itemId, qty: s.suggestedQty });
        return acc;
      },
      {} as Record<
        string,
        {
          supplierId: string;
          branchId: string;
          items: Array<{ itemId: string; qty: number }>;
        }
      >,
    );

    // Create ProcurementJob
    const job = await this.prisma.client.procurementJob.create({
      data: {
        orgId,
        createdById: userId,
        strategy,
        draftPoCount: Object.keys(grouped).length,
        status: 'DRAFT',
      },
    });

    // Create draft POs
    const drafts: Array<{
      poId: string;
      supplierId: string;
      branchId: string;
      itemsCount: number;
    }> = [];

    for (const group of Object.values(grouped)) {
      // Get supplier to apply packSize/minOrderQty
      const supplier = await this.prisma.client.supplier.findUnique({
        where: { id: group.supplierId },
        select: { packSize: true, minOrderQty: true },
      });

      const poItems = group.items.map((itm) => {
        let qty = itm.qty;

        // Round up to packSize
        if (supplier?.packSize && Number(supplier.packSize) > 0) {
          const packSize = Number(supplier.packSize);
          qty = Math.ceil(qty / packSize) * packSize;
        }

        // Ensure minOrderQty
        if (supplier?.minOrderQty && qty < Number(supplier.minOrderQty)) {
          qty = Number(supplier.minOrderQty);
        }

        return {
          itemId: itm.itemId,
          qty,
          unitCost: 0, // Unknown until supplier quote
          subtotal: 0,
        };
      });

      const total = poItems.reduce((sum, i) => sum + Number(i.subtotal), 0);

      const po = await this.prisma.client.purchaseOrder.create({
        data: {
          orgId,
          branchId: group.branchId,
          supplierId: group.supplierId,
          poNumber: `DRAFT-${Date.now()}`,
          status: 'DRAFT',
          totalAmount: total,
          items: {
            create: poItems,
          },
        },
      });

      drafts.push({
        poId: po.id,
        supplierId: group.supplierId,
        branchId: group.branchId,
        itemsCount: poItems.length,
      });
    }

    return { jobId: job.id, drafts };
  }

  async getDraftPOs(orgId: string): Promise<
    Array<{
      poId: string;
      poNumber: string;
      supplierId: string;
      supplierName: string;
      branchId: string;
      branchName: string;
      itemsCount: number;
      total: number;
    }>
  > {
    const pos = await this.prisma.client.purchaseOrder.findMany({
      where: { orgId, status: 'DRAFT' },
      include: {
        supplier: { select: { name: true } },
        branch: { select: { name: true } },
        items: true,
      },
    });

    return pos.map((po) => ({
      poId: po.id,
      poNumber: po.poNumber,
      supplierId: po.supplierId,
      supplierName: po.supplier.name,
      branchId: po.branchId,
      branchName: po.branch.name,
      itemsCount: po.items.length,
      total: Number(po.totalAmount),
    }));
  }

  async approvePOs(orgId: string, poIds: string[]): Promise<{ approved: number }> {
    // Update PO status
    await this.prisma.client.purchaseOrder.updateMany({
      where: { orgId, id: { in: poIds }, status: 'DRAFT' },
      data: { status: 'PLACED' },
    });

    // Send email stubs (in production would send real emails)
    const pos = await this.prisma.client.purchaseOrder.findMany({
      where: { id: { in: poIds } },
      include: { supplier: { select: { email: true, name: true } }, items: true },
    });

    for (const po of pos) {
      if (po.supplier.email) {
        console.log(
          `[EMAIL STUB] To: ${po.supplier.email}, Subject: PO ${po.poNumber} for ${po.supplier.name}, Items: ${po.items.length}`,
        );
        // In production: await this.mailerService.send(...)
      }
    }

    return { approved: poIds.length };
  }
}
