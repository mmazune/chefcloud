/**
 * Centralized Redis Configuration for Worker Service
 * 
 * Provides shared Redis connection options for BullMQ workers
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

import Redis from 'ioredis';

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
 * Create a new Redis connection for BullMQ workers
 * BullMQ requires maxRetriesPerRequest: null for blocking operations
 */
export function createRedisConnection(): Redis {
  const url = getRedisUrl();

  return new Redis(url, {
    maxRetriesPerRequest: null, // Required for BullMQ workers
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
