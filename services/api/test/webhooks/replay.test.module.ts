import { Module } from '@nestjs/common';
import { WebhookReplayTestController } from './replay.test.controller';

@Module({
  controllers: [WebhookReplayTestController],
})
export class WebhookReplayTestModule {}
