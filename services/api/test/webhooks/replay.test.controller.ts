import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { isSkewOk, signCanonical } from './replay.validate';
import { rememberNonce } from './replay.store';
import * as crypto from 'crypto';

@Controller('webhook-test')
export class WebhookReplayTestController {
  @Post('events')
  @HttpCode(200)
  handle(
    @Body() body: any,
    @Headers('x-signature') sig?: string,
    @Headers('x-timestamp') ts?: string,
    @Headers('x-nonce') nonce?: string,
  ) {
    const secret = process.env.WH_SECRET || '';
    const windowSec = parseInt(process.env.WH_SKEW_SEC || '300', 10);
    const raw = JSON.stringify(body ?? {});
    
    if (!sig) return { ok: false, reason: 'missing_signature' };
    if (!ts || !nonce) return { ok: false, reason: 'missing_timestamp_or_nonce' };

    const tsMs = Number(ts);
    if (!Number.isFinite(tsMs) || !isSkewOk(tsMs, windowSec)) {
      return { ok: false, reason: 'stale_or_invalid_timestamp' };
    }

    // Verify HMAC on canonicalized content
    const expected = signCanonical(raw, ts, nonce, secret);
    
    // Timing-safe compare
    if (expected.length !== sig.length) {
      return { ok: false, reason: 'bad_signature' };
    }
    const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    if (!ok) return { ok: false, reason: 'bad_signature' };

    // Replay protection
    const ttlMs = windowSec * 1000;
    if (!rememberNonce(nonce, ttlMs)) {
      return { ok: false, reason: 'replay_detected' };
    }

    // Simulate success
    return { ok: true, id: body?.id ?? 'evt_test', type: body?.type ?? 'event' };
  }
}
