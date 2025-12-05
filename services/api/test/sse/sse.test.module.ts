import { Module } from '@nestjs/common';
import { SseTestController } from './sse.test.controller';

@Module({
  controllers: [SseTestController],
})
export class SseTestModule {}
