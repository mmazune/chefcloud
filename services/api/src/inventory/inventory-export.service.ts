import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';

const Decimal = Prisma.Decimal;
import { createHash } from 'crypto';
import { InventoryLedgerService } from './inventory-ledger.service';

export enum ExportFormat {
  CSV = 'CSV',
  JSON = 'JSON',
}

export interface ExportOptions {
  format?: ExportFormat;
  includeZeroStock?: boolean;
  locationId?: string;
  categoryId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ExportResult {
  data: string;
  format: ExportFormat;
  contentType: string;
  filename: string;
  hash: string;
  recordCount: number;
  generatedAt: Date;
}

@Injectable()
export class InventoryExportService {
  private readonly logger = new Logger(InventoryExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: InventoryLedgerService,
  ) { }

  /**
   * Export current inventory levels
   */
  async exportInventoryLevels(
    orgId: string,
    branchId: string,
    options?: ExportOptions,
  ): Promise<ExportResult> {
    const format = options?.format ?? ExportFormat.CSV;

    this.logger.log(`Exporting inventory levels: org=${orgId}, branch=${branchId}, format=${format}`);

    // Get all items for the org
    const items = await this.prisma.client.inventoryItem.findMany({
      where: { orgId },
      include: {
        uom: { select: { code: true, name: true, symbol: true } },
      },
      orderBy: [{ sku: 'asc' }],
    });

    // Get on-hand quantities by location
    const onHandByLocation = await this.ledgerService.getOnHandByBranch(branchId, options?.locationId);

    // Build inventory snapshot
    const snapshot: any[] = [];
    for (const item of items) {
      const itemOnHand = onHandByLocation.filter((oh) => oh.itemId === item.id);

      if (itemOnHand.length === 0 && !options?.includeZeroStock) {
        continue;
      }

      if (itemOnHand.length === 0) {
        // Include item with zero stock
        snapshot.push({
          sku: item.sku,
          name: item.name,
          uom: item.uom?.code ?? item.unit ?? 'EACH',
          locationCode: options?.locationId ?? 'ALL',
          onHand: new Decimal(0),
          reorderPoint: item.reorderLevel,
          active: item.isActive,
        });
      } else {
        for (const loc of itemOnHand) {
          snapshot.push({
            sku: item.sku,
            name: item.name,
            uom: item.uom?.code ?? item.unit ?? 'EACH',
            locationCode: loc.locationCode,
            locationName: loc.locationName,
            onHand: loc.onHand,
            reorderPoint: item.reorderLevel,
            active: item.isActive,
          });
        }
      }
    }

    // Generate export
    const now = new Date();
    let data: string;
    let contentType: string;
    let filename: string;

    if (format === ExportFormat.JSON) {
      data = JSON.stringify({
        exportedAt: now.toISOString(),
        orgId,
        branchId,
        recordCount: snapshot.length,
        items: snapshot.map((s) => ({
          ...s,
          onHand: s.onHand.toString(),
          reorderPoint: s.reorderPoint?.toString(),
        })),
      }, null, 2);
      contentType = 'application/json';
      filename = `inventory-levels-${branchId}-${now.toISOString().slice(0, 10)}.json`;
    } else {
      // CSV format
      const headers = ['SKU', 'Name', 'UOM', 'Location Code', 'Location Name', 'On Hand', 'Reorder Point', 'Active'];
      const rows = snapshot.map((s) => [
        this.escapeCsv(s.sku),
        this.escapeCsv(s.name),
        s.uom,
        s.locationCode,
        s.locationName ?? '',
        s.onHand.toString(),
        s.reorderPoint?.toString() ?? '',
        s.active ? 'Yes' : 'No',
      ].join(','));

      data = [headers.join(','), ...rows].join('\n');
      contentType = 'text/csv';
      filename = `inventory-levels-${branchId}-${now.toISOString().slice(0, 10)}.csv`;
    }

    // Calculate hash for integrity verification
    const hash = createHash('sha256').update(data).digest('hex');

    this.logger.log(`Export complete: ${snapshot.length} records, hash=${hash.slice(0, 16)}...`);

    return {
      data,
      format,
      contentType,
      filename,
      hash,
      recordCount: snapshot.length,
      generatedAt: now,
    };
  }

  /**
   * Export ledger entries (audit trail)
   */
  async exportLedgerEntries(
    orgId: string,
    branchId: string,
    options?: ExportOptions & { itemId?: string },
  ): Promise<ExportResult> {
    const format = options?.format ?? ExportFormat.CSV;

    this.logger.log(`Exporting ledger entries: org=${orgId}, branch=${branchId}, format=${format}`);

    const where: any = { orgId, branchId };
    if (options?.itemId) where.itemId = options.itemId;
    if (options?.locationId) where.locationId = options.locationId;
    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options?.startDate) where.createdAt.gte = options.startDate;
      if (options?.endDate) where.createdAt.lte = options.endDate;
    }

    const entries = await this.prisma.client.inventoryLedgerEntry.findMany({
      where,
      include: {
        item: { select: { sku: true, name: true } },
        location: { select: { code: true, name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000, // Limit for safety
    });

    const now = new Date();
    let data: string;
    let contentType: string;
    let filename: string;

    if (format === ExportFormat.JSON) {
      data = JSON.stringify({
        exportedAt: now.toISOString(),
        orgId,
        branchId,
        recordCount: entries.length,
        entries: entries.map((e) => ({
          id: e.id,
          timestamp: e.createdAt.toISOString(),
          itemSku: e.item.sku,
          itemName: e.item.name,
          locationCode: e.location.code,
          qty: e.qty.toString(),
          reason: e.reason,
          sourceType: e.sourceType,
          sourceId: e.sourceId,
          notes: e.notes,
          createdBy: `${e.createdBy?.firstName ?? ''} ${e.createdBy?.lastName ?? ''}`.trim(),
        })),
      }, null, 2);
      contentType = 'application/json';
      filename = `ledger-entries-${branchId}-${now.toISOString().slice(0, 10)}.json`;
    } else {
      const headers = [
        'Entry ID', 'Timestamp', 'Item SKU', 'Item Name', 'Location Code',
        'Qty', 'Reason', 'Source Type', 'Source ID', 'Notes', 'Created By',
      ];
      const rows = entries.map((e) => [
        e.id,
        e.createdAt.toISOString(),
        this.escapeCsv(e.item.sku),
        this.escapeCsv(e.item.name),
        e.location.code,
        e.qty.toString(),
        e.reason,
        e.sourceType ?? '',
        e.sourceId ?? '',
        this.escapeCsv(e.notes ?? ''),
        `${e.createdBy?.firstName ?? ''} ${e.createdBy?.lastName ?? ''}`.trim(),
      ].join(','));

      data = [headers.join(','), ...rows].join('\n');
      contentType = 'text/csv';
      filename = `ledger-entries-${branchId}-${now.toISOString().slice(0, 10)}.csv`;
    }

    const hash = createHash('sha256').update(data).digest('hex');

    this.logger.log(`Ledger export complete: ${entries.length} records, hash=${hash.slice(0, 16)}...`);

    return {
      data,
      format,
      contentType,
      filename,
      hash,
      recordCount: entries.length,
      generatedAt: now,
    };
  }

  /**
   * Export adjustments
   */
  async exportAdjustments(
    orgId: string,
    branchId: string,
    options?: ExportOptions & { status?: string },
  ): Promise<ExportResult> {
    const format = options?.format ?? ExportFormat.CSV;

    this.logger.log(`Exporting adjustments: org=${orgId}, branch=${branchId}, format=${format}`);

    const where: any = { orgId, branchId };
    if (options?.locationId) where.locationId = options.locationId;
    if (options?.status) where.status = options.status;
    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options?.startDate) where.createdAt.gte = options.startDate;
      if (options?.endDate) where.createdAt.lte = options.endDate;
    }

    const adjustments = await this.prisma.client.stockAdjustment.findMany({
      where,
      include: {
        item: { select: { sku: true, name: true } },
        location: { select: { code: true, name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const now = new Date();
    let data: string;
    let contentType: string;
    let filename: string;

    if (format === ExportFormat.JSON) {
      data = JSON.stringify({
        exportedAt: now.toISOString(),
        orgId,
        branchId,
        recordCount: adjustments.length,
        adjustments: adjustments.map((a) => ({
          id: a.id,
          timestamp: a.createdAt.toISOString(),
          itemSku: a.item.sku,
          itemName: a.item.name,
          locationCode: a.location.code,
          qty: a.qty.toString(),
          reason: a.reason,
          status: a.status,
          notes: a.notes,
          createdBy: `${a.createdBy?.firstName ?? ''} ${a.createdBy?.lastName ?? ''}`.trim(),
          approvedBy: a.approvedBy
            ? `${a.approvedBy.firstName ?? ''} ${a.approvedBy.lastName ?? ''}`.trim()
            : null,
          approvedAt: a.approvedAt?.toISOString(),
        })),
      }, null, 2);
      contentType = 'application/json';
      filename = `adjustments-${branchId}-${now.toISOString().slice(0, 10)}.json`;
    } else {
      const headers = [
        'Adjustment ID', 'Timestamp', 'Item SKU', 'Item Name', 'Location Code',
        'Qty', 'Reason', 'Status', 'Notes', 'Created By', 'Approved By', 'Approved At',
      ];
      const rows = adjustments.map((a) => [
        a.id,
        a.createdAt.toISOString(),
        this.escapeCsv(a.item.sku),
        this.escapeCsv(a.item.name),
        a.location.code,
        a.qty.toString(),
        a.reason,
        a.status,
        this.escapeCsv(a.notes ?? ''),
        `${a.createdBy?.firstName ?? ''} ${a.createdBy?.lastName ?? ''}`.trim(),
        a.approvedBy
          ? `${a.approvedBy.firstName ?? ''} ${a.approvedBy.lastName ?? ''}`.trim()
          : '',
        a.approvedAt?.toISOString() ?? '',
      ].join(','));

      data = [headers.join(','), ...rows].join('\n');
      contentType = 'text/csv';
      filename = `adjustments-${branchId}-${now.toISOString().slice(0, 10)}.csv`;
    }

    const hash = createHash('sha256').update(data).digest('hex');

    this.logger.log(`Adjustments export complete: ${adjustments.length} records, hash=${hash.slice(0, 16)}...`);

    return {
      data,
      format,
      contentType,
      filename,
      hash,
      recordCount: adjustments.length,
      generatedAt: now,
    };
  }

  /**
   * Export count sessions with lines
   */
  async exportCountSessions(
    orgId: string,
    branchId: string,
    options?: ExportOptions & { sessionId?: string; status?: string },
  ): Promise<ExportResult> {
    const format = options?.format ?? ExportFormat.CSV;

    this.logger.log(`Exporting count sessions: org=${orgId}, branch=${branchId}, format=${format}`);

    const where: any = { orgId, branchId };
    if (options?.sessionId) where.id = options.sessionId;
    if (options?.locationId) where.locationId = options.locationId;
    if (options?.status) where.status = options.status;
    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options?.startDate) where.createdAt.gte = options.startDate;
      if (options?.endDate) where.createdAt.lte = options.endDate;
    }

    const sessions = await this.prisma.client.countSession.findMany({
      where,
      include: {
        location: { select: { code: true, name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        finalizedBy: { select: { firstName: true, lastName: true } },
        lines: {
          include: {
            item: { select: { sku: true, name: true } },
            location: { select: { code: true } },
            countedBy: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const now = new Date();
    let data: string;
    let contentType: string;
    let filename: string;

    // Flatten sessions with lines for CSV
    const flatLines: any[] = [];
    for (const session of sessions) {
      for (const line of session.lines) {
        flatLines.push({
          sessionId: session.id,
          sessionName: session.name,
          sessionStatus: session.status,
          sessionCreatedAt: session.createdAt,
          itemSku: line.item.sku,
          itemName: line.item.name,
          locationCode: line.location.code,
          expectedQty: line.expectedQty,
          countedQty: line.countedQty,
          variance: line.variance,
          countedAt: line.countedAt,
          countedBy: `${line.countedBy?.firstName ?? ''} ${line.countedBy?.lastName ?? ''}`.trim(),
          notes: line.notes,
        });
      }
    }

    if (format === ExportFormat.JSON) {
      data = JSON.stringify({
        exportedAt: now.toISOString(),
        orgId,
        branchId,
        sessionCount: sessions.length,
        lineCount: flatLines.length,
        sessions: sessions.map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          createdAt: s.createdAt.toISOString(),
          finalizedAt: s.finalizedAt?.toISOString(),
          lines: s.lines.map((l) => ({
            itemSku: l.item.sku,
            itemName: l.item.name,
            locationCode: l.location.code,
            expectedQty: l.expectedQty.toString(),
            countedQty: l.countedQty.toString(),
            variance: l.variance.toString(),
            countedAt: l.countedAt.toISOString(),
          })),
        })),
      }, null, 2);
      contentType = 'application/json';
      filename = `count-sessions-${branchId}-${now.toISOString().slice(0, 10)}.json`;
    } else {
      const headers = [
        'Session ID', 'Session Name', 'Status', 'Session Created',
        'Item SKU', 'Item Name', 'Location Code',
        'Expected Qty', 'Counted Qty', 'Variance',
        'Counted At', 'Counted By', 'Notes',
      ];
      const rows = flatLines.map((l) => [
        l.sessionId,
        this.escapeCsv(l.sessionName),
        l.sessionStatus,
        l.sessionCreatedAt.toISOString(),
        this.escapeCsv(l.itemSku),
        this.escapeCsv(l.itemName),
        l.locationCode,
        l.expectedQty.toString(),
        l.countedQty.toString(),
        l.variance.toString(),
        l.countedAt.toISOString(),
        l.countedBy,
        this.escapeCsv(l.notes ?? ''),
      ].join(','));

      data = [headers.join(','), ...rows].join('\n');
      contentType = 'text/csv';
      filename = `count-sessions-${branchId}-${now.toISOString().slice(0, 10)}.csv`;
    }

    const hash = createHash('sha256').update(data).digest('hex');

    this.logger.log(
      `Count sessions export complete: ${sessions.length} sessions, ${flatLines.length} lines, hash=${hash.slice(0, 16)}...`,
    );

    return {
      data,
      format,
      contentType,
      filename,
      hash,
      recordCount: flatLines.length,
      generatedAt: now,
    };
  }

  /**
   * Export recipes with lines
   */
  async exportRecipes(
    orgId: string,
    options?: ExportOptions & { includeInactive?: boolean },
  ): Promise<ExportResult> {
    const format = options?.format ?? ExportFormat.CSV;

    this.logger.log(`Exporting recipes: org=${orgId}, format=${format}`);

    const where: any = { orgId };
    if (!options?.includeInactive) {
      where.isActive = true;
    }

    const recipes = await this.prisma.client.recipe.findMany({
      where,
      include: {
        lines: {
          include: {
            inventoryItem: { select: { sku: true, name: true } },
            inputUom: { select: { code: true } },
          },
        },
        outputUom: { select: { code: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Flatten to lines for CSV
    const flatLines: any[] = [];
    for (const recipe of recipes) {
      for (const line of recipe.lines) {
        flatLines.push({
          recipeName: recipe.name,
          targetType: recipe.targetType,
          targetId: recipe.targetId,
          outputQty: recipe.outputQtyBase.toString(),
          outputUom: recipe.outputUom?.code ?? '',
          isActive: recipe.isActive ? 'Yes' : 'No',
          ingredientSku: line.inventoryItem.sku,
          ingredientName: line.inventoryItem.name,
          qtyInput: line.qtyInput.toString(),
          inputUom: line.inputUom.code,
          qtyBase: line.qtyBase.toString(),
          notes: line.notes ?? '',
        });
      }
    }

    const now = new Date();
    let data: string;
    let contentType: string;
    let filename: string;

    if (format === ExportFormat.JSON) {
      data = JSON.stringify({
        exportedAt: now.toISOString(),
        orgId,
        recordCount: recipes.length,
        recipes: recipes.map((r) => ({
          id: r.id,
          name: r.name,
          targetType: r.targetType,
          targetId: r.targetId,
          outputQtyBase: r.outputQtyBase.toString(),
          outputUom: r.outputUom?.code,
          isActive: r.isActive,
          lines: r.lines.map((l) => ({
            ingredientSku: l.inventoryItem.sku,
            ingredientName: l.inventoryItem.name,
            qtyInput: l.qtyInput.toString(),
            inputUom: l.inputUom.code,
            qtyBase: l.qtyBase.toString(),
            notes: l.notes,
          })),
        })),
      }, null, 2);
      contentType = 'application/json';
      filename = `recipes-${now.toISOString().slice(0, 10)}.json`;
    } else {
      // CSV format with UTF-8 BOM
      const BOM = '\uFEFF';
      const headers = [
        'Recipe Name', 'Target Type', 'Target ID', 'Output Qty', 'Output UOM', 'Active',
        'Ingredient SKU', 'Ingredient Name', 'Qty Input', 'Input UOM', 'Qty Base', 'Notes',
      ];
      const rows = flatLines.map((l) => [
        this.escapeCsv(l.recipeName),
        l.targetType,
        l.targetId,
        l.outputQty,
        l.outputUom,
        l.isActive,
        l.ingredientSku,
        this.escapeCsv(l.ingredientName),
        l.qtyInput,
        l.inputUom,
        l.qtyBase,
        this.escapeCsv(l.notes),
      ].join(','));

      data = BOM + [headers.join(','), ...rows].join('\n');
      contentType = 'text/csv; charset=utf-8';
      filename = `recipes-${now.toISOString().slice(0, 10)}.csv`;
    }

    const hash = createHash('sha256').update(data).digest('hex');

    this.logger.log(`Recipes export complete: ${recipes.length} recipes, ${flatLines.length} lines, hash=${hash.slice(0, 16)}...`);

    return {
      data,
      format,
      contentType,
      filename,
      hash,
      recordCount: flatLines.length,
      generatedAt: now,
    };
  }

  /**
   * Export inventory depletions
   */
  async exportDepletions(
    orgId: string,
    branchId: string,
    options?: ExportOptions,
  ): Promise<ExportResult> {
    const format = options?.format ?? ExportFormat.CSV;

    this.logger.log(`Exporting depletions: org=${orgId}, branch=${branchId}, format=${format}`);

    const where: any = { orgId, branchId };
    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const depletions = await this.prisma.client.orderInventoryDepletion.findMany({
      where,
      include: {
        order: {
          select: { orderNumber: true, total: true },
        },
        branch: { select: { name: true } },
        location: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    let data: string;
    let contentType: string;
    let filename: string;

    if (format === ExportFormat.JSON) {
      data = JSON.stringify({
        exportedAt: now.toISOString(),
        orgId,
        branchId,
        recordCount: depletions.length,
        depletions: depletions.map((d) => ({
          id: d.id,
          orderNumber: d.order.orderNumber,
          orderTotal: d.order.total?.toString(),
          branchName: d.branch.name,
          locationCode: d.location.code,
          status: d.status,
          errorCode: d.errorCode,
          errorMessage: d.errorMessage,
          ledgerEntryCount: d.ledgerEntryCount,
          createdAt: d.createdAt.toISOString(),
          postedAt: d.postedAt?.toISOString(),
          metadata: d.metadata,
        })),
      }, null, 2);
      contentType = 'application/json';
      filename = `depletions-${branchId}-${now.toISOString().slice(0, 10)}.json`;
    } else {
      // CSV format with UTF-8 BOM
      const BOM = '\uFEFF';
      const headers = [
        'Depletion ID', 'Order Number', 'Order Total', 'Branch', 'Location Code',
        'Status', 'Error Code', 'Error Message', 'Ledger Entry Count', 'Created At', 'Posted At',
      ];
      const rows = depletions.map((d) => [
        d.id,
        d.order.orderNumber,
        d.order.total?.toString() ?? '',
        this.escapeCsv(d.branch.name),
        d.location.code,
        d.status,
        d.errorCode ?? '',
        this.escapeCsv(d.errorMessage ?? ''),
        d.ledgerEntryCount.toString(),
        d.createdAt.toISOString(),
        d.postedAt?.toISOString() ?? '',
      ].join(','));

      data = BOM + [headers.join(','), ...rows].join('\n');
      contentType = 'text/csv; charset=utf-8';
      filename = `depletions-${branchId}-${now.toISOString().slice(0, 10)}.csv`;
    }

    const hash = createHash('sha256').update(data).digest('hex');

    this.logger.log(`Depletions export complete: ${depletions.length} records, hash=${hash.slice(0, 16)}...`);

    return {
      data,
      format,
      contentType,
      filename,
      hash,
      recordCount: depletions.length,
      generatedAt: now,
    };
  }

  /**
   * Escape CSV field value
   */
  private escapeCsv(value: string): string {
    if (!value) return '';
    // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
