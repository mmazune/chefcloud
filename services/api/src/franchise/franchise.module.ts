import { Module } from '@nestjs/common';
import { FranchiseController } from './franchise.controller';
import { FranchiseService } from './franchise.service';
import { FranchiseOverviewService } from './franchise-overview.service';
import { FranchiseAnalyticsService } from './franchise-analytics.service';
import { PrismaService } from '../prisma.service';
import { CacheInvalidation } from '../common/cache.invalidation';
import { InventoryModule } from '../inventory/inventory.module';
import { StaffModule } from '../staff/staff.module';
import { CacheModule } from '../common/cache.module';

@Module({
  imports: [InventoryModule, StaffModule, CacheModule],
  controllers: [FranchiseController],
  providers: [
    FranchiseService,
    FranchiseOverviewService,
    FranchiseAnalyticsService,
    PrismaService,
    CacheInvalidation,
  ],
  exports: [FranchiseService, FranchiseOverviewService, FranchiseAnalyticsService],
})
export class FranchiseModule {}
