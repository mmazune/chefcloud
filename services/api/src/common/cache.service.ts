import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { MetricsService } from '../observability/metrics.service';

/**
 * Cache Service for E22 Franchise Performance
 * 
 * Provides read-through caching with:
 * - Configurable TTLs per endpoint
 * - Parameter normalization for cache keys
 * - Prefix-based invalidation
 * - Cache hit/miss metrics
 * - Redis with in-memory fallback
 * 
 * Cache Key Format: `cache:${prefix}:${orgId}:${base64url(params)}`
 * Index Key Format: `idx:${prefix}:${orgId}` → Set of cache keys
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  
  // In-memory fallback cache
  private readonly memoryCache = new Map<string, { value: any; expiresAt: number }>();
  private readonly indexSets = new Map<string, Set<string>>();
  
  // Metrics
  private cacheHits = 0;
  private cacheMisses = 0;
  
  // Cleanup interval reference
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
  ) {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanupMemory(), 5 * 60 * 1000);
    
    this.logger.log('CacheService initialized with Redis fallback to memory');
  }

  /**
   * Normalize query parameters for consistent cache keys
   * Sorts object keys and handles arrays
   */
  normalizeParams(params: Record<string, any>): string {
    const sorted: Record<string, any> = {};
    
    Object.keys(params)
      .sort()
      .forEach((key) => {
        const value = params[key];
        sorted[key] = Array.isArray(value) ? [...value].sort() : value;
      });
    
    return Buffer.from(JSON.stringify(sorted)).toString('base64url');
  }

  /**
   * Generate cache key from prefix, orgId, and params
   */
  makeKey(prefix: string, orgId: string, params: Record<string, any>): string {
    const normalizedParams = this.normalizeParams(params);
    return `cache:${prefix}:${orgId}:${normalizedParams}`;
  }

  /**
   * Generate index key for tracking all cache entries under a prefix
   */
  makeIndexKey(prefix: string, orgId: string): string {
    return `idx:${prefix}:${orgId}`;
  }

  /**
   * Read-through cache pattern
   * 
   * @param key - Cache key
   * @param ttlSeconds - Time to live in seconds
   * @param fetchFn - Function to fetch data on cache miss
   * @param indexKey - Optional index key for bust-by-prefix
   * @returns Cached or freshly fetched data
   */
  async readThrough<T>(
    key: string,
    ttlSeconds: number,
    fetchFn: () => Promise<T>,
    indexKey?: string,
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    
    if (cached !== null) {
      this.cacheHits++;
      this.logger.debug(`Cache HIT: ${key}`);
      return cached;
    }

    // Cache miss - fetch fresh data
    this.cacheMisses++;
    this.logger.debug(`Cache MISS: ${key}`);
    
    const data = await fetchFn();
    
    // Store in cache
    await this.set(key, data, ttlSeconds);
    
    // Add to index for prefix-based invalidation
    if (indexKey) {
      await this.addToIndex(indexKey, key);
    }
    
    return data;
  }

  /**
   * E22.A: Read-through with cached flag
   * Returns both data and whether it was cached
   * 
   * @param key - Cache key
   * @param ttlSeconds - Time to live in seconds
   * @param fetchFn - Function to fetch data on cache miss
   * @param indexKey - Optional index key for bust-by-prefix
   * @param endpointLabel - Optional endpoint label for metrics
   * @returns Object with data and cached boolean
   */
  async readThroughWithFlag<T>(
    key: string,
    ttlSeconds: number,
    fetchFn: () => Promise<T>,
    indexKey?: string,
    endpointLabel?: string,
  ): Promise<{ data: T; cached: boolean }> {
    const started = Date.now();
    
    // Try to get from cache
    const cached = await this.get<T>(key);
    
    if (cached !== null) {
      this.cacheHits++;
      this.logger.debug(`Cache HIT: ${key}`);
      
      const elapsed = Date.now() - started;
      if (this.metrics?.enabled) {
        const endpoint = endpointLabel || 'unknown';
        this.metrics.cacheHits.inc({ endpoint });
        this.metrics.dbQueryMs.observe(
          { endpoint, cached: 'true' },
          elapsed / 1000,
        );
      }
      
      return { data: cached, cached: true };
    }

    // Cache miss - fetch fresh data
    this.cacheMisses++;
    this.logger.debug(`Cache MISS: ${key}`);
    
    const data = await fetchFn();
    
    // Store in cache
    await this.set(key, data, ttlSeconds);
    
    // Add to index for prefix-based invalidation
    if (indexKey) {
      await this.addToIndex(indexKey, key);
    }
    
    const elapsed = Date.now() - started;
    if (this.metrics?.enabled) {
      const endpoint = endpointLabel || 'unknown';
      this.metrics.cacheMisses.inc({ endpoint });
      this.metrics.dbQueryMs.observe(
        { endpoint, cached: 'false' },
        elapsed / 1000,
      );
    }
    
    return { data, cached: false };
  }

  /**
   * Get value from cache (Redis or memory fallback)
   */
  private async get<T>(key: string): Promise<T | null> {
    try {
      // Try Redis first
      const redisValue = await this.redis.get(key);
      if (redisValue) {
        return JSON.parse(redisValue);
      }
    } catch (error) {
      this.logger.warn(`Redis get failed for ${key}, falling back to memory: ${(error as Error).message}`);
    }

    // Fallback to memory cache
    const memEntry = this.memoryCache.get(key);
    if (memEntry && memEntry.expiresAt > Date.now()) {
      return memEntry.value;
    }

    return null;
  }

  /**
   * Set value in cache (Redis or memory fallback)
   */
  private async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);
    
    try {
      // Try Redis first
      await this.redis.setEx(key, ttlSeconds, serialized);
    } catch (error) {
      this.logger.warn(`Redis set failed for ${key}, using memory: ${(error as Error).message}`);
    }

    // Always keep in memory as backup
    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Add cache key to index set for prefix-based invalidation
   */
  private async addToIndex(indexKey: string, cacheKey: string): Promise<void> {
    try {
      // Try Redis SADD
      await this.redis.sAdd(indexKey, cacheKey);
    } catch (error) {
      this.logger.debug(`Redis SADD failed for ${indexKey}, using memory`);
    }

    // Memory fallback
    if (!this.indexSets.has(indexKey)) {
      this.indexSets.set(indexKey, new Set());
    }
    this.indexSets.get(indexKey)!.add(cacheKey);
  }

  /**
   * Invalidate all cache entries matching a prefix
   * 
   * @param prefix - Cache prefix (e.g., 'overview', 'rankings')
   * @param orgId - Organization ID
   */
  async bustPrefix(prefix: string, orgId: string): Promise<number> {
    const indexKey = this.makeIndexKey(prefix, orgId);
    let deletedCount = 0;

    try {
      // Get all keys from Redis index
      const keys = await this.redis.sMembers(indexKey);
      
      if (keys.length > 0) {
        // Delete all cache entries
        for (const key of keys) {
          await this.redis.del(key);
          this.memoryCache.delete(key);
          deletedCount++;
        }
        
        // Clear the index
        await this.redis.del(indexKey);
      }
    } catch (error) {
      this.logger.warn(`Redis bust failed, using memory: ${(error as Error).message}`);
      
      // Fallback to memory
      const memKeys = this.indexSets.get(indexKey);
      if (memKeys) {
        for (const key of memKeys) {
          this.memoryCache.delete(key);
          deletedCount++;
        }
        this.indexSets.delete(indexKey);
      }
    }

    this.logger.log(`Busted cache prefix '${prefix}' for org ${orgId}: ${deletedCount} keys deleted`);
    
    // Emit metrics
    if (this.metrics?.enabled && deletedCount > 0) {
      this.metrics.invalidations.inc({ prefix });
    }
    
    return deletedCount;
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats() {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;

    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      total,
      hitRate: hitRate.toFixed(2) + '%',
      memoryEntries: this.memoryCache.size,
      indexCount: this.indexSets.size,
    };
  }

  /**
   * Cleanup expired entries from memory cache
   */
  private cleanupMemory(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Memory cleanup: removed ${cleaned} expired entries`);
    }
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.logger.log('CacheService destroyed, cleanup interval cleared');
  }
}
