import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export enum StockMovementType {
  SALE = 'SALE',
  WASTAGE = 'WASTAGE',
  ADJUSTMENT = 'ADJUSTMENT',
  PURCHASE = 'PURCHASE',
  COUNT_ADJUSTMENT = 'COUNT_ADJUSTMENT',
}

export interface CreateStockMovementDto {
  orgId: string;
  branchId: string;
  itemId: string;
  type: StockMovementType;
  qty: number;
  cost: number;
  shiftId?: string;
  orderId?: string;
  batchId?: string;
  reason?: string;
  metadata?: any;
}

export interface StockMovementFilters {
  orgId: string;
  branchId?: string;
  itemId?: string;
  shiftId?: string;
  orderId?: string;
  type?: StockMovementType;
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class StockMovementsService {
  private readonly logger = new Logger(StockMovementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a stock movement record
   * Used for tracking all inventory changes: sales, wastage, adjustments, purchases
   */
  async createMovement(dto: CreateStockMovementDto): Promise<any> {
    this.logger.log(
      `Creating ${dto.type} movement for item ${dto.itemId}: qty=${dto.qty}, cost=${dto.cost}`,
    );

    return this.prisma.client.stockMovement.create({
      data: {
        orgId: dto.orgId,
        branchId: dto.branchId,
        itemId: dto.itemId,
        type: dto.type,
        qty: dto.qty,
        cost: dto.cost,
        shiftId: dto.shiftId,
        orderId: dto.orderId,
        batchId: dto.batchId,
        reason: dto.reason,
        metadata: dto.metadata,
      },
      include: {
        item: { select: { name: true, sku: true } },
        batch: { select: { batchNumber: true } },
      },
    });
  }

  /**
   * Create multiple stock movements in a transaction
   * Useful for order close (multiple ingredients) or batch adjustments
   */
  async createMovements(movements: CreateStockMovementDto[]): Promise<any> {
    this.logger.log(`Creating ${movements.length} stock movements in transaction`);

    return this.prisma.client.$transaction(
      movements.map((dto) =>
        this.prisma.client.stockMovement.create({
          data: {
            orgId: dto.orgId,
            branchId: dto.branchId,
            itemId: dto.itemId,
            type: dto.type,
            qty: dto.qty,
            cost: dto.cost,
            shiftId: dto.shiftId,
            orderId: dto.orderId,
            batchId: dto.batchId,
            reason: dto.reason,
            metadata: dto.metadata,
          },
        }),
      ),
    );
  }

  /**
   * Get stock movements with filtering
   */
  async getMovements(filters: StockMovementFilters): Promise<any> {
    const where: any = {
      orgId: filters.orgId,
    };

    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.itemId) where.itemId = filters.itemId;
    if (filters.shiftId) where.shiftId = filters.shiftId;
    if (filters.orderId) where.orderId = filters.orderId;
    if (filters.type) where.type = filters.type;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    return this.prisma.client.stockMovement.findMany({
      where,
      include: {
        item: {
          select: { id: true, name: true, sku: true, unit: true },
        },
        shift: {
          select: { id: true, openedAt: true, closedAt: true },
        },
        order: {
          select: { id: true, orderNumber: true },
        },
        batch: {
          select: { id: true, batchNumber: true, receivedAt: true, unitCost: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get movements for a specific shift (for reconciliation)
   */
  async getMovementsByShift(orgId: string, shiftId: string): Promise<any> {
    return this.prisma.client.stockMovement.findMany({
      where: { orgId, shiftId },
      include: {
        item: {
          select: { id: true, name: true, sku: true, unit: true },
        },
        batch: {
          select: { id: true, batchNumber: true, unitCost: true },
        },
      },
      orderBy: [{ itemId: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Get movements for a specific item in a date range (for usage analysis)
   */
  async getItemMovements(
    orgId: string,
    itemId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    return this.prisma.client.stockMovement.findMany({
      where: {
        orgId,
        itemId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        shift: {
          select: { id: true, openedAt: true, closedAt: true },
        },
        order: {
          select: { id: true, orderNumber: true },
        },
        batch: {
          select: { id: true, batchNumber: true, unitCost: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Calculate theoretical usage from sales for an item
   * Used in reconciliation: opening + purchases = usage + wastage + closing
   */
  async calculateTheoreticalUsage(
    orgId: string,
    itemId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ qty: number; cost: number }> {
    const movements = await this.prisma.client.stockMovement.findMany({
      where: {
        orgId,
        itemId,
        type: StockMovementType.SALE,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { qty: true, cost: true },
    });

    const totalQty = movements.reduce(
      (sum: number, m: any) => sum + Number(m.qty),
      0,
    );
    const totalCost = movements.reduce(
      (sum: number, m: any) => sum + Number(m.cost),
      0,
    );

    return { qty: totalQty, cost: totalCost };
  }

  /**
   * Get aggregate movement summary by type for reconciliation
   */
  async getMovementSummary(
    orgId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const movements = await this.prisma.client.stockMovement.findMany({
      where: {
        orgId,
        branchId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        itemId: true,
        type: true,
        qty: true,
        cost: true,
        item: {
          select: { name: true, sku: true, unit: true },
        },
      },
    });

    // Group by itemId and type
    const summary = movements.reduce((acc: Record<string, any>, movement: any) => {
      const key = movement.itemId;
      if (!acc[key]) {
        acc[key] = {
          itemId: movement.itemId,
          itemName: movement.item.name,
          itemSku: movement.item.sku,
          unit: movement.item.unit,
          sales: { qty: 0, cost: 0 },
          wastage: { qty: 0, cost: 0 },
          adjustments: { qty: 0, cost: 0 },
          purchases: { qty: 0, cost: 0 },
          countAdjustments: { qty: 0, cost: 0 },
        };
      }

      const qty = Number(movement.qty);
      const cost = Number(movement.cost);

      if (movement.type === StockMovementType.SALE) {
        acc[key].sales.qty += qty;
        acc[key].sales.cost += cost;
      } else if (movement.type === StockMovementType.WASTAGE) {
        acc[key].wastage.qty += qty;
        acc[key].wastage.cost += cost;
      } else if (movement.type === StockMovementType.ADJUSTMENT) {
        acc[key].adjustments.qty += qty;
        acc[key].adjustments.cost += cost;
      } else if (movement.type === StockMovementType.PURCHASE) {
        acc[key].purchases.qty += qty;
        acc[key].purchases.cost += cost;
      } else if (movement.type === StockMovementType.COUNT_ADJUSTMENT) {
        acc[key].countAdjustments.qty += qty;
        acc[key].countAdjustments.cost += cost;
      }

      return acc;
    }, {} as Record<string, any>);

    return Object.values(summary);
  }
}
