/**
 * M11.15: Inventory Health Report Service
 *
 * Provides inventory system health metrics including:
 * - Item counts (total, active, inactive)
 * - Ledger entry counts
 * - Integrity checks (orphaned entries, negative stock)
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';

const Decimal = Prisma.Decimal;

export type HealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL';

export interface InventoryHealthMetrics {
  totalItems: number;
  activeItems: number;
  inactiveItems: number;
  totalLedgerEntries: number;
  totalCostLayers: number;
  totalLotAllocations: number;
  itemsWithNegativeStock: number;
  orphanedLedgerEntries: number;
}

export interface InventoryHealthReport {
  orgId: string;
  branchId?: string;
  generatedAt: string;
  metrics: InventoryHealthMetrics;
  health: HealthStatus;
  warnings: string[];
}

@Injectable()
export class InventoryHealthService {
  private readonly logger = new Logger(InventoryHealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate inventory health report for an organization.
   *
   * @param orgId Organization ID
   * @param branchId Optional branch ID for scoped report
   * @returns Inventory health report
   */
  async getHealthReport(
    orgId: string,
    branchId?: string,
  ): Promise<InventoryHealthReport> {
    const start = Date.now();
    this.logger.log(`Generating inventory health report for org=${orgId}`);

    // Count items
    const [totalItems, activeItems, inactiveItems] = await Promise.all([
      this.prisma.client.inventoryItem.count({
        where: { orgId },
      }),
      this.prisma.client.inventoryItem.count({
        where: { orgId, isActive: true },
      }),
      this.prisma.client.inventoryItem.count({
        where: { orgId, isActive: false },
      }),
    ]);

    // Count ledger entities
    const branchFilter = branchId ? { branchId } : {};
    const [totalLedgerEntries, totalCostLayers, totalLotAllocations] =
      await Promise.all([
        this.prisma.client.inventoryLedgerEntry.count({
          where: { orgId, ...branchFilter },
        }),
        this.prisma.client.inventoryCostLayer.count({
          where: { orgId, ...branchFilter },
        }),
        this.prisma.client.lotLedgerAllocation.count({
          where: { orgId },
        }),
      ]);

    // Check for items with negative stock (warning condition)
    // We compute stock by aggregating ledger entries
    const itemsWithNegativeStock = await this.countItemsWithNegativeStock(
      orgId,
      branchId,
    );

    // Check for orphaned ledger entries (entries with no valid item)
    const orphanedLedgerEntries = await this.countOrphanedLedgerEntries(orgId);

    const metrics: InventoryHealthMetrics = {
      totalItems,
      activeItems,
      inactiveItems,
      totalLedgerEntries,
      totalCostLayers,
      totalLotAllocations,
      itemsWithNegativeStock,
      orphanedLedgerEntries,
    };

    // Determine health status
    const warnings: string[] = [];
    let health: HealthStatus = 'HEALTHY';

    if (orphanedLedgerEntries > 0) {
      health = 'CRITICAL';
      warnings.push(
        `${orphanedLedgerEntries} orphaned ledger entries detected`,
      );
    }

    if (itemsWithNegativeStock > 10) {
      health = 'CRITICAL';
      warnings.push(`${itemsWithNegativeStock} items have negative stock`);
    } else if (itemsWithNegativeStock > 0) {
      if (health !== 'CRITICAL') health = 'WARNING';
      warnings.push(`${itemsWithNegativeStock} items have negative stock`);
    }

    const duration = Date.now() - start;
    this.logger.log(
      `Health report generated in ${duration}ms: ${health} (${warnings.length} warnings)`,
    );

    return {
      orgId,
      branchId,
      generatedAt: new Date().toISOString(),
      metrics,
      health,
      warnings,
    };
  }

  /**
   * Count items with negative computed stock.
   */
  private async countItemsWithNegativeStock(
    orgId: string,
    branchId?: string,
  ): Promise<number> {
    // Aggregate ledger entries by item and check for negative totals
    const branchFilter = branchId ? { branchId } : {};

    const aggregates = await this.prisma.client.inventoryLedgerEntry.groupBy({
      by: ['itemId'],
      where: { orgId, ...branchFilter },
      _sum: { qty: true },
    });

    let count = 0;
    for (const agg of aggregates) {
      const sum = agg._sum.qty;
      if (sum && new Decimal(sum).lessThan(0)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Count ledger entries referencing non-existent items.
   */
  private async countOrphanedLedgerEntries(orgId: string): Promise<number> {
    // Get all unique item IDs from ledger entries
    const ledgerItemIds = await this.prisma.client.inventoryLedgerEntry.findMany({
      where: { orgId },
      select: { itemId: true },
      distinct: ['itemId'],
    });

    const itemIds = ledgerItemIds.map((l) => l.itemId);

    if (itemIds.length === 0) return 0;

    // Check which items exist
    const existingItems = await this.prisma.client.inventoryItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true },
    });

    const existingIds = new Set(existingItems.map((i) => i.id));
    const orphanedIds = itemIds.filter((id) => !existingIds.has(id));

    if (orphanedIds.length === 0) return 0;

    // Count ledger entries for orphaned items
    return this.prisma.client.inventoryLedgerEntry.count({
      where: { itemId: { in: orphanedIds } },
    });
  }
}
