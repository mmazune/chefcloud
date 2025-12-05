import { Module } from '@nestjs/common';
import { TransferEventsTestController } from './transfer.events.test.controller';

@Module({
  controllers: [TransferEventsTestController],
})
export class TransferEventsTestModule {}
