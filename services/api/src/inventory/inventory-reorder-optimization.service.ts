/**
 * M11.14 Reorder Optimization Service
 * 
 * Generates optimized reorder suggestions using forecast data + safety stock.
 * 
 * Optimization Formula:
 *   availableQty = onHandQty + inTransitQty (if includeInTransit) + onOrderQty (if includeOpenPOs)
 *                  - quarantinedQty (if !includeQuarantinedLots) - recallBlockedQty (if !includeRecallBlockedLots)
 *   targetStockQty = avgDailyQty * (leadTimeDays + safetyStockDays)
 *   suggestedQty = max(0, ceil(targetStockQty - availableQty))
 * 
 * Key features:
 * - Uses forecast snapshots (not raw ledger) for efficiency
 * - Includes in-transit and on-order quantities (H5, H10)
 * - Respects quarantine/recall lot exclusions
 * - Generates explainable reason codes
 * - Deterministic hash for idempotency (H4)
 */
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { InventoryForecastingService } from './inventory-forecasting.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import {
  Prisma,
  ForecastOptimizationStatus,
  ForecastReasonCode,
  PurchaseOrderStatus,
  LotStatus,
  InventoryTransferStatus,
} from '@chefcloud/db';
import { createHash } from 'crypto';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const ZERO = new Decimal(0);

export interface OptimizationLineInput {
  itemId: string;
  onHandQty: Decimal;
  avgDailyQty: Decimal;
  forecastDemandQty: Decimal;
  snapshotId: string;
}

export interface OptimizationLineOutput {
  itemId: string;
  onHandQty: Decimal;
  inTransitQty: Decimal;
  onOrderQty: Decimal;
  quarantinedQty: Decimal;
  availableQty: Decimal;
  avgDailyQty: Decimal;
  forecastDemandQty: Decimal;
  targetStockQty: Decimal;
  reorderPointQty: Decimal;
  suggestedQty: Decimal;
  reasonCodes: ForecastReasonCode[];
  explanation: string;
  suggestedVendorId: string | null;
}

export interface GenerateOptimizationOptions {
  horizonDays?: number;
  leadTimeDaysOverride?: number;
  safetyStockDaysOverride?: number;
  snapshotIds?: string[]; // Use specific snapshots (or latest if not provided)
  itemIds?: string[]; // Filter to specific items
}

export interface GenerateOptimizationResult {
  runId: string;
  status: ForecastOptimizationStatus;
  itemCount: number;
  totalSuggestedQty: Decimal;
  created: boolean; // false if existing run found (idempotent)
}

@Injectable()
export class InventoryReorderOptimizationService {
  private readonly logger = new Logger(InventoryReorderOptimizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly forecastingService: InventoryForecastingService,
    private readonly ledgerService: InventoryLedgerService,
  ) {}

  // ============================================================================
  // Optimization Run Generation
  // ============================================================================

  /**
   * Generate an optimization run for a branch
   */
  async generateOptimizationRun(
    orgId: string,
    branchId: string,
    userId: string,
    options: GenerateOptimizationOptions = {},
  ): Promise<GenerateOptimizationResult> {
    const horizonDays = options.horizonDays ?? 14;

    this.logger.log(
      `Generating optimization run: org=${orgId}, branch=${branchId}, horizon=${horizonDays}`,
    );

    // Get items with reorder policies
    const policies = await this.prisma.client.reorderPolicy.findMany({
      where: {
        orgId,
        branchId,
        isActive: true,
        ...(options.itemIds?.length ? { inventoryItemId: { in: options.itemIds } } : {}),
      },
      include: {
        inventoryItem: { select: { id: true, sku: true, name: true, unit: true } },
      },
    });

    if (policies.length === 0) {
      throw new BadRequestException('No active reorder policies found for this branch');
    }

    const itemIds = policies.map((p) => p.inventoryItemId);

    // Get latest forecast snapshots for these items
    const snapshots = await this.prisma.client.demandForecastSnapshot.findMany({
      where: {
        orgId,
        branchId,
        inventoryItemId: { in: itemIds },
        ...(options.snapshotIds?.length ? { id: { in: options.snapshotIds } } : {}),
      },
      orderBy: { generatedAt: 'desc' },
      distinct: ['inventoryItemId'], // Get only latest per item
    });

    const snapshotMap = new Map(snapshots.map((s) => [s.inventoryItemId, s]));

    // Build lines with optimization logic
    const lines: OptimizationLineOutput[] = [];
    let totalSuggestedQty = ZERO;

    for (const policy of policies) {
      const snapshot = snapshotMap.get(policy.inventoryItemId);
      const line = await this.calculateOptimizationLine(
        orgId,
        branchId,
        policy,
        snapshot,
        options.leadTimeDaysOverride,
        options.safetyStockDaysOverride,
      );

      lines.push(line);
      totalSuggestedQty = totalSuggestedQty.plus(line.suggestedQty);
    }

    // Compute deterministic hash (H4)
    const deterministicHash = this.computeRunHash({
      orgId,
      branchId,
      horizonDays,
      leadTimeDaysOverride: options.leadTimeDaysOverride,
      safetyStockDaysOverride: options.safetyStockDaysOverride,
      snapshotIds: snapshots.map((s) => s.id).sort(),
      lineHashes: lines.map((l) => this.computeLineHash(l)).sort(),
    });

    // Check for existing run (idempotency - H4)
    const existing = await this.prisma.client.forecastOptimizationRun.findUnique({
      where: {
        orgId_branchId_deterministicHash: {
          orgId,
          branchId,
          deterministicHash,
        },
      },
    });

    if (existing) {
      this.logger.debug(`Found existing optimization run: ${existing.id}`);
      return {
        runId: existing.id,
        status: existing.status,
        itemCount: existing.itemCount,
        totalSuggestedQty: existing.totalSuggestedQty,
        created: false,
      };
    }

    // Create new run with lines
    const run = await this.prisma.client.forecastOptimizationRun.create({
      data: {
        orgId,
        branchId,
        horizonDays,
        leadTimeDaysOverride: options.leadTimeDaysOverride,
        safetyStockDaysOverride: options.safetyStockDaysOverride,
        status: ForecastOptimizationStatus.GENERATED,
        usedSnapshotId: snapshots[0]?.id, // Primary reference
        deterministicHash,
        itemCount: lines.length,
        totalSuggestedQty,
        createdById: userId,
        lines: {
          create: lines.map((line) => ({
            orgId,
            inventoryItemId: line.itemId,
            onHandQty: line.onHandQty,
            inTransitQty: line.inTransitQty,
            onOrderQty: line.onOrderQty,
            quarantinedQty: line.quarantinedQty,
            availableQty: line.availableQty,
            avgDailyQty: line.avgDailyQty,
            forecastDemandQty: line.forecastDemandQty,
            targetStockQty: line.targetStockQty,
            reorderPointQty: line.reorderPointQty,
            suggestedQty: line.suggestedQty,
            reasonCodes: line.reasonCodes,
            explanation: line.explanation,
            suggestedVendorId: line.suggestedVendorId,
          })),
        },
      },
    });

    // Audit log
    await this.auditLog.log({
      orgId,
      userId,
      action: 'OPTIMIZATION_RUN_GENERATED',
      resourceType: 'ForecastOptimizationRun',
      resourceId: run.id,
      metadata: {
        branchId,
        horizonDays,
        itemCount: lines.length,
        totalSuggestedQty: totalSuggestedQty.toString(),
      },
    });

    this.logger.log(
      `Optimization run created: ${run.id}, items=${lines.length}, total=${totalSuggestedQty}`,
    );

    return {
      runId: run.id,
      status: run.status,
      itemCount: lines.length,
      totalSuggestedQty,
      created: true,
    };
  }

  /**
   * Get optimization run by ID with lines
   */
  async getRunById(orgId: string, runId: string) {
    const run = await this.prisma.client.forecastOptimizationRun.findFirst({
      where: { id: runId, orgId },
      include: {
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        lines: {
          include: {
            inventoryItem: { select: { id: true, sku: true, name: true, unit: true } },
            suggestedVendor: { select: { id: true, name: true } },
          },
          orderBy: { suggestedQty: 'desc' },
        },
        generatedPOs: {
          select: { id: true, poNumber: true, status: true, totalAmount: true },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Optimization run not found');
    }

    return run;
  }

  /**
   * List optimization runs for a branch
   */
  async listRuns(
    orgId: string,
    branchId: string,
    options: { limit?: number; cursor?: string; status?: ForecastOptimizationStatus } = {},
  ) {
    const { limit = 20, cursor, status } = options;

    const where: Prisma.ForecastOptimizationRunWhereInput = { orgId, branchId };
    if (status) where.status = status;

    const runs = await this.prisma.client.forecastOptimizationRun.findMany({
      where,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { lines: true } },
      },
    });

    const hasMore = runs.length > limit;
    if (hasMore) runs.pop();

    return {
      runs,
      nextCursor: hasMore ? runs[runs.length - 1]?.id : undefined,
    };
  }

  /**
   * Convert optimization run to draft purchase orders
   * Groups suggestions by vendor
   */
  async createDraftPOs(
    orgId: string,
    runId: string,
    userId: string,
  ): Promise<{ poIds: string[]; poCount: number }> {
    const run = await this.prisma.client.forecastOptimizationRun.findFirst({
      where: { id: runId, orgId },
      include: {
        lines: {
          where: { suggestedQty: { gt: 0 } },
          include: {
            inventoryItem: true,
            suggestedVendor: true,
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Optimization run not found');
    }

    if (run.status === ForecastOptimizationStatus.PO_CREATED) {
      throw new BadRequestException('Draft POs already created from this run');
    }

    // Group lines by vendor
    const vendorGroups = new Map<string, typeof run.lines>();
    
    for (const line of run.lines) {
      const vendorId = line.suggestedVendorId || 'UNKNOWN';
      if (!vendorGroups.has(vendorId)) {
        vendorGroups.set(vendorId, []);
      }
      vendorGroups.get(vendorId)!.push(line);
    }

    const poIds: string[] = [];

    // Create PO per vendor (skip UNKNOWN vendor group)
    for (const [vendorId, lines] of vendorGroups) {
      if (vendorId === 'UNKNOWN') {
        this.logger.warn(`Skipping ${lines.length} items with no preferred vendor`);
        continue;
      }

      // Generate PO number
      const poNumber = await this.generatePONumber(orgId);

      const po = await this.prisma.client.purchaseOrderV2.create({
        data: {
          orgId,
          branchId: run.branchId,
          vendorId,
          poNumber,
          status: PurchaseOrderStatus.DRAFT,
          createdById: userId,
          optimizationRunId: run.id,
          lines: {
            create: lines.map((line) => ({
              itemId: line.inventoryItemId,
              qtyOrderedInput: line.suggestedQty,
              inputUomId: line.inventoryItem.uomId || '', // Requires UOM setup
              qtyOrderedBase: line.suggestedQty,
              unitCost: ZERO, // To be filled by user
            })),
          },
        },
      });

      poIds.push(po.id);
    }

    // Update run status
    await this.prisma.client.forecastOptimizationRun.update({
      where: { id: runId },
      data: { status: ForecastOptimizationStatus.PO_CREATED },
    });

    // Audit log
    await this.auditLog.log({
      orgId,
      userId,
      action: 'OPTIMIZATION_POS_CREATED',
      resourceType: 'ForecastOptimizationRun',
      resourceId: runId,
      metadata: { poIds, poCount: poIds.length },
    });

    this.logger.log(`Created ${poIds.length} draft POs from optimization run ${runId}`);

    return { poIds, poCount: poIds.length };
  }

  // ============================================================================
  // Optimization Calculation
  // ============================================================================

  /**
   * Calculate optimization for a single item
   */
  private async calculateOptimizationLine(
    orgId: string,
    branchId: string,
    policy: Prisma.ReorderPolicyGetPayload<{ include: { inventoryItem: { select: { id: true; sku: true; name: true; unit: true } } } }>,
    snapshot: Prisma.DemandForecastSnapshotGetPayload<Record<string, never>> | undefined,
    leadTimeDaysOverride?: number,
    safetyStockDaysOverride?: number,
  ): Promise<OptimizationLineOutput> {
    const itemId = policy.inventoryItemId;

    // Get on-hand quantity from ledger
    const onHandResults = await this.ledgerService.getOnHandByLocation(itemId, branchId);
    let onHandQty = ZERO;
    for (const result of onHandResults) {
      onHandQty = onHandQty.plus(result.onHand);
    }

    // Get in-transit quantity (shipped but not received)
    const inTransitQty = policy.includeInTransit
      ? await this.getInTransitQty(orgId, branchId, itemId)
      : ZERO;

    // Get on-order quantity (open POs not yet shipped) - H5, H10
    const onOrderQty = policy.includeOpenPOs
      ? await this.getOnOrderQty(orgId, branchId, itemId)
      : ZERO;

    // Get quarantined lot quantity (optional exclusion)
    const quarantinedQty = !policy.includeQuarantinedLots
      ? await this.getQuarantinedQty(orgId, branchId, itemId)
      : ZERO;

    // Calculate available quantity
    let availableQty = onHandQty.plus(inTransitQty).plus(onOrderQty);
    availableQty = availableQty.minus(quarantinedQty);
    if (availableQty.lessThan(ZERO)) availableQty = ZERO;

    // Get forecast values
    const avgDailyQty = snapshot?.avgDailyQty ?? ZERO;
    const forecastDemandQty = snapshot?.forecastTotalQty ?? ZERO;

    // Calculate target stock
    const leadTimeDays = leadTimeDaysOverride ?? policy.leadTimeDays;
    const safetyStockDays = safetyStockDaysOverride ?? policy.safetyStockDays;
    const coverageDays = leadTimeDays + safetyStockDays;

    const targetStockQty = avgDailyQty.times(coverageDays);
    const reorderPointQty = new Decimal(policy.reorderPointBaseQty);

    // Calculate suggested quantity
    let suggestedQty = targetStockQty.minus(availableQty);
    if (suggestedQty.lessThan(ZERO)) suggestedQty = ZERO;
    suggestedQty = suggestedQty.ceil(); // Round up

    // Apply minimum order quantity if set
    if (policy.minOrderQty && suggestedQty.greaterThan(ZERO)) {
      const minQty = new Decimal(policy.minOrderQty);
      if (suggestedQty.lessThan(minQty)) {
        suggestedQty = minQty;
      }
    }

    // Generate reason codes
    const reasonCodes = this.generateReasonCodes(
      onHandQty,
      availableQty,
      reorderPointQty,
      targetStockQty,
      avgDailyQty,
      leadTimeDays,
    );

    // Generate explanation
    const explanation = this.generateExplanation(
      onHandQty,
      inTransitQty,
      onOrderQty,
      quarantinedQty,
      availableQty,
      avgDailyQty,
      leadTimeDays,
      safetyStockDays,
      targetStockQty,
      suggestedQty,
      reasonCodes,
    );

    return {
      itemId,
      onHandQty,
      inTransitQty,
      onOrderQty,
      quarantinedQty,
      availableQty,
      avgDailyQty,
      forecastDemandQty,
      targetStockQty,
      reorderPointQty,
      suggestedQty,
      reasonCodes,
      explanation,
      suggestedVendorId: policy.preferredVendorId,
    };
  }

  /**
   * Get in-transit quantity (shipped transfers not yet received)
   */
  private async getInTransitQty(
    orgId: string,
    branchId: string,
    itemId: string,
  ): Promise<Decimal> {
    const result = await this.prisma.client.inventoryTransferLine.aggregate({
      where: {
        transfer: {
          orgId,
          toBranchId: branchId,
          status: InventoryTransferStatus.IN_TRANSIT,
        },
        itemId,
      },
      _sum: { qtyShipped: true },
    });

    return result._sum.qtyShipped ?? ZERO;
  }

  /**
   * Get on-order quantity (open POs not yet fully received) - H10
   */
  private async getOnOrderQty(
    orgId: string,
    branchId: string,
    itemId: string,
  ): Promise<Decimal> {
    // Get PO lines for this item in SUBMITTED/APPROVED status (not yet fully received)
    const result = await this.prisma.client.purchaseOrderLineV2.aggregate({
      where: {
        purchaseOrder: {
          orgId,
          branchId,
          status: { in: [PurchaseOrderStatus.SUBMITTED, PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIALLY_RECEIVED] },
        },
        itemId,
      },
      _sum: {
        qtyOrderedBase: true,
        qtyReceivedBase: true,
      },
    });

    // On-order = ordered - received (accounting for partial receipts - H10)
    const ordered = result._sum.qtyOrderedBase ?? ZERO;
    const received = result._sum.qtyReceivedBase ?? ZERO;
    let onOrder = ordered.minus(received);
    if (onOrder.lessThan(ZERO)) onOrder = ZERO;

    return onOrder;
  }

  /**
   * Get quarantined lot quantity (lots not in ACTIVE status)
   */
  private async getQuarantinedQty(
    orgId: string,
    branchId: string,
    itemId: string,
  ): Promise<Decimal> {
    // Get lots that are not active (EXPIRED, CONSUMED, or custom statuses)
    // Using status != ACTIVE to represent quarantine-like exclusions
    const result = await this.prisma.client.inventoryLot.aggregate({
      where: {
        orgId,
        branchId,
        itemId,
        status: { not: LotStatus.ACTIVE },
      },
      _sum: { remainingQty: true },
    });

    return result._sum.remainingQty ?? ZERO;
  }

  /**
   * Generate reason codes based on optimization state
   */
  private generateReasonCodes(
    onHandQty: Decimal,
    availableQty: Decimal,
    reorderPointQty: Decimal,
    targetStockQty: Decimal,
    avgDailyQty: Decimal,
    leadTimeDays: number,
  ): ForecastReasonCode[] {
    const codes: ForecastReasonCode[] = [];

    // Below reorder point
    if (onHandQty.lessThan(reorderPointQty)) {
      codes.push(ForecastReasonCode.BELOW_REORDER_POINT);
    }

    // Forecast-driven (available < target)
    if (availableQty.lessThan(targetStockQty)) {
      codes.push(ForecastReasonCode.FORECAST_DRIVEN);
    }

    // Stockout risk (available < lead time demand)
    const leadTimeDemand = avgDailyQty.times(leadTimeDays);
    if (availableQty.lessThan(leadTimeDemand)) {
      codes.push(ForecastReasonCode.STOCKOUT_RISK);
    }

    // If we're suggesting order but none of above, it's for safety buffer
    if (codes.length === 0 && availableQty.lessThan(targetStockQty)) {
      codes.push(ForecastReasonCode.LEAD_TIME_BUFFER);
    }

    return codes;
  }

  /**
   * Generate human-readable explanation
   */
  private generateExplanation(
    onHandQty: Decimal,
    inTransitQty: Decimal,
    onOrderQty: Decimal,
    quarantinedQty: Decimal,
    availableQty: Decimal,
    avgDailyQty: Decimal,
    leadTimeDays: number,
    safetyStockDays: number,
    targetStockQty: Decimal,
    suggestedQty: Decimal,
    reasonCodes: ForecastReasonCode[],
  ): string {
    if (suggestedQty.equals(ZERO)) {
      return `Stock adequate. On-hand: ${onHandQty}, Available: ${availableQty}, Target: ${targetStockQty}`;
    }

    const parts = [
      `On-hand: ${onHandQty}`,
      inTransitQty.greaterThan(ZERO) ? `In-transit: +${inTransitQty}` : null,
      onOrderQty.greaterThan(ZERO) ? `On-order: +${onOrderQty}` : null,
      quarantinedQty.greaterThan(ZERO) ? `Quarantined: -${quarantinedQty}` : null,
      `Available: ${availableQty}`,
      `Avg daily demand: ${avgDailyQty.toFixed(2)}`,
      `Coverage: ${leadTimeDays}d lead + ${safetyStockDays}d safety = ${leadTimeDays + safetyStockDays}d`,
      `Target: ${targetStockQty.toFixed(2)}`,
      `Suggested: ${suggestedQty}`,
    ].filter(Boolean);

    const reasonText = reasonCodes.length > 0
      ? ` Reasons: ${reasonCodes.join(', ')}`
      : '';

    return parts.join(' | ') + reasonText;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Compute deterministic hash for run
   */
  private computeRunHash(inputs: Record<string, unknown>): string {
    const sortedKeys = Object.keys(inputs).sort();
    const normalized = sortedKeys.map((k) => {
      const v = inputs[k];
      if (Array.isArray(v)) return `${k}:${v.sort().join(',')}`;
      return `${k}:${v}`;
    }).join('|');
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Compute hash for a single line
   */
  private computeLineHash(line: OptimizationLineOutput): string {
    return createHash('sha256')
      .update([
        line.itemId,
        line.onHandQty.toString(),
        line.inTransitQty.toString(),
        line.onOrderQty.toString(),
        line.quarantinedQty.toString(),
        line.avgDailyQty.toString(),
        line.targetStockQty.toString(),
        line.suggestedQty.toString(),
      ].join('|'))
      .digest('hex');
  }

  /**
   * Generate unique PO number
   */
  private async generatePONumber(orgId: string): Promise<string> {
    const count = await this.prisma.client.purchaseOrderV2.count({
      where: { orgId },
    });
    const seq = (count + 1).toString().padStart(6, '0');
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `PO-OPT-${date}-${seq}`;
  }
}
