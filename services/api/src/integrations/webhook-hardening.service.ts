/**
 * M9.6: Webhook Hardening Service
 *
 * Implements circuit breaker pattern and dead-letter replay.
 * Extends M9.5 webhook infrastructure with resilience patterns.
 */
import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OpsMonitoringService } from '../reservations/ops-monitoring.service';
import type { WebhookDelivery, WebhookEndpoint } from '@chefcloud/db';

export interface CircuitBreakerStatus {
  endpointId: string;
  enabled: boolean;
  failureCount: number;
  circuitBreakThreshold: number;
  disabledUntil: Date | null;
  lastFailureAt: Date | null;
  circuitOpen: boolean;
}

export interface ReplayResult {
  deliveryId: string;
  success: boolean;
  newStatus: string;
  attempts: number;
  error?: string;
}

@Injectable()
export class WebhookHardeningService {
  private readonly logger = new Logger(WebhookHardeningService.name);

  // Circuit breaker cooldown period (15 minutes)
  private readonly CIRCUIT_COOLDOWN_MS = 15 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private opsMonitoring: OpsMonitoringService,
  ) { }

  // ===== Circuit Breaker =====

  /**
   * Record a delivery failure and potentially open the circuit
   */
  async recordFailure(endpointId: string): Promise<void> {
    const endpoint = await this.prisma.client.webhookEndpoint.findUnique({
      where: { id: endpointId },
    });

    if (!endpoint) return;

    const newFailureCount = endpoint.failureCount + 1;
    const now = new Date();

    if (newFailureCount >= endpoint.circuitBreakThreshold) {
      // Open circuit - disable endpoint temporarily
      const disabledUntil = new Date(now.getTime() + this.CIRCUIT_COOLDOWN_MS);

      await this.prisma.client.webhookEndpoint.update({
        where: { id: endpointId },
        data: {
          failureCount: newFailureCount,
          lastFailureAt: now,
          enabled: false,
          disabledUntil,
        },
      });

      // Log incident
      await this.opsMonitoring.logIncident(endpoint.orgId, endpoint.branchId, {
        type: 'WEBHOOK_CIRCUIT_OPEN',
        severity: 'HIGH',
        title: `Webhook endpoint disabled: ${endpoint.url}`,
        payload: {
          endpointId,
          failureCount: newFailureCount,
          threshold: endpoint.circuitBreakThreshold,
          disabledUntil: disabledUntil.toISOString(),
        },
      });

      this.logger.warn(
        `Circuit breaker opened for endpoint ${endpointId} after ${newFailureCount} failures`,
      );
    } else {
      await this.prisma.client.webhookEndpoint.update({
        where: { id: endpointId },
        data: {
          failureCount: newFailureCount,
          lastFailureAt: now,
        },
      });
    }
  }

  /**
   * Record a successful delivery and reset the circuit
   */
  async recordSuccess(endpointId: string): Promise<void> {
    await this.prisma.client.webhookEndpoint.update({
      where: { id: endpointId },
      data: {
        failureCount: 0,
        lastFailureAt: null,
      },
    });
  }

  /**
   * Check if circuit is open for an endpoint
   */
  async isCircuitOpen(endpointId: string): Promise<boolean> {
    const endpoint = await this.prisma.client.webhookEndpoint.findUnique({
      where: { id: endpointId },
      select: {
        enabled: true,
        disabledUntil: true,
      },
    });

    if (!endpoint) return true;

    // If disabled and cooldown hasn't passed
    if (!endpoint.enabled && endpoint.disabledUntil) {
      if (new Date() < endpoint.disabledUntil) {
        return true;
      }
      // Cooldown passed - re-enable (half-open state)
      await this.prisma.client.webhookEndpoint.update({
        where: { id: endpointId },
        data: {
          enabled: true,
          disabledUntil: null,
          failureCount: 0,
        },
      });
      return false;
    }

    return !endpoint.enabled;
  }

  /**
   * Get circuit breaker status for all endpoints in an org
   */
  async getCircuitBreakerStatus(orgId: string): Promise<CircuitBreakerStatus[]> {
    const endpoints = await this.prisma.client.webhookEndpoint.findMany({
      where: { orgId },
      select: {
        id: true,
        enabled: true,
        failureCount: true,
        circuitBreakThreshold: true,
        disabledUntil: true,
        lastFailureAt: true,
      },
    });

    return endpoints.map(e => ({
      endpointId: e.id,
      enabled: e.enabled,
      failureCount: e.failureCount,
      circuitBreakThreshold: e.circuitBreakThreshold,
      disabledUntil: e.disabledUntil,
      lastFailureAt: e.lastFailureAt,
      circuitOpen: !e.enabled && e.disabledUntil !== null && new Date() < e.disabledUntil,
    }));
  }

  /**
   * Manually reset circuit breaker for an endpoint (L5 only)
   */
  async resetCircuitBreaker(orgId: string, endpointId: string): Promise<void> {
    const endpoint = await this.prisma.client.webhookEndpoint.findFirst({
      where: { id: endpointId, orgId },
    });

    if (!endpoint) {
      throw new BadRequestException('Endpoint not found');
    }

    await this.prisma.client.webhookEndpoint.update({
      where: { id: endpointId },
      data: {
        enabled: true,
        failureCount: 0,
        disabledUntil: null,
        lastFailureAt: null,
      },
    });

    this.logger.log(`Circuit breaker reset for endpoint ${endpointId} by admin`);
  }

  // ===== Dead Letter Replay =====

  /**
   * Get dead letter deliveries for an org
   */
  async getDeadLetterDeliveries(
    orgId: string,
    branchId?: string,
    limit = 50,
  ): Promise<WebhookDelivery[]> {
    const endpointWhere: Record<string, unknown> = { orgId };
    if (branchId) endpointWhere.branchId = branchId;

    const endpoints = await this.prisma.client.webhookEndpoint.findMany({
      where: endpointWhere,
      select: { id: true },
    });

    return this.prisma.client.webhookDelivery.findMany({
      where: {
        endpointId: { in: endpoints.map(e => e.id) },
        status: 'DEAD_LETTER',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        endpoint: {
          select: { url: true, branchId: true },
        },
      },
    });
  }

  /**
   * Replay a dead letter delivery (L5 only)
   * Resets status to PENDING for reprocessing
   */
  async replayDeadLetter(
    orgId: string,
    deliveryId: string,
    userId: string,
  ): Promise<ReplayResult> {
    // Find the delivery and verify ownership
    const delivery = await this.prisma.client.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        endpoint: { select: { orgId: true, branchId: true, enabled: true } },
      },
    });

    if (!delivery) {
      throw new BadRequestException('Delivery not found');
    }

    if (delivery.endpoint.orgId !== orgId) {
      throw new ForbiddenException('Delivery belongs to another organization');
    }

    if (delivery.status !== 'DEAD_LETTER') {
      throw new BadRequestException('Only DEAD_LETTER deliveries can be replayed');
    }

    if (!delivery.endpoint.enabled) {
      throw new BadRequestException('Webhook endpoint is disabled');
    }

    // Reset to PENDING for reprocessing
    const updated = await this.prisma.client.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'PENDING',
        attempts: 0,
        lastAttemptAt: null,
        responseCode: null,
        responseBody: null,
      },
    });

    this.logger.log(`Dead letter ${deliveryId} replayed by user ${userId}`);

    return {
      deliveryId,
      success: true,
      newStatus: updated.status,
      attempts: updated.attempts,
    };
  }

  /**
   * Bulk replay dead letters (L5 only)
   */
  async replayDeadLetterBulk(
    orgId: string,
    deliveryIds: string[],
    userId: string,
  ): Promise<ReplayResult[]> {
    const results: ReplayResult[] = [];

    for (const id of deliveryIds) {
      try {
        const result = await this.replayDeadLetter(orgId, id, userId);
        results.push(result);
      } catch (error) {
        results.push({
          deliveryId: id,
          success: false,
          newStatus: 'DEAD_LETTER',
          attempts: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }
}
