import * as crypto from 'crypto';

/**
 * Sign request body with HMAC SHA-256
 * @param bodyRaw - Raw request body as string
 * @param secret - HMAC secret key
 * @returns Hex-encoded HMAC signature
 */
export function signBody(bodyRaw: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(bodyRaw, 'utf8').digest('hex');
}

/**
 * Verify HMAC signature using timing-safe comparison
 * @param bodyRaw - Raw request body as string
 * @param secret - HMAC secret key
 * @param sigHex - Hex-encoded signature to verify
 * @returns True if signature is valid, false otherwise
 */
export function verifySignature(bodyRaw: string, secret: string, sigHex: string): boolean {
  if (!sigHex) return false;
  
  const expected = signBody(bodyRaw, secret);
  
  // Timing-safe comparison to prevent timing attacks
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(sigHex, 'hex');
  
  if (a.length !== b.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(a, b);
}
