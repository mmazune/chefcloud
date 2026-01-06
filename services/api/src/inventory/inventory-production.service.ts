/**
 * M11.9 Inventory Production Service
 *
 * Manages production/manufacturing batches:
 * - DRAFT → POSTED → VOID workflow
 * - Input consumption with FEFO lot allocation
 * - Output creation with cost calculation
 * - Ledger integration (PRODUCTION_CONSUME, PRODUCTION_PRODUCE)
 * - Lot traceability via LotLedgerAllocation
 * - CSV export with SHA256 hash
 */
import {
    Injectable,
    Logger,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { InventoryLedgerService, LedgerEntryReason, LedgerSourceType } from './inventory-ledger.service';
import { InventoryCostingService } from './inventory-costing.service';
import { InventoryUomService } from './inventory-uom.service';
import { AuditLogService } from '../audit/audit-log.service';
import { Prisma, ProductionBatchStatus, LotStatus, CostSourceType } from '@chefcloud/db';
import { createHash } from 'crypto';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

const ZERO = new Decimal(0);

// ============================================================================
// DTOs
// ============================================================================

export interface CreateProductionBatchDto {
    productionLocationId: string;
    outputItemId: string;
    outputQty: number | string;
    outputUomId: string;
    recipeId?: string;
    notes?: string;
    metadata?: Record<string, unknown>;
}

export interface AddProductionLineDto {
    itemId: string;
    locationId: string;
    lotId?: string; // Specific lot, else FEFO
    uomId: string;
    qty: number | string;
    notes?: string;
}

export interface PostProductionBatchDto {
    notes?: string;
}

export interface VoidProductionBatchDto {
    reason: string;
}

export interface ListProductionBatchesDto {
    status?: ProductionBatchStatus;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
}

export interface ProductionBatchResult {
    id: string;
    batchNumber: string;
    status: ProductionBatchStatus;
    outputItemId: string;
    outputItemName?: string;
    outputQty: Decimal;
    outputCost?: Decimal;
    producedAt?: Date;
    lines: ProductionLineResult[];
}

export interface ProductionLineResult {
    id: string;
    itemId: string;
    itemName?: string;
    locationId: string;
    locationCode?: string;
    lotId?: string;
    lotNumber?: string;
    qty: Decimal;
    baseQty: Decimal;
    consumedBaseQty?: Decimal;
    unitCostAtPost?: Decimal;
}

export interface ProductionExportResult {
    csv: string;
    hash: string;
    count: number;
}

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class InventoryProductionService {
    private readonly logger = new Logger(InventoryProductionService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly ledgerService: InventoryLedgerService,
        private readonly costingService: InventoryCostingService,
        private readonly uomService: InventoryUomService,
        private readonly auditLog: AuditLogService,
    ) { }

    // ==========================================================================
    // Batch Number Generation
    // ==========================================================================

    private async generateBatchNumber(orgId: string, branchId: string): Promise<string> {
        const today = new Date();
        const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');

        // Count existing batches for this branch today
        const count = await this.prisma.client.productionBatch.count({
            where: {
                orgId,
                branchId,
                batchNumber: { startsWith: `PB-${datePrefix}` },
            },
        });

        return `PB-${datePrefix}-${String(count + 1).padStart(4, '0')}`;
    }

    // ==========================================================================
    // CREATE Draft Batch
    // ==========================================================================

    async createBatch(
        orgId: string,
        branchId: string,
        userId: string,
        dto: CreateProductionBatchDto,
    ): Promise<ProductionBatchResult> {
        // Validate production location belongs to branch
        const location = await this.prisma.client.inventoryLocation.findFirst({
            where: { id: dto.productionLocationId, branchId, isActive: true },
        });

        if (!location) {
            throw new BadRequestException('Production location not found or not in this branch');
        }

        // Validate output item exists
        const outputItem = await this.prisma.client.inventoryItem.findFirst({
            where: { id: dto.outputItemId, orgId, isActive: true },
        });

        if (!outputItem) {
            throw new BadRequestException('Output item not found');
        }

        // Validate output UOM
        const outputUom = await this.prisma.client.unitOfMeasure.findFirst({
            where: { id: dto.outputUomId, orgId, isActive: true },
        });

        if (!outputUom) {
            throw new BadRequestException('Output UOM not found');
        }

        const outputQty = new Decimal(dto.outputQty);
        if (outputQty.lessThanOrEqualTo(0)) {
            throw new BadRequestException('Output quantity must be positive');
        }

        // Convert to base UOM (item's baseUomId is outputItem.uomId)
        const outputBaseQty = await this.uomService.convert(
            orgId,
            dto.outputUomId,
            outputItem.uomId,
            outputQty.toString(),
        );

        // Validate recipe if provided
        if (dto.recipeId) {
            const recipe = await this.prisma.client.recipe.findFirst({
                where: { id: dto.recipeId, orgId, isActive: true },
            });

            if (!recipe) {
                throw new BadRequestException('Recipe not found');
            }
        }

        const batchNumber = await this.generateBatchNumber(orgId, branchId);

        const batch = await this.prisma.client.productionBatch.create({
            data: {
                orgId,
                branchId,
                batchNumber,
                productionLocationId: dto.productionLocationId,
                outputItemId: dto.outputItemId,
                outputQty,
                outputUomId: dto.outputUomId,
                outputBaseQty,
                recipeId: dto.recipeId,
                notes: dto.notes,
                metadata: dto.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
                status: ProductionBatchStatus.DRAFT,
                createdById: userId,
            },
            include: {
                outputItem: { select: { name: true } },
                lines: {
                    include: {
                        item: { select: { name: true } },
                        location: { select: { code: true } },
                        lot: { select: { lotNumber: true } },
                    },
                },
            },
        });

        await this.auditLog.log({
            orgId,
            branchId,
            userId,
            action: 'PRODUCTION_BATCH_CREATED',
            resourceType: 'ProductionBatch',
            resourceId: batch.id,
            metadata: { batchNumber },
        });

        return this.mapBatchToResult(batch);
    }

    // ==========================================================================
    // ADD Line to Draft Batch
    // ==========================================================================

    async addLine(
        orgId: string,
        branchId: string,
        userId: string,
        batchId: string,
        dto: AddProductionLineDto,
    ): Promise<ProductionLineResult> {
        const batch = await this.prisma.client.productionBatch.findFirst({
            where: { id: batchId, orgId, branchId },
        });

        if (!batch) {
            throw new NotFoundException('Production batch not found');
        }

        if (batch.status !== ProductionBatchStatus.DRAFT) {
            throw new BadRequestException('Cannot add lines to non-DRAFT batch');
        }

        // Validate item
        const item = await this.prisma.client.inventoryItem.findFirst({
            where: { id: dto.itemId, orgId, isActive: true },
        });

        if (!item) {
            throw new BadRequestException('Item not found');
        }

        // Validate location belongs to batch's branch
        const location = await this.prisma.client.inventoryLocation.findFirst({
            where: { id: dto.locationId, branchId, isActive: true },
        });

        if (!location) {
            throw new BadRequestException('Location not found or not in this branch');
        }

        // Validate lot if specified
        if (dto.lotId) {
            const lot = await this.prisma.client.inventoryLot.findFirst({
                where: {
                    id: dto.lotId,
                    orgId,
                    branchId,
                    itemId: dto.itemId,
                    locationId: dto.locationId,
                    status: LotStatus.ACTIVE,
                },
            });

            if (!lot) {
                throw new BadRequestException('Lot not found or not available');
            }
        }

        // Validate UOM
        const uom = await this.prisma.client.unitOfMeasure.findFirst({
            where: { id: dto.uomId, orgId, isActive: true },
        });

        if (!uom) {
            throw new BadRequestException('UOM not found');
        }

        const qty = new Decimal(dto.qty);
        if (qty.lessThanOrEqualTo(0)) {
            throw new BadRequestException('Quantity must be positive');
        }

        // Convert to base UOM (item's baseUomId is item.uomId)
        const baseQty = await this.uomService.convert(orgId, dto.uomId, item.uomId, qty.toString());

        const line = await this.prisma.client.productionBatchLine.create({
            data: {
                batchId,
                itemId: dto.itemId,
                locationId: dto.locationId,
                lotId: dto.lotId,
                uomId: dto.uomId,
                qty,
                baseQty,
                notes: dto.notes,
            },
            include: {
                item: { select: { name: true } },
                location: { select: { code: true } },
                lot: { select: { lotNumber: true } },
            },
        });

        return this.mapLineToResult(line);
    }

    // ==========================================================================
    // REMOVE Line from Draft Batch
    // ==========================================================================

    async removeLine(
        orgId: string,
        branchId: string,
        batchId: string,
        lineId: string,
    ): Promise<void> {
        const batch = await this.prisma.client.productionBatch.findFirst({
            where: { id: batchId, orgId, branchId },
        });

        if (!batch) {
            throw new NotFoundException('Production batch not found');
        }

        if (batch.status !== ProductionBatchStatus.DRAFT) {
            throw new BadRequestException('Cannot remove lines from non-DRAFT batch');
        }

        const line = await this.prisma.client.productionBatchLine.findFirst({
            where: { id: lineId, batchId },
        });

        if (!line) {
            throw new NotFoundException('Line not found');
        }

        await this.prisma.client.productionBatchLine.delete({
            where: { id: lineId },
        });
    }

    // ==========================================================================
    // POST Batch (Consume Inputs, Produce Output)
    // ==========================================================================

    async postBatch(
        orgId: string,
        branchId: string,
        userId: string,
        batchId: string,
        dto?: PostProductionBatchDto,
    ): Promise<ProductionBatchResult> {
        const batch = await this.prisma.client.productionBatch.findFirst({
            where: { id: batchId, orgId, branchId },
            include: {
                lines: {
                    include: {
                        item: { select: { name: true } },
                        location: { select: { code: true } },
                        lot: true,
                    },
                },
                productionLocation: true,
                outputItem: { select: { name: true } },
            },
        });

        if (!batch) {
            throw new NotFoundException('Production batch not found');
        }

        // Idempotency: Already posted - return success
        if (batch.status === ProductionBatchStatus.POSTED) {
            this.logger.log(`Idempotent POST for batch ${batchId} - already POSTED`);
            return this.getBatch(orgId, branchId, batchId);
        }

        if (batch.status === ProductionBatchStatus.VOID) {
            throw new BadRequestException('Cannot post a voided batch');
        }

        if (batch.lines.length === 0) {
            throw new BadRequestException('Cannot post batch without input lines');
        }

        // Process in transaction
        return await this.prisma.client.$transaction(async (tx) => {
            let totalInputCost = ZERO;

            // Process each input line
            for (const line of batch.lines) {
                // Check on-hand at location
                const onHand = await this.ledgerService.getOnHand(
                    line.itemId,
                    line.locationId,
                    branchId,
                );

                if (onHand.lessThan(line.baseQty)) {
                    throw new BadRequestException(
                        `Insufficient stock for item ${line.item?.name ?? line.itemId} at location ${line.location?.code ?? line.locationId}. ` +
                        `Required: ${line.baseQty}, Available: ${onHand}`,
                    );
                }

                // Get current WAC for costing
                const wac = await this.costingService.getCurrentWac(orgId, branchId, line.itemId);
                const lineCost = line.baseQty.times(wac);
                totalInputCost = totalInputCost.plus(lineCost);

                // FEFO lot allocation if no specific lot
                const lotToConsume = line.lot;
                let qtyRemaining = new Decimal(line.baseQty);
                const allocations: { lotId: string; qty: Decimal }[] = [];

                if (line.lotId && lotToConsume) {
                    // Specific lot - consume from it
                    if (lotToConsume.remainingQty.lessThan(line.baseQty)) {
                        throw new BadRequestException(
                            `Lot ${lotToConsume.lotNumber} has insufficient remaining quantity`,
                        );
                    }
                    allocations.push({ lotId: line.lotId, qty: line.baseQty });
                } else {
                    // FEFO allocation - find lots ordered by expiry
                    const availableLots = await tx.inventoryLot.findMany({
                        where: {
                            orgId,
                            branchId,
                            itemId: line.itemId,
                            locationId: line.locationId,
                            status: LotStatus.ACTIVE,
                            remainingQty: { gt: 0 },
                        },
                        orderBy: [
                            { expiryDate: 'asc' },
                            { createdAt: 'asc' },
                        ],
                    });

                    for (const lot of availableLots) {
                        if (qtyRemaining.isZero()) break;

                        const allocQty = Decimal.min(qtyRemaining, lot.remainingQty);
                        allocations.push({ lotId: lot.id, qty: allocQty });
                        qtyRemaining = qtyRemaining.minus(allocQty);
                    }

                    if (qtyRemaining.greaterThan(0)) {
                        throw new BadRequestException(
                            `Unable to allocate full quantity for item ${line.item?.name ?? line.itemId}. ` +
                            `Shortfall: ${qtyRemaining}`,
                        );
                    }
                }

                // Decrement lot remainingQty and create allocations
                for (let i = 0; i < allocations.length; i++) {
                    const alloc = allocations[i];

                    await tx.inventoryLot.update({
                        where: { id: alloc.lotId },
                        data: {
                            remainingQty: { decrement: alloc.qty },
                        },
                    });

                    await tx.lotLedgerAllocation.create({
                        data: {
                            orgId,
                            lotId: alloc.lotId,
                            allocatedQty: alloc.qty,
                            sourceType: 'PRODUCTION',
                            sourceId: batch.id,
                            allocationOrder: i + 1,
                            metadata: { lineId: line.id },
                        },
                    });
                }

                // Record PRODUCTION_CONSUME ledger entry (negative)
                await this.ledgerService.recordEntry(
                    orgId,
                    branchId,
                    {
                        itemId: line.itemId,
                        locationId: line.locationId,
                        qty: line.baseQty.negated(),
                        reason: LedgerEntryReason.PRODUCTION_CONSUME,
                        sourceType: LedgerSourceType.PRODUCTION,
                        sourceId: batch.id,
                        notes: `Production batch ${batch.batchNumber}`,
                        createdById: userId,
                        metadata: { lineId: line.id },
                    },
                    { tx },
                );

                // Update line with consumed qty and cost
                await tx.productionBatchLine.update({
                    where: { id: line.id },
                    data: {
                        consumedBaseQty: line.baseQty,
                        unitCostAtPost: wac,
                    },
                });
            }

            // Calculate output unit cost
            const outputUnitCost = batch.outputBaseQty.isZero()
                ? ZERO
                : totalInputCost.dividedBy(batch.outputBaseQty);

            // Record PRODUCTION_PRODUCE ledger entry (positive)
            await this.ledgerService.recordEntry(
                orgId,
                branchId,
                {
                    itemId: batch.outputItemId,
                    locationId: batch.productionLocationId,
                    qty: batch.outputBaseQty,
                    reason: LedgerEntryReason.PRODUCTION_PRODUCE,
                    sourceType: LedgerSourceType.PRODUCTION,
                    sourceId: batch.id,
                    notes: `Production batch ${batch.batchNumber}`,
                    createdById: userId,
                },
                { tx },
            );

            // Create cost layer for output
            await this.costingService.createCostLayer(
                orgId,
                branchId,
                userId,
                {
                    itemId: batch.outputItemId,
                    locationId: batch.productionLocationId,
                    qtyReceived: batch.outputBaseQty,
                    unitCost: outputUnitCost,
                    sourceType: CostSourceType.PRODUCTION,
                    sourceId: batch.id,
                },
                { tx },
            );

            // Update batch status
            const updatedBatch = await tx.productionBatch.update({
                where: { id: batchId },
                data: {
                    status: ProductionBatchStatus.POSTED,
                    outputCost: totalInputCost,
                    producedAt: new Date(),
                    producedById: userId,
                    notes: dto?.notes ? `${batch.notes ?? ''}\n${dto.notes}`.trim() : batch.notes,
                },
                include: {
                    outputItem: { select: { name: true } },
                    lines: {
                        include: {
                            item: { select: { name: true } },
                            location: { select: { code: true } },
                            lot: { select: { lotNumber: true } },
                        },
                    },
                },
            });

            await this.auditLog.log({
                orgId,
                branchId,
                userId,
                action: 'PRODUCTION_BATCH_POSTED',
                resourceType: 'ProductionBatch',
                resourceId: batch.id,
                metadata: { batchNumber: batch.batchNumber, outputCost: totalInputCost.toString() },
            });

            return this.mapBatchToResult(updatedBatch);
        });
    }

    // ==========================================================================
    // VOID Batch (Reverse Posted Batch)
    // ==========================================================================

    async voidBatch(
        orgId: string,
        branchId: string,
        userId: string,
        batchId: string,
        dto: VoidProductionBatchDto,
    ): Promise<ProductionBatchResult> {
        if (!dto.reason || dto.reason.trim().length === 0) {
            throw new BadRequestException('Void reason is required');
        }

        const batch = await this.prisma.client.productionBatch.findFirst({
            where: { id: batchId, orgId, branchId },
            include: {
                lines: {
                    include: {
                        item: { select: { name: true } },
                        location: { select: { code: true } },
                        lot: { select: { lotNumber: true } },
                    },
                },
                productionLocation: true,
                outputItem: { select: { name: true } },
            },
        });

        if (!batch) {
            throw new NotFoundException('Production batch not found');
        }

        if (batch.status === ProductionBatchStatus.VOID) {
            this.logger.log(`Idempotent VOID for batch ${batchId} - already VOID`);
            return this.getBatch(orgId, branchId, batchId);
        }

        if (batch.status === ProductionBatchStatus.DRAFT) {
            throw new BadRequestException('Cannot void a draft batch - delete it instead');
        }

        // Process in transaction
        return await this.prisma.client.$transaction(async (tx) => {
            // Reverse output: PRODUCTION_PRODUCE negative
            await this.ledgerService.recordEntry(
                orgId,
                branchId,
                {
                    itemId: batch.outputItemId,
                    locationId: batch.productionLocationId,
                    qty: batch.outputBaseQty.negated(),
                    reason: LedgerEntryReason.PRODUCTION_PRODUCE,
                    sourceType: LedgerSourceType.PRODUCTION,
                    sourceId: `${batch.id}-VOID`,
                    notes: `VOID: Production batch ${batch.batchNumber} - ${dto.reason}`,
                    createdById: userId,
                },
                { allowNegative: true, tx },
            );

            // Get all lot allocations for this batch
            const allocations = await tx.lotLedgerAllocation.findMany({
                where: { sourceType: 'PRODUCTION', sourceId: batch.id },
            });

            // Restore lot remainingQty
            for (const alloc of allocations) {
                await tx.inventoryLot.update({
                    where: { id: alloc.lotId },
                    data: {
                        remainingQty: { increment: alloc.allocatedQty },
                    },
                });
            }

            // Reverse inputs: PRODUCTION_CONSUME positive (reversal)
            for (const line of batch.lines) {
                if (line.consumedBaseQty) {
                    await this.ledgerService.recordEntry(
                        orgId,
                        branchId,
                        {
                            itemId: line.itemId,
                            locationId: line.locationId,
                            qty: line.consumedBaseQty, // Positive to restore
                            reason: LedgerEntryReason.PRODUCTION_CONSUME,
                            sourceType: LedgerSourceType.PRODUCTION,
                            sourceId: `${batch.id}-VOID`,
                            notes: `VOID: Production batch ${batch.batchNumber} - ${dto.reason}`,
                            createdById: userId,
                        },
                        { tx },
                    );
                }
            }

            // Update batch status
            const updatedBatch = await tx.productionBatch.update({
                where: { id: batchId },
                data: {
                    status: ProductionBatchStatus.VOID,
                    voidedAt: new Date(),
                    voidedById: userId,
                    voidReason: dto.reason,
                },
                include: {
                    outputItem: { select: { name: true } },
                    lines: {
                        include: {
                            item: { select: { name: true } },
                            location: { select: { code: true } },
                            lot: { select: { lotNumber: true } },
                        },
                    },
                },
            });

            await this.auditLog.log({
                orgId,
                branchId,
                userId,
                action: 'PRODUCTION_BATCH_VOIDED',
                resourceType: 'ProductionBatch',
                resourceId: batch.id,
                metadata: { batchNumber: batch.batchNumber, reason: dto.reason },
            });

            return this.mapBatchToResult(updatedBatch);
        });
    }

    // ==========================================================================
    // GET / LIST
    // ==========================================================================

    async getBatch(
        orgId: string,
        branchId: string,
        batchId: string,
    ): Promise<ProductionBatchResult> {
        const batch = await this.prisma.client.productionBatch.findFirst({
            where: { id: batchId, orgId, branchId },
            include: {
                outputItem: { select: { name: true } },
                lines: {
                    include: {
                        item: { select: { name: true } },
                        location: { select: { code: true } },
                        lot: { select: { lotNumber: true } },
                    },
                },
            },
        });

        if (!batch) {
            throw new NotFoundException('Production batch not found');
        }

        return this.mapBatchToResult(batch);
    }

    async listBatches(
        orgId: string,
        branchId: string,
        dto?: ListProductionBatchesDto,
    ): Promise<{ batches: ProductionBatchResult[]; total: number }> {
        const where: Prisma.ProductionBatchWhereInput = {
            orgId,
            branchId,
        };

        if (dto?.status) {
            where.status = dto.status;
        }

        if (dto?.fromDate || dto?.toDate) {
            where.createdAt = {};
            if (dto?.fromDate) where.createdAt.gte = dto.fromDate;
            if (dto?.toDate) where.createdAt.lte = dto.toDate;
        }

        const [batches, total] = await Promise.all([
            this.prisma.client.productionBatch.findMany({
                where,
                include: {
                    outputItem: { select: { name: true } },
                    lines: {
                        include: {
                            item: { select: { name: true } },
                            location: { select: { code: true } },
                            lot: { select: { lotNumber: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: dto?.limit ?? 50,
                skip: dto?.offset ?? 0,
            }),
            this.prisma.client.productionBatch.count({ where }),
        ]);

        return {
            batches: batches.map((b) => this.mapBatchToResult(b)),
            total,
        };
    }

    // ==========================================================================
    // EXPORT
    // ==========================================================================

    async exportBatches(
        orgId: string,
        branchId: string,
        dto?: ListProductionBatchesDto,
    ): Promise<ProductionExportResult> {
        const { batches } = await this.listBatches(orgId, branchId, { ...dto, limit: 10000 });

        const headers = [
            'batchNumber',
            'outputItemName',
            'outputQty',
            'outputCost',
            'status',
            'producedAt',
            'inputCount',
            'notes',
        ];

        const rows = batches.map((b) => [
            b.batchNumber,
            b.outputItemName ?? '',
            b.outputQty.toString(),
            b.outputCost?.toString() ?? '',
            b.status,
            b.producedAt?.toISOString() ?? '',
            b.lines.length.toString(),
            (b as any).notes ?? '',
        ]);

        const csv = [headers.join(','), ...rows.map((r) => r.map(this.escapeCSV).join(','))].join('\n');
        const hash = createHash('sha256').update(csv).digest('hex');

        return { csv, hash, count: batches.length };
    }

    // ==========================================================================
    // DELETE Draft Batch
    // ==========================================================================

    async deleteBatch(
        orgId: string,
        branchId: string,
        userId: string,
        batchId: string,
    ): Promise<void> {
        const batch = await this.prisma.client.productionBatch.findFirst({
            where: { id: batchId, orgId, branchId },
        });

        if (!batch) {
            throw new NotFoundException('Production batch not found');
        }

        if (batch.status !== ProductionBatchStatus.DRAFT) {
            throw new BadRequestException('Can only delete DRAFT batches');
        }

        await this.prisma.client.productionBatch.delete({
            where: { id: batchId },
        });

        await this.auditLog.log({
            orgId,
            branchId,
            userId,
            action: 'PRODUCTION_BATCH_DELETED',
            resourceType: 'ProductionBatch',
            resourceId: batchId,
            metadata: { batchNumber: batch.batchNumber },
        });
    }

    // ==========================================================================
    // Helpers
    // ==========================================================================

    private mapBatchToResult(batch: any): ProductionBatchResult {
        return {
            id: batch.id,
            batchNumber: batch.batchNumber,
            status: batch.status,
            outputItemId: batch.outputItemId,
            outputItemName: batch.outputItem?.name,
            outputQty: new Decimal(batch.outputQty),
            outputCost: batch.outputCost ? new Decimal(batch.outputCost) : undefined,
            producedAt: batch.producedAt ?? undefined,
            lines: (batch.lines ?? []).map((l: any) => this.mapLineToResult(l)),
        };
    }

    private mapLineToResult(line: any): ProductionLineResult {
        return {
            id: line.id,
            itemId: line.itemId,
            itemName: line.item?.name,
            locationId: line.locationId,
            locationCode: line.location?.code,
            lotId: line.lotId ?? undefined,
            lotNumber: line.lot?.lotNumber,
            qty: new Decimal(line.qty),
            baseQty: new Decimal(line.baseQty),
            consumedBaseQty: line.consumedBaseQty ? new Decimal(line.consumedBaseQty) : undefined,
            unitCostAtPost: line.unitCostAtPost ? new Decimal(line.unitCostAtPost) : undefined,
        };
    }

    private escapeCSV(value: string): string {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }
}
