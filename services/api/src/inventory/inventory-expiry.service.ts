/**
 * M11.8 Expiry Enforcement Service
 *
 * Handles expiry evaluation and enforcement:
 * - Callable evaluateExpiry() - no timers or cron
 * - Marks lots as EXPIRED when past expiry date
 * - Generates expiry alerts
 * - Export expired lots for reporting
 */
import {
    Injectable,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { Prisma, LotStatus } from '@chefcloud/db';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

// Result of expiry evaluation
export interface ExpiryEvaluationResult {
    evaluatedAt: Date;
    lotsMarkedExpired: number;
    lotsExpiringSoon: number;
    totalExpiredValue: Decimal;
    details: ExpiredLotDetail[];
}

export interface ExpiredLotDetail {
    lotId: string;
    lotNumber: string;
    itemId: string;
    itemName: string;
    branchId: string;
    locationId: string;
    locationName: string;
    remainingQty: Decimal;
    unitCost: Decimal | null;
    estimatedValue: Decimal;
    expiryDate: Date;
    previousStatus: LotStatus;
}

// Expiring soon alert
export interface ExpiryAlert {
    lotId: string;
    lotNumber: string;
    itemId: string;
    itemName: string;
    branchId: string;
    locationId: string;
    locationName: string;
    remainingQty: Decimal;
    expiryDate: Date;
    daysToExpiry: number;
    estimatedValue: Decimal;
}

@Injectable()
export class InventoryExpiryService {
    private readonly logger = new Logger(InventoryExpiryService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLog: AuditLogService,
    ) { }

    /**
     * Evaluate and enforce expiry on all active lots
     * 
     * This is a callable method - no timers or cron.
     * Should be called periodically by external scheduler or on-demand.
     */
    async evaluateExpiry(options: {
        orgId: string;
        branchId?: string;
        dryRun?: boolean;
    }): Promise<ExpiryEvaluationResult> {
        const { orgId, branchId, dryRun = false } = options;
        const now = new Date();

        // Find all active lots that are past expiry
        const where: Prisma.InventoryLotWhereInput = {
            orgId,
            status: 'ACTIVE',
            expiryDate: { lt: now },
            remainingQty: { gt: 0 },
        };

        if (branchId) where.branchId = branchId;

        const expiredLots = await this.prisma.client.inventoryLot.findMany({
            where,
            include: {
                item: { select: { name: true } },
                location: { select: { name: true } },
            },
        });

        const details: ExpiredLotDetail[] = expiredLots.map((lot) => ({
            lotId: lot.id,
            lotNumber: lot.lotNumber,
            itemId: lot.itemId,
            itemName: lot.item?.name ?? 'Unknown',
            branchId: lot.branchId,
            locationId: lot.locationId,
            locationName: lot.location?.name ?? 'Unknown',
            remainingQty: lot.remainingQty,
            unitCost: lot.unitCost,
            estimatedValue: lot.unitCost
                ? lot.remainingQty.mul(lot.unitCost)
                : new Decimal(0),
            expiryDate: lot.expiryDate!,
            previousStatus: lot.status,
        }));

        const totalExpiredValue = details.reduce(
            (sum, d) => sum.plus(d.estimatedValue),
            new Decimal(0),
        );

        if (!dryRun && expiredLots.length > 0) {
            // Update lots to EXPIRED status
            await this.prisma.client.inventoryLot.updateMany({
                where: {
                    id: { in: expiredLots.map((l) => l.id) },
                },
                data: {
                    status: 'EXPIRED',
                },
            });

            // Audit log for each expired lot
            for (const lot of expiredLots) {
                await this.auditLog.log({
                    orgId,
                    branchId: lot.branchId,
                    userId: 'system',
                    action: 'LOT_EXPIRED',
                    resourceType: 'InventoryLot',
                    resourceId: lot.id,
                    metadata: {
                        lotNumber: lot.lotNumber,
                        itemId: lot.itemId,
                        remainingQty: lot.remainingQty.toString(),
                        expiryDate: lot.expiryDate?.toISOString(),
                    },
                });
            }

            this.logger.log(
                `Marked ${expiredLots.length} lots as EXPIRED for org ${orgId}`,
            );
        }

        // Also count lots expiring soon (within 7 days)
        const soonThreshold = new Date();
        soonThreshold.setDate(now.getDate() + 7);

        const expiringSoonCount = await this.prisma.client.inventoryLot.count({
            where: {
                orgId,
                branchId: branchId ?? undefined,
                status: 'ACTIVE',
                expiryDate: { gte: now, lte: soonThreshold },
                remainingQty: { gt: 0 },
            },
        });

        return {
            evaluatedAt: now,
            lotsMarkedExpired: dryRun ? 0 : expiredLots.length,
            lotsExpiringSoon: expiringSoonCount,
            totalExpiredValue,
            details,
        };
    }

    /**
     * Get lots expiring within N days
     */
    async getExpiringSoon(options: {
        orgId: string;
        branchId?: string;
        daysThreshold: number;
        limit?: number;
    }): Promise<ExpiryAlert[]> {
        const { orgId, branchId, daysThreshold, limit = 100 } = options;
        const now = new Date();
        const thresholdDate = new Date();
        thresholdDate.setDate(now.getDate() + daysThreshold);

        const where: Prisma.InventoryLotWhereInput = {
            orgId,
            status: 'ACTIVE',
            expiryDate: { gte: now, lte: thresholdDate },
            remainingQty: { gt: 0 },
        };

        if (branchId) where.branchId = branchId;

        const lots = await this.prisma.client.inventoryLot.findMany({
            where,
            include: {
                item: { select: { name: true } },
                location: { select: { name: true } },
            },
            orderBy: { expiryDate: 'asc' },
            take: limit,
        });

        return lots.map((lot) => {
            const daysToExpiry = Math.ceil(
                (lot.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            );
            return {
                lotId: lot.id,
                lotNumber: lot.lotNumber,
                itemId: lot.itemId,
                itemName: lot.item?.name ?? 'Unknown',
                branchId: lot.branchId,
                locationId: lot.locationId,
                locationName: lot.location?.name ?? 'Unknown',
                remainingQty: lot.remainingQty,
                expiryDate: lot.expiryDate!,
                daysToExpiry,
                estimatedValue: lot.unitCost
                    ? lot.remainingQty.mul(lot.unitCost)
                    : new Decimal(0),
            };
        });
    }

    /**
     * Get all expired lots
     */
    async getExpiredLots(options: {
        orgId: string;
        branchId?: string;
        includeZeroQty?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<{ lots: ExpiredLotDetail[]; total: number }> {
        const { orgId, branchId, includeZeroQty = false, limit = 50, offset = 0 } = options;

        const where: Prisma.InventoryLotWhereInput = {
            orgId,
            status: 'EXPIRED',
        };

        if (branchId) where.branchId = branchId;
        if (!includeZeroQty) {
            where.remainingQty = { gt: 0 };
        }

        const [lots, total] = await Promise.all([
            this.prisma.client.inventoryLot.findMany({
                where,
                include: {
                    item: { select: { name: true } },
                    location: { select: { name: true } },
                },
                orderBy: { expiryDate: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.client.inventoryLot.count({ where }),
        ]);

        return {
            lots: lots.map((lot) => ({
                lotId: lot.id,
                lotNumber: lot.lotNumber,
                itemId: lot.itemId,
                itemName: lot.item?.name ?? 'Unknown',
                branchId: lot.branchId,
                locationId: lot.locationId,
                locationName: lot.location?.name ?? 'Unknown',
                remainingQty: lot.remainingQty,
                unitCost: lot.unitCost,
                estimatedValue: lot.unitCost
                    ? lot.remainingQty.mul(lot.unitCost)
                    : new Decimal(0),
                expiryDate: lot.expiryDate!,
                previousStatus: 'ACTIVE' as LotStatus,
            })),
            total,
        };
    }

    /**
     * Get expiry summary stats
     */
    async getExpirySummary(options: {
        orgId: string;
        branchId?: string;
    }): Promise<{
        expiredLotsCount: number;
        expiredLotsValue: Decimal;
        expiringSoon7d: number;
        expiringSoon30d: number;
        expiringSoonValue7d: Decimal;
        expiringSoonValue30d: Decimal;
    }> {
        const { orgId, branchId } = options;
        const now = new Date();
        const date7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const date30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const baseWhere: Prisma.InventoryLotWhereInput = {
            orgId,
            remainingQty: { gt: 0 },
        };
        if (branchId) baseWhere.branchId = branchId;

        // Expired lots
        const expiredLots = await this.prisma.client.inventoryLot.findMany({
            where: { ...baseWhere, status: 'EXPIRED' },
            select: { remainingQty: true, unitCost: true },
        });

        const expiredLotsCount = expiredLots.length;
        const expiredLotsValue = expiredLots.reduce(
            (sum, l) => sum.plus(l.unitCost ? l.remainingQty.mul(l.unitCost) : new Decimal(0)),
            new Decimal(0),
        );

        // Expiring within 7 days
        const expiring7d = await this.prisma.client.inventoryLot.findMany({
            where: {
                ...baseWhere,
                status: 'ACTIVE',
                expiryDate: { gte: now, lte: date7 },
            },
            select: { remainingQty: true, unitCost: true },
        });

        const expiringSoon7d = expiring7d.length;
        const expiringSoonValue7d = expiring7d.reduce(
            (sum, l) => sum.plus(l.unitCost ? l.remainingQty.mul(l.unitCost) : new Decimal(0)),
            new Decimal(0),
        );

        // Expiring within 30 days
        const expiring30d = await this.prisma.client.inventoryLot.findMany({
            where: {
                ...baseWhere,
                status: 'ACTIVE',
                expiryDate: { gte: now, lte: date30 },
            },
            select: { remainingQty: true, unitCost: true },
        });

        const expiringSoon30d = expiring30d.length;
        const expiringSoonValue30d = expiring30d.reduce(
            (sum, l) => sum.plus(l.unitCost ? l.remainingQty.mul(l.unitCost) : new Decimal(0)),
            new Decimal(0),
        );

        return {
            expiredLotsCount,
            expiredLotsValue,
            expiringSoon7d,
            expiringSoon30d,
            expiringSoonValue7d,
            expiringSoonValue30d,
        };
    }

    /**
     * Export expired lots to CSV
     */
    async exportExpiredLots(options: {
        orgId: string;
        branchId?: string;
        includeZeroQty?: boolean;
    }): Promise<{ csv: string; hash: string }> {
        const { orgId, branchId, includeZeroQty = false } = options;

        const where: Prisma.InventoryLotWhereInput = {
            orgId,
            status: 'EXPIRED',
        };
        if (branchId) where.branchId = branchId;
        if (!includeZeroQty) where.remainingQty = { gt: 0 };

        const lots = await this.prisma.client.inventoryLot.findMany({
            where,
            include: {
                item: { select: { name: true, sku: true } },
                location: { select: { name: true } },
                branch: { select: { name: true } },
            },
            orderBy: { expiryDate: 'desc' },
        });

        const headers = [
            'Lot Number',
            'Item SKU',
            'Item Name',
            'Branch',
            'Location',
            'Remaining Qty',
            'Unit Cost',
            'Estimated Value',
            'Expiry Date',
        ];

        const rows: string[][] = lots.map((lot) => {
            const value = lot.unitCost
                ? lot.remainingQty.mul(lot.unitCost).toString()
                : '';
            return [
                lot.lotNumber,
                lot.item?.sku ?? '',
                lot.item?.name ?? '',
                lot.branch?.name ?? '',
                lot.location?.name ?? '',
                lot.remainingQty.toString(),
                lot.unitCost?.toString() ?? '',
                value,
                lot.expiryDate?.toISOString() ?? '',
            ];
        });

        const csvContent =
            headers.join(',') +
            '\n' +
            rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');

        const crypto = await import('crypto');
        const hash = crypto.createHash('sha256').update(csvContent).digest('hex');

        return { csv: csvContent, hash };
    }
}
