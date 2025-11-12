import { Body, Controller, Headers, HttpCode, Post, Req, RawBodyRequest } from '@nestjs/common';
import { verifySignature } from './webhook.hmac';

@Controller('payments-test-webhook')
export class PaymentsTestWebhookController {
  @Post('gateway')
  @HttpCode(200)
  handle(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: any,
    @Headers('x-signature') sig?: string,
  ) {
    const secret = process.env.WH_SECRET || '';
    // Raw body support: if your global pipe parses JSON, reconstruct a raw string deterministically
    // For test purposes, stringify body as sent:
    const raw = JSON.stringify(body ?? {});
    
    if (!sig) {
      return { ok: false, reason: 'missing_signature' };
    }
    
    const ok = verifySignature(raw, secret, sig);
    if (!ok) {
      return { ok: false, reason: 'bad_signature' };
    }
    
    // Simulate event handling result
    return {
      ok: true,
      type: body?.type ?? 'payment.updated',
      id: body?.id ?? 'evt_test',
    };
  }
}
