import { Module } from '@nestjs/common';
import { PaymentsTestWebhookController } from './webhook.test.controller';

@Module({
  controllers: [PaymentsTestWebhookController],
})
export class PaymentsWebhookTestModule {}
