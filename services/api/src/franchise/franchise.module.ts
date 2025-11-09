import { Module } from '@nestjs/common';
import { FranchiseController } from './franchise.controller';
import { FranchiseService } from './franchise.service';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../common/redis.service';
import { CacheService } from '../common/cache.service';
import { CacheInvalidation } from '../common/cache.invalidation';

@Module({
  controllers: [FranchiseController],
  providers: [
    FranchiseService,
    PrismaService,
    RedisService,
    CacheService,
    CacheInvalidation,
  ],
  exports: [FranchiseService],
})
export class FranchiseModule {}
