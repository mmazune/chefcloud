/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePODto, ReceivePODto } from './purchasing.dto';
import { CacheInvalidationService } from '../common/cache-invalidation.service';

@Injectable()
export class PurchasingService {
  private readonly logger = new Logger(PurchasingService.name);

  constructor(
    private prisma: PrismaService,
    private cacheInvalidation: CacheInvalidationService,
  ) {}

  async createPO(orgId: string, branchId: string, dto: CreatePODto): Promise<any> {
    // Generate PO number
    const poCount = await this.prisma.client.purchaseOrder.count({ where: { orgId } });
    const poNumber = `PO-${Date.now()}-${poCount + 1}`;

    // Calculate total
    const totalAmount = dto.items.reduce((sum, item) => sum + item.qty * item.unitCost, 0);

    return this.prisma.client.purchaseOrder.create({
      data: {
        orgId,
        branchId,
        supplierId: dto.supplierId,
        poNumber,
        status: 'draft',
        totalAmount,
        items: {
          create: dto.items.map((item) => ({
            itemId: item.itemId,
            qty: item.qty,
            unitCost: item.unitCost,
            subtotal: item.qty * item.unitCost,
          })),
        },
      },
      include: {
        items: { include: { item: true } },
        supplier: true,
      },
    });
  }

  async placePO(poId: string): Promise<any> {
    const po = await this.prisma.client.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new BadRequestException('PO not found');
    if (po.status !== 'draft') throw new BadRequestException('PO already placed');

    return this.prisma.client.purchaseOrder.update({
      where: { id: poId },
      data: { status: 'placed', placedAt: new Date() },
    });
  }

  async receivePO(poId: string, dto: ReceivePODto, orgId: string, branchId: string): Promise<any> {
    const po = await this.prisma.client.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });

    if (!po) throw new BadRequestException('PO not found');
    if (po.status !== 'placed') throw new BadRequestException('PO not placed yet');

    // Generate GR number
    const grCount = await this.prisma.client.goodsReceipt.count({ where: { orgId } });
    const grNumber = `GR-${Date.now()}-${grCount + 1}`;

    // Create goods receipt
    const gr = await this.prisma.client.goodsReceipt.create({
      data: {
        orgId,
        branchId,
        poId,
        grNumber,
        receivedBy: dto.receivedBy,
        lines: {
          create: po.items.map((item) => ({
            itemId: item.itemId,
            qtyReceived: item.qty,
            unitCost: item.unitCost,
          })),
        },
      },
      include: {
        lines: { include: { item: true } },
      },
    });

    // Create stock batches
    const batchPromises = po.items.map((item) =>
      this.prisma.client.stockBatch.create({
        data: {
          orgId,
          branchId,
          itemId: item.itemId,
          receivedQty: item.qty,
          remainingQty: item.qty,
          unitCost: item.unitCost,
          goodsReceiptId: gr.id,
        },
      }),
    );

    await Promise.all(batchPromises);

    // Mark PO as received
    await this.prisma.client.purchaseOrder.update({
      where: { id: poId },
      data: { status: 'received' },
    });

    // E22.D.2: Invalidate franchise caches (non-blocking, best-effort)
    try {
      await this.cacheInvalidation.onPoReceived(orgId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Cache invalidation failed for PO received: ${message}`);
    }

    return gr;
  }
}
