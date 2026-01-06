import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';

const Decimal = Prisma.Decimal;
import { InventoryLedgerService, LedgerEntryReason, LedgerSourceType } from './inventory-ledger.service';

export enum AdjustmentReason {
  DAMAGED = 'DAMAGED',
  EXPIRED = 'EXPIRED',
  THEFT = 'THEFT',
  FOUND = 'FOUND',
  CORRECTION = 'CORRECTION',
  TRANSFER = 'TRANSFER',
  OTHER = 'OTHER',
}

export enum AdjustmentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface CreateAdjustmentDto {
  itemId: string;
  locationId: string;
  qty: number | string;
  reason: AdjustmentReason | string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class InventoryAdjustmentsService {
  private readonly logger = new Logger(InventoryAdjustmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: InventoryLedgerService,
  ) { }

  /**
   * Create a stock adjustment
   * For negative adjustments, validates that sufficient stock exists (unless org allows negative)
   */
  async createAdjustment(
    orgId: string,
    branchId: string,
    userId: string,
    dto: CreateAdjustmentDto,
    options?: { autoApprove?: boolean; allowNegative?: boolean },
  ) {
    const qty = new Decimal(dto.qty);

    this.logger.log(
      `Creating adjustment: item=${dto.itemId}, location=${dto.locationId}, qty=${qty}, reason=${dto.reason}`,
    );

    // Verify item exists
    const item = await this.prisma.client.inventoryItem.findFirst({
      where: { id: dto.itemId, orgId },
    });

    if (!item) {
      throw new BadRequestException('Inventory item not found');
    }

    // Verify location exists
    const location = await this.prisma.client.inventoryLocation.findFirst({
      where: { id: dto.locationId, branchId },
    });

    if (!location) {
      throw new BadRequestException('Inventory location not found');
    }

    // Check stock levels for negative adjustments
    if (qty.lessThan(0) && !options?.allowNegative) {
      const currentOnHand = await this.ledgerService.getOnHand(dto.itemId, dto.locationId, branchId);
      if (currentOnHand.plus(qty).lessThan(0)) {
        throw new BadRequestException(
          `Insufficient stock: current on-hand is ${currentOnHand}, cannot adjust by ${qty}`,
        );
      }
    }

    // Create adjustment record
    const adjustment = await this.prisma.client.stockAdjustment.create({
      data: {
        orgId,
        branchId,
        itemId: dto.itemId,
        locationId: dto.locationId,
        qty,
        reason: dto.reason,
        notes: dto.notes,
        createdById: userId,
        status: options?.autoApprove ? AdjustmentStatus.APPROVED : AdjustmentStatus.PENDING,
        approvedById: options?.autoApprove ? userId : undefined,
        approvedAt: options?.autoApprove ? new Date() : undefined,
        metadata: dto.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
      },
      include: {
        item: { select: { id: true, name: true, sku: true } },
        location: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // If auto-approved, create ledger entry
    if (options?.autoApprove) {
      await this.ledgerService.recordEntry(orgId, branchId, {
        itemId: dto.itemId,
        locationId: dto.locationId,
        qty,
        reason: LedgerEntryReason.ADJUSTMENT,
        sourceType: LedgerSourceType.STOCK_ADJUSTMENT,
        sourceId: adjustment.id,
        notes: dto.notes,
        createdById: userId,
      }, { allowNegative: options?.allowNegative });

      this.logger.log(`Adjustment ${adjustment.id} auto-approved and applied`);
    }

    return adjustment;
  }

  /**
   * Approve a pending adjustment
   */
  async approveAdjustment(
    orgId: string,
    branchId: string,
    adjustmentId: string,
    approverId: string,
    options?: { allowNegative?: boolean },
  ) {
    const adjustment = await this.prisma.client.stockAdjustment.findFirst({
      where: { id: adjustmentId, orgId, branchId },
    });

    if (!adjustment) {
      throw new BadRequestException('Adjustment not found');
    }

    if (adjustment.status !== AdjustmentStatus.PENDING) {
      throw new BadRequestException(`Cannot approve adjustment with status ${adjustment.status}`);
    }

    // Cannot approve own adjustment (unless org allows)
    if (adjustment.createdById === approverId) {
      // For now, allow self-approval with warning
      this.logger.warn(`User ${approverId} approving their own adjustment ${adjustmentId}`);
    }

    // Check stock levels for negative adjustments
    if (adjustment.qty.lessThan(0) && !options?.allowNegative) {
      const currentOnHand = await this.ledgerService.getOnHand(
        adjustment.itemId,
        adjustment.locationId,
        branchId,
      );
      if (currentOnHand.plus(adjustment.qty).lessThan(0)) {
        throw new BadRequestException(
          `Insufficient stock: current on-hand is ${currentOnHand}, cannot adjust by ${adjustment.qty}`,
        );
      }
    }

    // Use transaction to ensure atomicity
    return this.prisma.client.$transaction(async (tx) => {
      // Update adjustment status
      const approved = await tx.stockAdjustment.update({
        where: { id: adjustmentId },
        data: {
          status: AdjustmentStatus.APPROVED,
          approvedById: approverId,
          approvedAt: new Date(),
        },
        include: {
          item: { select: { id: true, name: true, sku: true } },
          location: { select: { id: true, code: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Create ledger entry
      await this.ledgerService.recordEntry(
        orgId,
        branchId,
        {
          itemId: adjustment.itemId,
          locationId: adjustment.locationId,
          qty: adjustment.qty,
          reason: LedgerEntryReason.ADJUSTMENT,
          sourceType: LedgerSourceType.STOCK_ADJUSTMENT,
          sourceId: adjustmentId,
          notes: adjustment.notes ?? undefined,
          createdById: approverId,
        },
        { allowNegative: options?.allowNegative, tx },
      );

      this.logger.log(`Adjustment ${adjustmentId} approved by ${approverId} and applied`);

      return approved;
    });
  }

  /**
   * Reject a pending adjustment
   */
  async rejectAdjustment(
    orgId: string,
    branchId: string,
    adjustmentId: string,
    rejecterId: string,
    reason?: string,
  ) {
    const adjustment = await this.prisma.client.stockAdjustment.findFirst({
      where: { id: adjustmentId, orgId, branchId },
    });

    if (!adjustment) {
      throw new BadRequestException('Adjustment not found');
    }

    if (adjustment.status !== AdjustmentStatus.PENDING) {
      throw new BadRequestException(`Cannot reject adjustment with status ${adjustment.status}`);
    }

    const rejected = await this.prisma.client.stockAdjustment.update({
      where: { id: adjustmentId },
      data: {
        status: AdjustmentStatus.REJECTED,
        metadata: {
          ...(adjustment.metadata as object ?? {}),
          rejectedById: rejecterId,
          rejectedAt: new Date().toISOString(),
          rejectionReason: reason,
        },
      },
      include: {
        item: { select: { id: true, name: true, sku: true } },
        location: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    this.logger.log(`Adjustment ${adjustmentId} rejected by ${rejecterId}`);

    return rejected;
  }

  /**
   * List adjustments
   */
  async listAdjustments(
    orgId: string,
    branchId: string,
    filters: {
      itemId?: string;
      locationId?: string;
      status?: AdjustmentStatus | string;
      reason?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: any = { orgId, branchId };

    if (filters.itemId) where.itemId = filters.itemId;
    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.status) where.status = filters.status;
    if (filters.reason) where.reason = filters.reason;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [adjustments, total] = await Promise.all([
      this.prisma.client.stockAdjustment.findMany({
        where,
        include: {
          item: { select: { id: true, name: true, sku: true } },
          location: { select: { id: true, code: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 100,
        skip: filters.offset ?? 0,
      }),
      this.prisma.client.stockAdjustment.count({ where }),
    ]);

    return { adjustments, total };
  }

  /**
   * Get adjustment by ID
   */
  async getAdjustment(orgId: string, branchId: string, adjustmentId: string) {
    const adjustment = await this.prisma.client.stockAdjustment.findFirst({
      where: { id: adjustmentId, orgId, branchId },
      include: {
        item: { select: { id: true, name: true, sku: true, unit: true } },
        location: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!adjustment) {
      throw new BadRequestException('Adjustment not found');
    }

    return adjustment;
  }
}
