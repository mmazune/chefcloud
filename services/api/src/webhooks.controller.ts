import { Controller, Post, Body, Headers, Logger } from '@nestjs/common';
import { PaymentsService } from './payments/payments.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private paymentsService: PaymentsService) {}

  @Post('mtn')
  async handleMtnWebhook(@Body() payload: any, @Headers('x-mtn-signature') signature?: string) {
    this.logger.log('Received MTN webhook');
    return this.paymentsService.handleWebhook('MTN', payload, signature);
  }

  @Post('airtel')
  async handleAirtelWebhook(
    @Body() payload: any,
    @Headers('x-airtel-signature') signature?: string,
  ) {
    this.logger.log('Received Airtel webhook');
    return this.paymentsService.handleWebhook('AIRTEL', payload, signature);
  }
}
