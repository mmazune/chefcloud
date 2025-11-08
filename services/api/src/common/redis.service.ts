import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Shared Redis service for the application
 * Provides Redis connection with fallback to in-memory storage for local dev
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
      const host = process.env.REDIS_HOST;
      const port = process.env.REDIS_PORT;

      if (host && port) {
        this.redis = new Redis({
          host,
          port: parseInt(port, 10),
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => {
            if (times > 3) {
              this.logger.warn('Redis connection failed, falling back to in-memory');
              return null; // Stop retrying
            }
            return Math.min(times * 100, 3000);
          },
        });

        this.redis.on('connect', () => {
          this.logger.log('Redis connected');
        });

        this.redis.on('error', (err) => {
          this.logger.warn(`Redis error: ${err.message}, using in-memory fallback`);
        });
      } else {
        this.logger.log('Redis not configured, using in-memory storage');
      }
    } catch (error) {
      this.logger.warn(`Failed to initialize Redis: ${(error as Error).message}`);
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

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.redis) {
      this.redis.disconnect();
    }
  }
}
