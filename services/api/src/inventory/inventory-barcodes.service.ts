import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma, BarcodeFormat, LotStatus } from '@chefcloud/db';
import * as crypto from 'crypto';

// ============================================
// DTOs
// ============================================

export interface CreateItemBarcodeDto {
  value: string;
  format?: BarcodeFormat;
  isPrimary?: boolean;
}

export interface CreateLotBarcodeDto {
  value: string;
  format?: BarcodeFormat;
}

export interface BarcodeResolveResult {
  type: 'ITEM' | 'LOT';
  itemId: string;
  lotId?: string;
  sku?: string;
  name: string;
  unit: string;
  expiryDate?: Date;
  status?: LotStatus;
  remainingQty?: number;
  isActive: boolean;
  barcodeId: string;
}

// ============================================
// Service
// ============================================

@Injectable()
export class InventoryBarcodesService {
  private readonly logger = new Logger(InventoryBarcodesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // Barcode Value Normalization
  // ============================================

  private normalizeBarcode(value: string): string {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException('Barcode value is required');
    }

    const normalized = value.trim().replace(/\s+/g, '');

    if (normalized.length < 1 || normalized.length > 64) {
      throw new BadRequestException('Barcode value must be 1-64 characters');
    }

    return normalized;
  }

  // ============================================
  // Resolve Barcode (H1: Org Scoped)
  // ============================================

  async resolveBarcode(orgId: string, value: string): Promise<BarcodeResolveResult | null> {
    const normalized = this.normalizeBarcode(value);

    this.logger.debug(`Resolving barcode "${normalized}" for org ${orgId}`);

    // Try item barcode first
    const itemBarcode = await this.prisma.client.inventoryItemBarcode.findFirst({
      where: {
        orgId,
        value: normalized,
      },
      include: {
        item: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
            isActive: true,
          },
        },
      },
    });

    if (itemBarcode) {
      return {
        type: 'ITEM',
        itemId: itemBarcode.itemId,
        sku: itemBarcode.item.sku ?? undefined,
        name: itemBarcode.item.name,
        unit: itemBarcode.item.unit,
        isActive: itemBarcode.item.isActive,
        barcodeId: itemBarcode.id,
      };
    }

    // Try lot barcode
    const lotBarcode = await this.prisma.client.inventoryLotBarcode.findFirst({
      where: {
        orgId,
        value: normalized,
      },
      include: {
        lot: {
          select: {
            id: true,
            itemId: true,
            lotNumber: true,
            status: true,
            expiryDate: true,
            remainingQty: true,
            item: {
              select: {
                id: true,
                sku: true,
                name: true,
                unit: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (lotBarcode) {
      return {
        type: 'LOT',
        itemId: lotBarcode.lot.itemId,
        lotId: lotBarcode.lot.id,
        sku: lotBarcode.lot.item.sku ?? undefined,
        name: lotBarcode.lot.item.name,
        unit: lotBarcode.lot.item.unit,
        status: lotBarcode.lot.status,
        expiryDate: lotBarcode.lot.expiryDate ?? undefined,
        remainingQty: Number(lotBarcode.lot.remainingQty),
        isActive: lotBarcode.lot.item.isActive,
        barcodeId: lotBarcode.id,
      };
    }

    return null;
  }

  // ============================================
  // Item Barcode CRUD (H2: Unique per org)
  // ============================================

  async createItemBarcode(
    orgId: string,
    itemId: string,
    userId: string,
    dto: CreateItemBarcodeDto,
  ) {
    const normalized = this.normalizeBarcode(dto.value);

    // Verify item belongs to org
    const item = await this.prisma.client.inventoryItem.findFirst({
      where: { id: itemId, orgId },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    // Check uniqueness (H2)
    const existing = await this.prisma.client.inventoryItemBarcode.findFirst({
      where: { orgId, value: normalized },
    });

    if (existing) {
      throw new ConflictException(`Barcode "${normalized}" already exists in this organization`);
    }

    // Also check lot barcodes
    const existingLot = await this.prisma.client.inventoryLotBarcode.findFirst({
      where: { orgId, value: normalized },
    });

    if (existingLot) {
      throw new ConflictException(`Barcode "${normalized}" already exists as a lot barcode`);
    }

    // If setting as primary, unset existing primary
    if (dto.isPrimary) {
      await this.prisma.client.inventoryItemBarcode.updateMany({
        where: { itemId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const barcode = await this.prisma.client.inventoryItemBarcode.create({
      data: {
        orgId,
        itemId,
        value: normalized,
        format: dto.format ?? BarcodeFormat.OTHER,
        isPrimary: dto.isPrimary ?? false,
        createdById: userId,
      },
      include: {
        item: { select: { sku: true, name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    this.logger.log(`Created barcode "${normalized}" for item ${item.name}`);

    return barcode;
  }

  async listItemBarcodes(orgId: string, itemId: string) {
    // Verify item belongs to org
    const item = await this.prisma.client.inventoryItem.findFirst({
      where: { id: itemId, orgId },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    return this.prisma.client.inventoryItemBarcode.findMany({
      where: { itemId },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async deleteItemBarcode(orgId: string, itemId: string, barcodeId: string) {
    const barcode = await this.prisma.client.inventoryItemBarcode.findFirst({
      where: { id: barcodeId, itemId, item: { orgId } },
    });

    if (!barcode) {
      throw new NotFoundException('Barcode not found');
    }

    await this.prisma.client.inventoryItemBarcode.delete({
      where: { id: barcodeId },
    });

    this.logger.log(`Deleted barcode "${barcode.value}" from item ${itemId}`);

    return { deleted: true };
  }

  // ============================================
  // Lot Barcode CRUD
  // ============================================

  async createLotBarcode(
    orgId: string,
    lotId: string,
    userId: string,
    dto: CreateLotBarcodeDto,
  ) {
    const normalized = this.normalizeBarcode(dto.value);

    // Verify lot belongs to org
    const lot = await this.prisma.client.inventoryLot.findFirst({
      where: { id: lotId, orgId },
      include: { item: { select: { name: true } } },
    });

    if (!lot) {
      throw new NotFoundException('Lot not found');
    }

    // Check uniqueness
    const existing = await this.prisma.client.inventoryLotBarcode.findFirst({
      where: { orgId, value: normalized },
    });

    if (existing) {
      throw new ConflictException(`Barcode "${normalized}" already exists as a lot barcode`);
    }

    const existingItem = await this.prisma.client.inventoryItemBarcode.findFirst({
      where: { orgId, value: normalized },
    });

    if (existingItem) {
      throw new ConflictException(`Barcode "${normalized}" already exists as an item barcode`);
    }

    const barcode = await this.prisma.client.inventoryLotBarcode.create({
      data: {
        orgId,
        lotId,
        value: normalized,
        format: dto.format ?? BarcodeFormat.OTHER,
        createdById: userId,
      },
      include: {
        lot: {
          select: {
            lotNumber: true,
            item: { select: { name: true } },
          },
        },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    this.logger.log(`Created lot barcode "${normalized}" for lot ${lot.lotNumber}`);

    return barcode;
  }

  async listLotBarcodes(orgId: string, lotId: string) {
    const lot = await this.prisma.client.inventoryLot.findFirst({
      where: { id: lotId, orgId },
    });

    if (!lot) {
      throw new NotFoundException('Lot not found');
    }

    return this.prisma.client.inventoryLotBarcode.findMany({
      where: { lotId },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteLotBarcode(orgId: string, lotId: string, barcodeId: string) {
    const barcode = await this.prisma.client.inventoryLotBarcode.findFirst({
      where: { id: barcodeId, lotId, lot: { orgId } },
    });

    if (!barcode) {
      throw new NotFoundException('Barcode not found');
    }

    await this.prisma.client.inventoryLotBarcode.delete({
      where: { id: barcodeId },
    });

    this.logger.log(`Deleted lot barcode "${barcode.value}"`);

    return { deleted: true };
  }

  // ============================================
  // List All Barcodes (for export/search)
  // ============================================

  async listAllBarcodes(
    orgId: string,
    filters: { search?: string; type?: 'ITEM' | 'LOT'; limit?: number; page?: number } = {},
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const skip = (page - 1) * limit;

    const itemWhere: Prisma.InventoryItemBarcodeWhereInput = { orgId };
    const lotWhere: Prisma.InventoryLotBarcodeWhereInput = { orgId };

    if (filters.search) {
      itemWhere.OR = [
        { value: { contains: filters.search, mode: 'insensitive' } },
        { item: { name: { contains: filters.search, mode: 'insensitive' } } },
        { item: { sku: { contains: filters.search, mode: 'insensitive' } } },
      ];
      lotWhere.OR = [
        { value: { contains: filters.search, mode: 'insensitive' } },
        { lot: { lotNumber: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    if (filters.type === 'ITEM') {
      const [barcodes, total] = await Promise.all([
        this.prisma.client.inventoryItemBarcode.findMany({
          where: itemWhere,
          include: {
            item: { select: { sku: true, name: true, isActive: true } },
            createdBy: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.client.inventoryItemBarcode.count({ where: itemWhere }),
      ]);

      return {
        data: barcodes.map((b) => ({ ...b, type: 'ITEM' as const })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    }

    if (filters.type === 'LOT') {
      const [barcodes, total] = await Promise.all([
        this.prisma.client.inventoryLotBarcode.findMany({
          where: lotWhere,
          include: {
            lot: {
              select: {
                lotNumber: true,
                status: true,
                item: { select: { sku: true, name: true } },
              },
            },
            createdBy: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.client.inventoryLotBarcode.count({ where: lotWhere }),
      ]);

      return {
        data: barcodes.map((b) => ({ ...b, type: 'LOT' as const })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    }

    // Both types
    const [itemBarcodes, lotBarcodes, itemTotal, lotTotal] = await Promise.all([
      this.prisma.client.inventoryItemBarcode.findMany({
        where: itemWhere,
        include: {
          item: { select: { sku: true, name: true, isActive: true } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.inventoryLotBarcode.findMany({
        where: lotWhere,
        include: {
          lot: {
            select: {
              lotNumber: true,
              status: true,
              item: { select: { sku: true, name: true } },
            },
          },
          createdBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.inventoryItemBarcode.count({ where: itemWhere }),
      this.prisma.client.inventoryLotBarcode.count({ where: lotWhere }),
    ]);

    const combined = [
      ...itemBarcodes.map((b) => ({ ...b, type: 'ITEM' as const, createdAt: b.createdAt })),
      ...lotBarcodes.map((b) => ({ ...b, type: 'LOT' as const, createdAt: b.createdAt })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = itemTotal + lotTotal;
    const paginated = combined.slice(skip, skip + limit);

    return {
      data: paginated,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ============================================
  // Export CSV (H6: BOM + Hash)
  // ============================================

  async exportCsv(orgId: string): Promise<{ csv: string; hash: string; filename: string }> {
    const [itemBarcodes, lotBarcodes] = await Promise.all([
      this.prisma.client.inventoryItemBarcode.findMany({
        where: { orgId },
        include: {
          item: { select: { sku: true, name: true } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ item: { name: 'asc' } }, { value: 'asc' }],
      }),
      this.prisma.client.inventoryLotBarcode.findMany({
        where: { orgId },
        include: {
          lot: {
            select: {
              lotNumber: true,
              item: { select: { sku: true, name: true } },
            },
          },
          createdBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ lot: { lotNumber: 'asc' } }, { value: 'asc' }],
      }),
    ]);

    const headers = [
      'Barcode Value',
      'Format',
      'Type',
      'Item SKU',
      'Item Name',
      'Lot Number',
      'Is Primary',
      'Created At',
      'Created By',
    ];

    const rows: string[][] = [];

    for (const bc of itemBarcodes) {
      rows.push([
        bc.value,
        bc.format,
        'ITEM',
        bc.item.sku ?? '',
        bc.item.name,
        '',
        bc.isPrimary ? 'Yes' : 'No',
        bc.createdAt.toISOString(),
        bc.createdBy ? `${bc.createdBy.firstName} ${bc.createdBy.lastName}` : '',
      ]);
    }

    for (const bc of lotBarcodes) {
      rows.push([
        bc.value,
        bc.format,
        'LOT',
        bc.lot.item.sku ?? '',
        bc.lot.item.name,
        bc.lot.lotNumber,
        '',
        bc.createdAt.toISOString(),
        bc.createdBy ? `${bc.createdBy.firstName} ${bc.createdBy.lastName}` : '',
      ]);
    }

    // UTF-8 BOM + CSV content with LF
    const BOM = '\uFEFF';
    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map(escapeCsv).join(',')),
    ].join('\n');

    const fullCsv = BOM + csvContent;

    // Compute SHA256 hash
    const hash = crypto.createHash('sha256').update(fullCsv, 'utf8').digest('hex');

    const filename = `barcodes-${new Date().toISOString().slice(0, 10)}.csv`;

    return { csv: fullCsv, hash, filename };
  }
}

// ============================================
// Helper: CSV Escape
// ============================================

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
