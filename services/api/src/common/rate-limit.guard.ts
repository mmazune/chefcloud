/**
 * M9.4: Rate Limiting Guard
 * 
 * Simple in-memory rate limiter for public endpoints
 * Uses sliding window counter algorithm
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    maxRequests: number = 5,
    windowMs: number = 60000, // 1 minute
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);
    const now = Date.now();

    const entry = this.store.get(ip);

    if (!entry) {
      // First request from this IP
      this.store.set(ip, { count: 1, windowStart: now });
      return true;
    }

    const windowAge = now - entry.windowStart;

    if (windowAge >= this.windowMs) {
      // Window expired, reset
      this.store.set(ip, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((this.windowMs - windowAge) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment counter
    entry.count++;
    return true;
  }

  /**
   * Extract client IP from request
   */
  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.store.entries()) {
      if (now - entry.windowStart >= this.windowMs) {
        this.store.delete(ip);
      }
    }
  }

  /**
   * Get current rate limit status for an IP (for testing/debugging)
   */
  getStatus(ip: string): { remaining: number; resetAt: number } | null {
    const entry = this.store.get(ip);
    if (!entry) {
      return { remaining: this.maxRequests, resetAt: Date.now() + this.windowMs };
    }

    const windowAge = Date.now() - entry.windowStart;
    if (windowAge >= this.windowMs) {
      return { remaining: this.maxRequests, resetAt: Date.now() + this.windowMs };
    }

    return {
      remaining: Math.max(0, this.maxRequests - entry.count),
      resetAt: entry.windowStart + this.windowMs,
    };
  }

  /**
   * Reset rate limit for an IP (for testing)
   */
  reset(ip: string): void {
    this.store.delete(ip);
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Factory function to create guard with custom settings
export function createRateLimitGuard(maxRequests: number, windowMs: number): RateLimitGuard {
  return new RateLimitGuard(maxRequests, windowMs);
}

// Default instance for public booking endpoints
export const PublicBookingRateLimitGuard = new RateLimitGuard(5, 60000); // 5 req/min
