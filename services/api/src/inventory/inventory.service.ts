/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateInventoryItemDto } from './inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

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

  async getOnHandLevels(orgId: string, branchId?: string): Promise<any> {
    const where: any = { orgId };
    if (branchId) {
      where.branchId = branchId;
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
}
