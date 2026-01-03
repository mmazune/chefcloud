/**
 * M9.3: Reservation Automation Service
 * 
 * Handles:
 * - AC-01: HELD reservation auto-expiry
 * - AC-02: Waitlist auto-promotion
 * - AC-03: Reminder scheduling
 * - AC-06: No-show grace period handling with deposit forfeiture
 * 
 * All actions are audited with SYSTEM actor.
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificationService } from './notification.service';
import { DepositAccountingService } from './deposit-accounting.service';
import { Prisma } from '@chefcloud/db';

interface AutomationConfig {
  intervalMs: number;
  enabled: boolean;
}

@Injectable()
export class AutomationService implements OnModuleDestroy {
  private readonly logger = new Logger(AutomationService.name);
  private intervalHandle: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  private readonly config: AutomationConfig = {
    intervalMs: 60000, // Run every 60 seconds
    enabled: process.env.NODE_ENV !== 'test', // Disabled in tests
  };

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private depositService: DepositAccountingService,
  ) {
    if (this.config.enabled) {
      this.startAutomation();
    }
  }

  onModuleDestroy() {
    this.stopAutomation();
  }

  private startAutomation(): void {
    this.logger.log('Starting reservation automation runner');
    this.intervalHandle = setInterval(() => {
      this.runAutomationCycle().catch((err) => {
        this.logger.error('Automation cycle failed', err);
      });
    }, this.config.intervalMs);
  }

  private stopAutomation(): void {
    this.isShuttingDown = true;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      this.logger.log('Stopped reservation automation runner');
    }
  }

  /**
   * Main automation cycle - runs periodically
   */
  async runAutomationCycle(): Promise<void> {
    if (this.isShuttingDown) return;

    await this.processExpiredHolds();
    await this.processReminders();
    // Note: Waitlist auto-promotion is event-driven (on capacity change)
  }

  /**
   * AC-01: Process expired HELD reservations
   * Transitions HELD -> CANCELLED/EXPIRED after holdExpiresMinutes
   */
  async processExpiredHolds(): Promise<number> {
    const now = new Date();

    // Find all HELD reservations with autoCancelAt <= now
    const expired = await this.prisma.reservation.findMany({
      where: {
        status: 'HELD',
        autoCancelAt: { lte: now },
      },
      include: {
        branch: { select: { id: true, orgId: true } },
      },
    });

    let processed = 0;
    for (const res of expired) {
      if (this.isShuttingDown) break;

      try {
        const beforeState = {
          status: res.status,
          depositStatus: res.depositStatus,
        };

        // If deposit was held, mark as refunded (auto-cancel = refund)
        let newDepositStatus = res.depositStatus;
        if (res.depositStatus === 'HELD') {
          newDepositStatus = 'REFUNDED';
        }

        await this.prisma.reservation.update({
          where: { id: res.id },
          data: {
            status: 'CANCELLED',
            cancellationReason: 'Automatic expiry - hold not confirmed in time',
            depositStatus: newDepositStatus,
          },
        });

        // Log automation action
        await this.logAutomation({
          orgId: res.orgId,
          branchId: res.branchId,
          action: 'HOLD_EXPIRED',
          entityType: 'Reservation',
          entityId: res.id,
          beforeState,
          afterState: { status: 'CANCELLED', depositStatus: newDepositStatus },
        });

        // Send notification
        await this.notificationService.send({
          orgId: res.orgId,
          branchId: res.branchId,
          reservationId: res.id,
          type: 'IN_APP',
          event: 'CANCELLED',
          payload: { reason: 'Hold expired' },
        });

        processed++;
        this.logger.log(`Expired hold for reservation ${res.id}`);
      } catch (err) {
        this.logger.error(`Failed to expire hold ${res.id}`, err);
      }
    }

    return processed;
  }

  /**
   * AC-03: Process scheduled reminders
   * Creates NotificationLog entries for upcoming reservations
   */
  async processReminders(): Promise<number> {
    const now = new Date();

    // Find reservation reminders that are due but not yet sent
    const dueReminders = await this.prisma.client.reservationReminder.findMany({
      where: {
        scheduledAt: { lte: now },
        sentAt: null,
      },
      include: {
        reservation: {
          select: {
            id: true,
            orgId: true,
            branchId: true,
            name: true,
            phone: true,
            startAt: true,
            status: true,
          },
        },
      },
    });

    let processed = 0;
    for (const reminder of dueReminders) {
      if (this.isShuttingDown) break;

      // Skip if reservation is already cancelled/completed
      if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(reminder.reservation.status)) {
        await this.prisma.client.reservationReminder.update({
          where: { id: reminder.id },
          data: { sentAt: now },
        });
        continue;
      }

      try {
        // Send reminder notification (idempotent - check if already sent)
        const existingLog = await this.prisma.client.notificationLog.findFirst({
          where: {
            reservationId: reminder.reservation.id,
            event: 'REMINDER',
            createdAt: { gte: new Date(now.getTime() - 60000) }, // Within last minute
          },
        });

        if (!existingLog) {
          await this.notificationService.send({
            orgId: reminder.reservation.orgId,
            branchId: reminder.reservation.branchId,
            reservationId: reminder.reservation.id,
            type: reminder.channel as 'SMS' | 'EMAIL' | 'IN_APP',
            event: 'REMINDER',
            toAddress: reminder.target,
            payload: {
              name: reminder.reservation.name,
              startAt: reminder.reservation.startAt.toISOString(),
            },
          });

          // Log automation action
          await this.logAutomation({
            orgId: reminder.reservation.orgId,
            branchId: reminder.reservation.branchId,
            action: 'REMINDER_SCHEDULED',
            entityType: 'Reservation',
            entityId: reminder.reservation.id,
            metadata: { reminderId: reminder.id, channel: reminder.channel },
          });
        }

        // Mark reminder as sent
        await this.prisma.client.reservationReminder.update({
          where: { id: reminder.id },
          data: { sentAt: now },
        });

        processed++;
      } catch (err) {
        this.logger.error(`Failed to process reminder ${reminder.id}`, err);
      }
    }

    return processed;
  }

  /**
   * AC-02: Attempt to auto-promote waitlist entry when capacity becomes available
   * Called when a reservation is cancelled/completed
   */
  async tryAutoPromoteWaitlist(branchId: string): Promise<string | null> {
    // Check if branch has auto-promote enabled
    const policy = await this.prisma.client.reservationPolicy.findUnique({
      where: { branchId },
    });

    if (!policy?.waitlistAutoPromote) {
      return null;
    }

    // Find next waiting entry (FIFO)
    const nextEntry = await this.prisma.waitlistEntry.findFirst({
      where: {
        branchId,
        status: 'WAITING',
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!nextEntry) {
      return null;
    }

    // Check availability for this party size
    const now = new Date();
    const endAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hour default

    // Simple capacity check - find available table
    const availableTable = await this.findAvailableTable(
      branchId,
      nextEntry.partySize,
      now,
      endAt,
    );

    if (!availableTable) {
      return null; // No table available
    }

    const beforeState = { status: nextEntry.status };

    // Create reservation from waitlist entry
    const reservation = await this.prisma.reservation.create({
      data: {
        orgId: nextEntry.orgId,
        branchId: nextEntry.branchId,
        tableId: availableTable.id,
        name: nextEntry.name,
        phone: nextEntry.phone,
        partySize: nextEntry.partySize,
        startAt: now,
        endAt,
        status: 'CONFIRMED',
        source: 'INTERNAL',
        notes: `Auto-promoted from waitlist entry ${nextEntry.id}`,
      },
    });

    // Update waitlist entry
    await this.prisma.waitlistEntry.update({
      where: { id: nextEntry.id },
      data: {
        status: 'SEATED',
        seatedAt: now,
        promotedToResId: reservation.id,
      },
    });

    // Log automation action
    await this.logAutomation({
      orgId: nextEntry.orgId,
      branchId,
      action: 'WAITLIST_PROMOTED',
      entityType: 'WaitlistEntry',
      entityId: nextEntry.id,
      beforeState,
      afterState: { status: 'SEATED', promotedToResId: reservation.id },
      metadata: { reservationId: reservation.id },
    });

    // Send notification
    await this.notificationService.send({
      orgId: nextEntry.orgId,
      branchId,
      waitlistId: nextEntry.id,
      reservationId: reservation.id,
      type: 'SMS',
      event: 'WAITLIST_READY',
      toAddress: nextEntry.phone || undefined,
      payload: { name: nextEntry.name, table: availableTable.label },
    });

    this.logger.log(`Auto-promoted waitlist entry ${nextEntry.id} to reservation ${reservation.id}`);

    return reservation.id;
  }

  /**
   * AC-06: Handle no-show with grace period and deposit forfeiture
   */
  async handleNoShowWithGrace(
    orgId: string,
    reservationId: string,
    userId?: string,
  ): Promise<{ forfeited: boolean; amount: number }> {
    // First fetch reservation
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    // Fetch deposits separately with proper enum value
    const deposits = await this.prisma.client.reservationDeposit.findMany({
      where: { reservationId, status: 'PAID' },
    });

    // Get policy for grace period
    const policy = await this.prisma.client.reservationPolicy.findUnique({
      where: { branchId: reservation.branchId },
    });

    const gracePeriodMs = (policy?.noShowGraceMinutes ?? 15) * 60 * 1000;
    const graceExpiry = new Date(reservation.startAt.getTime() + gracePeriodMs);
    const now = new Date();

    // Only forfeit deposit if past grace period
    const pastGrace = now.getTime() > graceExpiry.getTime();
    let forfeitedAmount = 0;

    const beforeState = {
      status: reservation.status,
      depositStatus: reservation.depositStatus,
    };

    // Update reservation status
    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: 'NO_SHOW',
        cancellationReason: pastGrace
          ? 'No-show past grace period - deposit forfeited'
          : 'No-show within grace period',
        cancelledById: userId,
      },
    });

    // Forfeit deposit if applicable (using GL integration)
    if (pastGrace && deposits.length > 0) {
      for (const deposit of deposits) {
        // Mark as forfeited
        await this.prisma.client.reservationDeposit.update({
          where: { id: deposit.id },
          data: { status: 'FORFEITED' },
        });
        forfeitedAmount += Number(deposit.amount);
      }
    }

    // Log automation action
    await this.logAutomation({
      orgId,
      branchId: reservation.branchId,
      action: pastGrace ? 'NO_SHOW_FORFEITED' : 'NO_SHOW_GRACE',
      entityType: 'Reservation',
      entityId: reservationId,
      actorType: userId ? 'USER' : 'SYSTEM',
      actorId: userId,
      beforeState,
      afterState: {
        status: 'NO_SHOW',
        forfeitedAmount,
        pastGrace,
      },
    });

    // Send no-show notification
    await this.notificationService.send({
      orgId,
      branchId: reservation.branchId,
      reservationId,
      type: 'IN_APP',
      event: 'NO_SHOW',
      payload: { forfeited: pastGrace, amount: forfeitedAmount },
    });

    return { forfeited: pastGrace, amount: forfeitedAmount };
  }

  /**
   * Helper: Find available table for party size
   */
  private async findAvailableTable(
    branchId: string,
    partySize: number,
    startAt: Date,
    endAt: Date,
  ): Promise<{ id: string; label: string } | null> {
    // Get all tables for branch with sufficient capacity
    const tables = await this.prisma.client.table.findMany({
      where: {
        branchId,
        capacity: { gte: partySize },
        isActive: true,
      },
    });

    if (tables.length === 0) return null;

    // Find tables with overlapping reservations
    const overlapping = await this.prisma.reservation.findMany({
      where: {
        branchId,
        status: { in: ['HELD', 'CONFIRMED', 'SEATED'] },
        OR: [
          { AND: [{ startAt: { lte: startAt } }, { endAt: { gt: startAt } }] },
          { AND: [{ startAt: { lt: endAt } }, { endAt: { gte: endAt } }] },
          { AND: [{ startAt: { gte: startAt } }, { endAt: { lte: endAt } }] },
        ],
      },
      select: { tableId: true },
    });

    const occupiedIds = new Set(overlapping.filter((r) => r.tableId).map((r) => r.tableId));

    // Return first available table
    const available = tables.find((t) => !occupiedIds.has(t.id));
    return available ? { id: available.id, label: available.label } : null;
  }

  /**
   * Helper: Log automation action to AutomationLog table
   */
  private async logAutomation(params: {
    orgId: string;
    branchId?: string;
    action: string;
    entityType: string;
    entityId: string;
    actorType?: string;
    actorId?: string;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.client.automationLog.create({
      data: {
        orgId: params.orgId,
        branchId: params.branchId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        actorType: params.actorType || 'SYSTEM',
        actorId: params.actorId,
        beforeState: params.beforeState as Prisma.InputJsonValue ?? Prisma.JsonNull,
        afterState: params.afterState as Prisma.InputJsonValue ?? Prisma.JsonNull,
        metadata: params.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
      },
    });
  }

  /**
   * AC-05: Check if adding a reservation would exceed capacity for time slot
   */
  async checkCapacity(
    branchId: string,
    startAt: Date,
    endAt: Date,
    partySize: number,
    excludeReservationId?: string,
  ): Promise<{ allowed: boolean; current: number; max: number | null }> {
    const policy = await this.prisma.client.reservationPolicy.findUnique({
      where: { branchId },
    });

    // If no max capacity configured, always allowed
    if (!policy?.maxCapacityPerSlot) {
      return { allowed: true, current: 0, max: null };
    }

    // Count current capacity in overlapping time slot
    const overlapping = await this.prisma.reservation.findMany({
      where: {
        branchId,
        status: { in: ['HELD', 'CONFIRMED', 'SEATED'] },
        id: excludeReservationId ? { not: excludeReservationId } : undefined,
        OR: [
          { AND: [{ startAt: { lte: startAt } }, { endAt: { gt: startAt } }] },
          { AND: [{ startAt: { lt: endAt } }, { endAt: { gte: endAt } }] },
          { AND: [{ startAt: { gte: startAt } }, { endAt: { lte: endAt } }] },
        ],
      },
      select: { partySize: true },
    });

    const currentCapacity = overlapping.reduce((sum, r) => sum + r.partySize, 0);
    const wouldExceed = currentCapacity + partySize > policy.maxCapacityPerSlot;

    return {
      allowed: !wouldExceed,
      current: currentCapacity,
      max: policy.maxCapacityPerSlot,
    };
  }

  /**
   * Get automation logs for auditing
   */
  async getAutomationLogs(
    orgId: string,
    options: {
      branchId?: string;
      entityType?: string;
      entityId?: string;
      action?: string;
      from?: string;
      to?: string;
      limit?: number;
    } = {},
  ): Promise<unknown[]> {
    const where: Record<string, unknown> = { orgId };

    if (options.branchId) where.branchId = options.branchId;
    if (options.entityType) where.entityType = options.entityType;
    if (options.entityId) where.entityId = options.entityId;
    if (options.action) where.action = options.action;

    if (options.from || options.to) {
      const createdAt: Record<string, unknown> = {};
      if (options.from) createdAt.gte = new Date(options.from);
      if (options.to) createdAt.lte = new Date(options.to);
      where.createdAt = createdAt;
    }

    return this.prisma.client.automationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 100,
    });
  }
}
