/**
 * M12.2: Close Pack Service
 *
 * Generates audit-grade close pack bundle with all exports and bundle hash.
 * Bundle hash is SHA-256 over concatenated normalized CSV content.
 */
import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as crypto from 'crypto';
import { InventoryPeriodExportService } from './inventory-period-export.service';
import { InventoryReconciliationService } from './inventory-reconciliation.service';
import { InventoryPeriodEventsService } from './inventory-period-events.service';

export interface ClosePackSummary {
  period: {
    id: string;
    branchId: string;
    startDate: string;
    endDate: string;
    status: string;
    closedAt: string | null;
    revision: number;
  };
  reconciliation: {
    overallStatus: string;
    categoryCount: number;
  };
  totals: {
    valuationTotal: number;
    itemCount: number;
    movementSummaryCount: number;
  };
  exports: {
    valuation: { url: string; hash: string };
    movements: { url: string; hash: string };
    reconciliation: { url: string; hash: string };
    index: { url: string; hash: string };
  };
  bundleHash: string;
  generatedAt: string;
}

export interface IndexExportResult {
  content: string;
  hash: string;
  bundleHash: string;
  filename: string;
  contentType: string;
}

const UTF8_BOM = '\uFEFF';

@Injectable()
export class InventoryClosePackService {
  private readonly logger = new Logger(InventoryClosePackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly exportService: InventoryPeriodExportService,
    private readonly reconciliationService: InventoryReconciliationService,
    private readonly eventsService: InventoryPeriodEventsService,
  ) {}

  /**
   * Get close pack summary with all export hashes and bundle hash.
   */
  async getClosePack(
    orgId: string,
    userId: string,
    periodId: string,
  ): Promise<ClosePackSummary> {
    // Fetch period
    const period = await this.prisma.client.inventoryPeriod.findFirst({
      where: { id: periodId, orgId },
      include: {
        _count: {
          select: { valuationSnapshots: true, movementSummaries: true },
        },
      },
    });

    if (!period) {
      throw new NotFoundException('Period not found');
    }

    // M12.7 H10: Guard - close pack only for closed periods
    if (period.status === 'OPEN') {
      throw new ConflictException(
        'Cannot generate close pack for OPEN period. Close the period first.',
      );
    }

    // Get latest revision
    const latestRevision = await this.getLatestRevision(periodId);

    // Generate exports to get hashes (they're cached/deterministic)
    const [valuationExport, movementsExport, reconciliationExport] = await Promise.all([
      this.exportService.exportValuation(orgId, userId, periodId),
      this.exportService.exportMovements(orgId, userId, periodId),
      this.exportService.exportReconciliation(orgId, userId, periodId),
    ]);

    // Calculate bundle hash
    const bundleHash = this.computeBundleHash(
      valuationExport.content,
      movementsExport.content,
      reconciliationExport.content,
    );

    // Generate index export
    const indexHash = this.computeIndexHash(
      valuationExport.hash,
      movementsExport.hash,
      reconciliationExport.hash,
      bundleHash,
    );

    // Get reconciliation summary
    const recon = await this.reconciliationService.getReconciliation(orgId, periodId);

    // Calculate valuation total
    const valuationAgg = await this.prisma.client.inventoryValuationSnapshot.aggregate({
      where: { periodId, revision: latestRevision },
      _sum: { value: true },
      _count: { id: true },
    });

    // Log export event
    await this.eventsService.logEvent({
      orgId,
      branchId: period.branchId,
      periodId,
      type: 'EXPORT_GENERATED',
      actorUserId: userId,
      metadataJson: { exportType: 'close-pack', bundleHash },
    });

    const baseUrl = `/inventory/periods/${periodId}/export`;

    return {
      period: {
        id: period.id,
        branchId: period.branchId,
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString(),
        status: period.status,
        closedAt: period.closedAt?.toISOString() ?? null,
        revision: latestRevision,
      },
      reconciliation: {
        overallStatus: recon.overallStatus,
        categoryCount: recon.categories.length,
      },
      totals: {
        valuationTotal: Number(valuationAgg._sum.value ?? 0),
        itemCount: valuationAgg._count.id,
        movementSummaryCount: period._count.movementSummaries,
      },
      exports: {
        valuation: { url: `${baseUrl}/valuation.csv`, hash: valuationExport.hash },
        movements: { url: `${baseUrl}/movements.csv`, hash: movementsExport.hash },
        reconciliation: { url: `${baseUrl}/reconciliation.csv`, hash: reconciliationExport.hash },
        index: { url: `${baseUrl}/close-pack-index.csv`, hash: indexHash },
      },
      bundleHash,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Export close pack index CSV.
   */
  async exportIndex(
    orgId: string,
    userId: string,
    periodId: string,
  ): Promise<IndexExportResult> {
    const period = await this.prisma.client.inventoryPeriod.findFirst({
      where: { id: periodId, orgId },
    });

    if (!period) {
      throw new NotFoundException('Period not found');
    }

    // Generate exports to get hashes
    const [valuationExport, movementsExport, reconciliationExport] = await Promise.all([
      this.exportService.exportValuation(orgId, userId, periodId),
      this.exportService.exportMovements(orgId, userId, periodId),
      this.exportService.exportReconciliation(orgId, userId, periodId),
    ]);

    const bundleHash = this.computeBundleHash(
      valuationExport.content,
      movementsExport.content,
      reconciliationExport.content,
    );

    // Count rows (simple line count minus header)
    const countRows = (content: string) => content.split('\n').length - 2; // minus BOM+header

    const rows = [
      'ExportType,Filename,SHA256Hash,RowCount',
      `valuation,${valuationExport.filename},${valuationExport.hash},${countRows(valuationExport.content)}`,
      `movements,${movementsExport.filename},${movementsExport.hash},${countRows(movementsExport.content)}`,
      `reconciliation,${reconciliationExport.filename},${reconciliationExport.hash},${countRows(reconciliationExport.content)}`,
      `BUNDLE,,${bundleHash},`,
    ];

    const content = UTF8_BOM + rows.join('\n');
    const hash = this.computeHash(content);

    return {
      content,
      hash,
      bundleHash,
      filename: `close-pack-index-${period.branchId}-${period.startDate.toISOString().split('T')[0]}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  /**
   * Get latest revision number for a period.
   */
  private async getLatestRevision(periodId: string): Promise<number> {
    const result = await this.prisma.client.inventoryValuationSnapshot.aggregate({
      where: { periodId },
      _max: { revision: true },
    });
    return result._max.revision ?? 1;
  }

  /**
   * Compute bundle hash over normalized concatenated CSV content.
   * Algorithm:
   * 1. Strip BOM from each content
   * 2. Normalize line endings to LF
   * 3. Concatenate in order: valuation + movements + reconciliation
   * 4. SHA-256 the result
   */
  private computeBundleHash(
    valuationContent: string,
    movementsContent: string,
    reconciliationContent: string,
  ): string {
    const normalize = (content: string) =>
      content
        .replace(/^\uFEFF/, '') // Strip BOM
        .replace(/\r\n/g, '\n') // Normalize to LF
        .replace(/\r/g, '\n');

    const combined =
      normalize(valuationContent) +
      normalize(movementsContent) +
      normalize(reconciliationContent);

    return crypto.createHash('sha256').update(combined, 'utf8').digest('hex');
  }

  /**
   * Compute hash for index content.
   */
  private computeIndexHash(
    valuationHash: string,
    movementsHash: string,
    reconciliationHash: string,
    bundleHash: string,
  ): string {
    const combined = `${valuationHash}:${movementsHash}:${reconciliationHash}:${bundleHash}`;
    return crypto.createHash('sha256').update(combined, 'utf8').digest('hex');
  }

  /**
   * Compute SHA-256 hash of content (for index CSV).
   */
  private computeHash(content: string): string {
    const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  }
}
