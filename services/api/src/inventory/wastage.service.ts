/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateWastageDto } from './wastage.dto';
import { CacheInvalidationService } from '../common/cache-invalidation.service';
import { StockMovementsService, StockMovementType } from './stock-movements.service';
import { CostingService } from './costing.service';

@Injectable()
export class WastageService {
  private readonly logger = new Logger(WastageService.name);

  constructor(
    private prisma: PrismaService,
    private cacheInvalidation: CacheInvalidationService,
    private stockMovementsService: StockMovementsService,
    private costingService: CostingService,
  ) {}

  async recordWastage(
    orgId: string,
    branchId: string,
    userId: string,
    dto: CreateWastageDto,
  ): Promise<any> {
    // Get current shift if available
    const currentShift = await this.prisma.client.shift.findFirst({
      where: {
        branchId,
        closedAt: null,
      },
      select: { id: true },
    });

    // Calculate wastage cost using WAC
    const wac = await this.costingService.getWac(dto.itemId);
    const wastageCost = Number(dto.qty) * wac;

    // Create wastage record with M3 enhancements
    const result = await this.prisma.client.wastage.create({
      data: {
        orgId,
        branchId,
        itemId: dto.itemId,
        qty: dto.qty,
        reason: dto.reason,
        reportedBy: userId,
        shiftId: currentShift?.id, // M3: Link to shift
        userId, // M3: Link to user
      },
      include: {
        item: {
          select: { name: true, sku: true },
        },
      },
    });

    // M3: Create WASTAGE stock movement
    try {
      await this.stockMovementsService.createMovement({
        orgId,
        branchId,
        itemId: dto.itemId,
        type: StockMovementType.WASTAGE,
        qty: Number(dto.qty),
        cost: wastageCost,
        shiftId: currentShift?.id,
        reason: dto.reason,
        metadata: {
          wastageId: result.id,
          reportedBy: userId,
          itemName: result.item.name,
          itemSku: result.item.sku,
        },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to create wastage movement: ${errorMsg}`);
      // Continue - wastage is still recorded even if movement fails
    }

    // M3: Audit log for wastage
    try {
      await this.prisma.client.auditEvent.create({
        data: {
          branchId,
          userId,
          action: 'inventory.wastage.created',
          resource: 'wastage',
          resourceId: result.id,
          metadata: {
            itemId: dto.itemId,
            itemName: result.item.name,
            qty: Number(dto.qty),
            cost: wastageCost,
            reason: dto.reason,
            shiftId: currentShift?.id,
          },
        },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to create wastage audit log: ${errorMsg}`);
    }

    // E22.D.2: Invalidate franchise caches (non-blocking, best-effort)
    try {
      await this.cacheInvalidation.onInventoryAdjusted(orgId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Cache invalidation failed for wastage: ${message}`);
    }

    return result;
  }

  /**
   * M3: Get wastage summary for a period
   */
  async getWastageSummary(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalQty: number;
    totalCost: number;
    byReason: Record<string, { qty: number; cost: number }>;
    byUser: Record<string, { qty: number; cost: number; userName: string }>;
  }> {
    const wastageRecords = await this.prisma.client.wastage.findMany({
      where: {
        orgId,
        branchId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        item: {
          select: { name: true },
        },
        user: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    let totalQty = 0;
    let totalCost = 0;
    const byReason: Record<string, { qty: number; cost: number }> = {};
    const byUser: Record<string, { qty: number; cost: number; userName: string }> = {};

    for (const record of wastageRecords) {
      const qty = Number(record.qty);
      const wac = await this.costingService.getWac(record.itemId);
      const cost = qty * wac;

      totalQty += qty;
      totalCost += cost;

      // By reason
      const reason = record.reason || 'Unknown';
      if (!byReason[reason]) {
        byReason[reason] = { qty: 0, cost: 0 };
      }
      byReason[reason].qty += qty;
      byReason[reason].cost += cost;

      // By user
      if (record.userId) {
        if (!byUser[record.userId]) {
          byUser[record.userId] = {
            qty: 0,
            cost: 0,
            userName: record.user
              ? `${record.user.firstName} ${record.user.lastName}`
              : 'Unknown',
          };
        }
        byUser[record.userId].qty += qty;
        byUser[record.userId].cost += cost;
      }
    }

    return {
      totalQty,
      totalCost,
      byReason,
      byUser,
    };
  }
}

