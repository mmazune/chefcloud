/**
 * Audit Module
 *
 * Provides centralized audit logging functionality.
 */
import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [AuditLogService, PrismaService],
  exports: [AuditLogService],
})
export class AuditModule {}
