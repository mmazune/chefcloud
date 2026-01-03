/**
 * M9.5: Webhook Dispatcher Service
 *
 * Handles actual delivery of webhooks with retry logic and HMAC signing.
 * Designed to be invoked by automation runner or test harness.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WebhookService } from './webhook.service';
import { WebhookDeliveryStatus } from '@chefcloud/db';

// Retry delays in milliseconds
const RETRY_DELAYS = [60_000, 300_000, 900_000]; // 1m, 5m, 15m

export interface DeliveryResult {
  deliveryId: string;
  success: boolean;
  statusCode?: number;
  error?: string;
}

// HTTP client abstraction for testing
export interface HttpClient {
  post(
    url: string,
    body: string,
    headers: Record<string, string>,
    timeoutMs: number,
  ): Promise<{ status: number; body: string }>;
}

// Default fetch-based client
class DefaultHttpClient implements HttpClient {
  async post(
    url: string,
    body: string,
    headers: Record<string, string>,
    timeoutMs: number,
  ): Promise<{ status: number; body: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body,
        signal: controller.signal,
      });

      const responseBody = await response.text();
      return {
        status: response.status,
        body: responseBody.slice(0, 1000), // Truncate for storage
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);
  private httpClient: HttpClient = new DefaultHttpClient();

  constructor(
    private prisma: PrismaService,
    private webhookService: WebhookService,
  ) {}

  /**
   * Set custom HTTP client (for testing)
   */
  setHttpClient(client: HttpClient) {
    this.httpClient = client;
  }

  /**
   * Process pending webhook deliveries
   * Can be called by automation runner
   */
  async processPendingDeliveries(limit = 50): Promise<DeliveryResult[]> {
    const pending = await this.webhookService.getPendingDeliveries(limit);
    const results: DeliveryResult[] = [];

    for (const delivery of pending) {
      const result = await this.attemptDelivery(delivery.id);
      results.push(result);
    }

    return results;
  }

  /**
   * Attempt to deliver a specific webhook
   */
  async attemptDelivery(deliveryId: string): Promise<DeliveryResult> {
    const delivery = await this.prisma.client.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { endpoint: true },
    });

    if (!delivery || !delivery.endpoint) {
      return { deliveryId, success: false, error: 'Delivery not found' };
    }

    const { endpoint } = delivery;

    // Check if max retries exceeded
    if (delivery.attempts >= endpoint.maxRetries) {
      await this.prisma.client.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'DEAD_LETTER',
          lastAttemptAt: new Date(),
        },
      });
      return { deliveryId, success: false, error: 'Max retries exceeded' };
    }

    // Prepare payload
    const payload = JSON.stringify(delivery.payload);
    const signature = this.webhookService.generateSignature(payload, endpoint.secret);
    const timestamp = Date.now().toString();

    const headers = {
      'X-Nimbus-Signature': signature,
      'X-Nimbus-Event-Id': delivery.eventId,
      'X-Nimbus-Event-Type': delivery.eventType,
      'X-Nimbus-Timestamp': timestamp,
    };

    try {
      const response = await this.httpClient.post(
        endpoint.url,
        payload,
        headers,
        endpoint.timeoutMs,
      );

      const isSuccess = response.status >= 200 && response.status < 300;
      const newStatus: WebhookDeliveryStatus = isSuccess ? 'DELIVERED' : 'ATTEMPTED';

      await this.prisma.client.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: newStatus,
          attempts: delivery.attempts + 1,
          lastAttemptAt: new Date(),
          responseCode: response.status,
          responseBody: response.body,
        },
      });

      if (isSuccess) {
        this.logger.log(`Webhook ${deliveryId} delivered successfully`);
        return { deliveryId, success: true, statusCode: response.status };
      } else {
        this.logger.warn(`Webhook ${deliveryId} attempt ${delivery.attempts + 1} failed: ${response.status}`);
        return { deliveryId, success: false, statusCode: response.status };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.prisma.client.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'ATTEMPTED',
          attempts: delivery.attempts + 1,
          lastAttemptAt: new Date(),
          responseBody: errorMessage.slice(0, 1000),
        },
      });

      this.logger.error(`Webhook ${deliveryId} delivery error: ${errorMessage}`);
      return { deliveryId, success: false, error: errorMessage };
    }
  }

  /**
   * Mark stale deliveries as failed
   * Deliveries stuck in ATTEMPTED for too long become FAILED
   */
  async markStaleAsFailed(staleMinutes = 60): Promise<number> {
    const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);

    const result = await this.prisma.client.webhookDelivery.updateMany({
      where: {
        status: 'ATTEMPTED',
        lastAttemptAt: { lt: cutoff },
      },
      data: {
        status: 'FAILED',
      },
    });

    if (result.count > 0) {
      this.logger.log(`Marked ${result.count} stale deliveries as failed`);
    }

    return result.count;
  }

  /**
   * Get delivery statistics for an org
   */
  async getDeliveryStats(orgId: string, from: Date, to: Date) {
    const deliveries = await this.prisma.client.webhookDelivery.findMany({
      where: {
        endpoint: { orgId },
        createdAt: { gte: from, lte: to },
      },
      select: {
        status: true,
      },
    });

    const stats = {
      total: deliveries.length,
      pending: 0,
      attempted: 0,
      delivered: 0,
      failed: 0,
      deadLetter: 0,
    };

    for (const d of deliveries) {
      switch (d.status) {
        case 'PENDING':
          stats.pending++;
          break;
        case 'ATTEMPTED':
          stats.attempted++;
          break;
        case 'DELIVERED':
          stats.delivered++;
          break;
        case 'FAILED':
          stats.failed++;
          break;
        case 'DEAD_LETTER':
          stats.deadLetter++;
          break;
      }
    }

    return stats;
  }

  /**
   * Get deliveries for export
   */
  async getDeliveriesForExport(orgId: string, from: Date, to: Date): Promise<Array<{
    id: string;
    eventType: string;
    eventId: string;
    status: string;
    attempts: number;
    responseCode: number | null;
    createdAt: Date;
    endpoint: { url: string } | null;
  }>> {
    const results = await this.prisma.client.webhookDelivery.findMany({
      where: {
        endpoint: { orgId },
        createdAt: { gte: from, lte: to },
      },
      include: {
        endpoint: {
          select: { url: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return results as Array<{
      id: string;
      eventType: string;
      eventId: string;
      status: string;
      attempts: number;
      responseCode: number | null;
      createdAt: Date;
      endpoint: { url: string } | null;
    }>;
  }
}
