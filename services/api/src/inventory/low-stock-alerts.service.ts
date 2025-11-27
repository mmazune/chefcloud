import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StockMovementType } from './stock-movements.service';

export interface LowStockAlert {
  itemId: string;
  itemName: string;
  itemSku: string;
  category: string;
  unit: string;
  currentQty: number;
  minQuantity: number | null;
  minDaysOfCover: number | null;
  estimatedDaysRemaining: number | null;
  alertLevel: 'LOW' | 'CRITICAL';
  reorderLevel: number;
  reorderQty: number;
}

export interface LowStockConfigDto {
  itemId?: string;
  category?: string;
  minQuantity?: number;
  minDaysOfCover?: number;
  alertLevel?: 'LOW' | 'CRITICAL';
  enabled?: boolean;
}

@Injectable()
export class LowStockAlertsService {
  private readonly logger = new Logger(LowStockAlertsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get or create low-stock configuration
   */
  async getConfig(orgId: string, branchId?: string): Promise<any[]> {
    return this.prisma.client.lowStockConfig.findMany({
      where: {
        orgId,
        branchId: branchId || null,
        enabled: true,
      },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: true,
          },
        },
      },
    });
  }

  /**
   * Update or create low-stock configuration
   */
  async upsertConfig(orgId: string, branchId: string | null, dto: LowStockConfigDto): Promise<any> {
    const existing = await this.prisma.client.lowStockConfig.findFirst({
      where: {
        orgId,
        branchId,
        itemId: dto.itemId || null,
        category: dto.category || null,
      },
    });

    if (existing) {
      return this.prisma.client.lowStockConfig.update({
        where: { id: existing.id },
        data: {
          minQuantity: dto.minQuantity,
          minDaysOfCover: dto.minDaysOfCover,
          alertLevel: dto.alertLevel || 'LOW',
          enabled: dto.enabled !== undefined ? dto.enabled : true,
          updatedAt: new Date(),
        },
      });
    }

    return this.prisma.client.lowStockConfig.create({
      data: {
        orgId,
        branchId,
        itemId: dto.itemId,
        category: dto.category,
        minQuantity: dto.minQuantity,
        minDaysOfCover: dto.minDaysOfCover,
        alertLevel: dto.alertLevel || 'LOW',
        enabled: dto.enabled !== undefined ? dto.enabled : true,
      },
    });
  }

  /**
   * Detect low-stock items for a branch
   */
  async detectLowStock(orgId: string, branchId: string): Promise<LowStockAlert[]> {
    this.logger.log(`Detecting low stock for branch ${branchId}`);

    // Get all enabled configs for this org/branch
    const configs = await this.getConfig(orgId, branchId);

    // Also get org-level defaults
    const orgDefaults = await this.prisma.client.lowStockConfig.findMany({
      where: {
        orgId,
        branchId: null,
        enabled: true,
      },
    });

    const alerts: LowStockAlert[] = [];

    // Get all inventory items with current stock
    const items = await this.prisma.client.inventoryItem.findMany({
      where: {
        orgId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        unit: true,
        reorderLevel: true,
        reorderQty: true,
        stockBatches: {
          where: {
            branchId,
            remainingQty: { gt: 0 },
          },
          select: {
            remainingQty: true,
          },
        },
      },
    });

    for (const item of items) {
      // Calculate current quantity
      const currentQty = item.stockBatches.reduce(
        (sum, batch) => sum + Number(batch.remainingQty),
        0,
      );

      // Find applicable config (item-specific > category > org default)
      let config = configs.find((c) => c.itemId === item.id);
      if (!config && item.category) {
        config = configs.find((c) => c.category === item.category && !c.itemId);
      }
      if (!config && item.category) {
        config = orgDefaults.find((c) => c.category === item.category && !c.itemId);
      }
      if (!config) {
        config = orgDefaults.find((c) => !c.itemId && !c.category); // Global default
      }

      // Check if alert should be triggered
      let isLow = false;
      let isCritical = false;
      let estimatedDaysRemaining: number | null = null;

      // Check min quantity threshold
      if (config?.minQuantity) {
        const minQty = Number(config.minQuantity);
        if (currentQty <= minQty * 0.5) {
          isCritical = true;
          isLow = true;
        } else if (currentQty <= minQty) {
          isLow = true;
        }
      }

      // Check min days of cover
      if (config?.minDaysOfCover && !isCritical) {
        // Calculate average daily usage from last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const usageMovements = await this.prisma.client.stockMovement.findMany({
          where: {
            orgId,
            branchId,
            itemId: item.id,
            type: StockMovementType.SALE,
            createdAt: { gte: sevenDaysAgo },
          },
          select: { qty: true },
        });

        const totalUsage = usageMovements.reduce((sum, m) => sum + Number(m.qty), 0);
        const avgDailyUsage = totalUsage / 7;

        if (avgDailyUsage > 0) {
          estimatedDaysRemaining = currentQty / avgDailyUsage;

          if (estimatedDaysRemaining <= config.minDaysOfCover * 0.5) {
            isCritical = true;
            isLow = true;
          } else if (estimatedDaysRemaining <= config.minDaysOfCover) {
            isLow = true;
          }
        }
      }

      // Fallback: use reorderLevel from item if no config
      if (!config && Number(item.reorderLevel) > 0 && currentQty <= Number(item.reorderLevel)) {
        isLow = true;
        if (currentQty <= Number(item.reorderLevel) * 0.5) {
          isCritical = true;
        }
      }

      if (isLow) {
        alerts.push({
          itemId: item.id,
          itemName: item.name,
          itemSku: item.sku || '',
          category: item.category || 'Uncategorized',
          unit: item.unit,
          currentQty,
          minQuantity: config?.minQuantity ? Number(config.minQuantity) : null,
          minDaysOfCover: config?.minDaysOfCover || null,
          estimatedDaysRemaining,
          alertLevel: isCritical ? 'CRITICAL' : 'LOW',
          reorderLevel: Number(item.reorderLevel),
          reorderQty: Number(item.reorderQty),
        });
      }
    }

    // Sort: CRITICAL first, then by lowest current qty
    alerts.sort((a, b) => {
      if (a.alertLevel === 'CRITICAL' && b.alertLevel !== 'CRITICAL') return -1;
      if (a.alertLevel !== 'CRITICAL' && b.alertLevel === 'CRITICAL') return 1;
      return a.currentQty - b.currentQty;
    });

    this.logger.log(
      `Found ${alerts.length} low-stock alerts (${alerts.filter((a) => a.alertLevel === 'CRITICAL').length} critical)`,
    );

    return alerts;
  }

  /**
   * Delete a low-stock configuration
   */
  async deleteConfig(_orgId: string, configId: string): Promise<void> {
    await this.prisma.client.lowStockConfig.delete({
      where: { id: configId },
    });
  }
}
