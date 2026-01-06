/**
 * M10.11: Workforce Notifications Service
 * 
 * Logs workforce-related notifications for:
 * - Availability updates
 * - Shift swap requests and status changes
 * - Open shift claims
 * - Shift assignments
 * 
 * Note: This is workforce-local logging. Actual delivery (email, push, SSE)
 * would be handled by a separate notification delivery module.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';
import type { WorkforceNotificationType, WorkforceNotificationLog } from '@chefcloud/db';

export interface NotificationLogInput {
  orgId: string;
  type: WorkforceNotificationType;
  targetUserId: string;
  performedById?: string;
  entityType: string; // SwapRequest, OpenShift, Availability, etc.
  entityId: string;
  payload?: Prisma.InputJsonValue;
}

export interface NotificationQuery {
  targetUserId?: string;
  type?: WorkforceNotificationType;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

@Injectable()
export class WorkforceNotificationsService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Log a workforce notification
   */
  async log(input: NotificationLogInput): Promise<WorkforceNotificationLog> {
    return this.prisma.client.workforceNotificationLog.create({
      data: {
        orgId: input.orgId,
        type: input.type,
        targetUserId: input.targetUserId,
        performedById: input.performedById ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        payload: input.payload ?? Prisma.JsonNull,
      },
    });
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(orgId: string, query: NotificationQuery) {
    const where: Record<string, unknown> = { orgId };

    if (query.targetUserId) {
      where.targetUserId = query.targetUserId;
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.unreadOnly) {
      where.readAt = null;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.client.workforceNotificationLog.findMany({
        where,
        include: {
          targetUser: {
            select: { id: true, firstName: true, lastName: true },
          },
          performedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
      }),
      this.prisma.client.workforceNotificationLog.count({ where }),
    ]);

    return {
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        targetUser: n.targetUser
          ? { id: n.targetUser.id, name: `${n.targetUser.firstName} ${n.targetUser.lastName}` }
          : null,
        performedBy: n.performedBy
          ? { id: n.performedBy.id, name: `${n.performedBy.firstName} ${n.performedBy.lastName}` }
          : null,
        entityType: n.entityType,
        entityId: n.entityId,
        payload: n.payload,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      total,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    };
  }

  /**
   * Get my notifications (self-service)
   */
  async getMyNotifications(userId: string, orgId: string, query: Omit<NotificationQuery, 'targetUserId'>) {
    return this.getNotifications(orgId, { ...query, targetUserId: userId });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string, orgId: string) {
    const notification = await this.prisma.client.workforceNotificationLog.findFirst({
      where: { id: notificationId, targetUserId: userId, orgId },
    });

    if (!notification) {
      return { success: false, message: 'Notification not found' };
    }

    await this.prisma.client.workforceNotificationLog.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return { success: true };
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string, orgId: string) {
    const result = await this.prisma.client.workforceNotificationLog.updateMany({
      where: { targetUserId: userId, orgId, readAt: null },
      data: { readAt: new Date() },
    });

    return { markedCount: result.count };
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string, orgId: string) {
    const count = await this.prisma.client.workforceNotificationLog.count({
      where: { targetUserId: userId, orgId, readAt: null },
    });

    return { unreadCount: count };
  }

  /**
   * Batch log multiple notifications (e.g., notify all managers)
   */
  async logBatch(inputs: NotificationLogInput[]): Promise<WorkforceNotificationLog[]> {
    if (inputs.length === 0) return [];

    // Prisma createMany doesn't return created records, so we use a transaction
    return this.prisma.client.$transaction(
      inputs.map(input =>
        this.prisma.client.workforceNotificationLog.create({
          data: {
            orgId: input.orgId,
            type: input.type,
            targetUserId: input.targetUserId,
            performedById: input.performedById ?? null,
            entityType: input.entityType,
            entityId: input.entityId,
            payload: input.payload ?? Prisma.JsonNull,
          },
        })
      )
    );
  }

  /**
   * Notify all managers in an org about an event
   */
  async notifyManagers(
    orgId: string,
    branchId: string | null,
    type: WorkforceNotificationType,
    entityType: string,
    entityId: string,
    payload?: Prisma.InputJsonValue,
    performedById?: string,
  ): Promise<WorkforceNotificationLog[]> {
    // Find all managers (L3+) in the org/branch
    const managers = await this.prisma.client.user.findMany({
      where: {
        orgId,
        isActive: true,
        roleLevel: { in: ['L3', 'L4', 'L5'] },
        ...(branchId ? { branchId } : {}),
      },
      select: { id: true },
    });

    const inputs: NotificationLogInput[] = managers.map(m => ({
      orgId,
      type,
      targetUserId: m.id,
      performedById,
      entityType,
      entityId,
      payload,
    }));

    return this.logBatch(inputs);
  }
}
