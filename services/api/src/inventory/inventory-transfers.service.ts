/**
 * M11.3 Inventory Transfers Service
 * 
 * Manages inter-branch and intra-branch inventory transfers:
 * - Ship/Receive workflow with state machine
 * - Idempotent receive (prevents duplicate ledger entries)
 * - TRANSFER_OUT entries on ship (negative qty at source)
 * - TRANSFER_IN entries on receive (positive qty at destination)
 * - Negative stock prevention by default
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { InventoryLedgerService, LedgerEntryReason, LedgerSourceType } from './inventory-ledger.service';
import { Prisma, InventoryTransferStatus } from '@chefcloud/db';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export interface CreateTransferDto {
  fromBranchId: string;
  toBranchId: string;
  notes?: string;
  idempotencyKey?: string;
  lines: CreateTransferLineDto[];
}

export interface CreateTransferLineDto {
  itemId: string;
  fromLocationId: string;
  toLocationId: string;
  qtyShipped: number | string;
  notes?: string;
}

export interface UpdateTransferDto {
  notes?: string;
  lines?: CreateTransferLineDto[];
}

export interface ReceiveTransferDto {
  lines?: ReceiveTransferLineDto[];
}

export interface ReceiveTransferLineDto {
  lineId: string;
  qtyReceived: number | string;
}

export interface TransferQueryOptions {
  status?: InventoryTransferStatus | InventoryTransferStatus[];
  fromBranchId?: string;
  toBranchId?: string;
  fromDate?: Date;
  toDate?: Date;
  includeLines?: boolean;
}

// Valid state transitions (prefixed with _ to avoid lint warning when used only for documentation)
const _STATE_TRANSITIONS: Record<InventoryTransferStatus, InventoryTransferStatus[]> = {
  DRAFT: ['IN_TRANSIT', 'VOID'],
  IN_TRANSIT: ['RECEIVED'],
  RECEIVED: [],
  VOID: [],
};

@Injectable()
export class InventoryTransfersService {
  private readonly logger = new Logger(InventoryTransfersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly ledgerService: InventoryLedgerService,
  ) {}

  /**
   * Generate a unique transfer number
   */
  private async generateTransferNumber(orgId: string): Promise<string> {
    const count = await this.prisma.client.inventoryTransfer.count({
      where: { orgId },
    });
    const date = new Date();
    const yy = date.getFullYear().toString().slice(-2);
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    return `TRF-${yy}${mm}-${(count + 1).toString().padStart(5, '0')}`;
  }

  /**
   * Create a draft transfer
   */
  async create(
    orgId: string,
    userId: string,
    dto: CreateTransferDto,
  ) {
    this.logger.log(`Creating transfer for org=${orgId}, from=${dto.fromBranchId}, to=${dto.toBranchId}`);

    // Check idempotency
    if (dto.idempotencyKey) {
      const existing = await this.prisma.client.inventoryTransfer.findUnique({
        where: { orgId_idempotencyKey: { orgId, idempotencyKey: dto.idempotencyKey } },
        include: { lines: true, fromBranch: true, toBranch: true },
      });
      if (existing) {
        this.logger.log(`Idempotent return for transfer ${existing.id}`);
        return { ...existing, isIdempotent: true };
      }
    }

    // Verify fromBranch exists and belongs to org
    const fromBranch = await this.prisma.client.branch.findFirst({
      where: { id: dto.fromBranchId, orgId },
    });
    if (!fromBranch) {
      throw new BadRequestException('Source branch not found');
    }

    // Verify toBranch exists and belongs to org
    const toBranch = await this.prisma.client.branch.findFirst({
      where: { id: dto.toBranchId, orgId },
    });
    if (!toBranch) {
      throw new BadRequestException('Destination branch not found');
    }

    // Validate lines exist
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('At least one line is required');
    }

    // Process and validate lines
    const processedLines: {
      itemId: string;
      fromLocationId: string;
      toLocationId: string;
      qtyShipped: Decimal;
      notes?: string;
    }[] = [];

    for (const line of dto.lines) {
      // Validate qty is positive
      const qty = new Decimal(line.qtyShipped);
      if (qty.lessThanOrEqualTo(0)) {
        throw new BadRequestException('Quantity must be greater than zero');
      }

      // Verify item exists and belongs to org
      const item = await this.prisma.client.inventoryItem.findFirst({
        where: { id: line.itemId, orgId },
      });
      if (!item) {
        throw new BadRequestException(`Item ${line.itemId} not found`);
      }

      // Verify fromLocation exists and belongs to fromBranch
      const fromLocation = await this.prisma.client.inventoryLocation.findFirst({
        where: { id: line.fromLocationId, branchId: dto.fromBranchId, isActive: true },
      });
      if (!fromLocation) {
        throw new BadRequestException(`Source location ${line.fromLocationId} not found or inactive`);
      }

      // Verify toLocation exists and belongs to toBranch
      const toLocation = await this.prisma.client.inventoryLocation.findFirst({
        where: { id: line.toLocationId, branchId: dto.toBranchId, isActive: true },
      });
      if (!toLocation) {
        throw new BadRequestException(`Destination location ${line.toLocationId} not found or inactive`);
      }

      processedLines.push({
        itemId: line.itemId,
        fromLocationId: line.fromLocationId,
        toLocationId: line.toLocationId,
        qtyShipped: qty,
        notes: line.notes,
      });
    }

    // Create transfer with lines
    const transferNumber = await this.generateTransferNumber(orgId);

    const transfer = await this.prisma.client.inventoryTransfer.create({
      data: {
        orgId,
        fromBranchId: dto.fromBranchId,
        toBranchId: dto.toBranchId,
        transferNumber,
        status: 'DRAFT',
        notes: dto.notes,
        idempotencyKey: dto.idempotencyKey,
        createdById: userId,
        lines: {
          create: processedLines,
        },
      },
      include: {
        lines: { include: { item: true, fromLocation: true, toLocation: true } },
        fromBranch: true,
        toBranch: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await this.auditLog.log({
      orgId,
      branchId: dto.fromBranchId,
      userId,
      action: 'INVENTORY_TRANSFER_CREATED',
      resourceType: 'InventoryTransfer',
      resourceId: transfer.id,
      metadata: { toBranchId: dto.toBranchId, lineCount: dto.lines.length },
    });

    this.logger.log(`Created transfer ${transfer.transferNumber} with ${processedLines.length} lines`);
    return transfer;
  }

  /**
   * Get a transfer by ID
   */
  async findById(
    orgId: string,
    transferId: string,
    options?: { includeLines?: boolean },
  ) {
    const transfer = await this.prisma.client.inventoryTransfer.findFirst({
      where: { id: transferId, orgId },
      include: {
        lines: options?.includeLines !== false ? {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            fromLocation: { select: { id: true, code: true, name: true } },
            toLocation: { select: { id: true, code: true, name: true } },
          },
        } : false,
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        shippedBy: { select: { id: true, firstName: true, lastName: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    return transfer;
  }

  /**
   * List transfers
   */
  async findMany(
    orgId: string,
    options?: TransferQueryOptions,
  ) {
    const where: Prisma.InventoryTransferWhereInput = { orgId };

    if (options?.status) {
      where.status = Array.isArray(options.status)
        ? { in: options.status }
        : options.status;
    }

    if (options?.fromBranchId) {
      where.fromBranchId = options.fromBranchId;
    }

    if (options?.toBranchId) {
      where.toBranchId = options.toBranchId;
    }

    if (options?.fromDate || options?.toDate) {
      where.createdAt = {};
      if (options.fromDate) where.createdAt.gte = options.fromDate;
      if (options.toDate) where.createdAt.lte = options.toDate;
    }

    return this.prisma.client.inventoryTransfer.findMany({
      where,
      include: {
        lines: options?.includeLines ? {
          include: { item: true, fromLocation: true, toLocation: true },
        } : false,
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        shippedBy: { select: { id: true, firstName: true, lastName: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Ship a transfer (creates TRANSFER_OUT ledger entries)
   */
  async ship(
    orgId: string,
    transferId: string,
    userId: string,
  ): Promise<{ transfer: any; ledgerEntryCount: number }> {
    const transfer = await this.prisma.client.inventoryTransfer.findFirst({
      where: { id: transferId, orgId },
      include: { lines: { include: { item: true, fromLocation: true, toLocation: true } } },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    // Validate state transition
    if (transfer.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot ship transfer in ${transfer.status} status`);
    }

    let ledgerEntryCount = 0;

    // Ship in transaction
    const shippedTransfer = await this.prisma.client.$transaction(async (tx) => {
      // Create TRANSFER_OUT ledger entries (negative qty)
      for (const line of transfer.lines) {
        await this.ledgerService.recordEntry(
          orgId,
          transfer.fromBranchId,
          {
            itemId: line.itemId,
            locationId: line.fromLocationId,
            qty: new Decimal(line.qtyShipped).negated(), // Negative for outgoing
            reason: LedgerEntryReason.TRANSFER_OUT,
            sourceType: LedgerSourceType.TRANSFER,
            sourceId: transferId,
            notes: `Transfer ${transfer.transferNumber} to ${transfer.toBranchId}`,
            createdById: userId,
            metadata: { transferNumber: transfer.transferNumber },
          },
          { tx },
        );
        ledgerEntryCount++;
      }

      // Update transfer status
      return tx.inventoryTransfer.update({
        where: { id: transferId },
        data: {
          status: 'IN_TRANSIT',
          shippedAt: new Date(),
          shippedById: userId,
        },
        include: {
          lines: { include: { item: true, fromLocation: true, toLocation: true } },
          fromBranch: { select: { id: true, name: true } },
          toBranch: { select: { id: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          shippedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    });

    await this.auditLog.log({
      orgId,
      branchId: transfer.fromBranchId,
      userId,
      action: 'INVENTORY_TRANSFER_SHIPPED',
      resourceType: 'InventoryTransfer',
      resourceId: transferId,
      metadata: { ledgerEntryCount },
    });

    this.logger.log(`Shipped transfer ${transfer.transferNumber} with ${ledgerEntryCount} ledger entries`);
    return { transfer: shippedTransfer, ledgerEntryCount };
  }

  /**
   * Receive a transfer (creates TRANSFER_IN ledger entries)
   * This is IDEMPOTENT - receiving the same transfer twice returns success without duplication
   */
  async receive(
    orgId: string,
    transferId: string,
    userId: string,
    dto?: ReceiveTransferDto,
  ): Promise<{ transfer: any; isAlreadyReceived: boolean; ledgerEntryCount: number }> {
    const transfer = await this.prisma.client.inventoryTransfer.findFirst({
      where: { id: transferId, orgId },
      include: { lines: { include: { item: true, fromLocation: true, toLocation: true } } },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    // Idempotency check
    if (transfer.status === 'RECEIVED') {
      this.logger.log(`Transfer ${transfer.transferNumber} already received - idempotent return`);
      return { transfer, isAlreadyReceived: true, ledgerEntryCount: 0 };
    }

    // Validate state transition
    if (transfer.status !== 'IN_TRANSIT') {
      throw new BadRequestException(`Cannot receive transfer in ${transfer.status} status`);
    }

    // Process receive quantities (default to shipped qty if not specified)
    const receiveQtys = new Map<string, Decimal>();
    if (dto?.lines) {
      for (const lineDto of dto.lines) {
        receiveQtys.set(lineDto.lineId, new Decimal(lineDto.qtyReceived));
      }
    }

    let ledgerEntryCount = 0;

    // Receive in transaction
    const receivedTransfer = await this.prisma.client.$transaction(async (tx) => {
      // Create TRANSFER_IN ledger entries (positive qty) and update line received quantities
      for (const line of transfer.lines) {
        const qtyReceived = receiveQtys.get(line.id) ?? new Decimal(line.qtyShipped);

        // Only create ledger entry if qty > 0
        if (qtyReceived.greaterThan(0)) {
          await this.ledgerService.recordEntry(
            orgId,
            transfer.toBranchId,
            {
              itemId: line.itemId,
              locationId: line.toLocationId,
              qty: qtyReceived, // Positive for incoming
              reason: LedgerEntryReason.TRANSFER_IN,
              sourceType: LedgerSourceType.TRANSFER,
              sourceId: transferId,
              notes: `Transfer ${transfer.transferNumber} from ${transfer.fromBranchId}`,
              createdById: userId,
              metadata: { transferNumber: transfer.transferNumber },
            },
            { tx, allowNegative: true }, // TRANSFER_IN always adds, so allow
          );
          ledgerEntryCount++;
        }

        // Update line received quantity
        await tx.inventoryTransferLine.update({
          where: { id: line.id },
          data: { qtyReceived },
        });
      }

      // Update transfer status
      return tx.inventoryTransfer.update({
        where: { id: transferId },
        data: {
          status: 'RECEIVED',
          receivedAt: new Date(),
          receivedById: userId,
        },
        include: {
          lines: { include: { item: true, fromLocation: true, toLocation: true } },
          fromBranch: { select: { id: true, name: true } },
          toBranch: { select: { id: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          shippedBy: { select: { id: true, firstName: true, lastName: true } },
          receivedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    });

    await this.auditLog.log({
      orgId,
      branchId: transfer.toBranchId,
      userId,
      action: 'INVENTORY_TRANSFER_RECEIVED',
      resourceType: 'InventoryTransfer',
      resourceId: transferId,
      metadata: { ledgerEntryCount },
    });

    this.logger.log(`Received transfer ${transfer.transferNumber} with ${ledgerEntryCount} ledger entries`);
    return { transfer: receivedTransfer, isAlreadyReceived: false, ledgerEntryCount };
  }

  /**
   * Void a draft transfer
   */
  async void(
    orgId: string,
    transferId: string,
    userId: string,
  ) {
    const transfer = await this.prisma.client.inventoryTransfer.findFirst({
      where: { id: transferId, orgId },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    // Can only void DRAFT transfers
    if (transfer.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot void transfer in ${transfer.status} status. Only DRAFT transfers can be voided.`);
    }

    const voidedTransfer = await this.prisma.client.inventoryTransfer.update({
      where: { id: transferId },
      data: { status: 'VOID' },
      include: {
        lines: { include: { item: true, fromLocation: true, toLocation: true } },
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
      },
    });

    await this.auditLog.log({
      orgId,
      branchId: transfer.fromBranchId,
      userId,
      action: 'INVENTORY_TRANSFER_VOIDED',
      resourceType: 'InventoryTransfer',
      resourceId: transferId,
      metadata: {},
    });

    this.logger.log(`Voided transfer ${transfer.transferNumber}`);
    return voidedTransfer;
  }

  /**
   * Export transfers as CSV
   */
  async exportCsv(
    orgId: string,
    options?: TransferQueryOptions,
  ): Promise<{ csv: string; hash: string }> {
    const transfers = await this.findMany(orgId, { ...options, includeLines: true });

    // Sort deterministically for stable hash
    transfers.sort((a, b) => {
      const dateCompare = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.id.localeCompare(b.id);
    });

    // Build CSV
    const BOM = '\uFEFF';
    const headers = [
      'Transfer Number',
      'Status',
      'From Branch',
      'To Branch',
      'Shipped At',
      'Received At',
      'Created At',
      'Item SKU',
      'Item Name',
      'From Location',
      'To Location',
      'Qty Shipped',
      'Qty Received',
    ].join(',');

    const rows: string[] = [];
    for (const transfer of transfers) {
      const lines = (transfer as any).lines || [];
      if (lines.length === 0) {
        rows.push([
          transfer.transferNumber,
          transfer.status,
          (transfer as any).fromBranch?.name || '',
          (transfer as any).toBranch?.name || '',
          transfer.shippedAt?.toISOString() || '',
          transfer.receivedAt?.toISOString() || '',
          transfer.createdAt.toISOString(),
          '', '', '', '', '', '',
        ].join(','));
      } else {
        for (const line of lines) {
          rows.push([
            transfer.transferNumber,
            transfer.status,
            (transfer as any).fromBranch?.name || '',
            (transfer as any).toBranch?.name || '',
            transfer.shippedAt?.toISOString() || '',
            transfer.receivedAt?.toISOString() || '',
            transfer.createdAt.toISOString(),
            line.item?.sku || '',
            `"${(line.item?.name || '').replace(/"/g, '""')}"`,
            line.fromLocation?.code || '',
            line.toLocation?.code || '',
            line.qtyShipped.toString(),
            line.qtyReceived.toString(),
          ].join(','));
        }
      }
    }

    const csv = BOM + headers + '\n' + rows.join('\n');

    // Calculate SHA-256 hash
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(csv).digest('hex');

    return { csv, hash };
  }
}
