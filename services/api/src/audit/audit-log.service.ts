/**
 * Audit Log Service
 *
 * Provides a centralized audit logging interface that wraps Prisma's auditEvent model.
 * This standardizes audit logging across all modules.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface AuditLogEntry {
  orgId: string;
  branchId?: string; // Optional - will skip logging if not provided (AuditEvent schema requires branchId)
  userId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Log an audit event
   * 
   * Note: AuditEvent requires branchId. If branchId is not provided,
   * the event will be logged as a debug message but not persisted to DB.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    // Skip DB logging if branchId not provided (schema requires it)
    if (!entry.branchId) {
      this.logger.debug(`Audit (no-persist): ${entry.action} on ${entry.resourceType}:${entry.resourceId} by ${entry.userId ?? 'system'}`);
      return;
    }

    try {
      await this.prisma.client.auditEvent.create({
        data: {
          branchId: entry.branchId,
          userId: entry.userId,
          action: entry.action,
          resource: entry.resourceType,
          resourceId: entry.resourceId,
          metadata: entry.metadata ? JSON.parse(JSON.stringify(entry.metadata)) : undefined,
        },
      });
      this.logger.debug(`Audit: ${entry.action} on ${entry.resourceType}:${entry.resourceId} by ${entry.userId}`);
    } catch (error) {
      // Log error but don't throw - audit logging should not break main operations
      this.logger.error(`Failed to log audit event: ${error}`);
    }
  }
}
