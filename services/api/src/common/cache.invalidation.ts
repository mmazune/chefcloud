import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

const logger = new Logger('CacheInvalidation');

/**
 * E22.D: Cache invalidation events
 * Maps domain events to affected cache prefixes for automatic invalidation
 */
export type InvalidationEvent =
  | { type: 'po.received'; orgId: string }
  | { type: 'transfer.changed'; orgId: string }
  | { type: 'budget.updated'; orgId: string }
  | { type: 'inventory.adjusted'; orgId: string };

/**
 * Event to cache prefix mapping
 * Defines which cache prefixes should be invalidated for each domain event
 */
const EVENT_PREFIX_MAP: Record<InvalidationEvent['type'], string[]> = {
  'po.received': ['fr:overview', 'fr:rankings'],
  'transfer.changed': ['fr:overview', 'fr:rankings', 'fr:forecast'],
  'budget.updated': ['fr:budgets'],
  'inventory.adjusted': ['fr:overview', 'fr:rankings', 'fr:forecast'],
};

/**
 * E22.D: Cache Invalidation Service
 * 
 * Handles event-based cache invalidation for franchise analytics endpoints.
 * Uses Redis index sets created by CacheService to efficiently remove cached keys.
 * 
 * Features:
 * - Event-driven invalidation (no manual cache management)
 * - Bulk key removal using index sets (no KEYS scan)
 * - Graceful fallback when Redis unavailable
 * - Observability via structured logging
 * 
 * @example
 * // After updating a budget
 * await cacheInvalidation.handle({ type: 'budget.updated', orgId: 'ORG123' });
 * 
 * // After receiving a purchase order
 * await cacheInvalidation.handle({ type: 'po.received', orgId: 'ORG123' });
 */
@Injectable()
export class CacheInvalidation {
  constructor(private readonly redis: RedisService) {}

  /**
   * Bust all cached keys for a given prefix and organization.
   * Uses Redis index sets (idx:prefix:orgId) created by CacheService during caching.
   * 
   * @param prefix - Cache key prefix (e.g., 'fr:overview', 'fr:budgets')
   * @param orgId - Organization ID
   * @returns Number of keys removed
   * 
   * @example
   * const removed = await invalidation.bustPrefix('fr:overview', 'ORG123');
   * console.log(`Removed ${removed} cached overview keys`);
   */
  async bustPrefix(prefix: string, orgId: string): Promise<number> {
    try {
      // Get all cached keys for this prefix from the index set
      const indexKey = `idx:${prefix}:${orgId}`;
      const cachedKeys: string[] = await this.redis.sMembers(indexKey);

      if (!cachedKeys || cachedKeys.length === 0) {
        // No cached keys found - this is normal if cache was empty or expired
        return 0;
      }

      // Delete all cached keys (one by one since del() takes single key)
      for (const key of cachedKeys) {
        await this.redis.del(key);
      }
      
      // Delete the index set itself
      await this.redis.del(indexKey);

      return cachedKeys.length;
    } catch (error) {
      // Graceful fallback: log warning but don't crash
      // This handles Redis being unavailable (will use in-memory cache instead)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(
        `Redis unavailable during bustPrefix(${prefix}, ${orgId}): ${errorMessage}`,
      );
      return 0;
    }
  }

  /**
   * Handle a domain event and invalidate affected caches.
   * Maps the event type to relevant cache prefixes and busts them.
   * 
   * @param event - Domain event (e.g., budget update, PO received)
   * @returns Total number of cache keys removed
   * 
   * @example
   * // After budget update
   * const removed = await invalidation.handle({
   *   type: 'budget.updated',
   *   orgId: 'ORG123'
   * });
   * // Logs: cache_bust org=ORG123 prefixes=fr:budgets removed=5
   */
  async handle(event: InvalidationEvent): Promise<number> {
    const prefixes = EVENT_PREFIX_MAP[event.type] || [];
    
    if (prefixes.length === 0) {
      logger.warn(`Unknown event type: ${event.type}`);
      return 0;
    }

    let totalRemoved = 0;
    for (const prefix of prefixes) {
      const removed = await this.bustPrefix(prefix, event.orgId);
      totalRemoved += removed;
    }

    // Structured logging for observability
    logger.log(
      `cache_bust org=${event.orgId} prefixes=${prefixes.join(',')} removed=${totalRemoved}`,
    );

    return totalRemoved;
  }

  /**
   * Get the list of cache prefixes that would be affected by an event.
   * Useful for testing and debugging.
   * 
   * @param eventType - Event type to check
   * @returns Array of cache prefixes
   */
  getAffectedPrefixes(eventType: InvalidationEvent['type']): string[] {
    return EVENT_PREFIX_MAP[eventType] || [];
  }
}
