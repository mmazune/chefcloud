import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify HMAC signature with constant-time comparison
 */
export function verifyHMAC(
  secret: string,
  data: string,
  signature: string,
  algorithm: 'sha256' | 'sha512' = 'sha256',
): boolean {
  if (!secret || !data || !signature) {
    return false;
  }

  const expected = createHmac(algorithm, secret).update(data).digest('hex');
  
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex'),
    );
  } catch {
    return false;
  }
}

/**
 * Check if timestamp is within acceptable window (default 5 minutes)
 * Returns true if timestamp is valid, false if replay attack suspected
 */
export function checkTimestampWindow(
  timestamp: number,
  windowSeconds: number = 300, // 5 minutes
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const delta = Math.abs(now - timestamp);
  return delta <= windowSeconds;
}

/**
 * Verify webhook HMAC signature with timestamp
 * Expected format: HMAC(secret + body + timestamp)
 */
export function verifyWebhookSignature(
  secret: string,
  body: string,
  timestamp: string,
  signature: string,
): { valid: boolean; reason?: string } {
  // Check timestamp window first (replay protection)
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    return { valid: false, reason: 'Invalid timestamp format' };
  }

  if (!checkTimestampWindow(ts)) {
    return { valid: false, reason: 'Timestamp outside valid window (5 min)' };
  }

  // Verify HMAC
  const data = secret + body + timestamp;
  const valid = verifyHMAC(secret, data, signature, 'sha256');

  if (!valid) {
    return { valid: false, reason: 'Invalid signature' };
  }

  return { valid: true };
}

/**
 * Verify Spout device signature
 * Expected format: HMAC(device.secret + body + timestamp)
 */
export function verifySpoutSignature(
  deviceSecret: string,
  body: string,
  timestamp: string,
  signature: string,
): { valid: boolean; reason?: string } {
  // Reuse webhook verification (same format)
  return verifyWebhookSignature(deviceSecret, body, timestamp, signature);
}
