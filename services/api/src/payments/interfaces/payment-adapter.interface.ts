export interface CreateIntentResult {
  providerRef?: string;
  nextAction?: {
    type: 'ussd' | 'deep_link' | 'qr';
    data: string;
  };
  metadata?: any;
}

export interface WebhookResult {
  intentId: string;
  status: 'SUCCEEDED' | 'FAILED';
  providerRef?: string;
  metadata?: any;
}

export interface IPaymentAdapter {
  createIntent(params: {
    intentId: string;
    amount: number;
    currency: string;
    metadata?: any;
  }): Promise<CreateIntentResult>;

  handleWebhook(payload: any, signature?: string): Promise<WebhookResult>;
}
