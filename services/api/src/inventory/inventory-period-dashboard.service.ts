/**
 * M12.4 Inventory Period Dashboard Service
 *
 * Provides multi-branch period close dashboard data:
 * - Per-branch current period status
 * - Preclose status (READY/BLOCKED/WARNING/NOT_RUN)
 * - Last close pack info
 * - Close request status
 * - Last event info
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { InventoryPeriodStatus } from '@chefcloud/db';

// ============================================
// DTOs
// ============================================

export interface DashboardFilters {
  branchId?: string;
  from?: Date;
  to?: Date;
}

export interface PeriodDashboardRow {
  branchId: string;
  branchName: string;
  currentPeriod: {
    id: string;
    startDate: Date;
    endDate: Date;
    status: InventoryPeriodStatus;
  } | null;
  precloseStatus: 'READY' | 'BLOCKED' | 'WARNING' | 'NOT_RUN';
  blockerSummary: string[];
  lastClosePack: {
    hash: string;
    generatedAt: Date;
  } | null;
  closeRequest: {
    id: string;
    status: string;
  } | null;
  lastEvent: {
    type: string;
    occurredAt: Date;
    actorName: string;
  } | null;
}

export interface DashboardResult {
  rows: PeriodDashboardRow[];
  summary: {
    totalBranches: number;
    openPeriods: number;
    blockedPeriods: number;
    pendingApprovals: number;
  };
}

// ============================================
// Service
// ============================================

@Injectable()
export class InventoryPeriodDashboardService {
  private readonly logger = new Logger(InventoryPeriodDashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // Get Dashboard
  // ============================================

  async getDashboard(orgId: string, filters: DashboardFilters): Promise<DashboardResult> {
    // Step 1: Get all branches for org (or filtered branch)
    const branchWhere: any = { orgId };
    if (filters.branchId) {
      branchWhere.id = filters.branchId;
    }

    const branches = await this.prisma.client.branch.findMany({
      where: branchWhere,
      orderBy: { name: 'asc' },
    });

    const branchIds = branches.map((b) => b.id);

    // Step 2: Get current OPEN periods for all branches (batch query - avoids N+1)
    const dateFilter: any = {};
    if (filters.from) dateFilter.startDate = { gte: filters.from };
    if (filters.to) dateFilter.endDate = { lte: filters.to };

    const periods = await this.prisma.client.inventoryPeriod.findMany({
      where: {
        orgId,
        branchId: { in: branchIds },
        status: 'OPEN',
        ...dateFilter,
      },
      orderBy: { endDate: 'desc' },
    });

    // Create period map by branchId (take most recent OPEN period per branch)
    const periodByBranch = new Map<string, typeof periods[0]>();
    for (const period of periods) {
      if (!periodByBranch.has(period.branchId)) {
        periodByBranch.set(period.branchId, period);
      }
    }

    // Step 3: Get close requests for all periods (batch query)
    const periodIds = [...periodByBranch.values()].map((p) => p.id);
    const closeRequests = await this.prisma.client.inventoryPeriodCloseRequest.findMany({
      where: {
        orgId,
        periodId: { in: periodIds },
      },
    });

    const requestByPeriod = new Map<string, typeof closeRequests[0]>();
    for (const req of closeRequests) {
      requestByPeriod.set(req.periodId, req);
    }

    // Step 4: Get last events for all periods (batch query)
    const lastEvents = await this.prisma.client.inventoryPeriodEvent.findMany({
      where: {
        orgId,
        periodId: { in: periodIds },
      },
      orderBy: { occurredAt: 'desc' },
      include: {
        actor: true,
      },
    });

    const lastEventByPeriod = new Map<string, typeof lastEvents[0]>();
    for (const event of lastEvents) {
      if (!lastEventByPeriod.has(event.periodId)) {
        lastEventByPeriod.set(event.periodId, event);
      }
    }

    // Step 5: Get OPEN alerts for all periods to determine preclose status
    const alerts = await this.prisma.client.inventoryAlert.findMany({
      where: {
        orgId,
        branchId: { in: branchIds },
        entityType: 'PERIOD',
        entityId: { in: periodIds },
        status: 'OPEN',
        type: 'PERIOD_CLOSE_BLOCKED',
      },
    });

    const blockedPeriods = new Set(alerts.map((a) => a.entityId));
    const blockersByPeriod = new Map<string, string[]>();
    for (const alert of alerts) {
      const details = alert.detailsJson as any;
      const blockers = details?.blockers || [alert.title];
      blockersByPeriod.set(alert.entityId, blockers);
    }

    // Step 6: Get last export events for close pack info
    const exportEvents = lastEvents.filter((e) => e.type === 'EXPORT_GENERATED');
    const exportByPeriod = new Map<string, typeof exportEvents[0]>();
    for (const event of exportEvents) {
      if (!exportByPeriod.has(event.periodId)) {
        exportByPeriod.set(event.periodId, event);
      }
    }

    // Step 7: Build rows
    const rows: PeriodDashboardRow[] = branches.map((branch) => {
      const period = periodByBranch.get(branch.id);
      const request = period ? requestByPeriod.get(period.id) : undefined;
      const lastEvent = period ? lastEventByPeriod.get(period.id) : undefined;
      const exportEvent = period ? exportByPeriod.get(period.id) : undefined;
      const isBlocked = period ? blockedPeriods.has(period.id) : false;
      const blockers = period ? blockersByPeriod.get(period.id) || [] : [];

      // Determine preclose status
      let precloseStatus: 'READY' | 'BLOCKED' | 'WARNING' | 'NOT_RUN' = 'NOT_RUN';
      if (period) {
        if (isBlocked) {
          precloseStatus = 'BLOCKED';
        } else if (lastEvent?.type === 'EXPORT_GENERATED' || exportEvent) {
          precloseStatus = 'READY';
        } else {
          // Check if preclose was run (any event indicates some activity)
          precloseStatus = lastEvent ? 'READY' : 'NOT_RUN';
        }
      }

      return {
        branchId: branch.id,
        branchName: branch.name,
        currentPeriod: period
          ? {
              id: period.id,
              startDate: period.startDate,
              endDate: period.endDate,
              status: period.status,
            }
          : null,
        precloseStatus,
        blockerSummary: blockers.slice(0, 5),
        lastClosePack: exportEvent
          ? {
              hash: (exportEvent.metadataJson as any)?.hash || 'N/A',
              generatedAt: exportEvent.occurredAt,
            }
          : null,
        closeRequest: request
          ? {
              id: request.id,
              status: request.status,
            }
          : null,
        lastEvent: lastEvent
          ? {
              type: lastEvent.type,
              occurredAt: lastEvent.occurredAt,
              actorName: lastEvent.actor
                ? `${lastEvent.actor.firstName} ${lastEvent.actor.lastName}`
                : 'Unknown',
            }
          : null,
      };
    });

    // Step 8: Build summary
    const summary = {
      totalBranches: branches.length,
      openPeriods: periodByBranch.size,
      blockedPeriods: blockedPeriods.size,
      pendingApprovals: closeRequests.filter((r) => r.status === 'SUBMITTED').length,
    };

    return { rows, summary };
  }
}
