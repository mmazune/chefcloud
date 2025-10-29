/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { InventoryService } from './inventory.service';

interface StockCountLine {
  itemId: string;
  countedQty: number;
}

interface ToleranceConfig {
  pct?: number;
  absolute?: number;
}

interface VarianceItem {
  itemId: string;
  itemName: string;
  expected: number;
  counted: number;
  variance: number;
  variancePct: number;
}

@Injectable()
export class CountsService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
  ) {}

  /**
   * Begin a new stock count for the current shift.
   * Creates a draft StockCount with empty lines.
   */
  async beginCount(
    orgId: string,
    branchId: string,
    userId: string,
    notes?: string,
  ): Promise<any> {
    // Find current open shift
    const shift = await this.prisma.client.shift.findFirst({
      where: { branchId, closedAt: null },
    });

    if (!shift) {
      throw new NotFoundException('No open shift found for this branch');
    }

    // Check if there's already a draft count for this shift
    const existing = await this.prisma.client.stockCount.findFirst({
      where: { shiftId: shift.id },
    });

    if (existing) {
      return existing; // Return existing draft
    }

    return this.prisma.client.stockCount.create({
      data: {
        orgId,
        branchId,
        shiftId: shift.id,
        countedById: userId,
        notes,
        lines: [],
      },
    });
  }

  /**
   * Submit/finalize a stock count with actual counted quantities.
   */
  async submitCount(
    countId: string,
    lines: StockCountLine[],
    notes?: string,
  ): Promise<any> {
    const count = await this.prisma.client.stockCount.findUnique({
      where: { id: countId },
    });

    if (!count) {
      throw new NotFoundException('Stock count not found');
    }

    return this.prisma.client.stockCount.update({
      where: { id: countId },
      data: {
        lines: lines as any,
        notes: notes || count.notes,
        countedAt: new Date(),
      },
    });
  }

  /**
   * Get the current or last stock count for the active shift.
   */
  async getCurrentCount(branchId: string): Promise<any> {
    const shift = await this.prisma.client.shift.findFirst({
      where: { branchId, closedAt: null },
    });

    if (!shift) {
      throw new NotFoundException('No open shift found');
    }

    return this.prisma.client.stockCount.findFirst({
      where: { shiftId: shift.id },
      include: {
        countedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Validate that stock count exists for the shift and is within tolerance.
   * Throws ConflictException if validation fails.
   * Returns reconciliation summary on success.
   */
  async validateShiftStockCount(shiftId: string): Promise<any> {
    const shift = await this.prisma.client.shift.findUnique({
      where: { id: shiftId },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    // 1. Check if count exists
    const count = await this.prisma.client.stockCount.findFirst({
      where: { shiftId },
    });

    if (!count) {
      throw new ConflictException({
        code: 'COUNT_REQUIRED',
        message: 'Stock count required before closing shift',
      });
    }

    // 2. Get lines
    const lines = (count.lines as any) || [];
    if (lines.length === 0) {
      throw new ConflictException({
        code: 'COUNT_REQUIRED',
        message: 'Stock count has no items',
      });
    }

    // 3. Get expected on-hand levels for counted items
    const itemIds = lines.map((l: any) => l.itemId);
    const onHand = await this.inventoryService.getOnHandLevels(
      shift.orgId,
      shift.branchId,
      itemIds,
    );

    // 4. Get tolerance config
    const settings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId: shift.orgId },
    });

    const tolerance: ToleranceConfig = (settings?.inventoryTolerance as any) || {
      pct: 0.05,
      absolute: 0,
    };

    // 5. Compare expected vs counted
    const variances: VarianceItem[] = [];
    const outOfTolerance: VarianceItem[] = [];

    for (const line of lines) {
      const { itemId, countedQty } = line;
      const expectedQty = onHand[itemId] || 0;
      const variance = countedQty - expectedQty;
      const variancePct = expectedQty > 0 ? variance / expectedQty : 0;

      const item = await this.prisma.client.inventoryItem.findUnique({
        where: { id: itemId },
        select: { name: true },
      });

      const varianceItem: VarianceItem = {
        itemId,
        itemName: item?.name || 'Unknown',
        expected: expectedQty,
        counted: countedQty,
        variance,
        variancePct,
      };

      variances.push(varianceItem);

      // Check tolerance
      const absTolerance = tolerance.absolute || 0;
      const pctTolerance = tolerance.pct || 0.05;

      const outsideTolerance =
        Math.abs(variance) > absTolerance &&
        Math.abs(variancePct) > pctTolerance;

      if (outsideTolerance) {
        outOfTolerance.push(varianceItem);
      }
    }

    // 6. If out of tolerance, reject
    if (outOfTolerance.length > 0) {
      throw new ConflictException({
        code: 'COUNT_OUT_OF_TOLERANCE',
        message: 'Stock count variances exceed tolerance',
        items: outOfTolerance,
      });
    }

    // 7. Return reconciliation summary
    return {
      countId: count.id,
      shiftId,
      variances,
      tolerance,
      status: 'OK',
    };
  }

  /**
   * Emit anomaly events for out-of-tolerance items.
   */
  async emitVarianceAnomalies(
    orgId: string,
    branchId: string,
    variances: VarianceItem[],
  ): Promise<void> {
    for (const v of variances) {
      let type = 'LARGE_VARIANCE';
      let severity = 'WARN';

      if (v.variance < 0) {
        type = 'NEGATIVE_STOCK';
        severity = 'CRITICAL';
      }

      await this.prisma.client.anomalyEvent.create({
        data: {
          orgId,
          branchId,
          type,
          severity,
          details: {
            itemId: v.itemId,
            itemName: v.itemName,
            expected: v.expected,
            counted: v.counted,
            variance: v.variance,
            variancePct: v.variancePct,
          },
        },
      });
    }
  }
}
