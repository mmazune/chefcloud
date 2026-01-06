/**
 * M11.2 Purchase Orders Service
 * 
 * Enterprise purchase order management with:
 * - State machine workflow (DRAFT → SUBMITTED → APPROVED → RECEIVED)
 * - Vendor integration (reuses accounting Vendor model)
 * - Base UOM conversion on lines
 * - Over-receipt policy per line
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { InventoryUomService } from './inventory-uom.service';
import { Prisma, PurchaseOrderStatus } from '@chefcloud/db';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export interface CreatePurchaseOrderDto {
  vendorId: string;
  expectedAt?: Date;
  notes?: string;
  idempotencyKey?: string;
  lines: CreatePurchaseOrderLineDto[];
}

export interface CreatePurchaseOrderLineDto {
  itemId: string;
  qtyOrderedInput: number | string;
  inputUomId: string;
  unitCost: number | string;
  allowOverReceipt?: boolean;
  notes?: string;
}

export interface UpdatePurchaseOrderDto {
  expectedAt?: Date;
  notes?: string;
  lines?: CreatePurchaseOrderLineDto[];
}

export interface PurchaseOrderQueryOptions {
  status?: PurchaseOrderStatus | PurchaseOrderStatus[];
  vendorId?: string;
  fromDate?: Date;
  toDate?: Date;
  includeLines?: boolean;
  includeVendor?: boolean;
}

// Valid state transitions
const STATE_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: [],
};

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly uomService: InventoryUomService,
  ) { }

  /**
   * Generate a unique PO number
   */
  private async generatePoNumber(orgId: string, branchId: string): Promise<string> {
    const count = await this.prisma.client.purchaseOrderV2.count({
      where: { orgId },
    });
    const date = new Date();
    const yy = date.getFullYear().toString().slice(-2);
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    return `PO-${yy}${mm}-${(count + 1).toString().padStart(5, '0')}`;
  }

  /**
   * Create a new purchase order
   */
  async create(
    orgId: string,
    branchId: string,
    userId: string,
    dto: CreatePurchaseOrderDto,
  ) {
    this.logger.log(`Creating PO for org=${orgId}, branch=${branchId}, vendor=${dto.vendorId}`);

    // Check idempotency
    if (dto.idempotencyKey) {
      const existing = await this.prisma.client.purchaseOrderV2.findUnique({
        where: { orgId_idempotencyKey: { orgId, idempotencyKey: dto.idempotencyKey } },
        include: { lines: true, vendor: true },
      });
      if (existing) {
        this.logger.log(`Idempotent return for PO ${existing.id}`);
        return { ...existing, isIdempotent: true };
      }
    }

    // Verify vendor exists and belongs to org
    const vendor = await this.prisma.client.vendor.findFirst({
      where: { id: dto.vendorId, orgId },
    });
    if (!vendor) {
      throw new BadRequestException('Vendor not found');
    }

    // Validate lines exist
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('At least one line is required');
    }

    // Process lines with UOM conversion
    const processedLines: {
      itemId: string;
      qtyOrderedInput: Decimal;
      inputUomId: string;
      qtyOrderedBase: Decimal;
      unitCost: Decimal;
      allowOverReceipt: boolean;
      notes?: string;
    }[] = [];

    let totalAmount = new Decimal(0);

    for (const line of dto.lines) {
      // Get item and verify it exists
      const item = await this.prisma.client.inventoryItem.findFirst({
        where: { id: line.itemId, orgId },
        include: { uom: true },
      });
      if (!item) {
        throw new BadRequestException(`Item ${line.itemId} not found`);
      }

      // Verify input UOM exists
      const inputUom = await this.prisma.client.unitOfMeasure.findFirst({
        where: { id: line.inputUomId, orgId },
      });
      if (!inputUom) {
        throw new BadRequestException(`UOM ${line.inputUomId} not found`);
      }

      // Convert to base UOM
      const qtyInput = new Decimal(line.qtyOrderedInput);
      let qtyBase: Decimal;

      if (!item.uomId || item.uomId === line.inputUomId) {
        // Same UOM, no conversion needed
        qtyBase = qtyInput;
      } else {
        // Need conversion
        try {
          qtyBase = await this.uomService.convert(orgId, line.inputUomId, item.uomId, qtyInput.toString());
        } catch {
          throw new BadRequestException({
            code: 'MISSING_CONVERSION',
            message: `No conversion found from ${inputUom.code} to item base UOM`,
            itemId: item.id,
            fromUom: line.inputUomId,
            toUom: item.uomId,
          });
        }
      }

      // Validate unit cost
      const unitCost = new Decimal(line.unitCost);
      if (unitCost.lessThan(0)) {
        throw new BadRequestException('Unit cost must be >= 0');
      }

      const lineTotal = qtyInput.times(unitCost);
      totalAmount = totalAmount.plus(lineTotal);

      processedLines.push({
        itemId: line.itemId,
        qtyOrderedInput: qtyInput,
        inputUomId: line.inputUomId,
        qtyOrderedBase: qtyBase,
        unitCost,
        allowOverReceipt: line.allowOverReceipt ?? false,
        notes: line.notes,
      });
    }

    // Create PO with lines in transaction
    const poNumber = await this.generatePoNumber(orgId, branchId);

    const po = await this.prisma.client.purchaseOrderV2.create({
      data: {
        orgId,
        branchId,
        vendorId: dto.vendorId,
        poNumber,
        status: 'DRAFT',
        expectedAt: dto.expectedAt,
        notes: dto.notes,
        totalAmount,
        createdById: userId,
        idempotencyKey: dto.idempotencyKey,
        lines: {
          create: processedLines,
        },
      },
      include: {
        lines: { include: { item: true, inputUom: true } },
        vendor: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Audit log
    await this.auditLog.log({
      orgId,
      branchId,
      userId,
      action: 'PURCHASE_ORDER_CREATED',
      resourceType: 'PurchaseOrderV2',
      resourceId: po.id,
      metadata: { vendorId: dto.vendorId, lineCount: dto.lines.length, totalAmount: totalAmount.toString() },
    });

    this.logger.log(`Created PO ${po.poNumber} with ${processedLines.length} lines`);
    return po;
  }

  /**
   * Get a purchase order by ID
   */
  async findById(
    orgId: string,
    branchId: string,
    poId: string,
    options?: { includeLines?: boolean; includeVendor?: boolean },
  ) {
    const po = await this.prisma.client.purchaseOrderV2.findFirst({
      where: { id: poId, orgId, branchId },
      include: {
        lines: options?.includeLines !== false ? {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            inputUom: { select: { id: true, code: true, name: true } },
          },
        } : false,
        vendor: options?.includeVendor !== false,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!po) {
      throw new NotFoundException('Purchase order not found');
    }

    return po;
  }

  /**
   * List purchase orders
   */
  async findMany(
    orgId: string,
    branchId: string,
    options?: PurchaseOrderQueryOptions,
  ) {
    const where: Prisma.PurchaseOrderV2WhereInput = {
      orgId,
      branchId,
    };

    if (options?.status) {
      where.status = Array.isArray(options.status)
        ? { in: options.status }
        : options.status;
    }

    if (options?.vendorId) {
      where.vendorId = options.vendorId;
    }

    if (options?.fromDate || options?.toDate) {
      where.createdAt = {};
      if (options.fromDate) where.createdAt.gte = options.fromDate;
      if (options.toDate) where.createdAt.lte = options.toDate;
    }

    return this.prisma.client.purchaseOrderV2.findMany({
      where,
      include: {
        lines: options?.includeLines ? {
          include: { item: true, inputUom: true },
        } : false,
        vendor: options?.includeVendor ?? true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update a purchase order (only if DRAFT or SUBMITTED)
   */
  async update(
    orgId: string,
    branchId: string,
    poId: string,
    userId: string,
    dto: UpdatePurchaseOrderDto,
  ) {
    const po = await this.findById(orgId, branchId, poId);

    if (!['DRAFT', 'SUBMITTED'].includes(po.status)) {
      throw new BadRequestException(`Cannot update PO in ${po.status} status`);
    }

    const updateData: Prisma.PurchaseOrderV2UpdateInput = {};
    const changedFields: string[] = [];

    if (dto.expectedAt !== undefined) {
      updateData.expectedAt = dto.expectedAt;
      changedFields.push('expectedAt');
    }

    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
      changedFields.push('notes');
    }

    // Handle lines update if provided
    if (dto.lines) {
      // Delete existing lines and recreate
      await this.prisma.client.purchaseOrderLineV2.deleteMany({
        where: { purchaseOrderId: poId },
      });

      const processedLines: Prisma.PurchaseOrderLineV2CreateManyInput[] = [];
      let totalAmount = new Decimal(0);

      for (const line of dto.lines) {
        const item = await this.prisma.client.inventoryItem.findFirst({
          where: { id: line.itemId, orgId },
        });
        if (!item) {
          throw new BadRequestException(`Item ${line.itemId} not found`);
        }

        const qtyInput = new Decimal(line.qtyOrderedInput);
        let qtyBase: Decimal;

        if (!item.uomId || item.uomId === line.inputUomId) {
          qtyBase = qtyInput;
        } else {
          try {
            qtyBase = await this.uomService.convert(orgId, line.inputUomId, item.uomId, qtyInput.toString());
          } catch {
            throw new BadRequestException({
              code: 'MISSING_CONVERSION',
              message: 'No conversion found',
              itemId: item.id,
            });
          }
        }

        const unitCost = new Decimal(line.unitCost);
        totalAmount = totalAmount.plus(qtyInput.times(unitCost));

        processedLines.push({
          purchaseOrderId: poId,
          itemId: line.itemId,
          qtyOrderedInput: qtyInput,
          inputUomId: line.inputUomId,
          qtyOrderedBase: qtyBase,
          unitCost,
          allowOverReceipt: line.allowOverReceipt ?? false,
          notes: line.notes,
        });
      }

      await this.prisma.client.purchaseOrderLineV2.createMany({
        data: processedLines,
      });

      updateData.totalAmount = totalAmount;
      changedFields.push('lines');
    }

    const updated = await this.prisma.client.purchaseOrderV2.update({
      where: { id: poId },
      data: updateData,
      include: {
        lines: { include: { item: true, inputUom: true } },
        vendor: true,
      },
    });

    await this.auditLog.log({
      orgId,
      branchId,
      userId,
      action: 'PURCHASE_ORDER_UPDATED',
      resourceType: 'PurchaseOrderV2',
      resourceId: poId,
      metadata: { changedFields },
    });

    return updated;
  }

  /**
   * Submit a purchase order for approval
   */
  async submit(orgId: string, branchId: string, poId: string, userId: string) {
    const po = await this.findById(orgId, branchId, poId);
    this.validateTransition(po.status as PurchaseOrderStatus, 'SUBMITTED');

    const updated = await this.prisma.client.purchaseOrderV2.update({
      where: { id: poId },
      data: { status: 'SUBMITTED' },
      include: { lines: true, vendor: true },
    });

    await this.auditLog.log({
      orgId,
      branchId,
      userId,
      action: 'PURCHASE_ORDER_SUBMITTED',
      resourceType: 'PurchaseOrderV2',
      resourceId: poId,
      metadata: {},
    });

    this.logger.log(`PO ${po.poNumber} submitted`);
    return updated;
  }

  /**
   * Approve a purchase order (L4+ only)
   */
  async approve(orgId: string, branchId: string, poId: string, userId: string) {
    const po = await this.findById(orgId, branchId, poId);
    this.validateTransition(po.status as PurchaseOrderStatus, 'APPROVED');

    const updated = await this.prisma.client.purchaseOrderV2.update({
      where: { id: poId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
      },
      include: { lines: true, vendor: true },
    });

    await this.auditLog.log({
      orgId,
      branchId,
      userId,
      action: 'PURCHASE_ORDER_APPROVED',
      resourceType: 'PurchaseOrderV2',
      resourceId: poId,
      metadata: { approvedById: userId },
    });

    this.logger.log(`PO ${po.poNumber} approved by ${userId}`);
    return updated;
  }

  /**
   * Cancel a purchase order (L4+ only)
   */
  async cancel(orgId: string, branchId: string, poId: string, userId: string, reason?: string) {
    const po = await this.findById(orgId, branchId, poId);
    this.validateTransition(po.status as PurchaseOrderStatus, 'CANCELLED');

    const updated = await this.prisma.client.purchaseOrderV2.update({
      where: { id: poId },
      data: { status: 'CANCELLED' },
      include: { lines: true, vendor: true },
    });

    await this.auditLog.log({
      orgId,
      branchId,
      userId,
      action: 'PURCHASE_ORDER_CANCELLED',
      resourceType: 'PurchaseOrderV2',
      resourceId: poId,
      metadata: { reason },
    });

    this.logger.log(`PO ${po.poNumber} cancelled`);
    return updated;
  }

  /**
   * Update PO status when receiving (called by receipts service)
   */
  async updateReceivingStatus(poId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma.client;

    const po = await client.purchaseOrderV2.findUnique({
      where: { id: poId },
      include: { lines: true },
    });

    if (!po) return;

    // Check if all lines are fully received
    const allReceived = po.lines.every(
      line => new Decimal(line.qtyReceivedBase).gte(new Decimal(line.qtyOrderedBase)),
    );

    const someReceived = po.lines.some(
      line => new Decimal(line.qtyReceivedBase).gt(0),
    );

    let newStatus: PurchaseOrderStatus = po.status;
    if (allReceived) {
      newStatus = 'RECEIVED';
    } else if (someReceived && po.status === 'APPROVED') {
      newStatus = 'PARTIALLY_RECEIVED';
    }

    if (newStatus !== po.status) {
      await client.purchaseOrderV2.update({
        where: { id: poId },
        data: { status: newStatus },
      });
      this.logger.log(`PO ${po.poNumber} status updated to ${newStatus}`);
    }
  }

  /**
   * Validate state transition
   */
  private validateTransition(currentStatus: PurchaseOrderStatus, targetStatus: PurchaseOrderStatus) {
    const allowed = STATE_TRANSITIONS[currentStatus];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(`Cannot transition from ${currentStatus} to ${targetStatus}`);
    }
  }
}
