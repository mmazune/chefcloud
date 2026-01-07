/**
 * M12.1 Inventory Period Export Service
 *
 * Generates audit-grade CSV exports with:
 * - UTF-8 BOM
 * - Stable deterministic ordering
 * - X-Nimbus-Export-Hash SHA-256 over normalized LF content
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { InventoryPeriodsService } from './inventory-periods.service';
import { InventoryReconciliationService } from './inventory-reconciliation.service';
import { createHash } from 'crypto';
import { Prisma } from '@chefcloud/db';

const Decimal = Prisma.Decimal;

// UTF-8 BOM for Excel compatibility
const UTF8_BOM = '\uFEFF';

export interface ExportResult {
  content: string;
  hash: string;
  filename: string;
  contentType: string;
}

@Injectable()
export class InventoryPeriodExportService {
  private readonly logger = new Logger(InventoryPeriodExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly periodsService: InventoryPeriodsService,
    private readonly reconciliationService: InventoryReconciliationService,
  ) {}

  /**
   * Generate valuation CSV export.
   */
  async exportValuation(
    orgId: string,
    userId: string,
    periodId: string,
  ): Promise<ExportResult> {
    const period = await this.periodsService.getPeriod(orgId, periodId);
    const snapshots = await this.periodsService.getValuationSnapshots(orgId, periodId);

    // Build CSV rows
    const rows: string[] = [];
    
    // Header
    rows.push('Item Code,Item Name,Location Code,Qty On Hand,WAC,Value');

    // Data rows (stable ordering: itemId ASC, locationId ASC)
    for (const snap of snapshots) {
      rows.push([
        this.escapeCsv(snap.itemCode),
        this.escapeCsv(snap.itemName),
        this.escapeCsv(snap.locationCode),
        snap.qtyOnHand.toFixed(4),
        snap.wac.toFixed(4),
        snap.value.toFixed(2),
      ].join(','));
    }

    // Add summary row
    const totalValue = snapshots.reduce(
      (sum, s) => sum.plus(s.value),
      new Decimal(0),
    );
    rows.push(`,,TOTAL,,,${totalValue.toFixed(2)}`);

    const content = UTF8_BOM + rows.join('\n');
    const hash = this.computeHash(content);

    // Audit log
    await this.auditLog.log({
      orgId,
      userId,
      action: 'INVENTORY_PERIOD_EXPORT_GENERATED',
      resourceType: 'InventoryPeriod',
      resourceId: periodId,
      metadata: {
        exportType: 'valuation',
        rowCount: snapshots.length,
        hash,
      },
    });

    return {
      content,
      hash,
      filename: `valuation-${period.branchId}-${period.startDate.toISOString().split('T')[0]}-${period.endDate.toISOString().split('T')[0]}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  /**
   * Generate movements CSV export.
   */
  async exportMovements(
    orgId: string,
    userId: string,
    periodId: string,
  ): Promise<ExportResult> {
    const period = await this.periodsService.getPeriod(orgId, periodId);
    const summaries = await this.periodsService.getMovementSummaries(orgId, periodId);

    const rows: string[] = [];

    // Header
    rows.push('Item Code,Item Name,Receive Qty,Depletion Qty,Waste Qty,Transfer In Qty,Transfer Out Qty,Adjustment Qty,Count Variance Qty,Prod Consume Qty,Prod Produce Qty');

    // Data rows
    for (const sum of summaries) {
      rows.push([
        this.escapeCsv(sum.itemCode),
        this.escapeCsv(sum.itemName),
        sum.receiveQty.toFixed(4),
        sum.depletionQty.toFixed(4),
        sum.wasteQty.toFixed(4),
        sum.transferInQty.toFixed(4),
        sum.transferOutQty.toFixed(4),
        sum.adjustmentQty.toFixed(4),
        sum.countVarianceQty.toFixed(4),
        sum.productionConsumeQty.toFixed(4),
        sum.productionProduceQty.toFixed(4),
      ].join(','));
    }

    const content = UTF8_BOM + rows.join('\n');
    const hash = this.computeHash(content);

    await this.auditLog.log({
      orgId,
      userId,
      action: 'INVENTORY_PERIOD_EXPORT_GENERATED',
      resourceType: 'InventoryPeriod',
      resourceId: periodId,
      metadata: {
        exportType: 'movements',
        rowCount: summaries.length,
        hash,
      },
    });

    return {
      content,
      hash,
      filename: `movements-${period.branchId}-${period.startDate.toISOString().split('T')[0]}-${period.endDate.toISOString().split('T')[0]}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  /**
   * Generate reconciliation CSV export.
   */
  async exportReconciliation(
    orgId: string,
    userId: string,
    periodId: string,
  ): Promise<ExportResult> {
    const period = await this.periodsService.getPeriod(orgId, periodId);
    const recon = await this.reconciliationService.getReconciliation(orgId, periodId);

    const rows: string[] = [];

    // Header
    rows.push('Category,Inventory Qty,Inventory Value,GL Debit,GL Credit,GL Net,Delta,Status,Warnings');

    // Data rows
    for (const cat of recon.categories) {
      rows.push([
        cat.category,
        cat.inventorySide.qty.toFixed(4),
        cat.inventorySide.value.toFixed(2),
        cat.glSide.debitTotal.toFixed(2),
        cat.glSide.creditTotal.toFixed(2),
        cat.glSide.netValue.toFixed(2),
        cat.delta.toFixed(2),
        cat.status,
        this.escapeCsv(cat.warnings.join('; ')),
      ].join(','));
    }

    // Summary row
    rows.push(`OVERALL,,,,,,${recon.overallStatus},,`);

    const content = UTF8_BOM + rows.join('\n');
    const hash = this.computeHash(content);

    await this.auditLog.log({
      orgId,
      userId,
      action: 'INVENTORY_PERIOD_EXPORT_GENERATED',
      resourceType: 'InventoryPeriod',
      resourceId: periodId,
      metadata: {
        exportType: 'reconciliation',
        rowCount: recon.categories.length,
        hash,
        overallStatus: recon.overallStatus,
      },
    });

    return {
      content,
      hash,
      filename: `reconciliation-${period.branchId}-${period.startDate.toISOString().split('T')[0]}-${period.endDate.toISOString().split('T')[0]}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  /**
   * Compute SHA-256 hash over normalized LF content (H5).
   * Removes BOM before hashing, normalizes to LF.
   */
  private computeHash(content: string): string {
    // Remove BOM and normalize line endings to LF
    const normalized = content
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    return createHash('sha256').update(normalized, 'utf8').digest('hex');
  }

  /**
   * Escape CSV value (quote if contains comma, quote, or newline).
   */
  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
