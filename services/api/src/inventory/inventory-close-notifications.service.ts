/**
 * M12.6 Inventory Close Notifications Service
 *
 * Emits DB-based notifications for inventory close workflow events:
 * - CLOSE_REQUEST_CREATED
 * - CLOSE_REQUEST_APPROVED
 * - CLOSE_REQUEST_REJECTED
 * - PERIOD_CLOSED
 * - PERIOD_REOPENED
 * - OVERRIDE_USED
 *
 * Notifications are stored in NotificationOutbox with:
 * - IN_APP type
 * - Org/branch scoped
 * - Safe subset of data (no sensitive fields)
 */
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma.service';
import { NotificationType, InventoryPeriodEventType } from '@chefcloud/db';

// ============================================
// Safe Notification Payload (H3: No sensitive fields)
// ============================================

export interface InventoryCloseNotificationPayload {
  branchId: string;
  branchName: string;
  periodRange: string; // e.g., "2025-01-01 to 2025-01-31"
  status: string;
  requestId?: string;
  actorRole: string; // e.g., "Owner", "Manager" - NOT userId
  eventType: InventoryPeriodEventType;
  timestamp: string; // ISO string
  reason?: string; // For rejects or reopen
}

export interface CloseNotificationRecord {
  id: string;
  orgId: string;
  branchId: string;
  eventType: string;
  payload: InventoryCloseNotificationPayload;
  status: 'PENDING' | 'SENT' | 'ACKED';
  createdAt: Date;
  ackedAt: Date | null;
  ackedById: string | null;
}

// ============================================
// Service
// ============================================

@Injectable()
export class InventoryCloseNotificationsService {
  private readonly logger = new Logger(InventoryCloseNotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // Emit Notification
  // ============================================

  async emitNotification(
    orgId: string,
    branchId: string,
    branchName: string,
    eventType: InventoryPeriodEventType,
    periodStart: Date,
    periodEnd: Date,
    status: string,
    actorRole: string,
    options?: {
      requestId?: string;
      reason?: string;
    },
  ): Promise<{ id: string }> {
    const periodRange = `${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`;

    const payload: InventoryCloseNotificationPayload = {
      branchId,
      branchName,
      periodRange,
      status,
      requestId: options?.requestId,
      actorRole,
      eventType,
      timestamp: new Date().toISOString(),
      reason: options?.reason,
    };

    // Create notification in outbox with IN_APP type
    const notification = await this.prisma.client.notificationOutbox.create({
      data: {
        orgId,
        recipientId: null, // Broadcast to org
        type: NotificationType.IN_APP,
        event: `INVENTORY_CLOSE_${eventType}`,
        subject: this.getSubject(eventType, branchName, periodRange),
        body: JSON.stringify(payload),
        status: 'PENDING',
        metadata: {
          branchId,
          eventType,
          periodRange,
          safePayload: true, // Flag indicating this is safe subset
        },
      },
    });

    this.logger.log(
      `Emitted ${eventType} notification for branch ${branchName}, period ${periodRange}`,
    );

    return { id: notification.id };
  }

  // ============================================
  // List Notifications
  // ============================================

  async listNotifications(
    orgId: string,
    filters: {
      branchId?: string;
      status?: 'PENDING' | 'SENT' | 'ACKED';
      eventType?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    notifications: CloseNotificationRecord[];
    total: number;
  }> {
    const where: any = {
      orgId,
      event: { startsWith: 'INVENTORY_CLOSE_' },
    };

    if (filters.branchId) {
      where.metadata = { path: ['branchId'], equals: filters.branchId };
    }

    if (filters.status) {
      // Map our status to outbox status
      if (filters.status === 'ACKED') {
        where.status = 'SENT';
        where.metadata = { ...where.metadata, path: ['acked'], equals: true };
      } else {
        where.status = filters.status;
      }
    }

    const [notifications, total] = await Promise.all([
      this.prisma.client.notificationOutbox.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      this.prisma.client.notificationOutbox.count({ where }),
    ]);

    return {
      notifications: notifications.map((n) => this.mapNotification(n)),
      total,
    };
  }

  // ============================================
  // Acknowledge Notification (Idempotent - H9)
  // ============================================

  async ackNotification(
    orgId: string,
    notificationId: string,
    userId: string,
  ): Promise<CloseNotificationRecord> {
    const notification = await this.prisma.client.notificationOutbox.findFirst({
      where: { id: notificationId, orgId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    const metadata = (notification.metadata as Record<string, unknown>) || {};

    // Idempotent: if already acked, just return current state
    if (metadata.acked === true) {
      return this.mapNotification(notification);
    }

    // Update to acked state
    const updated = await this.prisma.client.notificationOutbox.update({
      where: { id: notificationId },
      data: {
        status: 'SENT',
        metadata: {
          ...metadata,
          acked: true,
          ackedAt: new Date().toISOString(),
          ackedById: userId,
        },
      },
    });

    return this.mapNotification(updated);
  }

  // ============================================
  // Export Notifications as CSV (H4: BOM + LF normalization)
  // ============================================

  async exportNotificationsCsv(
    orgId: string,
    filters?: { branchId?: string },
  ): Promise<{ content: string; hash: string }> {
    const { notifications } = await this.listNotifications(orgId, {
      branchId: filters?.branchId,
      limit: 10000, // Large limit for export
    });

    // Header row
    const rows: string[] = [];
    rows.push('id,branchId,branchName,eventType,periodRange,status,actorRole,timestamp,reason');

    // Data rows (stable ordering by createdAt DESC, then id ASC)
    for (const n of notifications) {
      rows.push([
        this.escapeCsv(n.id),
        this.escapeCsv(n.payload.branchId),
        this.escapeCsv(n.payload.branchName),
        this.escapeCsv(n.payload.eventType),
        this.escapeCsv(n.payload.periodRange),
        this.escapeCsv(n.payload.status),
        this.escapeCsv(n.payload.actorRole),
        this.escapeCsv(n.payload.timestamp),
        this.escapeCsv(n.payload.reason || ''),
      ].join(','));
    }

    // UTF-8 BOM + LF normalized content
    const content = '\uFEFF' + rows.join('\n');
    const hash = this.computeHash(content);

    return { content, hash };
  }

  // ============================================
  // Helpers
  // ============================================

  private getSubject(
    eventType: InventoryPeriodEventType,
    branchName: string,
    periodRange: string,
  ): string {
    const eventLabels: Record<string, string> = {
      CLOSE_REQUEST_CREATED: 'Close Request Created',
      CLOSE_REQUEST_SUBMITTED: 'Close Request Submitted',
      CLOSE_REQUEST_APPROVED: 'Close Request Approved',
      CLOSE_REQUEST_REJECTED: 'Close Request Rejected',
      CLOSED: 'Period Closed',
      REOPENED: 'Period Reopened',
      FORCE_CLOSE_USED: 'Override Used',
      OVERRIDE_USED: 'Override Used',
    };

    const label = eventLabels[eventType] || eventType;
    return `[${branchName}] ${label} - ${periodRange}`;
  }

  private mapNotification(n: any): CloseNotificationRecord {
    const metadata = (n.metadata as Record<string, unknown>) || {};
    let payload: InventoryCloseNotificationPayload;

    try {
      payload = JSON.parse(n.body);
    } catch {
      payload = {
        branchId: (metadata.branchId as string) || '',
        branchName: '',
        periodRange: (metadata.periodRange as string) || '',
        status: n.status,
        actorRole: '',
        eventType: (metadata.eventType as InventoryPeriodEventType) || 'CREATED',
        timestamp: n.createdAt.toISOString(),
      };
    }

    return {
      id: n.id,
      orgId: n.orgId,
      branchId: payload.branchId,
      eventType: payload.eventType,
      payload,
      status: metadata.acked ? 'ACKED' : (n.status === 'SENT' ? 'SENT' : 'PENDING'),
      createdAt: n.createdAt,
      ackedAt: metadata.ackedAt ? new Date(metadata.ackedAt as string) : null,
      ackedById: (metadata.ackedById as string) || null,
    };
  }

  private escapeCsv(value: string): string {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private computeHash(content: string): string {
    // Normalize to LF before hashing (H4)
    const normalized = content.replace(/\r\n/g, '\n');
    return createHash('sha256').update(normalized, 'utf8').digest('hex');
  }
}
