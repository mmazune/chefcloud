import * as crypto from 'crypto';

export function signBody(bodyRaw: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(bodyRaw, 'utf8').digest('hex');
}

export function verifySignature(bodyRaw: string, secret: string, sigHex: string): boolean {
  const expected = signBody(bodyRaw, secret);
  // Simple timing-safe compare
  if (expected.length !== sigHex.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sigHex));
}
