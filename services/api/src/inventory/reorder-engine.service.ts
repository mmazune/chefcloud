/**
 * M11.6 Reorder Engine Service
 * 
 * Generates reorder suggestions based on:
 * - Current on-hand quantity (from ledger)
 * - Reorder points (from ReorderPolicy or InventoryItem)
 * - Preferred vendor selection
 * 
 * Features:
 * - Deterministic hash for idempotency (H3, H10)
 * - UOM conversion for vendor quantities (H2)
 * - Sorted output for stability
 */
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { SupplierCatalogService } from './supplier-catalog.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { Prisma, ReorderReasonCode } from '@chefcloud/db';
import { createHash } from 'crypto';

type Decimal = Prisma.Decimal;
const ZERO = new Prisma.Decimal(0);

export interface ReorderPolicyDto {
    inventoryItemId: string;
    reorderPointBaseQty: number | string;
    reorderQtyBaseQty: number | string;
    preferredLocationId?: string;
    preferredVendorId?: string;
    isActive?: boolean;
}

export interface CreateRunOptions {
    itemIds?: string[]; // Optional filter to specific items
}

@Injectable()
export class ReorderEngineService {
    private readonly logger = new Logger(ReorderEngineService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLog: AuditLogService,
        private readonly catalogService: SupplierCatalogService,
        private readonly ledgerService: InventoryLedgerService,
    ) { }

    // ============================================================================
    // Reorder Policies
    // ============================================================================

    /**
     * Create or update a reorder policy for an item at a branch
     */
    async upsertPolicy(
        orgId: string,
        branchId: string,
        userId: string,
        dto: ReorderPolicyDto,
    ) {
        // Verify item exists
        const item = await this.prisma.client.inventoryItem.findFirst({
            where: { id: dto.inventoryItemId, orgId },
        });
        if (!item) {
            throw new NotFoundException('Inventory item not found');
        }

        // Verify branch exists
        const branch = await this.prisma.client.branch.findFirst({
            where: { id: branchId, orgId },
        });
        if (!branch) {
            throw new NotFoundException('Branch not found');
        }

        // Upsert policy
        const policy = await this.prisma.client.reorderPolicy.upsert({
            where: {
                orgId_branchId_inventoryItemId: {
                    orgId,
                    branchId,
                    inventoryItemId: dto.inventoryItemId,
                },
            },
            create: {
                orgId,
                branchId,
                inventoryItemId: dto.inventoryItemId,
                reorderPointBaseQty: dto.reorderPointBaseQty,
                reorderQtyBaseQty: dto.reorderQtyBaseQty,
                preferredLocationId: dto.preferredLocationId,
                preferredVendorId: dto.preferredVendorId,
                isActive: dto.isActive ?? true,
            },
            update: {
                reorderPointBaseQty: dto.reorderPointBaseQty,
                reorderQtyBaseQty: dto.reorderQtyBaseQty,
                preferredLocationId: dto.preferredLocationId,
                preferredVendorId: dto.preferredVendorId,
                isActive: dto.isActive,
            },
        });

        await this.auditLog.log({
            orgId,
            branchId,
            userId,
            action: 'REORDER_POLICY_UPDATED',
            resourceType: 'ReorderPolicy',
            resourceId: policy.id,
            metadata: { ...dto } as Record<string, unknown>,
        });

        this.logger.log(`Upserted reorder policy ${policy.id} for item ${dto.inventoryItemId}`);
        return policy;
    }

    /**
     * Get reorder policy for an item at a branch
     */
    async getPolicy(orgId: string, branchId: string, inventoryItemId: string) {
        return this.prisma.client.reorderPolicy.findFirst({
            where: { orgId, branchId, inventoryItemId, isActive: true },
        });
    }

    /**
     * List all reorder policies for a branch
     */
    async listPolicies(orgId: string, branchId: string) {
        return this.prisma.client.reorderPolicy.findMany({
            where: { orgId, branchId },
            include: {
                inventoryItem: { select: { id: true, name: true, sku: true } },
                preferredVendor: { select: { id: true, name: true } },
            },
            orderBy: { inventoryItem: { name: 'asc' } },
        });
    }

    // ============================================================================
    // Suggestion Runs
    // ============================================================================

    /**
     * Create a reorder suggestion run.
     * Idempotent via deterministicHash (H3, H10).
     */
    async createRun(
        orgId: string,
        branchId: string,
        userId: string,
        options?: CreateRunOptions,
    ) {
        // Get all active items with reorder info
        const itemWhere: Prisma.InventoryItemWhereInput = { orgId, isActive: true };
        if (options?.itemIds && options.itemIds.length > 0) {
            itemWhere.id = { in: options.itemIds };
        }

        const items = await this.prisma.client.inventoryItem.findMany({
            where: itemWhere,
            select: { id: true, reorderLevel: true, reorderQty: true },
            orderBy: { id: 'asc' }, // H10: Deterministic ordering
        });

        // Get policies for this branch (override item-level settings)
        const policies = await this.prisma.client.reorderPolicy.findMany({
            where: { orgId, branchId, isActive: true },
        });
        const policyMap = new Map(policies.map(p => [p.inventoryItemId, p]));

        // Get all on-hand quantities for this branch in one call
        const onHandData = await this.ledgerService.getOnHandByBranch(branchId);
        // Aggregate by itemId (sum across all locations)
        const onHandMap = new Map<string, Prisma.Decimal>();
        for (const row of onHandData) {
            const current = onHandMap.get(row.itemId) ?? ZERO;
            onHandMap.set(row.itemId, current.plus(row.onHand));
        }

        // Build suggestion data
        const suggestionData: Array<{
            itemId: string;
            onHandBaseQty: Decimal;
            reorderPointBaseQty: Decimal;
            reorderQtyBaseQty: Decimal;
            preferredVendorId?: string;
        }> = [];

        for (const item of items) {
            const policy = policyMap.get(item.id);

            // Determine reorder point and qty (H9: policy takes precedence)
            const reorderPointBaseQty = policy
                ? new Prisma.Decimal(policy.reorderPointBaseQty)
                : new Prisma.Decimal(item.reorderLevel);
            const reorderQtyBaseQty = policy
                ? new Prisma.Decimal(policy.reorderQtyBaseQty)
                : new Prisma.Decimal(item.reorderQty);

            // Skip items with zero reorder point (no reorder needed)
            if (reorderPointBaseQty.isZero() && reorderQtyBaseQty.isZero()) {
                continue;
            }

            // Get on-hand quantity from aggregated map
            const onHandBaseQty = onHandMap.get(item.id) ?? ZERO;

            // Check if below reorder point or negative
            if (onHandBaseQty.lessThan(reorderPointBaseQty) || onHandBaseQty.isNegative()) {
                suggestionData.push({
                    itemId: item.id,
                    onHandBaseQty,
                    reorderPointBaseQty,
                    reorderQtyBaseQty,
                    preferredVendorId: policy?.preferredVendorId ?? undefined,
                });
            }
        }

        // If no suggestions, still create a run but with empty lines
        // Compute deterministic hash (H10: sorted by itemId)
        const hashInput = suggestionData
            .sort((a, b) => a.itemId.localeCompare(b.itemId))
            .map(s => `${s.itemId}:${s.onHandBaseQty.toString()}:${s.reorderPointBaseQty.toString()}`)
            .join('|');

        const deterministicHash = createHash('sha256')
            .update(`${branchId}:${hashInput}`)
            .digest('hex');

        // Check for existing run with same hash (H3 idempotency)
        const existingRun = await this.prisma.client.reorderSuggestionRun.findFirst({
            where: { orgId, branchId, deterministicHash },
            include: {
                lines: {
                    include: {
                        inventoryItem: { select: { id: true, name: true, sku: true } },
                        suggestedVendor: { select: { id: true, name: true } },
                    },
                },
            },
        });

        if (existingRun) {
            this.logger.log(`Returning existing run ${existingRun.id} (idempotent)`);
            return existingRun;
        }

        // Create new run with lines
        const run = await this.prisma.client.$transaction(async (tx) => {
            const newRun = await tx.reorderSuggestionRun.create({
                data: {
                    orgId,
                    branchId,
                    deterministicHash,
                    createdById: userId,
                },
            });

            // Create suggestion lines with vendor info
            for (const s of suggestionData) {
                // Find preferred supplier item
                const supplierItem = await this.catalogService.findPreferredForItem(
                    orgId,
                    s.itemId,
                    s.preferredVendorId,
                );

                let suggestedVendorId: string | undefined;
                let suggestedVendorUomId: string | undefined;
                let suggestedVendorQty: Decimal | undefined;

                if (supplierItem) {
                    suggestedVendorId = supplierItem.vendorId;
                    suggestedVendorUomId = supplierItem.vendorUomId ?? undefined;

                    // Convert base qty to vendor qty (H2)
                    const factor = new Prisma.Decimal(supplierItem.uomConversionFactorToBase);
                    suggestedVendorQty = this.catalogService.convertBaseToVendorQty(
                        s.reorderQtyBaseQty,
                        factor,
                    );
                }

                const reasonCode = s.onHandBaseQty.isNegative()
                    ? ReorderReasonCode.NEGATIVE_ON_HAND
                    : ReorderReasonCode.BELOW_REORDER_POINT;

                await tx.reorderSuggestionLine.create({
                    data: {
                        orgId,
                        runId: newRun.id,
                        inventoryItemId: s.itemId,
                        onHandBaseQty: s.onHandBaseQty,
                        reorderPointBaseQty: s.reorderPointBaseQty,
                        suggestedBaseQty: s.reorderQtyBaseQty,
                        suggestedVendorId,
                        suggestedVendorUomId,
                        suggestedVendorQty,
                        reasonCode,
                    },
                });
            }

            return newRun;
        });

        // Fetch with lines for response
        const runWithLines = await this.prisma.client.reorderSuggestionRun.findUnique({
            where: { id: run.id },
            include: {
                lines: {
                    include: {
                        inventoryItem: { select: { id: true, name: true, sku: true } },
                        suggestedVendor: { select: { id: true, name: true } },
                    },
                    orderBy: { inventoryItemId: 'asc' },
                },
            },
        });

        await this.auditLog.log({
            orgId,
            branchId,
            userId,
            action: 'REORDER_RUN_CREATED',
            resourceType: 'ReorderSuggestionRun',
            resourceId: run.id,
            metadata: { lineCount: suggestionData.length },
        });

        this.logger.log(`Created reorder run ${run.id} with ${suggestionData.length} suggestions`);
        return runWithLines;
    }

    /**
     * Get a run by ID
     */
    async getRun(orgId: string, runId: string) {
        const run = await this.prisma.client.reorderSuggestionRun.findFirst({
            where: { id: runId, orgId },
            include: {
                branch: { select: { id: true, name: true } },
                createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
                lines: {
                    include: {
                        inventoryItem: { select: { id: true, name: true, sku: true } },
                        suggestedVendor: { select: { id: true, name: true } },
                    },
                    orderBy: { inventoryItemId: 'asc' },
                },
                generatedPOs: {
                    select: { id: true, poNumber: true, vendorId: true, status: true, totalAmount: true },
                },
            },
        });

        if (!run) {
            throw new NotFoundException('Reorder run not found');
        }

        return run;
    }

    /**
     * List recent runs for a branch
     */
    async listRuns(orgId: string, branchId: string, limit = 20) {
        return this.prisma.client.reorderSuggestionRun.findMany({
            where: { orgId, branchId },
            include: {
                createdBy: { select: { id: true, firstName: true, lastName: true } },
                _count: { select: { lines: true, generatedPOs: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
}
