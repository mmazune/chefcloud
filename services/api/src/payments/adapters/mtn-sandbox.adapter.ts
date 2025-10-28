import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IPaymentAdapter,
  CreateIntentResult,
  WebhookResult,
} from '../interfaces/payment-adapter.interface';

@Injectable()
export class MtnSandboxAdapter implements IPaymentAdapter {
  private readonly logger = new Logger(MtnSandboxAdapter.name);
  private readonly forceFail: boolean;

  constructor(private configService: ConfigService) {
    const forceFailProviders = this.configService.get<string>('PAYMENTS_FORCE_FAIL') || '';
    this.forceFail = forceFailProviders.toLowerCase().includes('mtn');
  }

  async createIntent(params: {
    intentId: string;
    amount: number;
    currency: string;
    metadata?: any;
  }): Promise<CreateIntentResult> {
    this.logger.log(
      `[MTN Sandbox] Creating intent ${params.intentId} for ${params.amount} ${params.currency}`,
    );

    // Simulate provider reference
    const providerRef = `MTN-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Simulate USSD code
    return {
      providerRef,
      nextAction: {
        type: 'ussd',
        data: '*165*3*${phoneNumber}#',
      },
      metadata: {
        sandbox: true,
        forceFail: this.forceFail,
      },
    };
  }

  async handleWebhook(payload: any, signature?: string): Promise<WebhookResult> {
    this.logger.log(`[MTN Sandbox] Processing webhook`, payload);

    // In sandbox, verify signature if secret is set
    const secret = this.configService.get<string>('PAY_MTN_SECRET');
    if (secret && signature) {
      // Simple signature verification (in production, use HMAC)
      const expectedSig = `mtn-${secret}`;
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
