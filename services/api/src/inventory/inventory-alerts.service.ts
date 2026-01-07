/**
 * Inventory Alerts Service - M11.12
 * 
 * Provides alert evaluation, acknowledgment, and resolution lifecycle.
 * Implements H1 (unique constraint upsert), H7 (RBAC guards checked at controller).
 */

import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma, InventoryAlertType, InventoryAlertSeverity, InventoryAlertStatus } from '@chefcloud/db';
import { InventoryAnalyticsService } from './inventory-analytics.service';

const Decimal = Prisma.Decimal;

// ============================================
// DTOs
// ============================================

export interface AlertFilters {
  branchId?: string;
  type?: InventoryAlertType;
  severity?: InventoryAlertSeverity;
  status?: InventoryAlertStatus;
  from?: Date;
  to?: Date;
}

export interface AlertListResult {
  items: AlertItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AlertItem {
  id: string;
  orgId: string;
  branchId: string | null;
  type: InventoryAlertType;
  severity: InventoryAlertSeverity;
  entityType: string;
  entityId: string;
  title: string;
  detailsJson: any;
  status: InventoryAlertStatus;
  acknowledgedAt: Date | null;
  acknowledgedById: string | null;
  resolvedAt: Date | null;
  resolvedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EvaluateResult {
  created: number;
  skippedDuplicate: number;
  alertsByType: Record<string, number>;
}

// ============================================
// Service
// ============================================

@Injectable()
export class InventoryAlertsService {
  private readonly logger = new Logger(InventoryAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: InventoryAnalyticsService,
  ) {}

  // ============================================
  // List Alerts
  // ============================================

  async listAlerts(
    orgId: string,
    filters: AlertFilters,
    page = 1,
    pageSize = 20,
  ): Promise<AlertListResult> {
    const where: Prisma.InventoryAlertWhereInput = {
      orgId,
      ...(filters.branchId && { branchId: filters.branchId }),
      ...(filters.type && { type: filters.type }),
      ...(filters.severity && { severity: filters.severity }),
      ...(filters.status && { status: filters.status }),
      ...(filters.from && { createdAt: { gte: filters.from } }),
      ...(filters.to && { createdAt: { lte: filters.to } }),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.inventoryAlert.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [
          { severity: 'desc' },
          { createdAt: 'desc' },
        ],
      }),
      this.prisma.client.inventoryAlert.count({ where }),
    ]);

    return {
      items: items.map(this.mapAlert),
      total,
      page,
      pageSize,
    };
  }

  // ============================================
  // Get Single Alert
  // ============================================

  async getAlert(orgId: string, alertId: string): Promise<AlertItem> {
    const alert = await this.prisma.client.inventoryAlert.findFirst({
      where: { id: alertId, orgId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    return this.mapAlert(alert);
  }

  // ============================================
  // Acknowledge Alert (L4+)
  // ============================================

  async acknowledgeAlert(
    orgId: string,
    alertId: string,
    userId: string,
  ): Promise<AlertItem> {
    const alert = await this.prisma.client.inventoryAlert.findFirst({
      where: { id: alertId, orgId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    if (alert.status !== 'OPEN') {
      throw new ForbiddenException(`Alert is not in OPEN status, cannot acknowledge`);
    }

    const updated = await this.prisma.client.inventoryAlert.update({
      where: { id: alertId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
        acknowledgedById: userId,
      },
    });

    this.logger.log(`Alert ${alertId} acknowledged by user ${userId}`);

    return this.mapAlert(updated);
  }

  // ============================================
  // Resolve Alert (L4+)
  // ============================================

  async resolveAlert(
    orgId: string,
    alertId: string,
    userId: string,
    resolutionNote?: string,
  ): Promise<AlertItem> {
    const alert = await this.prisma.client.inventoryAlert.findFirst({
      where: { id: alertId, orgId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    if (alert.status === 'RESOLVED') {
      throw new ForbiddenException(`Alert is already resolved`);
    }

    const details = (alert.detailsJson as Record<string, any>) ?? {};
    if (resolutionNote) {
      details.resolutionNote = resolutionNote;
    }

    const updated = await this.prisma.client.inventoryAlert.update({
      where: { id: alertId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedById: userId,
        detailsJson: details,
      },
    });

    this.logger.log(`Alert ${alertId} resolved by user ${userId}`);

    return this.mapAlert(updated);
  }

  // ============================================
  // Evaluate Alerts (Manual Trigger)
  // H1: Uses unique constraint upsert to prevent duplicates
  // ============================================

  async evaluateAlerts(
    orgId: string,
    branchId?: string,
    options?: {
      deadStockDays?: number;
      expiryThresholdDays?: number;
    },
  ): Promise<EvaluateResult> {
    this.logger.log(`Evaluating alerts for org ${orgId}, branch ${branchId ?? 'all'}`);

    const deadStockDays = options?.deadStockDays ?? 30;
    const expiryThresholdDays = options?.expiryThresholdDays ?? 7;

    let created = 0;
    let skippedDuplicate = 0;
    const alertsByType: Record<string, number> = {};

    // 1. Dead Stock Alerts
    const deadStockItems = await this.analyticsService.getDeadStockData(orgId, {
      branchId,
      deadStockDays,
    });

    for (const item of deadStockItems) {
      const result = await this.upsertAlert({
        orgId,
        branchId: item.branchId !== 'unknown' ? item.branchId : null,
        type: 'DEAD_STOCK',
        severity: item.daysSinceMovement > 60 ? 'CRITICAL' : 'WARN',
        entityType: 'InventoryItem',
        entityId: item.itemId,
        title: `Dead stock: ${item.itemName} - ${item.daysSinceMovement} days without movement`,
        detailsJson: {
          sku: item.sku,
          onHand: item.onHand,
          lastMovementDate: item.lastMovementDate,
          daysSinceMovement: item.daysSinceMovement,
        },
      });

      if (result.created) {
        created++;
        alertsByType['DEAD_STOCK'] = (alertsByType['DEAD_STOCK'] ?? 0) + 1;
      } else {
        skippedDuplicate++;
      }
    }

    // 2. Expiry Risk Alerts
    const expiryRisk = await this.analyticsService.getExpiryRiskData(orgId, { branchId });

    for (const bucket of expiryRisk) {
      if (bucket.lotCount === 0) continue;

      const alertType: InventoryAlertType = bucket.bucket === 'expired' ? 'EXPIRED' : 'EXPIRY_SOON';
      const severity: InventoryAlertSeverity = 
        bucket.bucket === 'expired' ? 'CRITICAL' :
        bucket.bucket === 'within7' ? 'WARN' : 'INFO';

      for (const lot of bucket.lots) {
        // Skip lots beyond the threshold for EXPIRY_SOON
        if (alertType === 'EXPIRY_SOON' && lot.daysToExpiry > expiryThresholdDays) {
          continue;
        }

        const result = await this.upsertAlert({
          orgId,
          branchId: branchId ?? null,
          type: alertType,
          severity,
          entityType: 'InventoryLot',
          entityId: lot.lotId,
          title: alertType === 'EXPIRED' 
            ? `Expired lot: ${lot.lotNumber} (${lot.itemName})`
            : `Expiring soon: ${lot.lotNumber} (${lot.itemName}) - ${lot.daysToExpiry} days`,
          detailsJson: {
            lotNumber: lot.lotNumber,
            itemName: lot.itemName,
            expiryDate: lot.expiryDate,
            daysToExpiry: lot.daysToExpiry,
            qty: lot.qty,
          },
        });

        if (result.created) {
          created++;
          alertsByType[alertType] = (alertsByType[alertType] ?? 0) + 1;
        } else {
          skippedDuplicate++;
        }
      }
    }

    // 3. Below Reorder Point Alerts
    const reorderHealth = await this.analyticsService.getReorderHealthData(orgId, { branchId });

    for (const item of reorderHealth.itemsBelowReorder) {
      const shortfall = parseFloat(item.shortfall);
      const severity: InventoryAlertSeverity = shortfall > 50 ? 'CRITICAL' : 'WARN';

      const result = await this.upsertAlert({
        orgId,
        branchId: branchId ?? null,
        type: 'BELOW_REORDER_POINT',
        severity,
        entityType: 'InventoryItem',
        entityId: item.itemId,
        title: `Below reorder: ${item.itemName} (${item.onHand}/${item.reorderLevel})`,
        detailsJson: {
          sku: item.sku,
          onHand: item.onHand,
          reorderLevel: item.reorderLevel,
          shortfall: item.shortfall,
        },
      });

      if (result.created) {
        created++;
        alertsByType['BELOW_REORDER_POINT'] = (alertsByType['BELOW_REORDER_POINT'] ?? 0) + 1;
      } else {
        skippedDuplicate++;
      }
    }

    this.logger.log(`Evaluation complete: created=${created}, skipped=${skippedDuplicate}`);

    return {
      created,
      skippedDuplicate,
      alertsByType,
    };
  }

  // ============================================
  // Upsert Alert (H1: Unique constraint handling)
  // ============================================

  private async upsertAlert(data: {
    orgId: string;
    branchId: string | null;
    type: InventoryAlertType;
    severity: InventoryAlertSeverity;
    entityType: string;
    entityId: string;
    title: string;
    detailsJson: any;
  }): Promise<{ created: boolean; alert: any }> {
    // Check if an OPEN alert already exists for this entity
    const existing = await this.prisma.client.inventoryAlert.findFirst({
      where: {
        orgId: data.orgId,
        branchId: data.branchId,
        type: data.type,
        entityType: data.entityType,
        entityId: data.entityId,
        status: 'OPEN',
      },
    });

    if (existing) {
      // Update details but don't create duplicate
      const updated = await this.prisma.client.inventoryAlert.update({
        where: { id: existing.id },
        data: {
          severity: data.severity,
          title: data.title,
          detailsJson: data.detailsJson,
        },
      });
      return { created: false, alert: updated };
    }

    // Create new alert
    const created = await this.prisma.client.inventoryAlert.create({
      data: {
        orgId: data.orgId,
        branchId: data.branchId,
        type: data.type,
        severity: data.severity,
        entityType: data.entityType,
        entityId: data.entityId,
        title: data.title,
        detailsJson: data.detailsJson,
        status: 'OPEN',
      },
    });

    return { created: true, alert: created };
  }

  // ============================================
  // Helper
  // ============================================

  private mapAlert(alert: any): AlertItem {
    return {
      id: alert.id,
      orgId: alert.orgId,
      branchId: alert.branchId,
      type: alert.type,
      severity: alert.severity,
      entityType: alert.entityType,
      entityId: alert.entityId,
      title: alert.title,
      detailsJson: alert.detailsJson,
      status: alert.status,
      acknowledgedAt: alert.acknowledgedAt,
      acknowledgedById: alert.acknowledgedById,
      resolvedAt: alert.resolvedAt,
      resolvedById: alert.resolvedById,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
    };
  }
}
