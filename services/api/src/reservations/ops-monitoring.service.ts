/**
 * M9.6: Ops Monitoring Service
 *
 * Provides operational KPIs and incident logging.
 * Tracks SLA metrics for reservations, webhooks, and notifications.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { OpsIncident } from '@chefcloud/db';

export interface SlaMetrics {
  period: { start: Date; end: Date };
  reservations: {
    totalCreated: number;
    avgHoldDurationMinutes: number | null;
    avgConfirmLatencyMinutes: number | null;
    noShowCount: number;
    noShowRate: number;
    cancellationCount: number;
    cancellationRate: number;
    completedCount: number;
  };
  deposits: {
    totalRequired: number;
    capturedCount: number;
    refundedCount: number;
    conversionRate: number;
  };
  webhooks: {
    totalSent: number;
    deliveredCount: number;
    failedCount: number;
    deadLetterCount: number;
    deliveryRate: number;
    avgDeliveryLatencyMs: number | null;
  };
  notifications: {
    totalQueued: number;
    sentCount: number;
    failedCount: number;
    deliveryRate: number;
  };
}

export interface IncidentDto {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  payload?: Record<string, unknown>;
}

export type OpsIncidentRecord = OpsIncident;

@Injectable()
export class OpsMonitoringService {
  private readonly logger = new Logger(OpsMonitoringService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get SLA metrics for a branch over a time period
   */
  async getSlaMetrics(
    branchId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SlaMetrics> {
    const [
      reservationStats,
      depositStats,
      webhookStats,
      notificationStats,
    ] = await Promise.all([
      this.getReservationStats(branchId, startDate, endDate),
      this.getDepositStats(branchId, startDate, endDate),
      this.getWebhookStats(branchId, startDate, endDate),
      this.getNotificationStats(branchId, startDate, endDate),
    ]);

    return {
      period: { start: startDate, end: endDate },
      reservations: reservationStats,
      deposits: depositStats,
      webhooks: webhookStats,
      notifications: notificationStats,
    };
  }

  private async getReservationStats(branchId: string, start: Date, end: Date) {
    const reservations = await this.prisma.client.reservation.findMany({
      where: {
        branchId,
        createdAt: { gte: start, lte: end },
      },
      select: {
        status: true,
        createdAt: true,
        startAt: true,
        seatedAt: true,
        updatedAt: true,
      },
    });

    const totalCreated = reservations.length;
    const noShowCount = reservations.filter(r => r.status === 'NO_SHOW').length;
    const cancellationCount = reservations.filter(r => r.status === 'CANCELLED').length;
    const completedCount = reservations.filter(r => r.status === 'COMPLETED').length;

    // Calculate avg hold duration (HELD → CONFIRMED)
    const confirmedReservations = reservations.filter(r =>
      r.status === 'CONFIRMED' || r.status === 'SEATED' || r.status === 'COMPLETED',
    );

    let avgHoldDurationMinutes: number | null = null;
    if (confirmedReservations.length > 0) {
      // Approximate: updatedAt - createdAt for confirmed ones
      const totalMinutes = confirmedReservations.reduce((sum, r) => {
        const diff = (r.updatedAt.getTime() - r.createdAt.getTime()) / 60000;
        return sum + diff;
      }, 0);
      avgHoldDurationMinutes = totalMinutes / confirmedReservations.length;
    }

    // Calculate avg confirm latency (createdAt → status change)
    const avgConfirmLatencyMinutes = avgHoldDurationMinutes; // Simplified

    return {
      totalCreated,
      avgHoldDurationMinutes,
      avgConfirmLatencyMinutes,
      noShowCount,
      noShowRate: totalCreated > 0 ? noShowCount / totalCreated : 0,
      cancellationCount,
      cancellationRate: totalCreated > 0 ? cancellationCount / totalCreated : 0,
      completedCount,
    };
  }

  private async getDepositStats(branchId: string, start: Date, end: Date) {
    const deposits = await this.prisma.client.reservationDeposit.findMany({
      where: {
        reservation: { branchId },
        createdAt: { gte: start, lte: end },
      },
      select: { status: true },
    });

    const totalRequired = deposits.length;
    const capturedCount = deposits.filter(d => d.status === 'PAID' || d.status === 'APPLIED').length;
    const refundedCount = deposits.filter(d => d.status === 'REFUNDED').length;

    return {
      totalRequired,
      capturedCount,
      refundedCount,
      conversionRate: totalRequired > 0 ? capturedCount / totalRequired : 0,
    };
  }

  private async getWebhookStats(branchId: string, start: Date, end: Date) {
    // Get endpoints for this branch
    const endpoints = await this.prisma.client.webhookEndpoint.findMany({
      where: { branchId },
      select: { id: true },
    });
    const endpointIds = endpoints.map(e => e.id);

    if (endpointIds.length === 0) {
      return {
        totalSent: 0,
        deliveredCount: 0,
        failedCount: 0,
        deadLetterCount: 0,
        deliveryRate: 0,
        avgDeliveryLatencyMs: null,
      };
    }

    const deliveries = await this.prisma.client.webhookDelivery.findMany({
      where: {
        endpointId: { in: endpointIds },
        createdAt: { gte: start, lte: end },
      },
      select: {
        status: true,
        createdAt: true,
        lastAttemptAt: true,
      },
    });

    const totalSent = deliveries.length;
    const deliveredCount = deliveries.filter(d => d.status === 'DELIVERED').length;
    const failedCount = deliveries.filter(d => d.status === 'FAILED').length;
    const deadLetterCount = deliveries.filter(d => d.status === 'DEAD_LETTER').length;

    // Calculate avg delivery latency for successful deliveries
    const delivered = deliveries.filter(d => d.status === 'DELIVERED' && d.lastAttemptAt);
    let avgDeliveryLatencyMs: number | null = null;
    if (delivered.length > 0) {
      const totalMs = delivered.reduce((sum, d) => {
        const diff = d.lastAttemptAt!.getTime() - d.createdAt.getTime();
        return sum + diff;
      }, 0);
      avgDeliveryLatencyMs = totalMs / delivered.length;
    }

    return {
      totalSent,
      deliveredCount,
      failedCount,
      deadLetterCount,
      deliveryRate: totalSent > 0 ? deliveredCount / totalSent : 0,
      avgDeliveryLatencyMs,
    };
  }

  private async getNotificationStats(branchId: string, start: Date, end: Date) {
    const notifications = await this.prisma.client.notificationLog.findMany({
      where: {
        branchId,
        createdAt: { gte: start, lte: end },
      },
      select: { status: true },
    });

    const totalQueued = notifications.length;
    const sentCount = notifications.filter(n => n.status === 'SENT').length;
    const failedCount = notifications.filter(n => n.status === 'FAILED').length;

    return {
      totalQueued,
      sentCount,
      failedCount,
      deliveryRate: totalQueued > 0 ? sentCount / totalQueued : 0,
    };
  }

  /**
   * Export SLA metrics as CSV
   */
  exportSlaMetricsCsv(metrics: SlaMetrics): string {
    const lines: string[] = [
      'Metric,Value',
      `Period Start,${metrics.period.start.toISOString()}`,
      `Period End,${metrics.period.end.toISOString()}`,
      '',
      '# Reservations',
      `Total Created,${metrics.reservations.totalCreated}`,
      `Avg Hold Duration (min),${metrics.reservations.avgHoldDurationMinutes ?? 'N/A'}`,
      `No-Show Count,${metrics.reservations.noShowCount}`,
      `No-Show Rate,${(metrics.reservations.noShowRate * 100).toFixed(1)}%`,
      `Cancellation Count,${metrics.reservations.cancellationCount}`,
      `Cancellation Rate,${(metrics.reservations.cancellationRate * 100).toFixed(1)}%`,
      `Completed Count,${metrics.reservations.completedCount}`,
      '',
      '# Deposits',
      `Total Required,${metrics.deposits.totalRequired}`,
      `Captured,${metrics.deposits.capturedCount}`,
      `Refunded,${metrics.deposits.refundedCount}`,
      `Conversion Rate,${(metrics.deposits.conversionRate * 100).toFixed(1)}%`,
      '',
      '# Webhooks',
      `Total Sent,${metrics.webhooks.totalSent}`,
      `Delivered,${metrics.webhooks.deliveredCount}`,
      `Failed,${metrics.webhooks.failedCount}`,
      `Dead Letter,${metrics.webhooks.deadLetterCount}`,
      `Delivery Rate,${(metrics.webhooks.deliveryRate * 100).toFixed(1)}%`,
      `Avg Latency (ms),${metrics.webhooks.avgDeliveryLatencyMs ?? 'N/A'}`,
      '',
      '# Notifications',
      `Total Queued,${metrics.notifications.totalQueued}`,
      `Sent,${metrics.notifications.sentCount}`,
      `Failed,${metrics.notifications.failedCount}`,
      `Delivery Rate,${(metrics.notifications.deliveryRate * 100).toFixed(1)}%`,
    ];

    return lines.join('\n');
  }

  // ===== Incident Logging =====

  async logIncident(
    orgId: string,
    branchId: string | null,
    dto: IncidentDto,
  ): Promise<OpsIncidentRecord> {
    this.logger.warn(`OpsIncident [${dto.severity}] ${dto.type}: ${dto.title}`);

    return this.prisma.client.opsIncident.create({
      data: {
        orgId,
        branchId,
        type: dto.type,
        severity: dto.severity,
        title: dto.title,
        payload: dto.payload as object ?? undefined,
      },
    });
  }

  async getIncidents(
    orgId: string,
    branchId?: string,
    resolved?: boolean,
    limit = 50,
  ): Promise<OpsIncidentRecord[]> {
    const where: Record<string, unknown> = { orgId };
    if (branchId) where.branchId = branchId;
    if (resolved !== undefined) where.resolved = resolved;

    return this.prisma.client.opsIncident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async resolveIncident(
    orgId: string,
    incidentId: string,
    resolvedBy: string,
  ): Promise<OpsIncidentRecord> {
    return this.prisma.client.opsIncident.update({
      where: { id: incidentId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
      },
    });
  }
}
