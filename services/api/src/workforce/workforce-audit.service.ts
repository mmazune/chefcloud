/**
 * M10.1: Workforce Audit Service
 *
 * Audit logging for workforce actions (scheduling, timeclock, approvals).
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export enum WorkforceAuditAction {
  SHIFT_CREATED = 'SHIFT_CREATED',
  SHIFT_UPDATED = 'SHIFT_UPDATED',
  SHIFT_PUBLISHED = 'SHIFT_PUBLISHED',
  SHIFT_STARTED = 'SHIFT_STARTED',
  SHIFT_COMPLETED = 'SHIFT_COMPLETED',
  SHIFT_APPROVED = 'SHIFT_APPROVED',
  SHIFT_CANCELLED = 'SHIFT_CANCELLED',
  CLOCK_IN = 'CLOCK_IN',
  CLOCK_OUT = 'CLOCK_OUT',
  BREAK_START = 'BREAK_START',
  BREAK_END = 'BREAK_END',
  TEMPLATE_CREATED = 'TEMPLATE_CREATED',
  TEMPLATE_UPDATED = 'TEMPLATE_UPDATED',
  TEMPLATE_DELETED = 'TEMPLATE_DELETED',
}

interface AuditLogData {
  orgId: string;
  performedById: string;
  action: WorkforceAuditAction;
  entityType: 'SHIFT' | 'TIME_ENTRY' | 'BREAK' | 'TEMPLATE';
  entityId: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class WorkforceAuditService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== Log Action =====

  async logAction(data: AuditLogData): Promise<void> {
    await this.prisma.client.workforceAuditLog.create({
      data: {
        orgId: data.orgId,
        performedById: data.performedById,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        payload: data.payload ? JSON.parse(JSON.stringify(data.payload)) : null,
        createdAt: new Date(),
      },
    });
  }

  // ===== Query Logs =====

  async getAuditLogs(filters: {
    orgId: string;
    entityType?: 'SHIFT' | 'TIME_ENTRY' | 'BREAK' | 'TEMPLATE';
    entityId?: string;
    performedById?: string;
    action?: WorkforceAuditAction;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: unknown[]; total: number }> {
    const where: Record<string, unknown> = {
      orgId: filters.orgId,
    };

    if (filters.entityType) {
      where.entityType = filters.entityType;
    }
    if (filters.entityId) {
      where.entityId = filters.entityId;
    }
    if (filters.performedById) {
      where.performedById = filters.performedById;
    }
    if (filters.action) {
      where.action = filters.action;
    }
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) {
        (where.createdAt as Record<string, Date>).gte = filters.from;
      }
      if (filters.to) {
        (where.createdAt as Record<string, Date>).lte = filters.to;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.client.workforceAuditLog.findMany({
        where,
        include: {
          performedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
      }),
      this.prisma.client.workforceAuditLog.count({ where }),
    ]);

    return { logs, total };
  }

  // ===== Convenience Methods =====

  async logShiftCreated(
    orgId: string,
    performedById: string,
    shiftId: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.logAction({
      orgId,
      performedById,
      action: WorkforceAuditAction.SHIFT_CREATED,
      entityType: 'SHIFT',
      entityId: shiftId,
      payload,
    });
  }

  async logShiftPublished(
    orgId: string,
    performedById: string,
    shiftId: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.logAction({
      orgId,
      performedById,
      action: WorkforceAuditAction.SHIFT_PUBLISHED,
      entityType: 'SHIFT',
      entityId: shiftId,
      payload,
    });
  }

  async logShiftApproved(
    orgId: string,
    performedById: string,
    shiftId: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.logAction({
      orgId,
      performedById,
      action: WorkforceAuditAction.SHIFT_APPROVED,
      entityType: 'SHIFT',
      entityId: shiftId,
      payload,
    });
  }

  async logClockIn(
    orgId: string,
    performedById: string,
    timeEntryId: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.logAction({
      orgId,
      performedById,
      action: WorkforceAuditAction.CLOCK_IN,
      entityType: 'TIME_ENTRY',
      entityId: timeEntryId,
      payload,
    });
  }

  async logClockOut(
    orgId: string,
    performedById: string,
    timeEntryId: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.logAction({
      orgId,
      performedById,
      action: WorkforceAuditAction.CLOCK_OUT,
      entityType: 'TIME_ENTRY',
      entityId: timeEntryId,
      payload,
    });
  }

  async logBreakStart(
    orgId: string,
    performedById: string,
    breakId: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.logAction({
      orgId,
      performedById,
      action: WorkforceAuditAction.BREAK_START,
      entityType: 'BREAK',
      entityId: breakId,
      payload,
    });
  }

  async logBreakEnd(
    orgId: string,
    performedById: string,
    breakId: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.logAction({
      orgId,
      performedById,
      action: WorkforceAuditAction.BREAK_END,
      entityType: 'BREAK',
      entityId: breakId,
      payload,
    });
  }
}
