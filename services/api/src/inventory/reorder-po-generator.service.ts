/**
 * M11.6 Reorder PO Generator Service
 * 
 * Generates Draft PurchaseOrderV2 records from reorder suggestion runs.
 * Features:
 * - Groups suggestions by vendor
 * - Creates one PO per vendor per run
 * - Idempotent via externalKey (H4)
 * - Includes unit price from latest SupplierPrice
 */
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { SupplierPricingService } from './supplier-pricing.service';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrderStatus } from '@chefcloud/db';

@Injectable()
export class ReorderPoGeneratorService {
  private readonly logger = new Logger(ReorderPoGeneratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly pricingService: SupplierPricingService,
    private readonly poService: PurchaseOrdersService,
  ) {}

  /**
   * Generate draft POs from a reorder suggestion run.
   * Idempotent: uses idempotencyKey = "reorder:<runId>:<vendorId>" (H4).
   * Returns existing POs if already generated.
   */
  async generatePOs(
    orgId: string,
    runId: string,
    userId: string,
  ): Promise<object> {
    // Get the run with lines
    const run = await this.prisma.client.reorderSuggestionRun.findFirst({
      where: { id: runId, orgId },
      include: {
        lines: {
          where: { suggestedVendorId: { not: null } },
          include: {
            inventoryItem: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Reorder run not found');
    }

    // Check for existing POs for this run (idempotency)
    const existingPOs = await this.prisma.client.purchaseOrderV2.findMany({
      where: { reorderRunId: runId, orgId },
      include: {
        vendor: { select: { id: true, name: true } },
        lines: true,
      },
    });

    if (existingPOs.length > 0) {
      this.logger.log(`Returning ${existingPOs.length} existing POs for run ${runId} (idempotent)`);
      return {
        isNew: false,
        purchaseOrders: existingPOs,
      };
    }

    // Group lines by vendor
    const linesByVendor = new Map<string, typeof run.lines>();
    for (const line of run.lines) {
      if (!line.suggestedVendorId) continue;
      
      const existing = linesByVendor.get(line.suggestedVendorId) ?? [];
      existing.push(line);
      linesByVendor.set(line.suggestedVendorId, existing);
    }

    if (linesByVendor.size === 0) {
      this.logger.log(`No vendor assignments in run ${runId}, no POs to generate`);
      return {
        isNew: false,
        purchaseOrders: [],
      };
    }

    // Get supplier items for price lookup
    const allItemIds = run.lines.map(l => l.inventoryItemId);
    const supplierItems = await this.prisma.client.supplierItem.findMany({
      where: { orgId, inventoryItemId: { in: allItemIds } },
      select: { id: true, vendorId: true, inventoryItemId: true },
    });

    // Build map: vendorId+itemId -> supplierItemId
    const supplierItemMap = new Map<string, string>();
    for (const si of supplierItems) {
      supplierItemMap.set(`${si.vendorId}:${si.inventoryItemId}`, si.id);
    }

    // Get latest prices for all supplier items
    const allSupplierItemIds = supplierItems.map(si => si.id);
    const priceMap = await this.pricingService.getLatestPricesForItems(allSupplierItemIds);

    // Create POs
    const createdPOs: any[] = [];

    for (const [vendorId, lines] of linesByVendor) {
      // Generate idempotency key (H4)
      const idempotencyKey = `reorder:${runId}:${vendorId}`;

      // Check if PO already exists with this key
      const existingPO = await this.prisma.client.purchaseOrderV2.findFirst({
        where: { orgId, idempotencyKey },
      });

      if (existingPO) {
        this.logger.debug(`PO already exists for vendor ${vendorId} in run ${runId}`);
        createdPOs.push(existingPO);
        continue;
      }

      // Get vendor info for default UOM
      const vendor = await this.prisma.client.vendor.findFirst({
        where: { id: vendorId, orgId },
      });

      if (!vendor) {
        this.logger.warn(`Vendor ${vendorId} not found, skipping`);
        continue;
      }

      // Get default UOM for org (fallback)
      const defaultUom = await this.prisma.client.unitOfMeasure.findFirst({
        where: { orgId, code: 'pcs' },
      });

      // Build PO lines
      const poLines: Array<{
        itemId: string;
        qtyOrderedInput: number;
        inputUomId: string;
        qtyOrderedBase: number;
        unitCost: number;
      }> = [];

      for (const line of lines) {
        // Get supplier item for this vendor+item
        const supplierItemId = supplierItemMap.get(`${vendorId}:${line.inventoryItemId}`);
        
        // Get price if available
        let unitCost = 0;
        if (supplierItemId) {
          const priceInfo = priceMap.get(supplierItemId);
          if (priceInfo) {
            unitCost = Number(priceInfo.unitPriceVendorUom);
          }
        }

        // Use vendor UOM qty if available, otherwise base qty
        const qtyOrderedInput = line.suggestedVendorQty
          ? Number(line.suggestedVendorQty)
          : Number(line.suggestedBaseQty);
        
        const inputUomId = line.suggestedVendorUomId ?? defaultUom?.id ?? '';

        poLines.push({
          itemId: line.inventoryItemId,
          qtyOrderedInput,
          inputUomId,
          qtyOrderedBase: Number(line.suggestedBaseQty),
          unitCost,
        });
      }

      // Calculate total
      const totalAmount = poLines.reduce((sum, l) => sum + (l.qtyOrderedInput * l.unitCost), 0);

      // Create PO using transaction
      const po = await this.prisma.client.$transaction(async (tx) => {
        // Generate PO number
        const poCount = await tx.purchaseOrderV2.count({ where: { orgId } });
        const poNumber = `PO-${String(poCount + 1).padStart(6, '0')}`;

        const newPO = await tx.purchaseOrderV2.create({
          data: {
            orgId,
            branchId: run.branchId,
            vendorId,
            poNumber,
            status: PurchaseOrderStatus.DRAFT,
            totalAmount,
            createdById: userId,
            idempotencyKey,
            reorderRunId: runId,
            notes: `Auto-generated from reorder run ${runId}`,
          },
        });

        // Create lines
        for (const line of poLines) {
          if (!line.inputUomId) {
            this.logger.warn(`No UOM for item ${line.itemId}, skipping line`);
            continue;
          }

          await tx.purchaseOrderLineV2.create({
            data: {
              purchaseOrderId: newPO.id,
              itemId: line.itemId,
              qtyOrderedInput: line.qtyOrderedInput,
              inputUomId: line.inputUomId,
              qtyOrderedBase: line.qtyOrderedBase,
              unitCost: line.unitCost,
            },
          });
        }

        return newPO;
      });

      createdPOs.push(po);
      this.logger.log(`Created draft PO ${po.poNumber} for vendor ${vendor.name}`);
    }

    await this.auditLog.log({
      orgId,
      branchId: run.branchId,
      userId,
      action: 'REORDER_POS_GENERATED',
      resourceType: 'ReorderSuggestionRun',
      resourceId: runId,
      metadata: { poCount: createdPOs.length, vendorIds: Array.from(linesByVendor.keys()) },
    });

    // Fetch full PO details
    const fullPOs = await this.prisma.client.purchaseOrderV2.findMany({
      where: { id: { in: createdPOs.map(p => p.id) } },
      include: {
        vendor: { select: { id: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    return {
      isNew: true,
      purchaseOrders: fullPOs,
    };
  }

  /**
   * Get POs generated from a run
   */
  async getPOsForRun(orgId: string, runId: string): Promise<object[]> {
    const run = await this.prisma.client.reorderSuggestionRun.findFirst({
      where: { id: runId, orgId },
    });

    if (!run) {
      throw new NotFoundException('Reorder run not found');
    }

    return this.prisma.client.purchaseOrderV2.findMany({
      where: { reorderRunId: runId, orgId },
      include: {
        vendor: { select: { id: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
