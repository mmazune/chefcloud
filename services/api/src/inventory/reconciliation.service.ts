import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StockMovementType } from './stock-movements.service';

export interface ReconciliationItemResult {
  itemId: string;
  itemName: string;
  itemSku: string;
  unit: string;
  openingQty: number;
  purchasesQty: number;
  wastageQty: number;
  theoreticalUsageQty: number;
  closingQty: number;
  varianceQty: number;
  varianceCost: number;
  withinTolerance: boolean;
  openingCost: number;
  purchasesCost: number;
  wastageCost: number;
  theoreticalUsageCost: number;
  closingCost: number;
}

export interface ReconciliationQuery {
  orgId: string;
  branchId: string;
  shiftId?: string;
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Perform comprehensive inventory reconciliation
   * Equation: opening + purchases = theoretical usage + wastage + closing (+/- variance)
   */
  async reconcile(query: ReconciliationQuery): Promise<ReconciliationItemResult[]> {
    this.logger.log(
      `Reconciling inventory for branch ${query.branchId}, shift: ${query.shiftId || 'N/A'}, dates: ${query.startDate || 'N/A'} - ${query.endDate || 'N/A'}`,
    );

    // Determine period boundaries
    let periodStart: Date;
    let periodEnd: Date;

    if (query.shiftId) {
      // Use shift boundaries
      const shift = await this.prisma.client.shift.findUnique({
        where: { id: query.shiftId },
        select: { openedAt: true, closedAt: true },
      });

      if (!shift) {
        throw new Error(`Shift ${query.shiftId} not found`);
      }

      periodStart = shift.openedAt;
      periodEnd = shift.closedAt || new Date();
    } else if (query.startDate && query.endDate) {
      periodStart = query.startDate;
      periodEnd = query.endDate;
    } else {
      throw new Error('Either shiftId or startDate+endDate must be provided');
    }

    // Get all inventory items for this branch
    const items = await this.prisma.client.inventoryItem.findMany({
      where: {
        orgId: query.orgId,
        // Items that have any activity in this branch during the period
      },
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
      },
    });

    // Get tolerance config
    const orgSettings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId: query.orgId },
      select: { inventoryTolerance: true },
    });
    const tolerance = orgSettings?.inventoryTolerance as { pct?: number } | null;
    const tolerancePct = Number(tolerance?.pct || 5);

    // Process each item
    const results: ReconciliationItemResult[] = [];

    for (const item of items) {
      try {
        const result = await this.reconcileItem({
          ...query,
          itemId: item.id,
          periodStart,
          periodEnd,
          tolerancePct,
        });

        if (result) {
          results.push({
            ...result,
            itemName: item.name,
            itemSku: item.sku || '',
            unit: item.unit,
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to reconcile item ${item.id}: ${errorMsg}`);
      }
    }

    return results.filter(
      (r) =>
        r.openingQty > 0 || r.purchasesQty > 0 || r.wastageQty > 0 || r.theoreticalUsageQty > 0,
    );
  }

  /**
   * Reconcile a single item
   */
  private async reconcileItem(params: {
    orgId: string;
    branchId: string;
    itemId: string;
    shiftId?: string;
    periodStart: Date;
    periodEnd: Date;
    tolerancePct: number;
  }): Promise<Omit<ReconciliationItemResult, 'itemName' | 'itemSku' | 'unit'> | null> {
    const { orgId, branchId, itemId, shiftId, periodStart, periodEnd, tolerancePct } = params;

    // 1. Opening stock: Get stock at period start
    // For simplicity, we calculate opening from batches that existed before period start
    const openingBatches = await this.prisma.client.stockBatch.findMany({
      where: {
        branchId,
        itemId,
        receivedAt: { lt: periodStart },
      },
      select: {
        remainingQty: true,
        unitCost: true,
      },
    });

    let openingQty = 0;
    let openingCost = 0;
    for (const batch of openingBatches) {
      const qty = Number(batch.remainingQty);
      const cost = Number(batch.unitCost);
      openingQty += qty;
      openingCost += qty * cost;
    }

    // 2. Purchases: Sum PURCHASE movements or goods receipts in period
    const purchaseMovements = await this.prisma.client.stockMovement.findMany({
      where: {
        orgId,
        branchId,
        itemId,
        type: StockMovementType.PURCHASE,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      select: { qty: true, cost: true },
    });

    let purchasesQty = 0;
    let purchasesCost = 0;
    for (const mov of purchaseMovements) {
      purchasesQty += Number(mov.qty);
      purchasesCost += Number(mov.cost);
    }

    // If no PURCHASE movements exist yet, fall back to goods receipts
    if (purchasesQty === 0) {
      const receipts = await this.prisma.client.goodsReceiptLine.findMany({
        where: {
          itemId,
          gr: {
            branchId,
            receivedAt: {
              gte: periodStart,
              lte: periodEnd,
            },
          },
        },
        select: {
          qtyReceived: true,
          unitCost: true,
        },
      });

      for (const line of receipts) {
        const qty = Number(line.qtyReceived);
        const cost = Number(line.unitCost);
        purchasesQty += qty;
        purchasesCost += qty * cost;
      }
    }

    // 3. Theoretical usage: Sum SALE movements
    const saleMovements = await this.prisma.client.stockMovement.findMany({
      where: {
        orgId,
        branchId,
        itemId,
        type: StockMovementType.SALE,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      select: { qty: true, cost: true },
    });

    let theoreticalUsageQty = 0;
    let theoreticalUsageCost = 0;
    for (const mov of saleMovements) {
      theoreticalUsageQty += Number(mov.qty);
      theoreticalUsageCost += Number(mov.cost);
    }

    // 4. Wastage: Sum WASTAGE movements
    const wastageMovements = await this.prisma.client.stockMovement.findMany({
      where: {
        orgId,
        branchId,
        itemId,
        type: StockMovementType.WASTAGE,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      select: { qty: true, cost: true },
    });

    let wastageQty = 0;
    let wastageCost = 0;
    for (const mov of wastageMovements) {
      wastageQty += Number(mov.qty);
      wastageCost += Number(mov.cost);
    }

    // 5. Closing stock: Get stock at period end
    // Option A: From stock count if shift is closed
    let closingQty = 0;
    let closingCost = 0;

    if (shiftId) {
      // Try to get from stock count (lines stored in JSON field)
      const stockCount = await this.prisma.client.stockCount.findFirst({
        where: { shiftId },
      });

      if (stockCount && stockCount.lines) {
        const lines = stockCount.lines as any;
        const linesArray = Array.isArray(lines) ? lines : [];
        const itemLine = linesArray.find((l: any) => l.itemId === itemId);
        if (itemLine) {
          closingQty = Number(itemLine.countedQty || 0);
        }
      }

      if (closingQty > 0) {
        // Estimate closing cost using WAC from batches
        const closingBatches = await this.prisma.client.stockBatch.findMany({
          where: {
            branchId,
            itemId,
            remainingQty: { gt: 0 },
          },
          select: {
            remainingQty: true,
            unitCost: true,
          },
        });

        if (closingBatches.length > 0) {
          let totalCostQty = 0;
          let totalQty = 0;
          for (const batch of closingBatches) {
            const qty = Number(batch.remainingQty);
            const cost = Number(batch.unitCost);
            totalCostQty += qty * cost;
            totalQty += qty;
          }
          const wac = totalQty > 0 ? totalCostQty / totalQty : 0;
          closingCost = closingQty * wac;
        }
      }
    }

    // Option B: Calculate from current batches if no count available
    if (closingQty === 0) {
      const currentBatches = await this.prisma.client.stockBatch.findMany({
        where: {
          branchId,
          itemId,
          remainingQty: { gt: 0 },
        },
        select: {
          remainingQty: true,
          unitCost: true,
        },
      });

      for (const batch of currentBatches) {
        const qty = Number(batch.remainingQty);
        const cost = Number(batch.unitCost);
        closingQty += qty;
        closingCost += qty * cost;
      }
    }

    // 6. Calculate variance
    // Equation: opening + purchases = theoretical usage + wastage + closing + variance
    // Therefore: variance = (opening + purchases) - (theoretical usage + wastage + closing)
    const varianceQty = openingQty + purchasesQty - (theoreticalUsageQty + wastageQty + closingQty);

    // Estimate variance cost (use WAC or simple proportion)
    const totalInQty = openingQty + purchasesQty;
    const totalInCost = openingCost + purchasesCost;
    const avgCost = totalInQty > 0 ? totalInCost / totalInQty : 0;
    const varianceCost = varianceQty * avgCost;

    // 7. Check tolerance
    const expectedClosingQty = openingQty + purchasesQty - theoreticalUsageQty - wastageQty;
    const toleranceAmount = Math.abs(expectedClosingQty * (tolerancePct / 100));
    const withinTolerance = Math.abs(varianceQty) <= toleranceAmount;

    return {
      itemId,
      openingQty,
      purchasesQty,
      wastageQty,
      theoreticalUsageQty,
      closingQty,
      varianceQty,
      varianceCost,
      withinTolerance,
      openingCost,
      purchasesCost,
      wastageCost,
      theoreticalUsageCost,
      closingCost,
    };
  }

  /**
   * Get summary statistics for a reconciliation
   */
  async getSummary(query: ReconciliationQuery): Promise<{
    totalItems: number;
    itemsWithVariance: number;
    itemsOutOfTolerance: number;
    totalVarianceCost: number;
    totalWastageCost: number;
  }> {
    const results = await this.reconcile(query);

    const totalItems = results.length;
    const itemsWithVariance = results.filter((r) => Math.abs(r.varianceQty) > 0.001).length;
    const itemsOutOfTolerance = results.filter((r) => !r.withinTolerance).length;
    const totalVarianceCost = results.reduce((sum, r) => sum + r.varianceCost, 0);
    const totalWastageCost = results.reduce((sum, r) => sum + r.wastageCost, 0);

    return {
      totalItems,
      itemsWithVariance,
      itemsOutOfTolerance,
      totalVarianceCost,
      totalWastageCost,
    };
  }
}
