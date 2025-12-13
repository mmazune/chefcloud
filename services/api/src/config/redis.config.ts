/**
 * Centralized Redis Configuration
 * 
 * Provides shared Redis connection options for:
 * - BullMQ queues
 * - Direct Redis clients
 * - Any other Redis consumers in the application
 * 
 * Configuration priority (uses first available):
 * 1. REDIS_URL - Full connection URL (e.g., redis://user:pass@host:port)
 * 2. UPSTASH_REDIS_URL - Upstash Redis URL (for managed Redis)
 * 3. REDIS_HOST + REDIS_PORT - Legacy host/port config
 * 
 * For production (NODE_ENV=production):
 * - REDIS_URL or UPSTASH_REDIS_URL must be set
 * - Will throw error if not configured
 * 
 * For development/Codespaces:
 * - Falls back to redis://redis:6379 (docker-compose service name)
 * - Or redis://localhost:6379 for local dev without docker
 */

import Redis, { RedisOptions } from 'ioredis';

/**
 * Get Redis connection URL from environment
 */
export function getRedisUrl(): string {
  // Priority 1: REDIS_URL (standard)
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  // Priority 2: UPSTASH_REDIS_URL (Upstash managed Redis)
  if (process.env.UPSTASH_REDIS_URL) {
    return process.env.UPSTASH_REDIS_URL;
  }

  // Priority 3: Legacy REDIS_HOST + REDIS_PORT
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT;
  if (host && port) {
    return `redis://${host}:${port}`;
  }

  // Production: fail fast if no Redis URL is configured
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Redis is not configured for production. ' +
      'Please set REDIS_URL or UPSTASH_REDIS_URL environment variable. ' +
      'Cannot fall back to localhost in production.',
    );
  }

  // Development fallback
  // In Codespaces/docker-compose, use service name 'redis'
  // In local dev without docker, use 'localhost'
  const isInContainer = process.env.REMOTE_CONTAINERS === 'true' || process.env.CODESPACES === 'true';
  const fallbackUrl = isInContainer ? 'redis://redis:6379' : 'redis://localhost:6379';
  
  console.log(`[redis-config] No REDIS_URL set, using development fallback: ${fallbackUrl}`);
  return fallbackUrl;
}

/**
 * Shared Redis connection options for BullMQ queues
 * 
 * Usage:
 * ```typescript
 * import { getRedisConnectionOptions } from '../config/redis.config';
 * 
 * const queue = new Queue('my-queue', {
 *   connection: getRedisConnectionOptions(),
 * });
 * ```
 */
export function getRedisConnectionOptions(): RedisOptions {
  const url = getRedisUrl();
  
  return {
    // BullMQ requires maxRetriesPerRequest to be null for blocking operations
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times: number) => {
      if (times > 3) {
        console.warn('[redis-config] Redis connection failed after 3 retries');
        return null;
      }
      return Math.min(times * 100, 3000);
    },
    // Parse URL to extract host, port, password, etc.
    ...parseRedisUrl(url),
  };
}

/**
 * Create a new Redis client instance
 * 
 * Usage:
 * ```typescript
 * import { createRedisClient } from '../config/redis.config';
 * 
 * const redis = createRedisClient();
 * ```
 */
export function createRedisClient(): Redis {
  const url = getRedisUrl();
  
  return new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy: (times: number) => {
      if (times > 3) {
        console.warn('[redis-config] Redis connection failed after 3 retries');
        return null;
      }
      return Math.min(times * 100, 3000);
    },
  });
}

/**
 * Parse Redis URL into connection options
 * Helper for libraries that don't accept URL directly
 */
function parseRedisUrl(url: string): Partial<RedisOptions> {
  try {
    const parsed = new URL(url);
    
    return {
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) : 0,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    };
  } catch (error) {
    console.error('[redis-config] Failed to parse Redis URL:', error);
    return {};
  }
}
