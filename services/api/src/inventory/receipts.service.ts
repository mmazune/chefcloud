/**
 * M11.2 Goods Receipts Service
 * 
 * Manages goods receiving workflow:
 * - Create receipt drafts from approved POs
 * - Post receipts to create ledger entries (BASE UOM)
 * - Idempotent posting (same receipt cannot double-post)
 * - Over-receipt policy enforcement
 * - Void posted receipts (L4+ only)
 * - M11.5: Creates cost layers on post for WAC tracking
 * - M11.13: Creates GL journal entries on post (Dr Inventory, Cr GRNI)
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { InventoryUomService } from './inventory-uom.service';
import { InventoryLedgerService, LedgerEntryReason, LedgerSourceType } from './inventory-ledger.service';
import { PurchaseOrdersService } from './purchase-orders.service';
import { InventoryCostingService } from './inventory-costing.service';
import { SupplierPricingService } from './supplier-pricing.service';
import { InventoryGlPostingService } from './inventory-gl-posting.service';
import { Prisma, GoodsReceiptStatus, CostSourceType } from '@chefcloud/db';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export interface CreateReceiptDto {
  purchaseOrderId: string;
  referenceNumber?: string;
  notes?: string;
  idempotencyKey?: string;
  lines: CreateReceiptLineDto[];
}

export interface CreateReceiptLineDto {
  itemId: string;
  locationId: string;
  poLineId?: string;
  qtyReceivedInput: number | string;
  inputUomId: string;
  unitCost?: number | string; // Optional override from PO line
  notes?: string;
}

export interface ReceiptQueryOptions {
  status?: GoodsReceiptStatus | GoodsReceiptStatus[];
  purchaseOrderId?: string;
  fromDate?: Date;
  toDate?: Date;
  includeLines?: boolean;
  includePurchaseOrder?: boolean;
}

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly uomService: InventoryUomService,
    private readonly ledgerService: InventoryLedgerService,
    private readonly poService: PurchaseOrdersService,
    private readonly costingService: InventoryCostingService,
    private readonly supplierPricingService: SupplierPricingService,
    private readonly glPostingService: InventoryGlPostingService,
  ) { }

  /**
   * Generate a unique receipt number
   */
  private async generateReceiptNumber(orgId: string): Promise<string> {
    const count = await this.prisma.client.goodsReceiptV2.count({
      where: { orgId },
    });
    const date = new Date();
    const yy = date.getFullYear().toString().slice(-2);
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    return `GR-${yy}${mm}-${(count + 1).toString().padStart(5, '0')}`;
  }

  /**
   * Create a receipt draft
   */
  async create(
    orgId: string,
    branchId: string,
    userId: string,
    dto: CreateReceiptDto,
  ) {
    this.logger.log(`Creating receipt for PO ${dto.purchaseOrderId}`);

    // Check idempotency
    if (dto.idempotencyKey) {
      const existing = await this.prisma.client.goodsReceiptV2.findUnique({
        where: { orgId_idempotencyKey: { orgId, idempotencyKey: dto.idempotencyKey } },
        include: { lines: true, purchaseOrder: true },
      });
      if (existing) {
        this.logger.log(`Idempotent return for receipt ${existing.id}`);
        return { ...existing, isIdempotent: true };
      }
    }

    // Verify PO exists, belongs to org/branch, and is APPROVED or PARTIALLY_RECEIVED
    const po = await this.prisma.client.purchaseOrderV2.findFirst({
      where: {
        id: dto.purchaseOrderId,
        orgId,
        branchId,
        status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] },
      },
      include: { lines: true },
    });

    if (!po) {
      throw new BadRequestException('Purchase order not found or not in receivable status');
    }

    // Validate lines exist
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('At least one line is required');
    }

    // Process lines with UOM conversion
    const processedLines: {
      itemId: string;
      locationId: string;
      poLineId?: string;
      qtyReceivedInput: Decimal;
      inputUomId: string;
      qtyReceivedBase: Decimal;
      unitCost: Decimal;
      notes?: string;
    }[] = [];

    for (const line of dto.lines) {
      // Get item and verify it exists
      const item = await this.prisma.client.inventoryItem.findFirst({
        where: { id: line.itemId, orgId },
      });
      if (!item) {
        throw new BadRequestException(`Item ${line.itemId} not found`);
      }

      // Verify location exists and belongs to branch
      const location = await this.prisma.client.inventoryLocation.findFirst({
        where: { id: line.locationId, branchId, isActive: true },
      });
      if (!location) {
        throw new BadRequestException(`Location ${line.locationId} not found or inactive`);
      }

      // Verify input UOM exists
      const inputUom = await this.prisma.client.unitOfMeasure.findFirst({
        where: { id: line.inputUomId, orgId },
      });
      if (!inputUom) {
        throw new BadRequestException(`UOM ${line.inputUomId} not found`);
      }

      // Convert to base UOM
      const qtyInput = new Decimal(line.qtyReceivedInput);
      let qtyBase: Decimal;

      if (!item.uomId || item.uomId === line.inputUomId) {
        qtyBase = qtyInput;
      } else {
        try {
          qtyBase = await this.uomService.convert(orgId, line.inputUomId, item.uomId, qtyInput.toString());
        } catch {
          throw new BadRequestException({
            code: 'MISSING_CONVERSION',
            message: `No conversion found from ${inputUom.code} to item base UOM`,
            itemId: item.id,
          });
        }
      }

      // Determine unit cost (from PO line or override)
      let unitCost: Decimal;
      if (line.unitCost !== undefined) {
        unitCost = new Decimal(line.unitCost);
      } else if (line.poLineId) {
        const poLine = po.lines.find(l => l.id === line.poLineId);
        if (poLine) {
          unitCost = new Decimal(poLine.unitCost);
        } else {
          throw new BadRequestException(`PO line ${line.poLineId} not found`);
        }
      } else {
        // Find matching PO line by item
        const poLine = po.lines.find(l => l.itemId === line.itemId);
        if (poLine) {
          unitCost = new Decimal(poLine.unitCost);
        } else {
          throw new BadRequestException(`No PO line found for item ${line.itemId} and no unitCost provided`);
        }
      }

      processedLines.push({
        itemId: line.itemId,
        locationId: line.locationId,
        poLineId: line.poLineId,
        qtyReceivedInput: qtyInput,
        inputUomId: line.inputUomId,
        qtyReceivedBase: qtyBase,
        unitCost,
        notes: line.notes,
      });
    }

    // Create receipt with lines
    const receiptNumber = await this.generateReceiptNumber(orgId);

    const receipt = await this.prisma.client.goodsReceiptV2.create({
      data: {
        orgId,
        branchId,
        purchaseOrderId: dto.purchaseOrderId,
        receiptNumber,
        status: 'DRAFT',
        referenceNumber: dto.referenceNumber,
        notes: dto.notes,
        idempotencyKey: dto.idempotencyKey,
        lines: {
          create: processedLines,
        },
      },
      include: {
        lines: { include: { item: true, location: true, inputUom: true } },
        purchaseOrder: { include: { vendor: true } },
      },
    });

    await this.auditLog.log({
      orgId,
      branchId,
      userId,
      action: 'GOODS_RECEIPT_CREATED',
      resourceType: 'GoodsReceiptV2',
      resourceId: receipt.id,
      metadata: { purchaseOrderId: dto.purchaseOrderId, lineCount: dto.lines.length },
    });

    this.logger.log(`Created receipt ${receipt.receiptNumber} with ${processedLines.length} lines`);
    return receipt;
  }

  /**
   * Get a receipt by ID
   */
  async findById(
    orgId: string,
    branchId: string,
    receiptId: string,
    options?: { includeLines?: boolean; includePurchaseOrder?: boolean },
  ) {
    const receipt = await this.prisma.client.goodsReceiptV2.findFirst({
      where: { id: receiptId, orgId, branchId },
      include: {
        lines: options?.includeLines !== false ? {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            location: { select: { id: true, code: true, name: true } },
            inputUom: { select: { id: true, code: true, name: true } },
            poLine: true,
          },
        } : false,
        purchaseOrder: options?.includePurchaseOrder !== false ? {
          include: { vendor: true },
        } : false,
        postedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    return receipt;
  }

  /**
   * List receipts
   */
  async findMany(
    orgId: string,
    branchId: string,
    options?: ReceiptQueryOptions,
  ) {
    const where: Prisma.GoodsReceiptV2WhereInput = {
      orgId,
      branchId,
    };

    if (options?.status) {
      where.status = Array.isArray(options.status)
        ? { in: options.status }
        : options.status;
    }

    if (options?.purchaseOrderId) {
      where.purchaseOrderId = options.purchaseOrderId;
    }

    if (options?.fromDate || options?.toDate) {
      where.createdAt = {};
      if (options.fromDate) where.createdAt.gte = options.fromDate;
      if (options.toDate) where.createdAt.lte = options.toDate;
    }

    return this.prisma.client.goodsReceiptV2.findMany({
      where,
      include: {
        lines: options?.includeLines ? {
          include: { item: true, location: true },
        } : false,
        purchaseOrder: options?.includePurchaseOrder ?? true ? {
          include: { vendor: true },
        } : false,
        postedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Post a receipt (creates ledger entries, updates PO line received quantities)
   * This is IDEMPOTENT - posting the same receipt twice returns success without duplication
   */
  async post(
    orgId: string,
    branchId: string,
    receiptId: string,
    userId: string,
  ): Promise<{ receipt: any; isAlreadyPosted: boolean; ledgerEntryCount: number; costLayerCount: number }> {
    // Always get receipt with lines for posting
    const receiptWithLines = await this.prisma.client.goodsReceiptV2.findFirst({
      where: { id: receiptId, orgId, branchId },
      include: {
        lines: {
          include: {
            item: true,
            location: true,
            poLine: true,
          },
        },
        purchaseOrder: { include: { vendor: true } },
      },
    });

    if (!receiptWithLines) {
      throw new NotFoundException('Receipt not found');
    }

    // Idempotency check
    if (receiptWithLines.status === 'POSTED') {
      this.logger.log(`Receipt ${receiptWithLines.receiptNumber} already posted - idempotent return`);
      return { receipt: receiptWithLines, isAlreadyPosted: true, ledgerEntryCount: 0, costLayerCount: 0 };
    }

    if (receiptWithLines.status === 'VOID') {
      throw new BadRequestException('Cannot post a voided receipt');
    }

    // Validate over-receipt policy
    await this.validateOverReceipt(receiptWithLines);

    // Post in transaction
    let ledgerEntryCount = 0;
    let costLayerCount = 0;

    const postedReceipt = await this.prisma.client.$transaction(async (tx) => {
      // Create ledger entries for each line
      for (const line of receiptWithLines.lines) {
        await this.ledgerService.recordEntry(
          orgId,
          branchId,
          {
            itemId: line.itemId,
            locationId: line.locationId,
            qty: line.qtyReceivedBase,
            reason: LedgerEntryReason.PURCHASE,
            sourceType: LedgerSourceType.GOODS_RECEIPT,
            sourceId: receiptId,
            notes: `Receipt ${receiptWithLines.receiptNumber}`,
            createdById: userId,
          },
          { tx },
        );
        ledgerEntryCount++;

        // M11.5: Create cost layer for WAC tracking
        await this.costingService.createCostLayer(
          orgId,
          branchId,
          userId,
          {
            itemId: line.itemId,
            locationId: line.locationId,
            qtyReceived: line.qtyReceivedBase,
            unitCost: line.unitCost,
            sourceType: CostSourceType.GOODS_RECEIPT,
            sourceId: line.id, // Use receipt line ID for granular tracking
            metadata: {
              receiptId,
              receiptNumber: receiptWithLines.receiptNumber,
              poId: receiptWithLines.purchaseOrderId,
            },
          },
          { tx },
        );
        costLayerCount++;

        // M11.6: Record receipt-derived supplier price (if supplier item exists)
        if (receiptWithLines.purchaseOrder?.vendorId) {
          try {
            await this.supplierPricingService.addReceiptDerivedPrice(
              orgId,
              receiptWithLines.purchaseOrder.vendorId,
              line.itemId,
              line.unitCost,
              line.id, // receiptLineId for idempotency
              { tx },
            );
          } catch (err: any) {
            // Log but don't fail - price inference is best-effort
            this.logger.warn(`Failed to record receipt-derived price: ${err.message}`);
          }
        }

        // Update PO line received quantity if linked
        if (line.poLineId) {
          const poLine = await tx.purchaseOrderLineV2.findUnique({
            where: { id: line.poLineId },
          });
          if (poLine) {
            const newReceivedBase = new Decimal(poLine.qtyReceivedBase).plus(new Decimal(line.qtyReceivedBase));
            await tx.purchaseOrderLineV2.update({
              where: { id: line.poLineId },
              data: { qtyReceivedBase: newReceivedBase },
            });
          }
        }
      }

      // M11.13: Calculate total receipt value for GL posting
      const totalReceiptValue = receiptWithLines.lines.reduce(
        (sum, line) => sum.plus(new Decimal(line.qtyReceivedBase).times(new Decimal(line.unitCost))),
        new Decimal(0),
      );

      // M11.13: Post GL journal entry (Dr Inventory Asset, Cr GRNI)
      let glJournalEntryId: string | null = null;
      let glPostingStatus: 'PENDING' | 'POSTED' | 'FAILED' | 'SKIPPED' = 'PENDING';
      let glPostingError: string | null = null;

      try {
        const glResult = await this.glPostingService.postGoodsReceipt(
          orgId,
          branchId,
          receiptId,
          totalReceiptValue,
          userId,
          tx,
        );
        glJournalEntryId = glResult.journalEntryId;
        glPostingStatus = glResult.status;
        glPostingError = glResult.error;
      } catch (err: any) {
        // Log but don't fail receipt posting - GL is supplementary
        this.logger.warn(`GL posting failed for receipt ${receiptId}: ${err.message}`);
        glPostingStatus = 'FAILED';
        glPostingError = err.message;
      }

      // Update receipt status with GL posting info
      const updated = await tx.goodsReceiptV2.update({
        where: { id: receiptId },
        data: {
          status: 'POSTED',
          postedAt: new Date(),
          postedById: userId,
          glJournalEntryId,
          glPostingStatus,
          glPostingError,
        },
        include: {
          lines: { include: { item: true, location: true } },
          purchaseOrder: { include: { vendor: true } },
        },
      });

      // Update PO status
      await this.poService.updateReceivingStatus(receiptWithLines.purchaseOrderId, tx);

      return updated;
    });

    await this.auditLog.log({
      orgId,
      branchId,
      userId,
      action: 'GOODS_RECEIPT_POSTED',
      resourceType: 'GoodsReceiptV2',
      resourceId: receiptId,
      metadata: { ledgerEntryCount, costLayerCount },
    });

    this.logger.log(`Posted receipt ${receiptWithLines.receiptNumber}, created ${ledgerEntryCount} ledger entries, ${costLayerCount} cost layers`);
    return { receipt: postedReceipt, isAlreadyPosted: false, ledgerEntryCount, costLayerCount };
  }

  /**
   * Void a posted receipt (L4+ only)
   * Creates reversing ledger entries
   */
  async void(
    orgId: string,
    branchId: string,
    receiptId: string,
    userId: string,
    reason?: string,
  ) {
    // Always get receipt with lines for voiding
    const receiptWithLines = await this.prisma.client.goodsReceiptV2.findFirst({
      where: { id: receiptId, orgId, branchId },
      include: {
        lines: {
          include: {
            item: true,
            location: true,
            poLine: true,
          },
        },
        purchaseOrder: { include: { vendor: true } },
      },
    });

    if (!receiptWithLines) {
      throw new NotFoundException('Receipt not found');
    }

    if (receiptWithLines.status !== 'POSTED') {
      throw new BadRequestException('Can only void posted receipts');
    }

    // Void in transaction - create reversing entries
    const voidedReceipt = await this.prisma.client.$transaction(async (tx) => {
      // Create reversing ledger entries for each line
      for (const line of receiptWithLines.lines) {
        await this.ledgerService.recordEntry(
          orgId,
          branchId,
          {
            itemId: line.itemId,
            locationId: line.locationId,
            qty: new Decimal(line.qtyReceivedBase).negated(),
            reason: LedgerEntryReason.ADJUSTMENT,
            sourceType: LedgerSourceType.GOODS_RECEIPT,
            sourceId: receiptId,
            notes: `VOID: Receipt ${receiptWithLines.receiptNumber}${reason ? ` - ${reason}` : ''}`,
            createdById: userId,
          },
          { tx },
        );

        // Reverse PO line received quantity
        if (line.poLineId) {
          const poLine = await tx.purchaseOrderLineV2.findUnique({
            where: { id: line.poLineId },
          });
          if (poLine) {
            const newReceivedBase = new Decimal(poLine.qtyReceivedBase).minus(new Decimal(line.qtyReceivedBase));
            await tx.purchaseOrderLineV2.update({
              where: { id: line.poLineId },
              data: { qtyReceivedBase: Decimal.max(newReceivedBase, new Decimal(0)) },
            });
          }
        }
      }

      // Update receipt status
      const updated = await tx.goodsReceiptV2.update({
        where: { id: receiptId },
        data: { status: 'VOID' },
        include: {
          lines: { include: { item: true, location: true } },
          purchaseOrder: true,
        },
      });

      // M11.13: Create GL reversal if original receipt had GL posting
      if (receiptWithLines.glJournalEntryId) {
        try {
          await this.glPostingService.voidGoodsReceiptGl(orgId, branchId, receiptId, userId, tx);
        } catch (err: any) {
          this.logger.warn(`GL reversal failed for receipt ${receiptId}: ${err.message}`);
        }
      }

      // Update PO status
      await this.poService.updateReceivingStatus(receiptWithLines.purchaseOrderId, tx);

      return updated;
    });

    await this.auditLog.log({
      orgId,
      branchId,
      userId,
      action: 'GOODS_RECEIPT_VOIDED',
      resourceType: 'GoodsReceiptV2',
      resourceId: receiptId,
      metadata: { reason },
    });

    this.logger.log(`Voided receipt ${receiptWithLines.receiptNumber}`);
    return voidedReceipt;
  }

  /**
   * Validate over-receipt policy
   */
  private async validateOverReceipt(receipt: any) {
    const po = await this.prisma.client.purchaseOrderV2.findUnique({
      where: { id: receipt.purchaseOrderId },
      include: { lines: true },
    });

    if (!po) return;

    for (const receiptLine of receipt.lines) {
      // Find corresponding PO line
      const poLine = receiptLine.poLineId
        ? po.lines.find((l: any) => l.id === receiptLine.poLineId)
        : po.lines.find((l: any) => l.itemId === receiptLine.itemId);

      if (!poLine) continue;

      // Calculate total that would be received after this receipt
      const currentReceived = new Decimal(poLine.qtyReceivedBase);
      const thisReceipt = new Decimal(receiptLine.qtyReceivedBase);
      const totalAfterReceipt = currentReceived.plus(thisReceipt);
      const ordered = new Decimal(poLine.qtyOrderedBase);

      // Check if over-receipt
      if (totalAfterReceipt.gt(ordered) && !poLine.allowOverReceipt) {
        throw new ConflictException({
          code: 'OVER_RECEIPT_NOT_ALLOWED',
          message: `Over-receipt not allowed for item. Ordered: ${ordered}, Already received: ${currentReceived}, Trying to receive: ${thisReceipt}`,
          itemId: receiptLine.itemId,
          poLineId: poLine.id,
          qtyOrderedBase: ordered.toString(),
          qtyReceivedBase: currentReceived.toString(),
          qtyAttempting: thisReceipt.toString(),
        });
      }
    }
  }
}
