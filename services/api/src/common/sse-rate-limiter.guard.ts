import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { Request } from 'express';
import { MetricsService } from '../observability/metrics.service';

/**
 * SSE Rate Limiter Guard
 *
 * Implements sliding window rate limiting for SSE endpoints:
 * - Per-user limit: 60 requests/minute (configurable via SSE_RATE_PER_MIN)
 * - Per-IP limit: 60 requests/minute
 * - Max concurrent connections per user: 2 (configurable via SSE_MAX_CONNS_PER_USER)
 *
 * Uses in-memory storage with automatic cleanup.
 * For production with multiple instances, use Redis-backed implementation.
 */
@Injectable()
export class SseRateLimiterGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger(SseRateLimiterGuard.name);

  // Configuration from env
  private readonly ratePerMinute = parseInt(process.env.SSE_RATE_PER_MIN || '60', 10);
  private readonly maxConcurrentPerUser = parseInt(process.env.SSE_MAX_CONNS_PER_USER || '2', 10);
  private readonly windowMs = 60000; // 1 minute sliding window

  // In-memory storage (use Redis for production multi-instance setups)
  private readonly requestsByUser = new Map<string, number[]>();
  private readonly requestsByIp = new Map<string, number[]>();
  private readonly activeConnectionsByUser = new Map<string, number>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(@Optional() private readonly metrics: MetricsService) {
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);

    this.logger.log(
      `SSE Rate Limiter initialized: ${this.ratePerMinute}/min per user/IP, max ${this.maxConcurrentPerUser} concurrent/user`,
    );
  }

  onModuleDestroy() {
    // Clear cleanup interval when module is destroyed (important for tests)
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: any }>();
    const res = context.switchToHttp().getResponse();

    const userId = req.user?.userId;
    const ip = this.getClientIp(req);
    const now = Date.now();

    // Check per-user rate limit
    if (userId) {
      if (!this.checkRateLimit(this.requestsByUser, userId, now)) {
        const retryAfter = Math.ceil(this.windowMs / 1000);
        res.setHeader('Retry-After', retryAfter.toString());
        this.logger.warn(`SSE rate limit exceeded for user ${userId}`);

        // Emit metrics
        if (this.metrics?.enabled) {
          this.metrics.rateLimitHits.inc({ route: 'sse', kind: 'window' });
        }

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many SSE connection requests. Please wait before retrying.',
            retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Check concurrent connection limit
      const activeConns = this.activeConnectionsByUser.get(userId) || 0;
      if (activeConns >= this.maxConcurrentPerUser) {
        this.logger.warn(
          `SSE concurrent connection limit exceeded for user ${userId} (${activeConns}/${this.maxConcurrentPerUser})`,
        );

        // Emit metrics
        if (this.metrics?.enabled) {
          this.metrics.rateLimitHits.inc({ route: 'sse', kind: 'concurrent' });
        }

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Maximum ${this.maxConcurrentPerUser} concurrent SSE connections allowed per user. Please close existing connections.`,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Increment active connections and metrics
      this.activeConnectionsByUser.set(userId, activeConns + 1);
      if (this.metrics?.enabled) {
        this.metrics.sseClients.inc();
      }

      // Register cleanup on connection close
      req.on('close', () => {
        const current = this.activeConnectionsByUser.get(userId) || 0;
        if (current > 0) {
          this.activeConnectionsByUser.set(userId, current - 1);
        }
        if (this.metrics?.enabled) {
          this.metrics.sseClients.dec();
        }
        this.logger.debug(`SSE connection closed for user ${userId}, active: ${current - 1}`);
      });
    }

    // Check per-IP rate limit (defense against unauthenticated abuse attempts)
    if (ip) {
      if (!this.checkRateLimit(this.requestsByIp, ip, now)) {
        const retryAfter = Math.ceil(this.windowMs / 1000);
        res.setHeader('Retry-After', retryAfter.toString());
        this.logger.warn(`SSE rate limit exceeded for IP ${ip}`);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests from your IP address.',
            retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return true;
  }

  private checkRateLimit(store: Map<string, number[]>, key: string, now: number): boolean {
    // Get existing timestamps for this key
    let timestamps = store.get(key) || [];

    // Remove timestamps outside the sliding window
    timestamps = timestamps.filter((ts) => now - ts < this.windowMs);

    // Check if limit exceeded
    if (timestamps.length >= this.ratePerMinute) {
      return false;
    }

    // Add current timestamp
    timestamps.push(now);
    store.set(key, timestamps);

    return true;
  }

  private getClientIp(req: Request): string {
    // Try X-Forwarded-For (behind proxy)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ips.split(',')[0].trim();
    }

    // Try X-Real-IP
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fallback to socket
    return req.socket.remoteAddress || 'unknown';
  }

  private cleanup() {
    const now = Date.now();

    // Cleanup user requests
    for (const [key, timestamps] of this.requestsByUser.entries()) {
      const filtered = timestamps.filter((ts) => now - ts < this.windowMs);
      if (filtered.length === 0) {
        this.requestsByUser.delete(key);
      } else {
        this.requestsByUser.set(key, filtered);
      }
    }

    // Cleanup IP requests
    for (const [key, timestamps] of this.requestsByIp.entries()) {
      const filtered = timestamps.filter((ts) => now - ts < this.windowMs);
      if (filtered.length === 0) {
        this.requestsByIp.delete(key);
      } else {
        this.requestsByIp.set(key, filtered);
      }
    }

    // Cleanup stale active connections (users with 0 connections)
    for (const [userId, count] of this.activeConnectionsByUser.entries()) {
      if (count <= 0) {
        this.activeConnectionsByUser.delete(userId);
      }
    }

    this.logger.debug(
      `SSE rate limiter cleanup: ${this.requestsByUser.size} users, ${this.requestsByIp.size} IPs, ${this.activeConnectionsByUser.size} active`,
    );
  }

  /**
   * Get current active connections count for a user (for testing/monitoring)
   */
  getActiveConnections(userId: string): number {
    return this.activeConnectionsByUser.get(userId) || 0;
  }

  /**
   * Get total active connections (for testing/monitoring)
   */
  getTotalActiveConnections(): number {
    let total = 0;
    for (const count of this.activeConnectionsByUser.values()) {
      total += count;
    }
    return total;
  }
}
