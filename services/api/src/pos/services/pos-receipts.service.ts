/**
 * M13.4: POS Receipts Service
 *
 * Handles receipt issuance for paid orders with:
 * - Idempotent issuance (one receipt per order)
 * - Sequential receipt numbers per org
 * - Totals snapshot for immutability
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { createHash } from 'crypto';

@Injectable()
export class PosReceiptsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Issue a receipt for a fully paid order
   * Idempotent: returns existing receipt if already issued
   */
  async issueReceipt(
    orderId: string,
    orgId: string,
    branchId: string,
    userId: string,
  ): Promise<any> {
    // Check for existing receipt (idempotent)
    const existing = await this.prisma.client.posReceipt.findFirst({
      where: {
        orgId,
        orderId,
      },
    });

    if (existing) {
      return existing;
    }

    // Validate order exists and belongs to org/branch
    const order = await this.prisma.client.order.findFirst({
      where: {
        id: orderId,
        branch: {
          id: branchId,
          orgId,
        },
      },
      include: {
        orderItems: true,
      },
    });

    if (!order) {
      throw new BadRequestException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found or access denied',
      });
    }

    // Validate order is fully paid
    const payments = await this.prisma.client.payment.findMany({
      where: {
        orderId,
        orgId,
        branchId,
        posStatus: 'CAPTURED',
      },
    });

    const totalCaptured = payments.reduce((sum, p) => sum + p.capturedCents, 0);
    const orderTotalCents = Math.round(Number(order.total) * 100);

    if (totalCaptured < orderTotalCents) {
      throw new BadRequestException({
        code: 'ORDER_NOT_FULLY_PAID',
        message: `Order requires ${orderTotalCents} cents but only ${totalCaptured} cents captured`,
      });
    }

    // Generate receipt number (org-scoped sequential)
    const receiptNumber = await this.generateReceiptNumber(orgId);

    // Build totals snapshot
    const totalsSnapshot = {
      subtotal: Number(order.subtotal),
      tax: Number(order.tax),
      discount: Number(order.discount),
      total: Number(order.total),
      subtotalCents: Math.round(Number(order.subtotal) * 100),
      taxCents: Math.round(Number(order.tax) * 100),
      discountCents: Math.round(Number(order.discount) * 100),
      totalCents: orderTotalCents,
      paidCents: totalCaptured,
      paymentMethods: payments.map((p) => ({
        method: p.method,
        amountCents: p.capturedCents,
      })),
      itemCount: order.orderItems.length,
    };

    // Create receipt
    const receipt = await this.prisma.client.posReceipt.create({
      data: {
        orgId,
        branchId,
        orderId,
        receiptNumber,
        issuedById: userId,
        totalsSnapshot,
      },
    });

    return receipt;
  }

  /**
   * Get receipt by ID
   */
  async getReceipt(
    receiptId: string,
    orgId: string,
  ): Promise<any> {
    const receipt = await this.prisma.client.posReceipt.findFirst({
      where: {
        id: receiptId,
        orgId,
      },
    });

    if (!receipt) {
      throw new BadRequestException({
        code: 'RECEIPT_NOT_FOUND',
        message: 'Receipt not found or access denied',
      });
    }

    return receipt;
  }

  /**
   * Get receipt by order ID
   */
  async getReceiptByOrder(
    orderId: string,
    orgId: string,
  ): Promise<any | null> {
    return this.prisma.client.posReceipt.findFirst({
      where: {
        orderId,
        orgId,
      },
    });
  }

  /**
   * List receipts with filters
   */
  async listReceipts(
    orgId: string,
    branchId?: string,
    from?: string,
    to?: string,
    limit = 100,
  ): Promise<any[]> {
    const where: any = { orgId };

    if (branchId) {
      where.branchId = branchId;
    }

    if (from || to) {
      where.issuedAt = {};
      if (from) where.issuedAt.gte = new Date(from);
      if (to) where.issuedAt.lte = new Date(to);
    }

    return this.prisma.client.posReceipt.findMany({
      where,
      orderBy: { issuedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Export receipts to CSV with hash
   */
  async exportReceiptsCsv(
    orgId: string,
    branchId?: string,
    from?: string,
    to?: string,
  ): Promise<{ csv: string; hash: string }> {
    const receipts = await this.listReceipts(orgId, branchId, from, to, 10000);

    // Build CSV with BOM for Excel compatibility
    const BOM = '\uFEFF';
    const headers = [
      'receipt_id',
      'receipt_number',
      'order_id',
      'branch_id',
      'issued_at',
      'issued_by_id',
      'subtotal_cents',
      'tax_cents',
      'discount_cents',
      'total_cents',
      'paid_cents',
    ];

    const rows = receipts.map((r) => {
      const totals = r.totalsSnapshot as any;
      return [
        r.id,
        r.receiptNumber,
        r.orderId,
        r.branchId,
        r.issuedAt.toISOString(),
        r.issuedById,
        totals.subtotalCents || 0,
        totals.taxCents || 0,
        totals.discountCents || 0,
        totals.totalCents || 0,
        totals.paidCents || 0,
      ].join(',');
    });

    // Use \n consistently (not \r\n)
    const csv = BOM + [headers.join(','), ...rows].join('\n');

    // Calculate SHA-256 hash
    const hash = createHash('sha256').update(csv, 'utf8').digest('hex');

    return { csv, hash };
  }

  /**
   * Generate org-scoped sequential receipt number
   */
  private async generateReceiptNumber(orgId: string): Promise<string> {
    // Get latest receipt number for org
    const latest = await this.prisma.client.posReceipt.findFirst({
      where: { orgId },
      orderBy: { receiptNumber: 'desc' },
      select: { receiptNumber: true },
    });

    let nextNum = 1;
    if (latest && latest.receiptNumber) {
      // Parse number from format "RCP-000001"
      const match = latest.receiptNumber.match(/RCP-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }

    // Format with leading zeros
    return `RCP-${nextNum.toString().padStart(6, '0')}`;
  }
}
