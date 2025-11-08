import { Controller, Post, Body, Headers, Logger, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments/payments.service';
import { WebhookVerificationGuard } from './common/webhook-verification.guard';

/**
 * Webhooks Controller
 * 
 * Handles incoming webhooks from payment providers and other external services.
 * All webhook endpoints are protected by WebhookVerificationGuard (E24) which:
 * - Validates HMAC signatures (X-Sig header)
 * - Checks timestamp freshness (X-Ts header, ±5 minutes)
 * - Prevents replay attacks (X-Id header, 24h deduplication)
 */
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private paymentsService: PaymentsService) {}

  /**
   * MTN Mobile Money webhook endpoint
   * Protected by HMAC signature verification and replay protection
   */
  @Post('mtn')
  @UseGuards(WebhookVerificationGuard)
  async handleMtnWebhook(@Body() payload: any, @Headers('x-mtn-signature') signature?: string) {
    this.logger.log('Received MTN webhook');
    return this.paymentsService.handleWebhook('MTN', payload, signature);
  }

  /**
   * Airtel Money webhook endpoint
   * Protected by HMAC signature verification and replay protection
   */
  @Post('airtel')
  @UseGuards(WebhookVerificationGuard)
  async handleAirtelWebhook(
    @Body() payload: any,
    @Headers('x-airtel-signature') signature?: string,
  ) {
    this.logger.log('Received Airtel webhook');
    return this.paymentsService.handleWebhook('AIRTEL', payload, signature);
  }

  /**
   * Generic billing webhook endpoint for developer integrations
   * Protected by HMAC signature verification and replay protection
   */
  @Post('billing')
  @UseGuards(WebhookVerificationGuard)
  async handleBillingWebhook(@Body() payload: any) {
    this.logger.log(`Received billing webhook: ${payload.event || 'unknown'}`);
    return {
      received: true,
      event: payload.event,
      id: payload.id,
      timestamp: new Date().toISOString(),
    };
  }
}