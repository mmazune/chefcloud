/**
 * M11.4 Inventory Depletion Service
 * 
 * Handles automatic inventory depletion on POS order close:
 * - Idempotent depletion via OrderInventoryDepletion record (UNIQUE on orderId)
 * - SALE ledger entries for each recipe ingredient
 * - Location resolution cascade: Branch.depletionLocationId → KITCHEN → PRODUCTION → first active
 * - Negative stock handling: mark FAILED, don't block order
 * - Fire-and-forget pattern (non-blocking)
 * - M11.5: Records COGS breakdown on POSTED depletions
 * - M11.13: Creates GL journal entries for COGS (Dr COGS, Cr Inventory)
 * - M12.3: Period lock awareness (mark as FAILED if period locked)
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
import { InventoryRecipesService } from './inventory-recipes.service';
import { InventoryCostingService } from './inventory-costing.service';
import { InventoryGlPostingService } from './inventory-gl-posting.service';
import { InventoryPeriodsService } from './inventory-periods.service';
import { Prisma, DepletionStatus, RecipeTargetType } from '@chefcloud/db';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

// Error codes for depletion failures
export enum DepletionErrorCode {
    LOCATION_NOT_FOUND = 'LOCATION_NOT_FOUND',
    INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
    NO_RECIPE = 'NO_RECIPE',
    ORDER_NOT_CLOSED = 'ORDER_NOT_CLOSED',
    ALREADY_PROCESSED = 'ALREADY_PROCESSED',
    PERIOD_LOCKED = 'PERIOD_LOCKED',
    INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface DepletionResult {
    depletionId: string;
    status: DepletionStatus;
    ledgerEntryCount: number;
    errorCode?: string;
    errorMessage?: string;
    itemsProcessed: number;
    itemsSkipped: number;
    isIdempotent: boolean;
}

export interface DepletionQueryOptions {
    branchId?: string;
    status?: DepletionStatus | DepletionStatus[];
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
}

@Injectable()
export class InventoryDepletionService {
    private readonly logger = new Logger(InventoryDepletionService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLog: AuditLogService,
        private readonly ledgerService: InventoryLedgerService,
        private readonly recipesService: InventoryRecipesService,
        private readonly costingService: InventoryCostingService,
        private readonly glPostingService: InventoryGlPostingService,
        private readonly periodsService: InventoryPeriodsService,
    ) { }

    /**
     * Deplete inventory for a closed order (idempotent)
     * 
     * Flow:
     * 1. Check if already processed (idempotent return)
     * 2. Resolve depletion location
     * 3. Load order with items and recipes
     * 4. Create PENDING depletion record
     * 5. For each menu item with recipe, create SALE ledger entries
     * 6. Mark depletion as POSTED or FAILED
     */
    async depleteForOrder(
        orgId: string,
        orderId: string,
        branchId: string,
        userId?: string,
    ): Promise<DepletionResult> {
        this.logger.log(`Processing depletion for order ${orderId}`);

        // Check idempotency: already processed?
        const existing = await this.prisma.client.orderInventoryDepletion.findFirst({
            where: { orderId },
        });

        if (existing) {
            this.logger.log(`Idempotent return for depletion ${existing.id}, status=${existing.status}`);
            return {
                depletionId: existing.id,
                status: existing.status,
                ledgerEntryCount: existing.ledgerEntryCount,
                errorCode: existing.errorCode ?? undefined,
                errorMessage: existing.errorMessage ?? undefined,
                itemsProcessed: (existing.metadata as any)?.itemsProcessed ?? 0,
                itemsSkipped: (existing.metadata as any)?.itemsSkipped ?? 0,
                isIdempotent: true,
            };
        }

        // Resolve depletion location
        let locationId: string;
        try {
            locationId = await this.resolveDepletionLocation(branchId);
        } catch (error: any) {
            // Create FAILED depletion record
            const failed = await this.prisma.client.orderInventoryDepletion.create({
                data: {
                    orgId,
                    orderId,
                    branchId,
                    locationId: 'UNKNOWN', // Will be updated if retried
                    status: 'FAILED',
                    errorCode: DepletionErrorCode.LOCATION_NOT_FOUND,
                    errorMessage: error.message,
                    metadata: { itemsProcessed: 0, itemsSkipped: 0 },
                },
            });

            await this.auditLog.log({
                orgId,
                userId,
                action: 'depletion.failed',
                resourceType: 'Order',
                resourceId: orderId,
                metadata: { errorCode: DepletionErrorCode.LOCATION_NOT_FOUND, error: error.message },
            });

            return {
                depletionId: failed.id,
                status: 'FAILED',
                ledgerEntryCount: 0,
                errorCode: DepletionErrorCode.LOCATION_NOT_FOUND,
                errorMessage: error.message,
                itemsProcessed: 0,
                itemsSkipped: 0,
                isIdempotent: false,
            };
        }

        // Load order with items
        const order = await this.prisma.client.order.findFirst({
            where: { id: orderId, branchId },
            include: {
                orderItems: {
                    include: {
                        menuItem: { select: { id: true, name: true } },
                    },
                },
            },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        // Verify order is CLOSED
        if (order.status !== 'CLOSED') {
            throw new BadRequestException(
                `Order must be CLOSED to deplete inventory. Current status: ${order.status}`,
            );
        }

        // M12.3: Check period lock - use current date as the effective date for depletion
        // Depletions happen when orders close, so we use now() as the effective date
        const effectiveAt = new Date();
        const periodLockCheck = await this.periodsService.checkPeriodLock(orgId, branchId, effectiveAt);
        if (periodLockCheck.locked) {
            // Create FAILED depletion record with PERIOD_LOCKED error
            const failed = await this.prisma.client.orderInventoryDepletion.create({
                data: {
                    orgId,
                    orderId,
                    branchId,
                    locationId,
                    status: 'FAILED',
                    errorCode: DepletionErrorCode.PERIOD_LOCKED,
                    errorMessage: `Period ${periodLockCheck.periodId} is locked from ${periodLockCheck.startDate?.toISOString()} to ${periodLockCheck.endDate?.toISOString()}`,
                    metadata: { itemsProcessed: 0, itemsSkipped: 0, periodId: periodLockCheck.periodId },
                },
            });

            await this.auditLog.log({
                orgId,
                userId,
                action: 'depletion.failed',
                resourceType: 'Order',
                resourceId: orderId,
                metadata: { errorCode: DepletionErrorCode.PERIOD_LOCKED, periodId: periodLockCheck.periodId },
            });

            return {
                depletionId: failed.id,
                status: 'FAILED',
                ledgerEntryCount: 0,
                errorCode: DepletionErrorCode.PERIOD_LOCKED,
                errorMessage: `Inventory period is locked`,
                itemsProcessed: 0,
                itemsSkipped: 0,
                isIdempotent: false,
            };
        }

        // Create PENDING depletion record
        const depletion = await this.prisma.client.orderInventoryDepletion.create({
            data: {
                orgId,
                orderId,
                branchId,
                locationId,
                status: 'PENDING',
                metadata: { itemsProcessed: 0, itemsSkipped: 0 },
            },
        });

        // Process depletion
        let ledgerEntryCount = 0;
        let itemsProcessed = 0;
        let itemsSkipped = 0;
        const errors: string[] = [];
        const processedItems: { menuItemId: string; itemsConsumed: number }[] = [];

        // M11.5: Track depleted items for COGS breakdown
        const depletedItems: Map<string, Decimal> = new Map(); // itemId -> total qty depleted (positive)

        try {
            for (const orderItem of order.orderItems) {
                // Get recipe for this menu item
                const recipe = await this.recipesService.getByTarget(
                    orgId,
                    'MENU_ITEM' as RecipeTargetType,
                    orderItem.menuItemId,
                );

                if (!recipe || recipe.lines.length === 0) {
                    itemsSkipped++;
                    this.logger.debug(`No recipe found for menu item ${orderItem.menuItemId}, skipping`);
                    continue;
                }

                // Process each recipe line
                const qty = orderItem.quantity; // Number of menu items ordered
                let lineCount = 0;

                for (const line of recipe.lines) {
                    // Calculate total to deplete: qtyBase × order quantity
                    const depletionQty = line.qtyBase.times(qty).negated(); // Negative for consumption

                    try {
                        // Create SALE ledger entry
                        await this.ledgerService.recordEntry(
                            orgId,
                            branchId,
                            {
                                itemId: line.inventoryItemId,
                                locationId,
                                qty: depletionQty,
                                reason: LedgerEntryReason.SALE,
                                sourceType: LedgerSourceType.ORDER,
                                sourceId: orderId,
                                createdById: userId,
                                metadata: {
                                    orderNumber: order.orderNumber,
                                    menuItemId: orderItem.menuItemId,
                                    menuItemName: orderItem.menuItem.name,
                                    orderItemId: orderItem.id,
                                    recipeId: recipe.id,
                                    recipeLineId: line.id,
                                    qtyPerUnit: line.qtyBase.toString(),
                                    orderQuantity: qty,
                                },
                            },
                            { allowNegative: true }, // Allow negative stock, track in errors
                        );

                        ledgerEntryCount++;
                        lineCount++;

                        // M11.5: Track depleted qty for COGS breakdown (store as positive)
                        const depletedQty = depletionQty.abs();
                        const existing = depletedItems.get(line.inventoryItemId) ?? new Decimal(0);
                        depletedItems.set(line.inventoryItemId, existing.plus(depletedQty));
                    } catch (error: any) {
                        // Check if it's an insufficient stock error
                        if (error.message?.includes('Insufficient stock')) {
                            errors.push(
                                `${line.inventoryItem?.name ?? line.inventoryItemId}: insufficient stock`,
                            );
                            // Still count as processed since we allow negative
                            ledgerEntryCount++;
                            lineCount++;

                            // M11.5: Still track for COGS even on negative (cost is real)
                            const depletedQty = depletionQty.abs();
                            const existing = depletedItems.get(line.inventoryItemId) ?? new Decimal(0);
                            depletedItems.set(line.inventoryItemId, existing.plus(depletedQty));
                        } else {
                            throw error; // Re-throw unexpected errors
                        }
                    }
                }

                itemsProcessed++;
                processedItems.push({
                    menuItemId: orderItem.menuItemId,
                    itemsConsumed: lineCount,
                });
            }

            // Determine final status
            const finalStatus: DepletionStatus = errors.length > 0 ? 'FAILED' : 'POSTED';

            // M11.5: Record COGS breakdown if we have depleted items
            let cogsTotal: Decimal = new Decimal(0);
            let cogsBreakdowns = 0;
            if (depletedItems.size > 0) {
                const cogsItems = Array.from(depletedItems.entries()).map(([itemId, qtyDepleted]) => ({
                    itemId,
                    qtyDepleted,
                }));
                const cogsResult = await this.costingService.recordCogsBreakdown(
                    orgId,
                    depletion.id,
                    orderId,
                    branchId,
                    cogsItems,
                );
                cogsTotal = cogsResult.totalCogs;
                cogsBreakdowns = cogsResult.breakdowns;
            }

            // M11.13: Create GL journal entry for COGS (Dr COGS, Cr Inventory Asset)
            let glJournalEntryId: string | null = null;
            let glPostingStatus: 'PENDING' | 'POSTED' | 'FAILED' | 'SKIPPED' = 'PENDING';
            let glPostingError: string | null = null;

            if (finalStatus === 'POSTED' && cogsTotal.gt(0)) {
                try {
                    const glResult = await this.glPostingService.postDepletion(
                        orgId,
                        branchId,
                        depletion.id,
                        cogsTotal,
                        userId,
                    );

                    if (glResult.status === 'POSTED' && glResult.journalEntryId) {
                        glJournalEntryId = glResult.journalEntryId;
                        glPostingStatus = 'POSTED';
                        this.logger.log(`GL entry ${glJournalEntryId} created for depletion ${depletion.id}`);
                    } else if (glResult.status === 'SKIPPED') {
                        glPostingStatus = 'SKIPPED';
                        glPostingError = glResult.error || 'No GL mapping configured';
                    } else {
                        glPostingStatus = glResult.status;
                        glPostingError = glResult.error || 'Unknown GL posting error';
                    }
                } catch (glError: any) {
                    glPostingStatus = 'FAILED';
                    glPostingError = glError.message;
                    this.logger.warn(`GL posting failed for depletion ${depletion.id}: ${glError.message}`);
                    // GL failure doesn't block depletion - continue with inventory update
                }
            } else if (cogsTotal.lte(0)) {
                glPostingStatus = 'SKIPPED';
                glPostingError = 'No COGS value to post';
            }

            // Update depletion record
            const updated = await this.prisma.client.orderInventoryDepletion.update({
                where: { id: depletion.id },
                data: {
                    status: finalStatus,
                    ledgerEntryCount,
                    errorCode: errors.length > 0 ? DepletionErrorCode.INSUFFICIENT_STOCK : null,
                    errorMessage: errors.length > 0 ? errors.join('; ') : null,
                    postedAt: new Date(),
                    glJournalEntryId,
                    glPostingStatus,
                    glPostingError,
                    metadata: {
                        itemsProcessed,
                        itemsSkipped,
                        processedItems,
                        cogsTotal: cogsTotal.toString(),
                        cogsBreakdowns,
                        glPostingStatus,
                        errors: errors.length > 0 ? errors : undefined,
                    },
                },
            });

            await this.auditLog.log({
                orgId,
                userId,
                action: finalStatus === 'POSTED' ? 'depletion.posted' : 'depletion.partial',
                resourceType: 'Order',
                resourceId: orderId,
                metadata: {
                    depletionId: depletion.id,
                    ledgerEntryCount,
                    itemsProcessed,
                    itemsSkipped,
                    cogsTotal: cogsTotal.toString(),
                    cogsBreakdowns,
                    glJournalEntryId,
                    glPostingStatus,
                    errors: errors.length > 0 ? errors : undefined,
                },
            });

            this.logger.log(
                `Depletion ${depletion.id} completed: status=${finalStatus}, entries=${ledgerEntryCount}`,
            );

            return {
                depletionId: updated.id,
                status: finalStatus,
                ledgerEntryCount,
                errorCode: errors.length > 0 ? DepletionErrorCode.INSUFFICIENT_STOCK : undefined,
                errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
                itemsProcessed,
                itemsSkipped,
                isIdempotent: false,
            };
        } catch (error: any) {
            // Mark as FAILED
            await this.prisma.client.orderInventoryDepletion.update({
                where: { id: depletion.id },
                data: {
                    status: 'FAILED',
                    errorCode: DepletionErrorCode.INTERNAL_ERROR,
                    errorMessage: error.message,
                    metadata: {
                        itemsProcessed,
                        itemsSkipped,
                        error: error.message,
                    },
                },
            });

            await this.auditLog.log({
                orgId,
                userId,
                action: 'depletion.failed',
                resourceType: 'Order',
                resourceId: orderId,
                metadata: { depletionId: depletion.id, error: error.message },
            });

            throw error;
        }
    }

    /**
     * Retry a failed depletion
     */
    async retry(
        orgId: string,
        depletionId: string,
        userId: string,
    ): Promise<DepletionResult> {
        const existing = await this.prisma.client.orderInventoryDepletion.findFirst({
            where: { id: depletionId, orgId },
        });

        if (!existing) {
            throw new NotFoundException('Depletion record not found');
        }

        if (existing.status === 'POSTED') {
            throw new BadRequestException('Depletion already posted, cannot retry');
        }

        if (existing.status === 'SKIPPED') {
            throw new BadRequestException('Depletion was skipped, cannot retry');
        }

        // Delete the failed record and re-process
        await this.prisma.client.orderInventoryDepletion.delete({
            where: { id: depletionId },
        });

        await this.auditLog.log({
            orgId,
            userId,
            action: 'depletion.retry',
            resourceType: 'Order',
            resourceId: existing.orderId,
            metadata: { originalDepletionId: depletionId, originalErrorCode: existing.errorCode },
        });

        return this.depleteForOrder(orgId, existing.orderId, existing.branchId, userId);
    }

    /**
     * Skip a failed depletion (mark as intentionally skipped)
     */
    async skip(
        orgId: string,
        depletionId: string,
        userId: string,
        reason: string,
    ) {
        const existing = await this.prisma.client.orderInventoryDepletion.findFirst({
            where: { id: depletionId, orgId },
        });

        if (!existing) {
            throw new NotFoundException('Depletion record not found');
        }

        if (existing.status === 'POSTED') {
            throw new BadRequestException('Depletion already posted, cannot skip');
        }

        const updated = await this.prisma.client.orderInventoryDepletion.update({
            where: { id: depletionId },
            data: {
                status: 'SKIPPED',
                metadata: {
                    ...(existing.metadata as object),
                    skippedReason: reason,
                    skippedAt: new Date(),
                    skippedBy: userId,
                },
            },
        });

        await this.auditLog.log({
            orgId,
            userId,
            action: 'depletion.skipped',
            resourceType: 'Order',
            resourceId: existing.orderId,
            metadata: { depletionId, reason },
        });

        return updated;
    }

    /**
     * Get depletion by ID
     */
    async getById(orgId: string, depletionId: string) {
        const depletion = await this.prisma.client.orderInventoryDepletion.findFirst({
            where: { id: depletionId, orgId },
            include: {
                order: {
                    select: {
                        id: true,
                        orderNumber: true,
                        status: true,
                        total: true,
                        createdAt: true,
                    },
                },
                branch: { select: { id: true, name: true } },
                location: { select: { id: true, code: true, name: true } },
            },
        });

        if (!depletion) {
            throw new NotFoundException('Depletion record not found');
        }

        return depletion;
    }

    /**
     * Get depletion by order ID
     */
    async getByOrderId(orgId: string, orderId: string) {
        return this.prisma.client.orderInventoryDepletion.findFirst({
            where: { orgId, orderId },
            include: {
                order: {
                    select: {
                        id: true,
                        orderNumber: true,
                        status: true,
                        total: true,
                        createdAt: true,
                    },
                },
                branch: { select: { id: true, name: true } },
                location: { select: { id: true, code: true, name: true } },
            },
        });
    }

    /**
     * List depletions with filters
     */
    async list(orgId: string, options: DepletionQueryOptions = {}) {
        const where: Prisma.OrderInventoryDepletionWhereInput = { orgId };

        if (options.branchId) {
            where.branchId = options.branchId;
        }
        if (options.status) {
            where.status = Array.isArray(options.status)
                ? { in: options.status }
                : options.status;
        }
        if (options.fromDate || options.toDate) {
            where.createdAt = {};
            if (options.fromDate) where.createdAt.gte = options.fromDate;
            if (options.toDate) where.createdAt.lte = options.toDate;
        }

        const [depletions, total] = await Promise.all([
            this.prisma.client.orderInventoryDepletion.findMany({
                where,
                include: {
                    order: {
                        select: {
                            id: true,
                            orderNumber: true,
                            status: true,
                            total: true,
                        },
                    },
                    branch: { select: { id: true, name: true } },
                    location: { select: { id: true, code: true, name: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: options.limit ?? 100,
                skip: options.offset ?? 0,
            }),
            this.prisma.client.orderInventoryDepletion.count({ where }),
        ]);

        return { depletions, total };
    }

    /**
     * Get depletion statistics
     */
    async getStats(orgId: string, branchId?: string) {
        const where: Prisma.OrderInventoryDepletionWhereInput = { orgId };
        if (branchId) where.branchId = branchId;

        const [total, byStatus] = await Promise.all([
            this.prisma.client.orderInventoryDepletion.count({ where }),
            this.prisma.client.orderInventoryDepletion.groupBy({
                by: ['status'],
                where,
                _count: { status: true },
            }),
        ]);

        const statusCounts = byStatus.reduce(
            (acc, { status, _count }) => {
                acc[status] = _count.status;
                return acc;
            },
            {} as Record<string, number>,
        );

        return {
            total,
            posted: statusCounts['POSTED'] ?? 0,
            failed: statusCounts['FAILED'] ?? 0,
            pending: statusCounts['PENDING'] ?? 0,
            skipped: statusCounts['SKIPPED'] ?? 0,
        };
    }

    /**
     * Resolve the depletion location for a branch
     * 
     * Resolution cascade:
     * 1. Branch.depletionLocationId (explicit)
     * 2. Location with code = 'KITCHEN'
     * 3. Location with locationType = 'PRODUCTION'
     * 4. First active location
     */
    private async resolveDepletionLocation(branchId: string): Promise<string> {
        // 1. Check explicit depletion location on branch
        const branch = await this.prisma.client.branch.findUnique({
            where: { id: branchId },
            select: { depletionLocationId: true },
        });

        if (branch?.depletionLocationId) {
            const location = await this.prisma.client.inventoryLocation.findFirst({
                where: { id: branch.depletionLocationId, branchId, isActive: true },
            });
            if (location) {
                return location.id;
            }
        }

        // 2. Look for location with code = 'KITCHEN'
        const kitchen = await this.prisma.client.inventoryLocation.findFirst({
            where: { branchId, code: 'KITCHEN', isActive: true },
        });

        if (kitchen) {
            return kitchen.id;
        }

        // 3. Look for location with locationType = 'PRODUCTION'
        const production = await this.prisma.client.inventoryLocation.findFirst({
            where: { branchId, locationType: 'PRODUCTION', isActive: true },
        });

        if (production) {
            return production.id;
        }

        // 4. First active location
        const firstLocation = await this.prisma.client.inventoryLocation.findFirst({
            where: { branchId, isActive: true },
            orderBy: { createdAt: 'asc' },
        });

        if (firstLocation) {
            return firstLocation.id;
        }

        // No location found
        throw new BadRequestException(
            `No active inventory location found for branch ${branchId}. ` +
            'Please configure at least one active location.',
        );
    }
}
