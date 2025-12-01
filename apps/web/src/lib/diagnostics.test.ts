// apps/web/src/lib/diagnostics.test.ts
import { formatBytes, formatAgeMs } from './diagnostics';

describe('diagnostics helpers', () => {
  test('formatBytes formats KB/MB/GB correctly', () => {
    expect(formatBytes(0)).toBe('0 KB');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(1024 * 1024 * 5)).toBe('5.00 MB');
  });

  test('formatAgeMs formats minutes and hours', () => {
    expect(formatAgeMs(0)).toBe('0 min');
    expect(formatAgeMs(5 * 60 * 1000)).toBe('5 min');
    expect(formatAgeMs(60 * 60 * 1000)).toBe('1h');
    expect(formatAgeMs(75 * 60 * 1000)).toBe('1h 15m');
  });
});
