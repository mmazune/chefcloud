import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Shared Redis service for the application
 * 
 * Configuration priority (uses first available):
 * 1. REDIS_URL - Full connection URL (e.g., redis://user:pass@host:port)
 * 2. UPSTASH_REDIS_URL - Upstash Redis URL (for managed Redis)
 * 3. REDIS_HOST + REDIS_PORT - Legacy host/port config
 * 
 * For production (NODE_ENV=production):
 * - REDIS_URL or UPSTASH_REDIS_URL must be set
 * - Will NOT fall back to localhost
 * 
 * For development/Codespaces:
 * - Falls back to redis://redis:6379 (docker-compose service name)
 * - Or redis://localhost:6379 for local dev without docker
 * - Also provides in-memory fallback if Redis is unavailable
 */
@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private redis: Redis | null = null;
  private inMemoryStore = new Map<string, { value: string; expiresAt: number }>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initRedis();
    this.startInMemoryCleanup();
  }

  private initRedis() {
    try {
      // Get Redis URL from environment (priority order)
      const redisUrl =
        process.env.REDIS_URL ||
        process.env.UPSTASH_REDIS_URL ||
        this.getLegacyRedisUrl();

      // In production, Redis URL is required
      if (!redisUrl && process.env.NODE_ENV === 'production') {
        const error = new Error(
          'REDIS_URL or UPSTASH_REDIS_URL must be set in production environment. ' +
          'Cannot fall back to localhost in production.',
        );
        this.logger.error(error.message);
        throw error;
      }

      // Get fallback URL for development
      const fallbackUrl = this.getDevFallbackUrl();
      const connectionUrl = redisUrl || fallbackUrl;

      if (!redisUrl) {
        this.logger.log(`Redis not configured, using fallback: ${fallbackUrl}`);
      }

      if (connectionUrl) {
        this.redis = new Redis(connectionUrl, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          retryStrategy: (times: number) => {
            if (times > 3) {
              this.logger.warn('Redis connection failed after 3 retries, falling back to in-memory');
              return null; // Stop retrying
            }
            return Math.min(times * 100, 3000);
          },
          lazyConnect: false,
        });

        this.redis.on('connect', () => {
          this.logger.log(`Redis connected to ${this.sanitizeUrl(connectionUrl)}`);
        });

        this.redis.on('ready', () => {
          this.logger.log('Redis client ready');
        });

        this.redis.on('error', (err) => {
          this.logger.warn(`Redis error: ${err.message}, using in-memory fallback`);
        });

        this.redis.on('close', () => {
          this.logger.warn('Redis connection closed');
        });
      } else {
        this.logger.log('Redis not configured, using in-memory storage');
      }
    } catch (error) {
      this.logger.warn(`Failed to initialize Redis: ${(error as Error).message}`);
      if (process.env.NODE_ENV === 'production') {
        throw error; // Fail fast in production
      }
    }
  }

  /**
   * Build Redis URL from legacy REDIS_HOST and REDIS_PORT env vars
   */
  private getLegacyRedisUrl(): string | null {
    const host = process.env.REDIS_HOST;
    const port = process.env.REDIS_PORT;

    if (host && port) {
      return `redis://${host}:${port}`;
    }
    return null;
  }

  /**
   * Get development fallback URL
   * Tries docker-compose service name first, then localhost
   */
  private getDevFallbackUrl(): string {
    // In Codespaces/docker-compose, Redis service is named 'redis'
    // In local dev without docker, use localhost
    const isInContainer = process.env.REMOTE_CONTAINERS === 'true' || process.env.CODESPACES === 'true';
    return isInContainer ? 'redis://redis:6379' : 'redis://localhost:6379';
  }

  /**
   * Sanitize URL for logging (hide password if present)
   */
  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (parsed.password) {
        parsed.password = '***';
      }
      return parsed.toString();
    } catch {
      return url.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@');
    }
  }

  private startInMemoryCleanup() {
    // Clean expired keys every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, { expiresAt }] of this.inMemoryStore.entries()) {
        if (expiresAt <= now) {
          this.inMemoryStore.delete(key);
        }
      }
    }, 60000);
  }

  async get(key: string): Promise<string | null> {
    if (this.redis) {
      try {
        return await this.redis.get(key);
      } catch (error) {
        this.logger.warn(`Redis GET error: ${(error as Error).message}, using in-memory`);
      }
    }

    // In-memory fallback
    const entry = this.inMemoryStore.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.value;
    }
    return null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.redis) {
      try {
        if (ttlSeconds) {
          await this.redis.setex(key, ttlSeconds, value);
        } else {
          await this.redis.set(key, value);
        }
        return;
      } catch (error) {
        this.logger.warn(`Redis SET error: ${(error as Error).message}, using in-memory`);
      }
    }

    // In-memory fallback
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : Date.now() + 86400000;
    this.inMemoryStore.set(key, { value, expiresAt });
  }

  async exists(key: string): Promise<boolean> {
    if (this.redis) {
      try {
        const result = await this.redis.exists(key);
        return result === 1;
      } catch (error) {
        this.logger.warn(`Redis EXISTS error: ${(error as Error).message}, using in-memory`);
      }
    }

    // In-memory fallback
    const entry = this.inMemoryStore.get(key);
    return entry !== undefined && entry.expiresAt > Date.now();
  }

  async del(key: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(key);
        return;
      } catch (error) {
        this.logger.warn(`Redis DEL error: ${(error as Error).message}, using in-memory`);
      }
    }

    // In-memory fallback
    this.inMemoryStore.delete(key);
  }

  /**
   * Set with expiration (SETEX)
   *
   * @param key - Key name
   * @param ttlSeconds - Time to live in seconds
   * @param value - Value to store
   */
  async setEx(key: string, ttlSeconds: number, value: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.setex(key, ttlSeconds, value);
        return;
      } catch (error) {
        this.logger.warn(`Redis SETEX error: ${(error as Error).message}, using in-memory`);
      }
    }

    // In-memory fallback
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.inMemoryStore.set(key, { value, expiresAt });
  }

  /**
   * Add member to set (SADD)
   * Used for cache index tracking
   *
   * @param key - Set key
   * @param member - Member to add
   */
  async sAdd(key: string, member: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.sadd(key, member);
        return;
      } catch (error) {
        this.logger.warn(`Redis SADD error: ${(error as Error).message}`);
      }
    }

    // In-memory: store as JSON array
    const existing = this.inMemoryStore.get(key);
    let members: string[] = [];

    if (existing) {
      try {
        members = JSON.parse(existing.value);
      } catch {
        members = [];
      }
    }

    if (!members.includes(member)) {
      members.push(member);
    }

    this.inMemoryStore.set(key, {
      value: JSON.stringify(members),
      expiresAt: Date.now() + 86400000, // 24h default for index sets
    });
  }

  /**
   * Get all members from set (SMEMBERS)
   * Used for cache invalidation
   *
   * @param key - Set key
   * @returns Array of members
   */
  async sMembers(key: string): Promise<string[]> {
    if (this.redis) {
      try {
        return await this.redis.smembers(key);
      } catch (error) {
        this.logger.warn(`Redis SMEMBERS error: ${(error as Error).message}`);
      }
    }

    // In-memory fallback
    const entry = this.inMemoryStore.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      try {
        return JSON.parse(entry.value);
      } catch {
        return [];
      }
    }

    return [];
  }

  /**
   * Publish a message to a Redis channel (pub/sub)
   * Used for distributing session invalidation events across nodes
   *
   * @param channel - Channel name
   * @param message - Message to publish
   */
  async publish(channel: string, message: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.publish(channel, message);
        return;
      } catch (error) {
        this.logger.warn(`Redis PUBLISH error: ${(error as Error).message}`);
      }
    }

    // In-memory: no-op (single node, no subscribers)
    this.logger.debug(`Pub/sub not available in in-memory mode (channel: ${channel})`);
  }

  /**
   * Check if Redis is healthy (for health checks)
   * Returns true if Redis is connected, false if using in-memory fallback
   */
  async isHealthy(): Promise<boolean> {
    if (!this.redis) {
      return false; // Using in-memory fallback
    }

    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.warn(`Redis health check failed: ${(error as Error).message}`);
      return false;
    }
  }

  async onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.redis) {
      await this.redis.quit();
    }
  }
}
