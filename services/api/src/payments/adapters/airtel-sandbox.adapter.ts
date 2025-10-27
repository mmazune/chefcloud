import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IPaymentAdapter,
  CreateIntentResult,
  WebhookResult,
} from '../interfaces/payment-adapter.interface';

@Injectable()
export class AirtelSandboxAdapter implements IPaymentAdapter {
  private readonly logger = new Logger(AirtelSandboxAdapter.name);
  private readonly forceFail: boolean;

  constructor(private configService: ConfigService) {
    const forceFailProviders =
      this.configService.get<string>('PAYMENTS_FORCE_FAIL') || '';
    this.forceFail = forceFailProviders.toLowerCase().includes('airtel');
  }

  async createIntent(params: {
    intentId: string;
    amount: number;
    currency: string;
    metadata?: any;
  }): Promise<CreateIntentResult> {
    this.logger.log(
      `[Airtel Sandbox] Creating intent ${params.intentId} for ${params.amount} ${params.currency}`,
    );

    // Simulate provider reference
    const providerRef = `AIRTEL-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Simulate deep link
    return {
      providerRef,
      nextAction: {
        type: 'deep_link',
        data: `airtelmoney://pay?ref=${providerRef}&amount=${params.amount}`,
      },
      metadata: {
        sandbox: true,
        forceFail: this.forceFail,
      },
    };
  }

  async handleWebhook(
    payload: any,
    signature?: string,
  ): Promise<WebhookResult> {
    this.logger.log(`[Airtel Sandbox] Processing webhook`, payload);

    // In sandbox, verify signature if secret is set
    const secret = this.configService.get<string>('PAY_AIRTEL_SECRET');
    if (secret && signature) {
      // Simple signature verification (in production, use HMAC)
      const expectedSig = `airtel-${secret}`;
      if (signature !== expectedSig) {
        throw new Error('Invalid webhook signature');
      }
    }

    // Simulate status based on forceFail flag
    const status = this.forceFail ? 'FAILED' : 'SUCCEEDED';

    return {
      intentId: payload.intentId || payload.reference,
      status,
      providerRef: payload.providerRef || payload.transactionId,
      metadata: {
        sandbox: true,
        rawPayload: payload,
      },
    };
  }
}
