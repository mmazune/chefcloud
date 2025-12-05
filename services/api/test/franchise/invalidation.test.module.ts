import { Module } from '@nestjs/common';
import { FranchiseInvalidationTestController } from './invalidation.test.controller';

@Module({
  controllers: [FranchiseInvalidationTestController],
})
export class FranchiseInvalidationTestModule {}
