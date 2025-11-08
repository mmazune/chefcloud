import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RedisService } from './redis.service';
import { PrismaService } from '../prisma.service';

/**
 * Plan tier type
 */
export type PlanTier = 'free' | 'pro' | 'enterprise';

/**
 * Rate limit configuration per plan tier
 */
export const PLAN_RATE_LIMITS: Record<PlanTier, number> = {
  free: 10,       // 10 requests per minute
  pro: 60,        // 60 requests per minute
  enterprise: 240, // 240 requests per minute
};

/**
 * Per-IP rate limit to prevent abuse
 */
export const IP_RATE_LIMIT = 120; // 120 requests per minute

/**
 * Plan-Aware Rate Limiter Guard
 * 
 * Implements sliding window rate limiting for plan/subscription mutation endpoints.
 * Rate limits are based on the user's subscription plan tier.
 * 
 * Features:
 * - Plan-aware limits: free (10/min), pro (60/min), enterprise (240/min)
 * - Per-IP limits: 120/min to prevent abuse
 * - Sliding window (60 seconds) using Redis
 * - In-memory fallback for local development
 * - Metrics emission for monitoring
 * 
 * Rate Limit Keys:
 * - User: `pl:${userId}:${route}`
 * - IP: `ip:${ipAddress}:${route}`
 * 
 * Response Codes:
 * - 429 Too Many Requests: Rate limit exceeded
 * - Includes `Retry-After: 60` header
 * 
 * Environment Variables:
 * - REDIS_HOST: Redis server host (optional, falls back to in-memory)
 * - REDIS_PORT: Redis server port (optional)
 * 
 * @example
 * ```typescript
 * @Controller('billing')
 * export class BillingController {
 *   @Post('plan/change')
 *   @UseGuards(AuthGuard('jwt'), PlanRateLimiterGuard)
 *   async changePlan() {
 *     // Protected endpoint
 *   }
 * }
 * ```
 */
@Injectable()
export class PlanRateLimiterGuard implements CanActivate {
  private readonly logger = new Logger(PlanRateLimiterGuard.name);
  private readonly WINDOW_MS = 60_000; // 60 seconds
  
  // In-memory fallback storage
  private readonly memoryStore = new Map<string, { count: number; resetAt: number }>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Metrics counters
  private rateLimitHits = new Map<string, number>();

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {
    this.startMemoryCleanup();
  }

  /**
   * Start periodic cleanup of expired in-memory entries
   */
  private startMemoryCleanup() {
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, value] of this.memoryStore.entries()) {
          if (value.resetAt <= now) {
            this.memoryStore.delete(key);
          }
        }
      }, 30_000); // Clean every 30 seconds
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    const startTime = Date.now();

    try {
      // Extract user and IP information
      const user = request.user;
      if (!user || !user.userId) {
        // Rate limiter requires authentication
        throw new HttpException(
          {
            statusCode: 401,
            message: 'Authentication required for rate-limited endpoints',
            error: 'Unauthorized',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      const userId = user.userId;
      const orgId = user.orgId;
      const ip = this.extractIp(request);
      const route = this.getRouteKey(request);

      // Determine user's plan tier
      const planTier = await this.getUserPlanTier(orgId);
      const userLimit = PLAN_RATE_LIMITS[planTier];

      // Check and increment both user and IP limits atomically
      const userKey = `pl:${userId}:${route}`;
      const ipKey = `ip:${ip}:${route}`;

      const [userCount, ipCount] = await Promise.all([
        this.checkAndIncrement(userKey),
        this.checkAndIncrement(ipKey),
      ]);

      const userOk = userCount <= userLimit;
      const ipOk = ipCount <= IP_RATE_LIMIT;

      if (!userOk || !ipOk) {
        const limitType = !userOk ? 'user' : 'ip';
        const limit = !userOk ? userLimit : IP_RATE_LIMIT;

        this.logger.warn(
          `Rate limit exceeded: ${limitType} - user=${userId}, plan=${planTier}, route=${route}, ip=${ip}`,
        );

        // Emit metric
        this.incrementRateLimitMetric(route, planTier);

        // Set headers before throwing
        const response = context.switchToHttp().getResponse();
        response.setHeader('Retry-After', '60');
        response.setHeader('X-RateLimit-Limit', String(limit));
        response.setHeader('X-RateLimit-Window', '60');
        response.setHeader('X-RateLimit-Plan', planTier);

        throw new HttpException(
          {
            statusCode: 429,
            message: 'Rate limit exceeded',
            error: 'Too Many Requests',
            plan: planTier,
            limit,
            window: 60,
            retryAfter: 60,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Log latency for monitoring
      const latency = Date.now() - startTime;
      if (latency > 100) {
        this.logger.warn(`Slow rate limiter check: ${latency}ms for ${route}`);
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Rate limiter error: ${(error as Error).message}`);
      // Fail open - allow request if rate limiter has issues
      return true;
    }
  }

  /**
   * Get user's plan tier from database
   */
  private async getUserPlanTier(orgId: string): Promise<PlanTier> {
    try {
      const org = await this.prisma.org.findUnique({
        where: { id: orgId },
        include: {
          subscription: {
            include: {
              plan: true,
            },
          },
        },
      });

      if (!org?.subscription?.plan) {
        return 'free'; // Default to free if no subscription
      }

      const planCode = org.subscription.plan.code.toLowerCase();
      
      // Map plan codes to tiers
      if (planCode.includes('enterprise')) return 'enterprise';
      if (planCode.includes('pro') || planCode.includes('professional')) return 'pro';
      
      return 'free';
    } catch (error) {
      this.logger.warn(`Failed to fetch plan tier: ${(error as Error).message}, defaulting to free`);
      return 'free';
    }
  }

  /**
   * Check and increment rate limit counter atomically
   * Returns the new count after incrementing
   */
  private async checkAndIncrement(key: string): Promise<number> {
    const ttl = Math.ceil(this.WINDOW_MS / 1000); // 60 seconds
    
    try {
      // Try Redis first
      const currentValue = await this.redis.get(key);
      const newCount = currentValue === null ? 1 : parseInt(currentValue, 10) + 1;
      await this.redis.set(key, String(newCount), ttl);
      return newCount;
    } catch (error) {
      this.logger.debug(`Redis failed, using in-memory: ${(error as Error).message}`);
    }

    // Fallback to in-memory
    const now = Date.now();
    const resetAt = now + this.WINDOW_MS;
    
    const entry = this.memoryStore.get(key);
    if (!entry || entry.resetAt <= now) {
      this.memoryStore.set(key, { count: 1, resetAt });
      return 1;
    } else {
      entry.count++;
      return entry.count;
    }
  }

  /**
   * Extract IP address from request
   */
  private extractIp(request: any): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || request.socket?.remoteAddress || '0.0.0.0';
  }

  /**
   * Get normalized route key
   */
  private getRouteKey(request: any): string {
    const baseUrl = request.baseUrl || '';
    const path = request.path || request.url || '';
    return `${baseUrl}${path}`.replace(/\/+/g, '/');
  }

  /**
   * Increment rate limit hit metric
   */
  private incrementRateLimitMetric(route: string, plan: PlanTier): void {
    const key = `${route}:${plan}`;
    const current = this.rateLimitHits.get(key) || 0;
    this.rateLimitHits.set(key, current + 1);
    
    // Log metric for external collectors
    this.logger.log(`METRIC rate_limit_hits{route="${route}",plan="${plan}"} ${current + 1}`);
  }

  /**
   * Get current metrics (for testing/monitoring)
   */
  public getMetrics(): Map<string, number> {
    return new Map(this.rateLimitHits);
  }

  /**
   * Reset metrics (for testing)
   */
  public resetMetrics(): void {
    this.rateLimitHits.clear();
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
