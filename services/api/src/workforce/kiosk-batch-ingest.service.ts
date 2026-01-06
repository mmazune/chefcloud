/**
 * M10.22: Kiosk Batch Ingest Service
 *
 * Handles batch event ingestion with:
 * - Idempotency enforcement (H1)
 * - Sequence validation (H2)
 * - No timers (H3)
 * - Audit completeness (H7)
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WorkforceAuditService, WorkforceAuditAction } from './workforce-audit.service';
import { KioskTimeclockService } from './kiosk-timeclock.service';
import { WorkforceTimeclockService } from './workforce-timeclock.service';

export interface BatchEventInput {
  idempotencyKey: string;
  type: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';
  occurredAt: Date;
  pin: string;
}

export interface BatchEventResult {
  idempotencyKey: string;
  status: 'ACCEPTED' | 'REJECTED';
  code?: string;
  timeEntryId?: string;
  breakEntryId?: string;
}

export interface BatchIngestResult {
  batchId: string;
  eventCount: number;
  acceptedCount: number;
  rejectedCount: number;
  results: BatchEventResult[];
}

interface DeviceInfo {
  id: string;
  orgId: string;
  branchId: string;
  name: string;
}

@Injectable()
export class KioskBatchIngestService {
  private readonly logger = new Logger(KioskBatchIngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: WorkforceAuditService,
    private readonly kioskTimeclockService: KioskTimeclockService,
    private readonly timeclockService: WorkforceTimeclockService,
  ) { }

  /**
   * Process a batch of events from a kiosk device.
   * Called from controller with device already validated.
   * Idempotent: same idempotencyKey returns same result.
   */
  async processBatch(
    device: DeviceInfo,
    batchId: string,
    events: BatchEventInput[],
    ipAddress?: string,
  ): Promise<BatchIngestResult> {
    const { id: kioskDeviceId, orgId, branchId } = device;

    // Check for existing batch (idempotency at batch level)
    const existingBatch = await this.prisma.client.kioskEventIngest.findUnique({
      where: {
        kioskDeviceId_batchId: { kioskDeviceId, batchId },
      },
    });

    if (existingBatch && existingBatch.status === 'PROCESSED') {
      // Return existing results from KioskEvent records
      const existingEvents = await this.prisma.client.kioskEvent.findMany({
        where: {
          kioskDeviceId,
          idempotencyKey: { in: events.map(e => e.idempotencyKey) },
        },
      });

      const results: BatchEventResult[] = existingEvents.map(e => ({
        idempotencyKey: e.idempotencyKey,
        status: e.status as 'ACCEPTED' | 'REJECTED',
        code: e.rejectCode || undefined,
        timeEntryId: e.timeEntryId || undefined,
        breakEntryId: e.breakEntryId || undefined,
      }));

      return {
        batchId,
        eventCount: existingBatch.eventCount,
        acceptedCount: existingBatch.acceptedCount,
        rejectedCount: existingBatch.rejectedCount,
        results,
      };
    }

    // Create batch record
    const ingest = await this.prisma.client.kioskEventIngest.upsert({
      where: {
        kioskDeviceId_batchId: { kioskDeviceId, batchId },
      },
      create: {
        kioskDeviceId,
        batchId,
        eventCount: events.length,
        status: 'RECEIVED',
      },
      update: {
        eventCount: events.length,
        status: 'RECEIVED',
      },
    });

    // Audit batch received
    await this.auditService.logAction({
      orgId,
      performedById: 'SYSTEM_KIOSK',
      action: WorkforceAuditAction.KIOSK_EVENT_BATCH_RECEIVED,
      entityType: 'KioskEventIngest',
      entityId: ingest.id,
      payload: {
        description: `Batch ${batchId} received with ${events.length} events`,
        kioskDeviceId,
        branchId,
        batchId,
        eventCount: events.length,
      },
    });

    // Process each event
    const results: BatchEventResult[] = [];
    let acceptedCount = 0;
    let rejectedCount = 0;

    for (const event of events) {
      const result = await this.processEvent(
        device,
        event,
        ipAddress,
      );
      results.push(result);

      if (result.status === 'ACCEPTED') {
        acceptedCount++;
      } else {
        rejectedCount++;
      }
    }

    // Update batch status
    await this.prisma.client.kioskEventIngest.update({
      where: { id: ingest.id },
      data: {
        status: 'PROCESSED',
        acceptedCount,
        rejectedCount,
        diagnostics: JSON.stringify({
          processedAt: new Date().toISOString(),
          acceptedKeys: results.filter(r => r.status === 'ACCEPTED').map(r => r.idempotencyKey),
        }).slice(0, 1000), // Truncate for safety
      },
    });

    return {
      batchId,
      eventCount: events.length,
      acceptedCount,
      rejectedCount,
      results,
    };
  }

  /**
   * Process a single event, enforcing idempotency.
   */
  private async processEvent(
    device: DeviceInfo,
    event: BatchEventInput,
    ipAddress?: string,
  ): Promise<BatchEventResult> {
    const { id: kioskDeviceId, orgId, branchId } = device;
    const { idempotencyKey, type, occurredAt, pin } = event;

    // Check for existing event (idempotency at event level, H1)
    const existingEvent = await this.prisma.client.kioskEvent.findUnique({
      where: {
        kioskDeviceId_idempotencyKey: {
          kioskDeviceId,
          idempotencyKey,
        },
      },
    });

    if (existingEvent) {
      // Return stored result without re-processing
      return {
        idempotencyKey,
        status: existingEvent.status as 'ACCEPTED' | 'REJECTED',
        code: existingEvent.rejectCode || undefined,
        timeEntryId: existingEvent.timeEntryId || undefined,
        breakEntryId: existingEvent.breakEntryId || undefined,
      };
    }

    // Validate PIN format (never store raw PIN, H4)
    if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
      return await this.createRejectedEvent(
        kioskDeviceId,
        orgId,
        branchId,
        idempotencyKey,
        type,
        occurredAt,
        'INVALID_PIN_FORMAT',
        ipAddress,
      );
    }

    try {
      // Lookup user by PIN (org-scoped)
      const lookup = await this.kioskTimeclockService.lookupUserByPin(orgId, pin);
      if (!lookup) {
        return await this.createRejectedEvent(
          kioskDeviceId,
          orgId,
          branchId,
          idempotencyKey,
          type,
          occurredAt,
          'INVALID_PIN',
          ipAddress,
        );
      }

      const userId = lookup.user.id;

      // Check rate limiting (DB-based, H3)
      const allowed = await this.kioskTimeclockService.checkPinRateLimit(kioskDeviceId, orgId);
      if (!allowed) {
        return await this.createRejectedEvent(
          kioskDeviceId,
          orgId,
          branchId,
          idempotencyKey,
          type,
          occurredAt,
          'RATE_LIMITED',
          ipAddress,
          userId,
        );
      }

      // Validate sequence (H2)
      const sequenceError = await this.validateSequence(userId, type);
      if (sequenceError) {
        return await this.createRejectedEvent(
          kioskDeviceId,
          orgId,
          branchId,
          idempotencyKey,
          type,
          occurredAt,
          sequenceError,
          ipAddress,
          userId,
        );
      }

      // Execute timeclock action via WorkforceTimeclockService
      let timeEntryId: string | undefined;
      let breakEntryId: string | undefined;

      switch (type) {
        case 'CLOCK_IN': {
          const entry = await this.timeclockService.clockIn({
            userId,
            orgId,
            branchId,
            method: 'PASSWORD',
            kioskDeviceId,
          });
          timeEntryId = entry?.id;
          break;
        }
        case 'CLOCK_OUT': {
          const entry = await this.timeclockService.clockOut(userId, orgId);
          timeEntryId = entry?.id;
          break;
        }
        case 'BREAK_START': {
          const breakEntry = await this.timeclockService.startBreak(userId, orgId);
          breakEntryId = breakEntry?.id;
          break;
        }
        case 'BREAK_END': {
          // Find active break for this user
          const activeEntry = await this.prisma.client.timeEntry.findFirst({
            where: { userId, clockOutAt: null },
          });
          if (activeEntry) {
            const activeBreakEntry = await this.prisma.client.breakEntry.findFirst({
              where: { timeEntryId: activeEntry.id, endedAt: null },
            });
            if (activeBreakEntry) {
              const ended = await this.timeclockService.endBreak(activeBreakEntry.id);
              breakEntryId = ended?.id;
            }
          }
          break;
        }
      }

      // Create accepted event record
      await this.prisma.client.kioskEvent.create({
        data: {
          orgId,
          branchId,
          kioskDeviceId,
          type,
          occurredAt,
          idempotencyKey,
          status: 'ACCEPTED',
          timeEntryId,
          breakEntryId,
          userId,
          payloadJson: { occurredAt: occurredAt.toISOString() }, // Sanitized, no PIN
        },
      });

      // Audit accepted event (H7)
      await this.auditService.logAction({
        orgId,
        performedById: userId,
        action: WorkforceAuditAction.KIOSK_EVENT_ACCEPTED,
        entityType: 'KioskEvent',
        entityId: idempotencyKey,
        payload: {
          description: `${type} accepted via kiosk batch`,
          kioskDeviceId,
          branchId,
          idempotencyKey,
          timeEntryId,
          breakEntryId,
        },
      });

      return {
        idempotencyKey,
        status: 'ACCEPTED',
        timeEntryId,
        breakEntryId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Event processing failed: ${errorMessage}`, error);

      return await this.createRejectedEvent(
        kioskDeviceId,
        orgId,
        branchId,
        idempotencyKey,
        type,
        occurredAt,
        'PROCESSING_ERROR',
        ipAddress,
      );
    }
  }

  /**
   * Validate event sequence (H2).
   * Returns error code if sequence is invalid.
   */
  private async validateSequence(
    userId: string,
    type: string,
  ): Promise<string | null> {
    // Get user's current clock state
    const activeEntry = await this.prisma.client.timeEntry.findFirst({
      where: {
        userId,
        clockOutAt: null,
      },
    });

    // Check for active break
    const activeBreak = activeEntry
      ? await this.prisma.client.breakEntry.findFirst({
        where: {
          timeEntryId: activeEntry.id,
          endedAt: null,
        },
      })
      : null;

    const isClockedIn = !!activeEntry;
    const isOnBreak = !!activeBreak;

    switch (type) {
      case 'CLOCK_IN':
        if (isClockedIn) {
          return 'ALREADY_CLOCKED_IN';
        }
        break;
      case 'CLOCK_OUT':
        if (!isClockedIn) {
          return 'NOT_CLOCKED_IN';
        }
        if (isOnBreak) {
          return 'ON_BREAK';
        }
        break;
      case 'BREAK_START':
        if (!isClockedIn) {
          return 'NOT_CLOCKED_IN';
        }
        if (isOnBreak) {
          return 'ALREADY_ON_BREAK';
        }
        break;
      case 'BREAK_END':
        if (!isClockedIn) {
          return 'NOT_CLOCKED_IN';
        }
        if (!isOnBreak) {
          return 'NOT_ON_BREAK';
        }
        break;
    }

    return null;
  }

  /**
   * Create a rejected event record.
   */
  private async createRejectedEvent(
    kioskDeviceId: string,
    orgId: string,
    branchId: string,
    idempotencyKey: string,
    type: string,
    occurredAt: Date,
    rejectCode: string,
    ipAddress?: string,
    userId?: string,
  ): Promise<BatchEventResult> {
    await this.prisma.client.kioskEvent.create({
      data: {
        orgId,
        branchId,
        kioskDeviceId,
        type,
        occurredAt,
        idempotencyKey,
        status: 'REJECTED',
        rejectCode,
        userId,
        payloadJson: { occurredAt: occurredAt.toISOString() }, // Sanitized, no PIN
      },
    });

    // Audit rejected event (H7)
    await this.auditService.logAction({
      orgId,
      performedById: userId || 'SYSTEM_KIOSK',
      action: WorkforceAuditAction.KIOSK_EVENT_REJECTED,
      entityType: 'KioskEvent',
      entityId: idempotencyKey,
      payload: {
        description: `${type} rejected: ${rejectCode}`,
        kioskDeviceId,
        branchId,
        idempotencyKey,
        rejectCode,
        ipAddress,
      },
    });

    return {
      idempotencyKey,
      status: 'REJECTED',
      code: rejectCode,
    };
  }
}
