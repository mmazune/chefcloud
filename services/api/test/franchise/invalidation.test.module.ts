import { Module } from '@nestjs/common';
import { FranchiseInvalidationTestController } from './invalidation.test.controller';
import { CacheModule } from '../../src/common/cache.module';

@Module({
  imports: [CacheModule], // T1.9: Provides CacheInvalidationService for test controller
  controllers: [FranchiseInvalidationTestController],
})
export class FranchiseInvalidationTestModule {}
