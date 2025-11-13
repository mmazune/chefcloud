import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { verifySignature } from '../payments/webhook.hmac';

@Controller('dev-webhook')
export class DevPortalWebhookTestController {
  @Post('events')
  @HttpCode(200)
  handle(@Body() body: any, @Headers('x-signature') sig?: string) {
    const secret = process.env.WH_SECRET || '';
    const raw = JSON.stringify(body ?? {});
    const ok = !!sig && verifySignature(raw, secret, sig);
    if (!ok) return { ok: false, reason: !sig ? 'missing_signature' : 'bad_signature' };
    return { ok: true, type: body?.type ?? 'dev.event', id: body?.id ?? 'evt_test' };
  }
}
