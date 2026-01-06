/**
 * M9.2: Notification Service
 * 
 * Provider abstraction for logging notification attempts.
 * In M9.2, no actual delivery - just logging to NotificationLog.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';

type NotificationType = 'EMAIL' | 'SMS' | 'IN_APP';
type NotificationEvent =
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'DEPOSIT_PAID'
  | 'DEPOSIT_REFUNDED'
  | 'DEPOSIT_APPLIED'
  | 'REMINDER'
  | 'WAITLIST_READY'
  | 'BOOKING_CREATED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_MODIFIED';

interface SendNotificationParams {
  orgId: string;
  branchId?: string;
  reservationId?: string;
  waitlistId?: string;
  type: NotificationType;
  event: NotificationEvent;
  toAddress?: string;
  payload?: Prisma.InputJsonValue;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private prisma: PrismaService) { }

  /**
   * Log a notification event.
   * In M9.2, this just creates a log entry. No actual sending.
   */
  async send(params: SendNotificationParams): Promise<string> {
    const log = await this.prisma.client.notificationLog.create({
      data: {
        orgId: params.orgId,
        branchId: params.branchId,
        reservationId: params.reservationId,
        waitlistId: params.waitlistId,
        type: params.type,
        event: params.event,
        toAddress: params.toAddress,
        payloadJson: params.payload ?? Prisma.JsonNull,
        status: 'QUEUED',
      },
    });

    // In M9.2, simulate immediate "send" success
    await this.prisma.client.notificationLog.update({
      where: { id: log.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    this.logger.log(
      `Notification logged: ${params.event} -> ${params.toAddress || 'N/A'} (${log.id})`,
    );

    return log.id;
  }

  /**
   * Find notification logs with filters
   */
  async findLogs(
    orgId: string,
    options: {
      branchId?: string;
      reservationId?: string;
      from?: string;
      to?: string;
      event?: string;
    } = {},
  ): Promise<unknown[]> {
    const where: Record<string, unknown> = { orgId };

    if (options.branchId) {
      where.branchId = options.branchId;
    }

    if (options.reservationId) {
      where.reservationId = options.reservationId;
    }

    if (options.event) {
      where.event = options.event;
    }

    if (options.from || options.to) {
      where.createdAt = {};
      if (options.from) {
        (where.createdAt as Record<string, unknown>).gte = new Date(options.from);
      }
      if (options.to) {
        (where.createdAt as Record<string, unknown>).lte = new Date(options.to);
      }
    }

    return this.prisma.client.notificationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
