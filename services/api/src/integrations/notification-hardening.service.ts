/**
 * M9.6: Notification Hardening Service
 *
 * Implements dead-letter replay for failed notifications.
 * Extends M9.5 notification infrastructure with resilience patterns.
 */
import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { NotificationOutbox } from '@chefcloud/db';

export interface NotificationReplayResult {
  notificationId: string;
  success: boolean;
  newStatus: string;
  attempts: number;
  error?: string;
}

@Injectable()
export class NotificationHardeningService {
  private readonly logger = new Logger(NotificationHardeningService.name);

  constructor(private prisma: PrismaService) { }

  /**
   * Get failed notifications for an org
   */
  async getFailedNotifications(
    orgId: string,
    limit = 50,
  ): Promise<NotificationOutbox[]> {
    return this.prisma.client.notificationOutbox.findMany({
      where: {
        orgId,
        status: 'FAILED',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Replay a failed notification (L5 only)
   * Resets status to PENDING for reprocessing
   */
  async replayNotification(
    orgId: string,
    notificationId: string,
    userId: string,
  ): Promise<NotificationReplayResult> {
    const notification = await this.prisma.client.notificationOutbox.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new BadRequestException('Notification not found');
    }

    if (notification.orgId !== orgId) {
      throw new ForbiddenException('Notification belongs to another organization');
    }

    if (notification.status !== 'FAILED') {
      throw new BadRequestException('Only FAILED notifications can be replayed');
    }

    // Reset to PENDING for reprocessing
    const updated = await this.prisma.client.notificationOutbox.update({
      where: { id: notificationId },
      data: {
        status: 'PENDING',
        attempts: 0,
        lastError: null,
      },
    });

    this.logger.log(`Notification ${notificationId} replayed by user ${userId}`);

    return {
      notificationId,
      success: true,
      newStatus: updated.status,
      attempts: updated.attempts,
    };
  }

  /**
   * Bulk replay failed notifications (L5 only)
   */
  async replayNotificationBulk(
    orgId: string,
    notificationIds: string[],
    userId: string,
  ): Promise<NotificationReplayResult[]> {
    const results: NotificationReplayResult[] = [];

    for (const id of notificationIds) {
      try {
        const result = await this.replayNotification(orgId, id, userId);
        results.push(result);
      } catch (error) {
        results.push({
          notificationId: id,
          success: false,
          newStatus: 'FAILED',
          attempts: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Get notification stats by status
   */
  async getNotificationStatusCounts(orgId: string): Promise<Record<string, number>> {
    const counts = await this.prisma.client.notificationOutbox.groupBy({
      by: ['status'],
      where: { orgId },
      _count: true,
    });

    const result: Record<string, number> = {
      PENDING: 0,
      SENT: 0,
      FAILED: 0,
      RETRYING: 0,
    };

    for (const c of counts) {
      result[c.status] = c._count;
    }

    return result;
  }
}
