import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheInvalidationService } from './cache-invalidation.service';
import { RedisService } from './redis.service';
import { ObservabilityModule } from '../observability/observability.module';

/**
 * Cache Module
 * Provides cache and cache invalidation services
 * Used across franchise, purchasing, inventory modules
 */
@Global()
@Module({
  imports: [ObservabilityModule],
  providers: [RedisService, CacheService, CacheInvalidationService],
  exports: [RedisService, CacheService, CacheInvalidationService],
})
export class CacheModule {}
