/**
 * M11.6 Supplier Pricing Service
 * 
 * Manages supplier price history with effective dates.
 * Features:
 * - Add new prices with effectiveFrom/To dates
 * - Auto-close previous price when adding new
 * - Receipt-derived price inference (idempotent)
 * - Latest price retrieval
 */
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { Prisma, SupplierPriceSource } from '@chefcloud/db';

type Decimal = Prisma.Decimal;

export interface AddPriceDto {
  currency?: string;
  unitPriceVendorUom: number | string;
  effectiveFrom?: Date;
  note?: string;
}

@Injectable()
export class SupplierPricingService {
  private readonly logger = new Logger(SupplierPricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Add a new price for a supplier item.
   * Closes previous active price by setting effectiveTo.
   * H5 mitigation: Only one price with effectiveTo=null per item.
   */
  async addPrice(
    orgId: string,
    branchId: string,
    supplierItemId: string,
    userId: string,
    dto: AddPriceDto,
  ) {
    // Verify supplier item exists and belongs to org
    const supplierItem = await this.prisma.client.supplierItem.findFirst({
      where: { id: supplierItemId, orgId },
    });
    if (!supplierItem) {
      throw new NotFoundException('Supplier item not found');
    }

    const effectiveFrom = dto.effectiveFrom ?? new Date();

    // Close previous active price (H5 mitigation)
    await this.prisma.client.supplierPrice.updateMany({
      where: {
        supplierItemId,
        effectiveTo: null,
      },
      data: {
        effectiveTo: new Date(effectiveFrom.getTime() - 1), // 1ms before new price
      },
    });

    const price = await this.prisma.client.supplierPrice.create({
      data: {
        orgId,
        supplierItemId,
        currency: dto.currency ?? 'USD',
        unitPriceVendorUom: dto.unitPriceVendorUom,
        effectiveFrom,
        effectiveTo: null,
        source: SupplierPriceSource.MANUAL,
        note: dto.note,
      },
    });

    await this.auditLog.log({
      orgId,
      branchId,
      userId,
      action: 'SUPPLIER_PRICE_ADDED',
      resourceType: 'SupplierPrice',
      resourceId: price.id,
      metadata: {
        supplierItemId,
        unitPrice: dto.unitPriceVendorUom.toString(),
        currency: dto.currency ?? 'USD',
      },
    });

    this.logger.log(`Added price ${price.id} for supplier item ${supplierItemId}`);
    return price;
  }

  /**
   * Add price derived from a goods receipt line.
   * Idempotent: uses sourceReceiptLineId to prevent duplicates.
   * H8 mitigation: unique constraint on (supplierItemId, sourceReceiptLineId)
   * Looks up SupplierItem by vendorId + inventoryItemId.
   */
  async addReceiptDerivedPrice(
    orgId: string,
    vendorId: string,
    inventoryItemId: string,
    unitCost: Decimal | number | string,
    receiptLineId: string,
    options?: { tx?: any },
  ) {
    const client = options?.tx ?? this.prisma.client;

    // Look up SupplierItem for this vendor + item
    const supplierItem = await client.supplierItem.findFirst({
      where: { orgId, vendorId, inventoryItemId, isActive: true },
    });

    if (!supplierItem) {
      this.logger.debug(`No SupplierItem found for vendor ${vendorId} + item ${inventoryItemId}`);
      return null; // No supplier item to update
    }

    const supplierItemId = supplierItem.id;

    // Check if already exists (idempotency)
    const existing = await client.supplierPrice.findFirst({
      where: { supplierItemId, sourceReceiptLineId: receiptLineId },
    });
    if (existing) {
      this.logger.debug(`Receipt-derived price already exists for line ${receiptLineId}`);
      return existing;
    }

    const now = new Date();

    // Close previous active price
    await client.supplierPrice.updateMany({
      where: {
        supplierItemId,
        effectiveTo: null,
      },
      data: {
        effectiveTo: new Date(now.getTime() - 1),
      },
    });

    const price = await client.supplierPrice.create({
      data: {
        orgId,
        supplierItemId,
        currency: 'USD',
        unitPriceVendorUom: unitCost,
        effectiveFrom: now,
        effectiveTo: null,
        source: SupplierPriceSource.RECEIPT_DERIVED,
        sourceReceiptLineId: receiptLineId,
        note: `Derived from receipt line ${receiptLineId}`,
      },
    });

    this.logger.log(`Added receipt-derived price ${price.id} from line ${receiptLineId}`);
    return price;
  }

  /**
   * Get price history for a supplier item
   */
  async getPriceHistory(orgId: string, supplierItemId: string, limit = 50) {
    const supplierItem = await this.prisma.client.supplierItem.findFirst({
      where: { id: supplierItemId, orgId },
    });
    if (!supplierItem) {
      throw new NotFoundException('Supplier item not found');
    }

    return this.prisma.client.supplierPrice.findMany({
      where: { supplierItemId },
      orderBy: { effectiveFrom: 'desc' },
      take: limit,
    });
  }

  /**
   * Get latest active price for a supplier item.
   * H5 mitigation: Uses effectiveTo IS NULL OR >= now, ordered by effectiveFrom DESC
   */
  async getLatestPrice(supplierItemId: string): Promise<{ unitPriceVendorUom: Decimal; currency: string } | null> {
    const now = new Date();
    
    const price = await this.prisma.client.supplierPrice.findFirst({
      where: {
        supplierItemId,
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: now } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
      select: {
        unitPriceVendorUom: true,
        currency: true,
      },
    });

    if (!price) return null;

    return {
      unitPriceVendorUom: new Prisma.Decimal(price.unitPriceVendorUom),
      currency: price.currency,
    };
  }

  /**
   * Get latest prices for multiple supplier items (batch)
   */
  async getLatestPricesForItems(supplierItemIds: string[]): Promise<Map<string, { unitPriceVendorUom: Decimal; currency: string }>> {
    if (supplierItemIds.length === 0) return new Map();

    const now = new Date();

    // Get all active prices
    const prices = await this.prisma.client.supplierPrice.findMany({
      where: {
        supplierItemId: { in: supplierItemIds },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: now } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
      select: {
        supplierItemId: true,
        unitPriceVendorUom: true,
        currency: true,
      },
    });

    // Group by supplierItemId, take first (most recent)
    const result = new Map<string, { unitPriceVendorUom: Decimal; currency: string }>();
    for (const price of prices) {
      if (!result.has(price.supplierItemId)) {
        result.set(price.supplierItemId, {
          unitPriceVendorUom: new Prisma.Decimal(price.unitPriceVendorUom),
          currency: price.currency,
        });
      }
    }

    return result;
  }
}
