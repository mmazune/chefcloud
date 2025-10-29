/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Optional, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateInventoryItemDto } from './inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    @Optional() @Inject('KpisService') private kpisService?: any,
  ) {}

  private markKpisDirty(orgId: string, branchId: string) {
    if (this.kpisService) {
      this.kpisService.markDirty(orgId, branchId);
    }
  }

  async createItem(orgId: string, dto: CreateInventoryItemDto): Promise<any> {
    return this.prisma.client.inventoryItem.create({
      data: {
        orgId,
        sku: dto.sku,
        name: dto.name,
        unit: dto.unit,
        category: dto.category,
        reorderLevel: dto.reorderLevel || 0,
        reorderQty: dto.reorderQty || 0,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async getItems(orgId: string): Promise<any> {
    return this.prisma.client.inventoryItem.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
    });
  }

  async getOnHandLevels(orgId: string, branchId?: string, itemIds?: string[]): Promise<any> {
    const where: any = { orgId };
    if (branchId) {
      where.branchId = branchId;
    }
    if (itemIds && itemIds.length > 0) {
      where.itemId = { in: itemIds };
    }

    // Get all stock batches
    const batches = await this.prisma.client.stockBatch.findMany({
      where,
      include: {
        item: { select: { id: true, name: true, unit: true, reorderLevel: true } },
      },
    });

    // Aggregate by item
    const levels = new Map<string, any>();
    batches.forEach((batch) => {
      const existing = levels.get(batch.itemId) || {
        itemId: batch.itemId,
        itemName: batch.item.name,
        unit: batch.item.unit,
        onHand: 0,
        reorderLevel: Number(batch.item.reorderLevel),
        batches: 0,
      };
      existing.onHand += Number(batch.remainingQty);
      existing.batches += 1;
      levels.set(batch.itemId, existing);
    });

    // If itemIds specified, return as object keyed by itemId for easy lookup
    if (itemIds && itemIds.length > 0) {
      const result: any = {};
      itemIds.forEach((id) => {
        const level = levels.get(id);
        result[id] = level ? level.onHand : 0;
      });
      return result;
    }

    return Array.from(levels.values()).sort((a, b) => a.itemName.localeCompare(b.itemName));
  }

  // FIFO consumption
  async consumeIngredient(
    branchId: string,
    itemId: string,
    qtyNeeded: number,
  ): Promise<{ success: boolean; consumed: number }> {
    // Get batches with remaining qty > 0, ordered by receivedAt (FIFO)
    const batches = await this.prisma.client.stockBatch.findMany({
      where: {
        branchId,
        itemId,
        remainingQty: { gt: 0 },
      },
      orderBy: { receivedAt: 'asc' },
    });

    let remaining = qtyNeeded;
    const updates: any[] = [];

    for (const batch of batches) {
      if (remaining <= 0) break;

      const available = Number(batch.remainingQty);
      const toConsume = Math.min(available, remaining);

      updates.push(
        this.prisma.client.stockBatch.update({
          where: { id: batch.id },
          data: { remainingQty: available - toConsume },
        }),
      );

      remaining -= toConsume;
    }

    if (updates.length > 0) {
      await this.prisma.client.$transaction(updates);
    }

    const consumed = qtyNeeded - remaining;
    return {
      success: remaining === 0,
      consumed,
    };
  }

  // Manual inventory adjustment (for mobile stock counts)
  async createAdjustment(
    orgId: string,
    branchId: string,
    itemId: string,
    deltaQty: number,
    reason: string,
    adjustedBy: string,
  ): Promise<any> {
    const result = await this.prisma.client.$transaction(async (tx) => {
      // Record the adjustment
      const adjustment = await tx.adjustment.create({
        data: {
          orgId,
          branchId,
          itemId,
          deltaQty,
          reason,
          adjustedBy,
        },
      });

      // Update stock batches
      // For positive delta (adding stock), find the newest batch or create a virtual one
      // For negative delta (removing stock), use FIFO
      if (deltaQty > 0) {
        // Add stock: find newest batch and increase remainingQty
        const newestBatch = await tx.stockBatch.findFirst({
          where: { branchId, itemId },
          orderBy: { receivedAt: 'desc' },
        });

        if (newestBatch) {
          await tx.stockBatch.update({
            where: { id: newestBatch.id },
            data: {
              remainingQty: Number(newestBatch.remainingQty) + deltaQty,
            },
          });
        } else {
          // No batch exists, create one (adjustment-based)
          await tx.stockBatch.create({
            data: {
              orgId,
              branchId,
              itemId,
              receivedQty: deltaQty,
              remainingQty: deltaQty,
              receivedAt: new Date(),
              unitCost: 0, // Unknown cost for adjustments
            },
          });
        }
      } else if (deltaQty < 0) {
        // Remove stock: use FIFO consumption logic
        const batches = await tx.stockBatch.findMany({
          where: {
            branchId,
            itemId,
            remainingQty: { gt: 0 },
          },
          orderBy: { receivedAt: 'asc' },
        });

        let remaining = Math.abs(deltaQty);
        for (const batch of batches) {
          if (remaining <= 0) break;

          const available = Number(batch.remainingQty);
          const toRemove = Math.min(available, remaining);

          await tx.stockBatch.update({
            where: { id: batch.id },
            data: { remainingQty: available - toRemove },
          });

          remaining -= toRemove;
        }

        // If we couldn't remove all (insufficient stock), we still record the adjustment
        // This allows negative on-hand which can be flagged in reporting
      }

      return adjustment;
    });

    // Invalidate KPI cache after adjustment
    this.markKpisDirty(orgId, branchId);

    return result;
  }
}
