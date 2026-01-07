/**
 * M12.2: Inventory Period Events Service
 *
 * Manages audit-grade append-only event log for inventory periods.
 * Tracks: CREATED, CLOSED, REOPENED, OVERRIDE_USED, EXPORT_GENERATED
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { InventoryPeriodEventType } from '@chefcloud/db';

export interface LogEventDto {
  orgId: string;
  branchId: string;
  periodId: string;
  type: InventoryPeriodEventType;
  actorUserId: string;
  reason?: string;
  metadataJson?: Record<string, unknown>;
}

export interface PeriodEvent {
  id: string;
  type: InventoryPeriodEventType;
  actorUserId: string;
  actorName?: string;
  occurredAt: string;
  reason: string | null;
  metadataJson: Record<string, unknown> | null;
}

@Injectable()
export class InventoryPeriodEventsService {
  private readonly logger = new Logger(InventoryPeriodEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an event to the period audit trail.
   * Append-only - events cannot be modified or deleted.
   */
  async logEvent(dto: LogEventDto): Promise<PeriodEvent> {
    const event = await this.prisma.client.inventoryPeriodEvent.create({
      data: {
        orgId: dto.orgId,
        branchId: dto.branchId,
        periodId: dto.periodId,
        type: dto.type,
        actorUserId: dto.actorUserId,
        reason: dto.reason,
        metadataJson: dto.metadataJson as object ?? undefined,
      },
    });

    this.logger.debug(
      `Period event: ${dto.type} for period ${dto.periodId} by ${dto.actorUserId}`,
    );

    return {
      id: event.id,
      type: event.type,
      actorUserId: event.actorUserId,
      occurredAt: event.occurredAt.toISOString(),
      reason: event.reason,
      metadataJson: event.metadataJson as Record<string, unknown> | null,
    };
  }

  /**
   * Get all events for a period.
   */
  async getEventsForPeriod(
    orgId: string,
    periodId: string,
  ): Promise<PeriodEvent[]> {
    const events = await this.prisma.client.inventoryPeriodEvent.findMany({
      where: {
        orgId,
        periodId,
      },
      include: {
        actor: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { occurredAt: 'asc' },
    });

    return events.map((e) => ({
      id: e.id,
      type: e.type,
      actorUserId: e.actorUserId,
      actorName: e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : undefined,
      occurredAt: e.occurredAt.toISOString(),
      reason: e.reason,
      metadataJson: e.metadataJson as Record<string, unknown> | null,
    }));
  }

  /**
   * Count events by type for a period.
   */
  async countEventsByType(
    orgId: string,
    periodId: string,
  ): Promise<Record<InventoryPeriodEventType, number>> {
    const counts = await this.prisma.client.inventoryPeriodEvent.groupBy({
      by: ['type'],
      where: { orgId, periodId },
      _count: { type: true },
    });

    const result: Partial<Record<InventoryPeriodEventType, number>> = {};
    for (const c of counts) {
      result[c.type] = c._count.type;
    }

    // Fill in zeros for missing types
    const allTypes: InventoryPeriodEventType[] = [
      'CREATED',
      'CLOSED',
      'REOPENED',
      'OVERRIDE_USED',
      'EXPORT_GENERATED',
    ];
    for (const t of allTypes) {
      if (!(t in result)) {
        result[t] = 0;
      }
    }

    return result as Record<InventoryPeriodEventType, number>;
  }
}
