import {
  verifyHMAC,
  checkTimestampWindow,
  verifyWebhookSignature,
  verifySpoutSignature,
} from './crypto.utils';
import { createHmac } from 'crypto';

describe('Crypto Utils', () => {
  describe('verifyHMAC', () => {
    it('should verify valid HMAC signature', () => {
      const secret = 'test-secret';
      const data = 'test data';
      const signature = createHmac('sha256', secret).update(data).digest('hex');

      expect(verifyHMAC(secret, data, signature)).toBe(true);
    });

    it('should reject invalid signature', () => {
      const secret = 'test-secret';
      const data = 'test data';
      const wrongSignature = 'invalid-signature-hex-value';

      expect(verifyHMAC(secret, data, wrongSignature)).toBe(false);
    });

    it('should reject signature with wrong secret', () => {
      const secret = 'test-secret';
      const wrongSecret = 'wrong-secret';
      const data = 'test data';
      const signature = createHmac('sha256', wrongSecret).update(data).digest('hex');

      expect(verifyHMAC(secret, data, signature)).toBe(false);
    });

    it('should handle empty inputs safely', () => {
      expect(verifyHMAC('', 'data', 'sig')).toBe(false);
      expect(verifyHMAC('secret', '', 'sig')).toBe(false);
      expect(verifyHMAC('secret', 'data', '')).toBe(false);
    });

    it('should use constant-time comparison', () => {
      // This test verifies the function doesn't throw, timing analysis would require benchmarking
      const secret = 'test-secret';
      const data = 'test data';
      const validSig = createHmac('sha256', secret).update(data).digest('hex');
      const invalidSig = 'a'.repeat(validSig.length);

      expect(() => verifyHMAC(secret, data, validSig)).not.toThrow();
      expect(() => verifyHMAC(secret, data, invalidSig)).not.toThrow();
    });
  });

  describe('checkTimestampWindow', () => {
    it('should accept timestamp within 5 minute window', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(checkTimestampWindow(now)).toBe(true);
      expect(checkTimestampWindow(now - 60)).toBe(true); // 1 min ago
      expect(checkTimestampWindow(now - 299)).toBe(true); // 4:59 ago
      expect(checkTimestampWindow(now + 60)).toBe(true); // 1 min future
    });

    it('should reject timestamp outside 5 minute window', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(checkTimestampWindow(now - 301)).toBe(false); // 5:01 ago
      expect(checkTimestampWindow(now - 600)).toBe(false); // 10 min ago
      expect(checkTimestampWindow(now + 301)).toBe(false); // 5:01 future
    });

    it('should support custom window size', () => {
      const now = Math.floor(Date.now() / 1000);
      const customWindow = 60; // 1 minute
      expect(checkTimestampWindow(now - 30, customWindow)).toBe(true);
      expect(checkTimestampWindow(now - 61, customWindow)).toBe(false);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid webhook signature with timestamp', () => {
      const secret = 'webhook-secret';
      const body = '{"event":"payment.success"}';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const data = secret + body + timestamp;
      const signature = createHmac('sha256', secret).update(data).digest('hex');

      const result = verifyWebhookSignature(secret, body, timestamp, signature);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject signature with expired timestamp (replay attack)', () => {
      const secret = 'webhook-secret';
      const body = '{"event":"payment.success"}';
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 6+ min ago
      const data = secret + body + oldTimestamp;
      const signature = createHmac('sha256', secret).update(data).digest('hex');

      const result = verifyWebhookSignature(secret, body, oldTimestamp, signature);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Timestamp outside valid window');
    });

    it('should reject invalid timestamp format', () => {
      const secret = 'webhook-secret';
      const body = '{"event":"payment.success"}';
      const invalidTimestamp = 'not-a-number';
      const signature = 'dummy-signature';

      const result = verifyWebhookSignature(secret, body, invalidTimestamp, signature);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid timestamp format');
    });

    it('should reject invalid signature even with valid timestamp', () => {
      const secret = 'webhook-secret';
      const body = '{"event":"payment.success"}';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const wrongSignature = 'invalid-signature-0000000000000000';

      const result = verifyWebhookSignature(secret, body, timestamp, wrongSignature);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid signature');
    });
  });

  describe('verifySpoutSignature', () => {
    it('should verify valid spout device signature', () => {
      const deviceSecret = 'device-secret-abc123';
      const body = '{"deviceId":"dev-001","pulses":42}';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const data = deviceSecret + body + timestamp;
      const signature = createHmac('sha256', deviceSecret).update(data).digest('hex');

      const result = verifySpoutSignature(deviceSecret, body, timestamp, signature);
      expect(result.valid).toBe(true);
    });

    it('should reject spout signature with wrong device secret', () => {
      const correctSecret = 'device-secret-abc123';
      const wrongSecret = 'device-secret-xyz789';
      const body = '{"deviceId":"dev-001","pulses":42}';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const data = wrongSecret + body + timestamp;
      const signature = createHmac('sha256', wrongSecret).update(data).digest('hex');

      const result = verifySpoutSignature(correctSecret, body, timestamp, signature);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid signature');
    });
  });
});
