/**
 * M9.5: Notification Dispatcher Service
 *
 * Handles notification delivery with outbox pattern and retry logic.
 * Uses provider interface for flexibility (default: FakeProvider for E2E).
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TemplateRenderService, TemplateVariables } from './template-render.service';
import { NotificationType, NotificationOutboxStatus } from '@chefcloud/db';

// Provider interface for external notification services
export interface NotificationProvider {
  send(
    type: NotificationType,
    recipient: string,
    subject: string | null,
    body: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

// Fake provider for testing
export class FakeNotificationProvider implements NotificationProvider {
  public sentNotifications: Array<{
    type: NotificationType;
    recipient: string;
    subject: string | null;
    body: string;
    metadata?: Record<string, unknown>;
  }> = [];

  async send(
    type: NotificationType,
    recipient: string,
    subject: string | null,
    body: string,
    metadata?: Record<string, unknown>,
  ) {
    this.sentNotifications.push({ type, recipient, subject, body, metadata });
    return { success: true, messageId: `fake-${Date.now()}` };
  }

  clear() {
    this.sentNotifications = [];
  }
}

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);
  private provider: NotificationProvider = new FakeNotificationProvider();

  constructor(
    private prisma: PrismaService,
    private templateService: TemplateRenderService,
  ) { }

  /**
   * Set notification provider (for production or testing)
   */
  setProvider(provider: NotificationProvider) {
    this.provider = provider;
  }

  /**
   * Get current provider (for testing)
   */
  getProvider(): NotificationProvider {
    return this.provider;
  }

  /**
   * Queue a notification for delivery
   */
  async queueNotification(
    orgId: string,
    branchId: string | null,
    recipientId: string | null,
    type: NotificationType,
    event: string,
    variables: TemplateVariables,
    metadata?: Record<string, unknown>,
  ): Promise<{
    id: string;
    orgId: string;
    recipientId: string | null;
    type: NotificationType;
    event: string;
    subject: string | null;
    body: string;
    status: NotificationOutboxStatus;
    attempts: number;
  } | null> {
    // Find template
    const template = await this.templateService.findTemplate(orgId, branchId, type, event);

    if (!template) {
      this.logger.warn(`No template found for ${type}/${event} in org ${orgId}`);
      return null;
    }

    // Render template
    const renderedSubject = template.subject
      ? this.templateService.render(template.subject, variables)
      : null;
    const renderedBody = this.templateService.render(template.body, variables);

    // Create outbox record
    const outbox = await this.prisma.client.notificationOutbox.create({
      data: {
        orgId,
        recipientId,
        type,
        event,
        subject: renderedSubject,
        body: renderedBody,
        status: 'PENDING',
        metadata: metadata as object,
      },
    });

    this.logger.log(`Queued notification ${outbox.id} for ${event}`);
    return outbox;
  }

  /**
   * Process pending notifications
   */
  async processPendingNotifications(limit = 50): Promise<number> {
    const pending = await this.prisma.client.notificationOutbox.findMany({
      where: {
        status: { in: ['PENDING', 'RETRYING'] },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let processed = 0;

    for (const notification of pending) {
      await this.attemptDelivery(notification.id);
      processed++;
    }

    return processed;
  }

  /**
   * Attempt to deliver a notification
   */
  async attemptDelivery(outboxId: string): Promise<boolean> {
    const notification = await this.prisma.client.notificationOutbox.findUnique({
      where: { id: outboxId },
    });

    if (!notification) {
      this.logger.warn(`Notification ${outboxId} not found`);
      return false;
    }

    // Get recipient address from metadata
    const metadata = notification.metadata as Record<string, unknown> | null;
    const recipient = (metadata?.recipient as string) || notification.recipientId || 'unknown';

    try {
      const result = await this.provider.send(
        notification.type,
        recipient,
        notification.subject,
        notification.body,
        metadata ?? undefined,
      );

      if (result.success) {
        await this.prisma.client.notificationOutbox.update({
          where: { id: outboxId },
          data: {
            status: 'SENT',
            attempts: notification.attempts + 1,
            metadata: {
              ...(metadata || {}),
              messageId: result.messageId,
              sentAt: new Date().toISOString(),
            },
          },
        });
        this.logger.log(`Notification ${outboxId} sent successfully`);
        return true;
      } else {
        await this.handleFailure(outboxId, notification.attempts, result.error);
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.handleFailure(outboxId, notification.attempts, errorMessage);
      return false;
    }
  }

  /**
   * Handle delivery failure
   */
  private async handleFailure(outboxId: string, currentAttempts: number, error?: string) {
    const maxRetries = 3;
    const newAttempts = currentAttempts + 1;
    const newStatus: NotificationOutboxStatus = newAttempts >= maxRetries ? 'FAILED' : 'RETRYING';

    await this.prisma.client.notificationOutbox.update({
      where: { id: outboxId },
      data: {
        status: newStatus,
        attempts: newAttempts,
        lastError: error,
      },
    });

    this.logger.warn(`Notification ${outboxId} attempt ${newAttempts} failed: ${error}`);
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(orgId: string, from: Date, to: Date) {
    const notifications = await this.prisma.client.notificationOutbox.findMany({
      where: {
        orgId,
        createdAt: { gte: from, lte: to },
      },
      select: {
        status: true,
        type: true,
      },
    });

    const stats = {
      total: notifications.length,
      pending: 0,
      sent: 0,
      failed: 0,
      retrying: 0,
      byType: {} as Record<string, number>,
    };

    for (const n of notifications) {
      switch (n.status) {
        case 'PENDING':
          stats.pending++;
          break;
        case 'SENT':
          stats.sent++;
          break;
        case 'FAILED':
          stats.failed++;
          break;
        case 'RETRYING':
          stats.retrying++;
          break;
      }

      stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get notifications for export
   */
  async getNotificationsForExport(orgId: string, from: Date, to: Date): Promise<Array<{
    id: string;
    type: NotificationType;
    event: string;
    status: NotificationOutboxStatus;
    attempts: number;
    createdAt: Date;
  }>> {
    const results = await this.prisma.client.notificationOutbox.findMany({
      where: {
        orgId,
        createdAt: { gte: from, lte: to },
      },
      orderBy: { createdAt: 'desc' },
    });
    return results;
  }

  /**
   * Get recent notifications for a recipient (for self-service page)
   */
  async getRecentForRecipient(recipientId: string, limit = 5) {
    return this.prisma.client.notificationOutbox.findMany({
      where: { recipientId },
      select: {
        id: true,
        type: true,
        event: true,
        status: true,
        createdAt: true,
        // Don't expose full body/subject for privacy
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
