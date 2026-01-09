import { Module } from '@nestjs/common';
import { TransferEventsTestController } from './transfer.events.test.controller';
import { CacheModule } from '../../src/common/cache.module';

@Module({
  imports: [CacheModule], // Provides CacheInvalidationService for test controller
  controllers: [TransferEventsTestController],
})
export class TransferEventsTestModule {}
