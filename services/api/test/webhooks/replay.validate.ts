import { signBody } from '../payments/webhook.hmac';
import * as crypto from 'crypto';

export function isSkewOk(tsMs: number, windowSec: number): boolean {
  const now = Date.now();
  const skew = Math.abs(now - tsMs) / 1000;
  return skew <= windowSec;
}

// canonical payload for HMAC: `${timestamp}.${nonce}.${rawBody}`
export function makeCanonical(raw: string, ts: string, nonce: string) {
  return `${ts}.${nonce}.${raw}`;
}

export function signCanonical(raw: string, ts: string, nonce: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(makeCanonical(raw, ts, nonce), 'utf8').digest('hex');
}
