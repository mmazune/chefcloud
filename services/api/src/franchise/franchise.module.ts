import { Module } from '@nestjs/common';
import { FranchiseController } from './franchise.controller';
import { FranchiseService } from './franchise.service';
import { FranchiseOverviewService } from './franchise-overview.service';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../common/redis.service';
import { CacheService } from '../common/cache.service';
import { CacheInvalidation } from '../common/cache.invalidation';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';
import { WastageModule } from '../wastage/wastage.module';
import { WaiterModule } from '../waiter/waiter.module';

@Module({
  imports: [ReconciliationModule, WastageModule, WaiterModule],
  controllers: [FranchiseController],
  providers: [
    FranchiseService,
    FranchiseOverviewService,
    PrismaService,
    RedisService,
    CacheService,
    CacheInvalidation,
  ],
  exports: [FranchiseService, FranchiseOverviewService],
})
export class FranchiseModule {}
