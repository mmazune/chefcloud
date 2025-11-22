import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WebhookDeliveryStatus, WebhookSubscription } from '@chefcloud/db';
import * as crypto from 'crypto';
import axios, { AxiosError } from 'axios';

export interface WebhookEvent {
  type: string;
  orgId: string;
  payload: any;
  eventId?: string;
}

/**
 * WebhookDispatcherService
 * 
 * Handles webhook event delivery:
 * - Queue events for matching subscriptions
 * - HTTP POST delivery with HMAC signatures
 * - Retry logic with exponential backoff
 * - Delivery tracking and metrics
 * 
 * Signature format:
 * - Header: X-ChefCloud-Signature
 * - Value: HMAC-SHA256(secret, timestamp + body)
 * - Additional header: X-ChefCloud-Timestamp (for replay protection)
 */
@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);
  private readonly MAX_ATTEMPTS = 3;
  private readonly TIMEOUT_MS = 10000; // 10 seconds

  constructor(private prisma: PrismaService) {}

  /**
   * Compute HMAC-SHA256 signature
   * Format: HMAC-SHA256(secret, timestamp + '.' + body)
   */
  private computeSignature(secret: string, timestamp: number, body: string): string {
    const payload = `${timestamp}.${body}`;
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Calculate next retry time with exponential backoff
   * Attempt 1: immediate
   * Attempt 2: +1 minute
   * Attempt 3: +5 minutes
   */
  private calculateNextRetry(attempts: number): Date | null {
    if (attempts >= this.MAX_ATTEMPTS) {
      return null; // No more retries
    }

    const delays = [0, 60, 300]; // seconds
    const delaySeconds = delays[attempts] || 300;
    return new Date(Date.now() + delaySeconds * 1000);
  }

  /**
   * Enqueue webhook event
   * Creates WebhookDelivery records for all matching ACTIVE subscriptions
   */
  async enqueueEvent(event: WebhookEvent): Promise<number> {
    // Find active subscriptions matching this event type and org
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      where: {
        orgId: event.orgId,
        status: 'ACTIVE',
        eventTypes: {
          has: event.type,
        },
      },
    });

    if (subscriptions.length === 0) {
      this.logger.debug(`No subscriptions found for event ${event.type} in org ${event.orgId}`);
      return 0;
    }

    // Create delivery records for each subscription
    const deliveries = await Promise.all(
      subscriptions.map((subscription: WebhookSubscription) =>
        this.prisma.webhookDelivery.create({
          data: {
            subscriptionId: subscription.id,
            eventId: event.eventId || crypto.randomUUID(),
            eventType: event.type,
            payload: event.payload,
            status: 'PENDING',
            attempts: 0,
          },
        }),
      ),
    );

    this.logger.log(`Enqueued ${deliveries.length} webhook deliveries for event ${event.type}`);

    // Trigger immediate delivery for each (in production, this would be queued to a worker)
    deliveries.forEach((delivery: any) => {
      this.deliverWebhook(delivery.id).catch((error) => {
        this.logger.error(`Failed to deliver webhook ${delivery.id}: ${error.message}`);
      });
    });

    return deliveries.length;
  }

  /**
   * Deliver single webhook
   * Performs HTTP POST with HMAC signature
   */
  async deliverWebhook(deliveryId: string): Promise<void> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        subscription: true,
      },
    });

    if (!delivery) {
      throw new Error(`Delivery ${deliveryId} not found`);
    }

    if (delivery.subscription.status !== 'ACTIVE') {
      this.logger.warn(`Skipping delivery ${deliveryId} - subscription disabled`);
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { status: 'FAILED', errorMessage: 'Subscription disabled' },
      });
      return;
    }

    const startTime = Date.now();
    const timestamp = Math.floor(startTime / 1000); // Unix timestamp in seconds
    const body = JSON.stringify(delivery.payload);

    // Compute HMAC signature
    const signature = this.computeSignature(delivery.subscription.secret, timestamp, body);

    // Update status to SENDING
    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'PENDING', // Keep as PENDING while sending
        attempts: {
          increment: 1,
        },
        lastAttemptAt: new Date(),
      },
    });

    try {
      // Send HTTP POST
      const response = await axios.post(delivery.subscription.url, delivery.payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-ChefCloud-Signature': signature,
          'X-ChefCloud-Timestamp': timestamp.toString(),
          'X-ChefCloud-Event-Type': delivery.eventType,
          'X-ChefCloud-Event-Id': delivery.eventId,
          'User-Agent': 'ChefCloud-Webhooks/1.0',
        },
        timeout: this.TIMEOUT_MS,
        validateStatus: (status) => status >= 200 && status < 300,
      });

      const latencyMs = Date.now() - startTime;

      // Success (2xx response)
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'SUCCESS',
          responseCode: response.status,
          latencyMs,
          nextRetryAt: null,
          errorMessage: null,
        },
      });

      this.logger.log(
        `Webhook delivered successfully: ${deliveryId} (${latencyMs}ms, status ${response.status})`,
      );
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const attempts = delivery.attempts + 1;
      const nextRetryAt = this.calculateNextRetry(attempts);

      let errorMessage = 'Unknown error';
      let responseCode: number | null = null;

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        errorMessage = axiosError.message;
        responseCode = axiosError.response?.status || null;

        if (axiosError.code === 'ECONNABORTED') {
          errorMessage = 'Request timeout';
        } else if (axiosError.code === 'ECONNREFUSED') {
          errorMessage = 'Connection refused';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Determine final status
      const status: WebhookDeliveryStatus = nextRetryAt ? 'PENDING' : 'FAILED';

      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status,
          responseCode,
          latencyMs,
          errorMessage,
          nextRetryAt,
        },
      });

      this.logger.warn(
        `Webhook delivery failed: ${deliveryId} (attempt ${attempts}/${this.MAX_ATTEMPTS}, ${errorMessage})`,
      );

      // Schedule retry if available
      if (nextRetryAt) {
        this.logger.log(`Retry scheduled for ${deliveryId} at ${nextRetryAt.toISOString()}`);
        // In production, this would enqueue to a retry queue
        // For now, we just log and mark for manual retry
      }
    }
  }

  /**
   * Retry failed webhook delivery
   * Manually triggered or by scheduled worker
   */
  async retryDelivery(deliveryId: string): Promise<void> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new Error(`Delivery ${deliveryId} not found`);
    }

    if (delivery.status === 'SUCCESS') {
      throw new Error('Cannot retry successful delivery');
    }

    if (delivery.attempts >= this.MAX_ATTEMPTS) {
      throw new Error('Maximum retry attempts exceeded');
    }

    await this.deliverWebhook(deliveryId);
  }

  /**
   * List webhook deliveries with filters
   */
  async listDeliveries(filters: {
    orgId?: string;
    subscriptionId?: string;
    status?: WebhookDeliveryStatus;
    eventType?: string;
    limit?: number;
  }): Promise<any[]> {
    // Build where clause
    const where: any = {};

    if (filters.subscriptionId) {
      where.subscriptionId = filters.subscriptionId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.eventType) {
      where.eventType = filters.eventType;
    }

    // If orgId is provided, filter by subscription's orgId
    if (filters.orgId) {
      where.subscription = {
        orgId: filters.orgId,
      };
    }

    return this.prisma.webhookDelivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 100,
      include: {
        subscription: {
          select: {
            id: true,
            url: true,
            eventTypes: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Get webhook delivery details
   */
  async getDelivery(deliveryId: string, orgId: string): Promise<any> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        subscription: true,
      },
    });

    if (!delivery) {
      throw new Error('Delivery not found');
    }

    if (delivery.subscription.orgId !== orgId) {
      throw new Error('Cannot access delivery from different org');
    }

    return delivery;
  }

  /**
   * Get webhook metrics for a subscription
   */
  async getSubscriptionMetrics(subscriptionId: string, orgId: string) {
    const subscription = await this.prisma.webhookSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription || subscription.orgId !== orgId) {
      throw new Error('Subscription not found or access denied');
    }

    const [total, successful, failed, pending] = await Promise.all([
      this.prisma.webhookDelivery.count({
        where: { subscriptionId },
      }),
      this.prisma.webhookDelivery.count({
        where: { subscriptionId, status: 'SUCCESS' },
      }),
      this.prisma.webhookDelivery.count({
        where: { subscriptionId, status: 'FAILED' },
      }),
      this.prisma.webhookDelivery.count({
        where: { subscriptionId, status: 'PENDING' },
      }),
    ]);

    const avgLatency = await this.prisma.webhookDelivery.aggregate({
      where: {
        subscriptionId,
        status: 'SUCCESS',
        latencyMs: { not: null },
      },
      _avg: {
        latencyMs: true,
      },
    });

    return {
      subscriptionId,
      total,
      successful,
      failed,
      pending,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      avgLatencyMs: avgLatency._avg.latencyMs || 0,
    };
  }
}
