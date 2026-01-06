/**
 * M11.2 Procurement Reporting Service
 * 
 * Provides:
 * - Procurement KPIs (open POs, overdue POs, receipts count)
 * - PO and Receipt CSV/JSON exports
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';
import { createHash } from 'crypto';

const Decimal = Prisma.Decimal;

export enum ExportFormat {
  CSV = 'CSV',
  JSON = 'JSON',
}

export interface ProcurementKpis {
  openPOsCount: number;
  overduePOsCount: number;
  receiptsPostedCount: number;
  totalPOValue: string;
  avgReceiptTime?: number; // days from PO creation to receipt
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

// Helper to get full name from firstName/lastName
const getFullName = (user: { firstName?: string; lastName?: string } | null | undefined): string => {
  if (!user) return '';
  return [user.firstName, user.lastName].filter(Boolean).join(' ');
};

@Injectable()
export class ProcurementReportingService {
  private readonly logger = new Logger(ProcurementReportingService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Get procurement KPIs for a branch
   */
  async getKpis(orgId: string, branchId: string): Promise<ProcurementKpis> {
    const now = new Date();

    // Open POs (not received or cancelled)
    const openPOs = await this.prisma.client.purchaseOrderV2.count({
      where: {
        orgId,
        branchId,
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED'] },
      },
    });

    // Overdue POs (expectedAt < now and not received)
    const overduePOs = await this.prisma.client.purchaseOrderV2.count({
      where: {
        orgId,
        branchId,
        status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] },
        expectedAt: { lt: now },
      },
    });

    // Posted receipts count
    const receiptsPosted = await this.prisma.client.goodsReceiptV2.count({
      where: {
        orgId,
        branchId,
        status: 'POSTED',
      },
    });

    // Total PO value (open POs)
    const poValueResult = await this.prisma.client.purchaseOrderV2.aggregate({
      where: {
        orgId,
        branchId,
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED'] },
      },
      _sum: { totalAmount: true },
    });

    const totalPOValue = poValueResult._sum.totalAmount ?? new Decimal(0);

    return {
      openPOsCount: openPOs,
      overduePOsCount: overduePOs,
      receiptsPostedCount: receiptsPosted,
      totalPOValue: totalPOValue.toString(),
    };
  }

  /**
   * Export purchase orders to CSV/JSON
   */
  async exportPurchaseOrders(
    orgId: string,
    branchId: string,
    options?: { format?: ExportFormat; status?: string[] },
  ): Promise<ExportResult> {
    const format = options?.format ?? ExportFormat.CSV;

    const where: Prisma.PurchaseOrderV2WhereInput = { orgId, branchId };
    if (options?.status?.length) {
      where.status = { in: options.status as any[] };
    }

    const posRaw = await this.prisma.client.purchaseOrderV2.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true } },
        lines: {
          include: {
            item: { select: { sku: true, name: true } },
            inputUom: { select: { code: true } },
          },
        },
        createdBy: { select: { firstName: true, lastName: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ createdAt: 'asc' }],
    });
    // Cast to any[] to work around Prisma type inference issues with deep includes
    const pos = posRaw as any[];

    const now = new Date();
    let data: string;
    let contentType: string;
    let filename: string;

    if (format === ExportFormat.JSON) {
      const exportData = {
        exportedAt: now.toISOString(),
        orgId,
        branchId,
        recordCount: pos.length,
        purchaseOrders: pos.map((po: any) => ({
          id: po.id,
          poNumber: po.poNumber,
          status: po.status,
          vendorId: po.vendorId,
          vendorName: po.vendor.name,
          totalAmount: po.totalAmount.toString(),
          expectedAt: po.expectedAt?.toISOString() ?? null,
          createdAt: po.createdAt.toISOString(),
          createdBy: getFullName(po.createdBy),
          approvedAt: po.approvedAt?.toISOString() ?? null,
          approvedBy: getFullName(po.approvedBy) || null,
          lines: po.lines.map((line: any) => ({
            itemSku: line.item.sku,
            itemName: line.item.name,
            qtyOrderedInput: line.qtyOrderedInput.toString(),
            inputUom: line.inputUom.code,
            qtyOrderedBase: line.qtyOrderedBase.toString(),
            unitCost: line.unitCost.toString(),
            qtyReceivedBase: line.qtyReceivedBase.toString(),
            allowOverReceipt: line.allowOverReceipt,
          })),
        })),
      };
      data = JSON.stringify(exportData, null, 2);
      contentType = 'application/json';
      filename = `purchase-orders-${branchId}-${now.toISOString().slice(0, 10)}.json`;
    } else {
      // CSV format with UTF-8 BOM
      const BOM = '\uFEFF';
      const headers = [
        'PO Number',
        'Status',
        'Vendor',
        'Item SKU',
        'Item Name',
        'Qty Ordered',
        'Input UOM',
        'Qty Base',
        'Unit Cost',
        'Qty Received',
        'Over-Receipt',
        'Total Amount',
        'Expected Date',
        'Created At',
        'Created By',
        'Approved At',
        'Approved By',
      ];

      const rows: string[] = [];
      for (const po of pos) {
        for (const line of po.lines) {
          rows.push([
            this.escapeCsv(po.poNumber),
            po.status,
            this.escapeCsv(po.vendor.name),
            this.escapeCsv(line.item.sku ?? ''),
            this.escapeCsv(line.item.name),
            line.qtyOrderedInput.toString(),
            line.inputUom.code,
            line.qtyOrderedBase.toString(),
            line.unitCost.toString(),
            line.qtyReceivedBase.toString(),
            line.allowOverReceipt ? 'Yes' : 'No',
            po.totalAmount.toString(),
            po.expectedAt?.toISOString().slice(0, 10) ?? '',
            po.createdAt.toISOString(),
            getFullName(po.createdBy),
            po.approvedAt?.toISOString() ?? '',
            getFullName(po.approvedBy),
          ].join(','));
        }
      }

      data = BOM + [headers.join(','), ...rows].join('\n');
      contentType = 'text/csv; charset=utf-8';
      filename = `purchase-orders-${branchId}-${now.toISOString().slice(0, 10)}.csv`;
    }

    // Compute hash on LF-normalized content
    const normalizedData = data.replace(/\r\n/g, '\n');
    const hash = createHash('sha256').update(normalizedData).digest('hex');

    return {
      data,
      format,
      contentType,
      filename,
      hash,
      recordCount: pos.length,
      generatedAt: now,
    };
  }

  /**
   * Export goods receipts to CSV/JSON
   */
  async exportReceipts(
    orgId: string,
    branchId: string,
    options?: { format?: ExportFormat; status?: string[] },
  ): Promise<ExportResult> {
    const format = options?.format ?? ExportFormat.CSV;

    const where: Prisma.GoodsReceiptV2WhereInput = { orgId, branchId };
    if (options?.status?.length) {
      where.status = { in: options.status as any[] };
    }

    const receiptsRaw = await this.prisma.client.goodsReceiptV2.findMany({
      where,
      include: {
        purchaseOrder: {
          select: { poNumber: true, vendor: { select: { name: true } } },
        },
        lines: {
          include: {
            item: { select: { sku: true, name: true } },
            location: { select: { code: true, name: true } },
            inputUom: { select: { code: true } },
          },
        },
        postedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ createdAt: 'asc' }],
    });
    // Cast to any[] to work around Prisma type inference issues with deep includes
    const receipts = receiptsRaw as any[];

    const now = new Date();
    let data: string;
    let contentType: string;
    let filename: string;

    if (format === ExportFormat.JSON) {
      const exportData = {
        exportedAt: now.toISOString(),
        orgId,
        branchId,
        recordCount: receipts.length,
        receipts: receipts.map((r: any) => ({
          id: r.id,
          receiptNumber: r.receiptNumber,
          status: r.status,
          poNumber: r.purchaseOrder.poNumber,
          vendorName: r.purchaseOrder.vendor.name,
          referenceNumber: r.referenceNumber,
          receivedAt: r.receivedAt.toISOString(),
          postedAt: r.postedAt?.toISOString() ?? null,
          postedBy: getFullName(r.postedBy) || null,
          lines: r.lines.map((line: any) => ({
            itemSku: line.item.sku,
            itemName: line.item.name,
            locationCode: line.location.code,
            qtyReceivedInput: line.qtyReceivedInput.toString(),
            inputUom: line.inputUom.code,
            qtyReceivedBase: line.qtyReceivedBase.toString(),
            unitCost: line.unitCost.toString(),
          })),
        })),
      };
      data = JSON.stringify(exportData, null, 2);
      contentType = 'application/json';
      filename = `receipts-${branchId}-${now.toISOString().slice(0, 10)}.json`;
    } else {
      const BOM = '\uFEFF';
      const headers = [
        'Receipt Number',
        'Status',
        'PO Number',
        'Vendor',
        'Reference',
        'Item SKU',
        'Item Name',
        'Location',
        'Qty Received',
        'Input UOM',
        'Qty Base',
        'Unit Cost',
        'Received At',
        'Posted At',
        'Posted By',
      ];

      const rows: string[] = [];
      for (const r of receipts) {
        for (const line of r.lines) {
          rows.push([
            this.escapeCsv(r.receiptNumber),
            r.status,
            this.escapeCsv(r.purchaseOrder.poNumber),
            this.escapeCsv(r.purchaseOrder.vendor.name),
            this.escapeCsv(r.referenceNumber ?? ''),
            this.escapeCsv(line.item.sku ?? ''),
            this.escapeCsv(line.item.name),
            line.location.code,
            line.qtyReceivedInput.toString(),
            line.inputUom.code,
            line.qtyReceivedBase.toString(),
            line.unitCost.toString(),
            r.receivedAt.toISOString(),
            r.postedAt?.toISOString() ?? '',
            getFullName(r.postedBy),
          ].join(','));
        }
      }

      data = BOM + [headers.join(','), ...rows].join('\n');
      contentType = 'text/csv; charset=utf-8';
      filename = `receipts-${branchId}-${now.toISOString().slice(0, 10)}.csv`;
    }

    const normalizedData = data.replace(/\r\n/g, '\n');
    const hash = createHash('sha256').update(normalizedData).digest('hex');

    return {
      data,
      format,
      contentType,
      filename,
      hash,
      recordCount: receipts.length,
      generatedAt: now,
    };
  }

  /**
   * Escape CSV value
   */
  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
