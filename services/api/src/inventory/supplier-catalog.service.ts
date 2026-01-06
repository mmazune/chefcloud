/**
 * M11.6 Supplier Catalog Service
 * 
 * Manages supplier items mapping vendor products to inventory items.
 * Features:
 * - CRUD for SupplierItem with vendor-specific SKUs
 * - UOM conversion factors for pack sizes
 * - Preferred vendor/item designation
 * - Strict org scoping
 */
import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { Prisma } from '@chefcloud/db';

type Decimal = Prisma.Decimal;

export interface CreateSupplierItemDto {
  vendorId: string;
  inventoryItemId: string;
  vendorSku: string;
  vendorUomId?: string;
  uomConversionFactorToBase?: number | string;
  packSizeLabel?: string;
  leadTimeDays?: number;
  minOrderQtyVendorUom?: number | string;
  isPreferred?: boolean;
}

export interface UpdateSupplierItemDto {
  vendorSku?: string;
  vendorUomId?: string;
  uomConversionFactorToBase?: number | string;
  packSizeLabel?: string;
  leadTimeDays?: number;
  minOrderQtyVendorUom?: number | string;
  isPreferred?: boolean;
  isActive?: boolean;
}

export interface SupplierItemFilter {
  vendorId?: string;
  inventoryItemId?: string;
  isActive?: boolean;
  isPreferred?: boolean;
}

@Injectable()
export class SupplierCatalogService {
  private readonly logger = new Logger(SupplierCatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Create a new supplier item
   */
  async create(
    orgId: string,
    branchId: string,
    userId: string,
    dto: CreateSupplierItemDto,
  ) {
    // Verify vendor exists and belongs to org
    const vendor = await this.prisma.client.vendor.findFirst({
      where: { id: dto.vendorId, orgId },
    });
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    // Verify inventory item exists and belongs to org
    const item = await this.prisma.client.inventoryItem.findFirst({
      where: { id: dto.inventoryItemId, orgId },
    });
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    // Verify vendor UOM if provided
    if (dto.vendorUomId) {
      const uom = await this.prisma.client.unitOfMeasure.findFirst({
        where: { id: dto.vendorUomId, orgId },
      });
      if (!uom) {
        throw new NotFoundException('Vendor UOM not found');
      }
    }

    // Check for duplicate (vendor + item) - H1 mitigation
    const existingByItem = await this.prisma.client.supplierItem.findFirst({
      where: { orgId, vendorId: dto.vendorId, inventoryItemId: dto.inventoryItemId },
    });
    if (existingByItem) {
      throw new ConflictException('Supplier item already exists for this vendor and inventory item');
    }

    // Check for duplicate vendorSku per vendor - H1 mitigation
    const existingBySku = await this.prisma.client.supplierItem.findFirst({
      where: { orgId, vendorId: dto.vendorId, vendorSku: dto.vendorSku },
    });
    if (existingBySku) {
      throw new ConflictException('Vendor SKU already exists for this vendor');
    }

    const supplierItem = await this.prisma.client.supplierItem.create({
      data: {
        orgId,
        vendorId: dto.vendorId,
        inventoryItemId: dto.inventoryItemId,
        vendorSku: dto.vendorSku,
        vendorUomId: dto.vendorUomId,
        uomConversionFactorToBase: dto.uomConversionFactorToBase ?? 1,
        packSizeLabel: dto.packSizeLabel,
        leadTimeDays: dto.leadTimeDays ?? 0,
        minOrderQtyVendorUom: dto.minOrderQtyVendorUom ?? 0,
        isPreferred: dto.isPreferred ?? false,
      },
      include: {
        vendor: { select: { id: true, name: true } },
        inventoryItem: { select: { id: true, name: true, sku: true } },
        vendorUom: { select: { id: true, code: true, name: true } },
      },
    });

    await this.auditLog.log({
      orgId,
      branchId,
      userId,
      action: 'SUPPLIER_ITEM_CREATED',
      resourceType: 'SupplierItem',
      resourceId: supplierItem.id,
      metadata: { vendorId: dto.vendorId, inventoryItemId: dto.inventoryItemId, vendorSku: dto.vendorSku },
    });

    this.logger.log(`Created supplier item ${supplierItem.id} for vendor ${vendor.name}`);
    return supplierItem;
  }

  /**
   * Get supplier item by ID
   */
  async findById(orgId: string, id: string) {
    const item = await this.prisma.client.supplierItem.findFirst({
      where: { id, orgId },
      include: {
        vendor: { select: { id: true, name: true } },
        inventoryItem: { select: { id: true, name: true, sku: true } },
        vendorUom: { select: { id: true, code: true, name: true } },
        prices: {
          orderBy: { effectiveFrom: 'desc' },
          take: 5,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Supplier item not found');
    }

    return item;
  }

  /**
   * List supplier items with filters
   */
  async findMany(orgId: string, filter?: SupplierItemFilter) {
    const where: Prisma.SupplierItemWhereInput = { orgId };

    if (filter?.vendorId) {
      where.vendorId = filter.vendorId;
    }
    if (filter?.inventoryItemId) {
      where.inventoryItemId = filter.inventoryItemId;
    }
    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }
    if (filter?.isPreferred !== undefined) {
      where.isPreferred = filter.isPreferred;
    }

    return this.prisma.client.supplierItem.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true } },
        inventoryItem: { select: { id: true, name: true, sku: true } },
        vendorUom: { select: { id: true, code: true, name: true } },
      },
      orderBy: [
        { vendor: { name: 'asc' } },
        { inventoryItem: { name: 'asc' } },
      ],
    });
  }

  /**
   * Update supplier item
   */
  async update(
    orgId: string,
    branchId: string,
    id: string,
    userId: string,
    dto: UpdateSupplierItemDto,
  ) {
    const existing = await this.prisma.client.supplierItem.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException('Supplier item not found');
    }

    // Check vendorSku uniqueness if changing
    if (dto.vendorSku && dto.vendorSku !== existing.vendorSku) {
      const duplicate = await this.prisma.client.supplierItem.findFirst({
        where: {
          orgId,
          vendorId: existing.vendorId,
          vendorSku: dto.vendorSku,
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new ConflictException('Vendor SKU already exists for this vendor');
      }
    }

    // Verify vendor UOM if changing
    if (dto.vendorUomId) {
      const uom = await this.prisma.client.unitOfMeasure.findFirst({
        where: { id: dto.vendorUomId, orgId },
      });
      if (!uom) {
        throw new NotFoundException('Vendor UOM not found');
      }
    }

    const updated = await this.prisma.client.supplierItem.update({
      where: { id },
      data: {
        vendorSku: dto.vendorSku,
        vendorUomId: dto.vendorUomId,
        uomConversionFactorToBase: dto.uomConversionFactorToBase,
        packSizeLabel: dto.packSizeLabel,
        leadTimeDays: dto.leadTimeDays,
        minOrderQtyVendorUom: dto.minOrderQtyVendorUom,
        isPreferred: dto.isPreferred,
        isActive: dto.isActive,
      },
      include: {
        vendor: { select: { id: true, name: true } },
        inventoryItem: { select: { id: true, name: true, sku: true } },
        vendorUom: { select: { id: true, code: true, name: true } },
      },
    });

    const action = dto.isActive === false ? 'SUPPLIER_ITEM_DEACTIVATED' : 'SUPPLIER_ITEM_UPDATED';
    await this.auditLog.log({
      orgId,
      branchId,
      userId,
      action,
      resourceType: 'SupplierItem',
      resourceId: id,
      metadata: { ...dto } as Record<string, unknown>,
    });

    this.logger.log(`Updated supplier item ${id}`);
    return updated;
  }

  /**
   * Find preferred supplier item for an inventory item
   * Priority: isPreferred=true, then any active
   */
  async findPreferredForItem(orgId: string, inventoryItemId: string, preferredVendorId?: string) {
    // First try preferred vendor if specified
    if (preferredVendorId) {
      const byVendor = await this.prisma.client.supplierItem.findFirst({
        where: { orgId, inventoryItemId, vendorId: preferredVendorId, isActive: true },
        include: {
          vendor: { select: { id: true, name: true } },
          vendorUom: { select: { id: true, code: true } },
        },
      });
      if (byVendor) return byVendor;
    }

    // Then try isPreferred
    const preferred = await this.prisma.client.supplierItem.findFirst({
      where: { orgId, inventoryItemId, isPreferred: true, isActive: true },
      include: {
        vendor: { select: { id: true, name: true } },
        vendorUom: { select: { id: true, code: true } },
      },
    });
    if (preferred) return preferred;

    // Fallback to any active
    return this.prisma.client.supplierItem.findFirst({
      where: { orgId, inventoryItemId, isActive: true },
      include: {
        vendor: { select: { id: true, name: true } },
        vendorUom: { select: { id: true, code: true } },
      },
      orderBy: { vendorId: 'asc' }, // Deterministic
    });
  }

  /**
   * Convert base quantity to vendor quantity using factor
   * Formula: vendorQty = ceil(baseQty / factor)
   * H2 mitigation: explicit rounding up
   */
  convertBaseToVendorQty(baseQty: Decimal | number, factor: Decimal | number): Decimal {
    const baseDecimal = new Prisma.Decimal(baseQty);
    const factorDecimal = new Prisma.Decimal(factor);
    
    if (factorDecimal.isZero()) {
      throw new BadRequestException('Conversion factor cannot be zero');
    }

    // vendorQty = baseQty / factor, rounded up
    const result = baseDecimal.dividedBy(factorDecimal);
    return result.ceil();
  }

  /**
   * Convert vendor quantity to base quantity
   * Formula: baseQty = vendorQty × factor
   */
  convertVendorToBaseQty(vendorQty: Decimal | number, factor: Decimal | number): Decimal {
    const vendorDecimal = new Prisma.Decimal(vendorQty);
    const factorDecimal = new Prisma.Decimal(factor);
    return vendorDecimal.times(factorDecimal);
  }
}
