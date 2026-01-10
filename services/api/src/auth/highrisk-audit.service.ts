/**
 * HIGH Risk Audit Service
 * 
 * Logs HIGH risk actions to the audit_events table.
 * Used by controllers/services when performing HIGH risk operations.
 * 
 * Records: actor userId, role, branchId, action key, timestamp, requestId, target entity ids.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { HighRiskCapability } from './capabilities';

export interface HighRiskAuditEntry {
  /** User performing the action */
  userId: string;
  /** User's role level (L1-L5) */
  roleLevel: string;
  /** User's job role name */
  jobRole?: string;
  /** Branch ID (if applicable) */
  branchId: string;
  /** Org ID */
  orgId: string;
  /** The capability/action performed */
  capability: HighRiskCapability;
  /** Resource type affected (e.g., 'AccountingPeriod', 'PayrollRun') */
  resourceType: string;
  /** Resource ID affected */
  resourceId?: string;
  /** Request ID for correlation */
  requestId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** State before action (for reversible actions) */
  before?: Record<string, unknown>;
  /** State after action */
  after?: Record<string, unknown>;
}

export interface HighRiskAuditFilters {
  branchId?: string;
  userId?: string;
  capability?: HighRiskCapability;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class HighRiskAuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log a HIGH risk action
   */
  async logHighRiskAction(entry: HighRiskAuditEntry): Promise<void> {
    await this.prisma.client.auditEvent.create({
      data: {
        branchId: entry.branchId,
        userId: entry.userId,
        action: `highrisk.${entry.capability}`,
        resource: entry.resourceType,
        resourceId: entry.resourceId,
        before: entry.before ?? undefined,
        after: entry.after ?? undefined,
        metadata: {
          roleLevel: entry.roleLevel,
          jobRole: entry.jobRole,
          orgId: entry.orgId,
          requestId: entry.requestId,
          ...entry.metadata,
        },
      },
    });
  }

  /**
   * Get HIGH risk audit logs
   */
  async getHighRiskLogs(filters: HighRiskAuditFilters): Promise<{ items: unknown[]; total: number }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      action: { startsWith: 'highrisk.' },
    };

    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.capability) where.action = `highrisk.${filters.capability}`;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lte = filters.to;
    }

    const [items, total] = await Promise.all([
      this.prisma.client.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      this.prisma.client.auditEvent.count({ where }),
    ]);

    return { items, total };
  }
}
