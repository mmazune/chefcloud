import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma, LotStatus } from '@chefcloud/db';
import { InventoryBarcodesService, BarcodeResolveResult } from './inventory-barcodes.service';
import { InventoryLedgerService, LedgerEntryReason, LedgerSourceType } from './inventory-ledger.service';
import { InventoryLocationsService } from './inventory-locations.service';
import { InventoryLotsService } from './inventory-lots.service';

const Decimal = Prisma.Decimal;

// ============================================
// DTOs
// ============================================

export interface FastReceiveDto {
  branchId: string;
  locationId: string;
  barcodeValue: string;
  qty: number;
  uomId?: string;
  unitCost?: number;
  lotNumber?: string;
  expiryDate?: Date;
  notes?: string;
  idempotencyKey?: string;
}

export interface FastStocktakeScanDto {
  barcodeValue: string;
  locationId?: string;
  countedQty: number;
}

export interface FastWasteDto {
  branchId: string;
  locationId: string;
  barcodeValue: string;
  qty: number;
  reason?: string;
  notes?: string;
}

export interface FastTransferDto {
  fromLocationId: string;
  toLocationId: string;
  barcodeValue: string;
  qty: number;
  notes?: string;
}

// ============================================
// Service
// ============================================

@Injectable()
export class InventoryFastOpsService {
  private readonly logger = new Logger(InventoryFastOpsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly barcodesService: InventoryBarcodesService,
    private readonly ledgerService: InventoryLedgerService,
    private readonly locationsService: InventoryLocationsService,
    private readonly lotsService: InventoryLotsService,
  ) {}

  // ============================================
  // Fast Receive (H5: UOM Conversion)
  // ============================================

  async fastReceive(orgId: string, userId: string, dto: FastReceiveDto) {
    this.logger.log(`Fast receive: ${dto.barcodeValue} × ${dto.qty} at ${dto.locationId}`);

    // Resolve barcode
    const resolved = await this.barcodesService.resolveBarcode(orgId, dto.barcodeValue);
    if (!resolved) {
      throw new NotFoundException(`Barcode "${dto.barcodeValue}" not found`);
    }

    if (!resolved.isActive) {
      throw new BadRequestException('Item is inactive');
    }

    // Verify location belongs to branch
    const location = await this.locationsService.getLocation(orgId, dto.locationId);
    if (location.branchId !== dto.branchId) {
      throw new ForbiddenException('Location does not belong to specified branch');
    }

    // H5: UOM Conversion (if provided, assume already in base unit for now)
    // Future: integrate with UOM service convert() when item.baseUomId is available
    const baseQty = new Decimal(dto.qty);

    // Check idempotency
    if (dto.idempotencyKey) {
      const existing = await this.prisma.client.inventoryLedgerEntry.findFirst({
        where: {
          orgId,
          sourceType: 'FAST_RECEIVE',
          metadata: { path: ['idempotencyKey'], equals: dto.idempotencyKey },
        },
      });

      if (existing) {
        this.logger.log(`Idempotent return for key ${dto.idempotencyKey}`);
        return {
          idempotent: true,
          itemId: resolved.itemId,
          ledgerEntryId: existing.id,
        };
      }
    }

    // Create lot if lot tracking and lotNumber provided
    let lotId: string | undefined;
    if (dto.lotNumber) {
      const lot = await this.lotsService.createLot({
        orgId,
        branchId: dto.branchId,
        itemId: resolved.itemId,
        locationId: dto.locationId,
        lotNumber: dto.lotNumber,
        receivedQty: baseQty,
        unitCost: dto.unitCost ? new Decimal(dto.unitCost) : undefined,
        expiryDate: dto.expiryDate,
        sourceType: 'FAST_RECEIVE',
        createdById: userId,
      });
      lotId = lot.id;
    }

    // Post ledger entry
    const entry = await this.ledgerService.recordEntry(
      orgId,
      dto.branchId,
      {
        itemId: resolved.itemId,
        locationId: dto.locationId,
        qty: baseQty,
        reason: LedgerEntryReason.RECEIVE,
        sourceType: LedgerSourceType.FAST_RECEIVE,
        notes: dto.notes ?? `Fast receive via barcode ${dto.barcodeValue}`,
        createdById: userId,
        metadata: dto.idempotencyKey
          ? { idempotencyKey: dto.idempotencyKey }
          : undefined,
      },
      { allowNegative: false },
    );

    // Get new on-hand
    const newOnHand = await this.ledgerService.getOnHand(
      resolved.itemId,
      dto.locationId,
      dto.branchId,
    );

    this.logger.log(`Fast receive completed: item=${resolved.itemId}, qty=${baseQty}, entry=${entry.id}`);

    return {
      itemId: resolved.itemId,
      lotId,
      ledgerEntryId: entry.id,
      receivedQty: baseQty.toString(),
      newOnHand: newOnHand.toString(),
    };
  }

  // ============================================
  // Fast Stocktake Scan (H4: Upsert Line)
  // ============================================

  async fastStocktakeScan(
    orgId: string,
    branchId: string,
    sessionId: string,
    userId: string,
    dto: FastStocktakeScanDto,
  ) {
    this.logger.log(`Stocktake scan: session=${sessionId}, barcode=${dto.barcodeValue}`);

    // Resolve barcode
    const resolved = await this.barcodesService.resolveBarcode(orgId, dto.barcodeValue);
    if (!resolved) {
      throw new NotFoundException(`Barcode "${dto.barcodeValue}" not found`);
    }

    // Get session
    const session = await this.prisma.client.stocktakeSession.findFirst({
      where: { id: sessionId, orgId, branchId },
    });

    if (!session) {
      throw new NotFoundException('Stocktake session not found');
    }

    if (session.status !== 'IN_PROGRESS') {
      throw new BadRequestException(`Session status is ${session.status}, must be IN_PROGRESS`);
    }

    // Determine location
    let locationId = dto.locationId;
    if (!locationId) {
      if (session.locationId) {
        locationId = session.locationId;
      } else {
        throw new BadRequestException('locationId required for multi-location sessions');
      }
    }

    // Verify location if session is scoped
    if (session.locationId && locationId !== session.locationId) {
      throw new BadRequestException('Location does not match session scope');
    }

    const countedQty = new Decimal(dto.countedQty);

    // H4: Upsert line (find or create)
    const existingLine = await this.prisma.client.stocktakeLine.findUnique({
      where: {
        sessionId_itemId_locationId: {
          sessionId,
          itemId: resolved.itemId,
          locationId,
        },
      },
    });

    if (existingLine) {
      // Update existing line
      const variance = countedQty.minus(existingLine.snapshotQty);
      const updatedLine = await this.prisma.client.stocktakeLine.update({
        where: { id: existingLine.id },
        data: {
          countedQty,
          variance,
          countedById: userId,
          countedAt: new Date(),
        },
        select: {
          id: true,
          itemId: true,
          countedQty: true,
          snapshotQty: session.blindCount ? false : true,
        },
      });

      return {
        lineId: updatedLine.id,
        itemId: resolved.itemId,
        itemName: resolved.name,
        countedQty: countedQty.toString(),
        isUpdate: true,
      };
    }

    // Create new line (item not in original snapshot)
    const snapshotQty = await this.ledgerService.getOnHand(resolved.itemId, locationId, branchId);

    const newLine = await this.prisma.client.stocktakeLine.create({
      data: {
        sessionId,
        itemId: resolved.itemId,
        locationId,
        snapshotQty,
        countedQty,
        variance: countedQty.minus(snapshotQty),
        countedById: userId,
        countedAt: new Date(),
      },
    });

    // Update total lines
    await this.prisma.client.stocktakeSession.update({
      where: { id: sessionId },
      data: { totalLines: { increment: 1 } },
    });

    return {
      lineId: newLine.id,
      itemId: resolved.itemId,
      itemName: resolved.name,
      countedQty: countedQty.toString(),
      isNew: true,
    };
  }

  // ============================================
  // Fast Waste (H3: Lot Status Check)
  // ============================================

  async fastWaste(orgId: string, userId: string, dto: FastWasteDto) {
    this.logger.log(`Fast waste: ${dto.barcodeValue} × ${dto.qty} at ${dto.locationId}`);

    // Resolve barcode
    const resolved = await this.barcodesService.resolveBarcode(orgId, dto.barcodeValue);
    if (!resolved) {
      throw new NotFoundException(`Barcode "${dto.barcodeValue}" not found`);
    }

    // H3: Check lot status if lot barcode
    if (resolved.type === 'LOT') {
      if (resolved.status === LotStatus.QUARANTINE) {
        throw new BadRequestException({
          code: 'LOT_BLOCKED',
          message: 'Cannot waste quarantined lot',
          status: resolved.status,
        });
      }
      if (resolved.status === LotStatus.EXPIRED) {
        throw new BadRequestException({
          code: 'LOT_BLOCKED',
          message: 'Cannot waste expired lot (use different process)',
          status: resolved.status,
        });
      }
    }

    if (!resolved.isActive) {
      throw new BadRequestException('Item is inactive');
    }

    // Verify location belongs to branch
    const location = await this.locationsService.getLocation(orgId, dto.locationId);
    if (location.branchId !== dto.branchId) {
      throw new ForbiddenException('Location does not belong to specified branch');
    }

    const wasteQty = new Decimal(dto.qty).negated(); // Negative for waste

    // Post ledger entry
    const entry = await this.ledgerService.recordEntry(
      orgId,
      dto.branchId,
      {
        itemId: resolved.itemId,
        locationId: dto.locationId,
        qty: wasteQty,
        reason: LedgerEntryReason.WASTAGE,
        sourceType: LedgerSourceType.FAST_WASTE,
        notes: dto.notes ?? `Fast waste via barcode ${dto.barcodeValue}: ${dto.reason ?? 'unspecified'}`,
        createdById: userId,
      },
      { allowNegative: false }, // Will check on-hand
    );

    // Get new on-hand
    const newOnHand = await this.ledgerService.getOnHand(
      resolved.itemId,
      dto.locationId,
      dto.branchId,
    );

    this.logger.log(`Fast waste completed: item=${resolved.itemId}, qty=${dto.qty}, entry=${entry.id}`);

    return {
      itemId: resolved.itemId,
      lotId: resolved.lotId,
      ledgerEntryId: entry.id,
      wastedQty: dto.qty.toString(),
      newOnHand: newOnHand.toString(),
    };
  }

  // ============================================
  // Fast Transfer (Simplified)
  // ============================================

  async fastTransfer(orgId: string, branchId: string, userId: string, dto: FastTransferDto) {
    this.logger.log(`Fast transfer: ${dto.barcodeValue} × ${dto.qty} from ${dto.fromLocationId} to ${dto.toLocationId}`);

    // Resolve barcode
    const resolved = await this.barcodesService.resolveBarcode(orgId, dto.barcodeValue);
    if (!resolved) {
      throw new NotFoundException(`Barcode "${dto.barcodeValue}" not found`);
    }

    // Check lot status
    if (resolved.type === 'LOT') {
      if (resolved.status === LotStatus.QUARANTINE) {
        throw new BadRequestException({
          code: 'LOT_BLOCKED',
          message: 'Cannot transfer quarantined lot',
          status: resolved.status,
        });
      }
      if (resolved.status === LotStatus.EXPIRED) {
        throw new BadRequestException({
          code: 'LOT_BLOCKED',
          message: 'Cannot transfer expired lot',
          status: resolved.status,
        });
      }
    }

    if (!resolved.isActive) {
      throw new BadRequestException('Item is inactive');
    }

    // Verify locations belong to branch
    const fromLocation = await this.locationsService.getLocation(orgId, dto.fromLocationId);
    const toLocation = await this.locationsService.getLocation(orgId, dto.toLocationId);

    if (fromLocation.branchId !== branchId || toLocation.branchId !== branchId) {
      throw new ForbiddenException('Locations must belong to current branch');
    }

    const transferQty = new Decimal(dto.qty);

    // Execute in transaction
    return this.prisma.client.$transaction(async (tx) => {
      // Deduct from source
      const outEntry = await this.ledgerService.recordEntry(
        orgId,
        branchId,
        {
          itemId: resolved.itemId,
          locationId: dto.fromLocationId,
          qty: transferQty.negated(),
          reason: LedgerEntryReason.TRANSFER_OUT,
          sourceType: LedgerSourceType.FAST_TRANSFER,
          notes: dto.notes ?? `Fast transfer via barcode ${dto.barcodeValue}`,
          createdById: userId,
        },
        { allowNegative: false, tx },
      );

      // Add to destination
      const inEntry = await this.ledgerService.recordEntry(
        orgId,
        branchId,
        {
          itemId: resolved.itemId,
          locationId: dto.toLocationId,
          qty: transferQty,
          reason: LedgerEntryReason.TRANSFER_IN,
          sourceType: LedgerSourceType.FAST_TRANSFER,
          notes: dto.notes ?? `Fast transfer via barcode ${dto.barcodeValue}`,
          createdById: userId,
        },
        { allowNegative: true, tx },
      );

      return {
        itemId: resolved.itemId,
        lotId: resolved.lotId,
        transferredQty: dto.qty.toString(),
        fromLedgerEntryId: outEntry.id,
        toLedgerEntryId: inEntry.id,
      };
    });
  }
}
