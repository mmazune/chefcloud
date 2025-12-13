import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import Redis from 'ioredis';
import { createRedisClient } from '../config/redis.config';
import { logBuffer, logger } from '../logger';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

// Simple metrics store
class MetricsStore {
  private metrics: Map<string, number> = new Map();

  increment(key: string, value: number = 1) {
    this.metrics.set(key, (this.metrics.get(key) || 0) + value);
  }

  get(key: string): number {
    return this.metrics.get(key) || 0;
  }

  getAll(): Map<string, number> {
    return new Map(this.metrics);
  }
}

export const metricsStore = new MetricsStore();

// Error tracking
export interface ErrorEntry {
  timestamp: Date;
  message: string;
  stack?: string;
  context?: any;
}

class ErrorTracker {
  private errors: ErrorEntry[] = [];
  private maxSize: number = 100;

  trackError(error: Error, context?: any) {
    this.errors.push({
      timestamp: new Date(),
      message: error.message,
      stack: error.stack,
      context,
    });

    if (this.errors.length > this.maxSize) {
      this.errors.shift();
    }

    logger.error({ err: error, context }, 'Error tracked');
  }

  getRecent(count: number = 20): ErrorEntry[] {
    return this.errors.slice(-count);
  }
}

export const errorTracker = new ErrorTracker();

@Injectable()
export class OpsService {
  private redis: Redis;

  constructor(private prisma: PrismaService) {
    // Use centralized Redis configuration
    this.redis = createRedisClient();
  }

  async getHealthStatus() {
    const health: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // Check Prisma/Database
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
      health.checks.database = { status: 'up' };
    } catch (error) {
      health.checks.database = { status: 'down', error: (error as Error).message };
      health.status = 'unhealthy';
    }

    // Check Redis
    try {
      await this.redis.ping();
      health.checks.redis = { status: 'up' };
    } catch (error) {
      health.checks.redis = { status: 'down', error: (error as Error).message };
      health.status = 'unhealthy';
    }

    // Queue status (basic check)
    try {
      const queueKey = 'bull:orders:id';
      const exists = await this.redis.exists(queueKey);
      health.checks.queue = { status: 'up', monitored: exists > 0 };
    } catch (error) {
      health.checks.queue = { status: 'unknown', error: (error as Error).message };
    }

    return health;
  }

  // E54-s1: Readiness probe - more strict than liveness
  async getReadiness() {
    const ready: any = {
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // Database must respond quickly
    try {
      const start = Date.now();
      await this.prisma.client.$queryRaw`SELECT 1`;
      const duration = Date.now() - start;
      ready.checks.database = { status: 'ready', responseMs: duration };

      if (duration > 1000) {
        ready.checks.database.status = 'slow';
        ready.status = 'degraded';
      }
    } catch (error) {
      ready.checks.database = { status: 'not_ready', error: (error as Error).message };
      ready.status = 'not_ready';
    }

    // Redis must respond
    try {
      await this.redis.ping();
      ready.checks.redis = { status: 'ready' };
    } catch (error) {
      ready.checks.redis = { status: 'not_ready', error: (error as Error).message };
      ready.status = 'not_ready';
    }

    // Check queue backlog
    try {
      const queueKey = 'bull:orders:waiting';
      const waitingCount = await this.redis.llen(queueKey);
      ready.checks.queue = { status: 'ready', waiting: waitingCount };

      // If more than 100 jobs waiting, mark as degraded
      if (waitingCount > 100) {
        ready.checks.queue.status = 'backlogged';
        ready.status = 'degraded';
      }
    } catch (error) {
      ready.checks.queue = { status: 'unknown', error: (error as Error).message };
    }

    return ready;
  }

  getMetrics(): string {
    const metrics = metricsStore.getAll();
    const lines: string[] = [];

    // Prometheus text format
    lines.push('# HELP chefcloud_requests_total Total number of HTTP requests');
    lines.push('# TYPE chefcloud_requests_total counter');
    lines.push(`chefcloud_requests_total ${metrics.get('requests_total') || 0}`);

    lines.push('# HELP chefcloud_errors_total Total number of errors');
    lines.push('# TYPE chefcloud_errors_total counter');
    lines.push(`chefcloud_errors_total ${metrics.get('errors_total') || 0}`);

    lines.push('# HELP chefcloud_queue_jobs_total Total number of queue jobs processed');
    lines.push('# TYPE chefcloud_queue_jobs_total counter');
    lines.push(`chefcloud_queue_jobs_total ${metrics.get('queue_jobs_total') || 0}`);

    // E54-s2: Performance budget violations
    lines.push('# HELP chefcloud_perf_budget_violation_total Performance budget violations');
    lines.push('# TYPE chefcloud_perf_budget_violation_total counter');
    lines.push(
      `chefcloud_perf_budget_violation_total ${metrics.get('perf_budget_violations') || 0}`,
    );

    // E54-s2: SSE clients
    lines.push('# HELP chefcloud_sse_clients_current Current number of SSE clients');
    lines.push('# TYPE chefcloud_sse_clients_current gauge');
    lines.push(`chefcloud_sse_clients_current ${metrics.get('sse_clients_current') || 0}`);

    return lines.join('\n') + '\n';
  }

  async createDiagSnapshot(userId: string) {
    const snapshot = {
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      service: 'chefcloud-api',
      nodeVersion: process.version,
      recentLogs: logBuffer.getLast(100),
      recentErrors: errorTracker.getRecent(20),
      metrics: Object.fromEntries(metricsStore.getAll()),
      env: {
        nodeEnv: process.env.NODE_ENV,
        hasOtel: !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
        hasSentry: !!process.env.SENTRY_DSN,
      },
    };

    // Create audit event
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { branchId: true },
      });

      if (user?.branchId) {
        await this.prisma.auditEvent.create({
          data: {
            branchId: user.branchId,
            userId,
            action: 'DIAG_SNAPSHOT',
            resource: 'diagnostics',
            resourceId: null,
            metadata: {
              logCount: snapshot.recentLogs.length,
              errorCount: snapshot.recentErrors.length,
            },
          },
        });
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to create audit event for diag snapshot');
    }

    return snapshot;
  }

  async createApiKey(orgId: string, name: string, scopes: string[]): Promise<any> {
    // Generate a random API key (64 bytes = 128 hex chars)
    const plainKey = crypto.randomBytes(64).toString('hex');

    // Hash with argon2
    const keyHash = await argon2.hash(plainKey);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        orgId,
        name,
        keyHash,
        scopes,
      },
    });

    logger.info({ apiKeyId: apiKey.id, name, orgId }, 'API key created');

    // Return plaintext key ONCE - never shown again
    return {
      id: apiKey.id,
      name: apiKey.name,
      scopes: apiKey.scopes,
      key: plainKey, // Only time this is returned
      createdAt: apiKey.createdAt,
      warning: 'Save this key now. It will not be shown again.',
    };
  }

  async listApiKeys(orgId: string): Promise<any> {
    const apiKeys = await this.prisma.apiKey.findMany({
      where: { orgId },
      select: {
        id: true,
        name: true,
        scopes: true,
        lastUsedAt: true,
        createdAt: true,
        // Never return keyHash
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys.map((key) => ({
      ...key,
      keyPreview: '••••••••', // Masked
    }));
  }

  async deleteApiKey(orgId: string, id: string): Promise<any> {
    // Ensure the key belongs to the org (security check)
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id, orgId },
    });

    if (!apiKey) {
      throw new Error('API key not found');
    }

    await this.prisma.apiKey.delete({ where: { id } });

    logger.info({ apiKeyId: id, name: apiKey.name, orgId }, 'API key deleted');

    return { success: true, message: 'API key deleted' };
  }
}
