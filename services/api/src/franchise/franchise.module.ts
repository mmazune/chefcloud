import { Module } from '@nestjs/common';
import { FranchiseController } from './franchise.controller';
import { FranchiseService } from './franchise.service';
import { FranchiseOverviewService } from './franchise-overview.service';
import { FranchiseAnalyticsService } from './franchise-analytics.service';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../common/redis.service';
import { CacheService } from '../common/cache.service';
import { CacheInvalidation } from '../common/cache.invalidation';

@Module({
  imports: [],
  controllers: [FranchiseController],
  providers: [
    FranchiseService,
    FranchiseOverviewService,
    FranchiseAnalyticsService,
    PrismaService,
    RedisService,
    CacheService,
    CacheInvalidation,
  ],
  exports: [FranchiseService, FranchiseOverviewService, FranchiseAnalyticsService],
})
export class FranchiseModule {}
