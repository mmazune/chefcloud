/**
 * Chaos engineering utilities for fault injection testing.
 * All chaos features are OPT-IN only and disabled by default.
 * 
 * Environment variables:
 * - CHAOS_LATENCY_MS: Add artificial delay (0 = disabled)
 * - CHAOS_DB_TIMEOUT_PCT: Random Prisma timeout percentage (0-30)
 * - CHAOS_REDIS_DROP_PCT: Random cache miss percentage (0-30)
 */

import { InternalServerErrorException } from '@nestjs/common';

export class ChaosService {
  private readonly latencyMs: number;
  private readonly dbTimeoutPct: number;
  private readonly redisDropPct: number;

  constructor() {
    this.latencyMs = parseInt(process.env.CHAOS_LATENCY_MS || '0', 10);
    this.dbTimeoutPct = Math.min(30, parseInt(process.env.CHAOS_DB_TIMEOUT_PCT || '0', 10));
    this.redisDropPct = Math.min(30, parseInt(process.env.CHAOS_REDIS_DROP_PCT || '0', 10));

    if (this.isEnabled()) {
      console.warn('⚠️  CHAOS MODE ENABLED:', {
        latencyMs: this.latencyMs,
        dbTimeoutPct: this.dbTimeoutPct,
        redisDropPct: this.redisDropPct,
      });
    }
  }

  isEnabled(): boolean {
    return this.latencyMs > 0 || this.dbTimeoutPct > 0 || this.redisDropPct > 0;
  }

  /**
   * Inject artificial latency if enabled.
   */
  async maybeInjectLatency(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }
  }

  /**
   * Randomly throw database timeout error.
   */
  maybeThrowDbTimeout(): void {
    if (this.dbTimeoutPct > 0 && Math.random() * 100 < this.dbTimeoutPct) {
      throw new InternalServerErrorException({
        code: 'CHAOS_DB_TIMEOUT',
        message: 'Simulated database timeout',
      });
    }
  }

  /**
   * Randomly simulate cache miss (return false = drop the cache hit).
   */
  maybeDropCacheHit(): boolean {
    if (this.redisDropPct > 0 && Math.random() * 100 < this.redisDropPct) {
      return true; // Drop this cache hit
    }
    return false; // Allow cache hit
  }
}

// Singleton instance
export const chaos = new ChaosService();
