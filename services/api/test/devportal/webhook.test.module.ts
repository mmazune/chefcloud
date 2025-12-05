import { Module } from '@nestjs/common';
import { DevPortalWebhookTestController } from './webhook.test.controller';

@Module({
  controllers: [DevPortalWebhookTestController],
})
export class DevPortalWebhookTestModule {}
