// apps/web/src/lib/diagnostics.test.ts
import { formatBytes, formatAgeMs, serializeDiagnosticsSnapshot } from './diagnostics';

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

  test('serializeDiagnosticsSnapshot produces pretty JSON', () => {
    const json = serializeDiagnosticsSnapshot({
      appVersion: 'test',
      context: 'POS',
      timestampIso: '2025-01-01T00:00:00.000Z',
      deviceRole: 'POS',
      online: true,
      kiosk: { supported: true, active: false },
      offlineQueue: {
        queuedCount: 1,
        failedCount: 0,
        conflictCount: 0,
        historyCount: 1,
      },
      cache: {
        menuItemsCount: 1,
        menuStale: false,
        menuAgeMs: 60000,
        openOrdersCount: 1,
        openOrdersStale: false,
        openOrdersAgeMs: 120000,
      },
      storage: {
        usageBytes: 1024,
        quotaBytes: 1024 * 1024,
      },
      environment: {
        userAgent: 'test-agent',
        platform: 'test-platform',
        serviceWorkerSupported: true,
        language: 'en',
        locationHref: 'https://example.com',
        screen: { width: 800, height: 600 },
        nodeEnv: 'test',
        apiBaseUrl: 'https://api.example.com',
      },
      lastError: {
        hasError: true,
        context: 'POS',
        message: 'Test error',
        timestampIso: '2025-01-01T00:00:00.000Z',
      },
      billing: {
        status: 'PAST_DUE',
        planId: 'FRANCHISE_CORE',
        isRiskState: true,
      },
    });

    expect(json).toContain('"appVersion": "test"');
    expect(json).toContain('"context": "POS"');
    expect(json).toContain('"lastError"');
    expect(json).toContain('"Test error"');
    expect(json).toContain('"billing"');
    expect(json).toContain('"PAST_DUE"');
    expect(json).toContain('"FRANCHISE_CORE"');
    expect(json.split('\n').length).toBeGreaterThan(5);
  });

  test('serializeDiagnosticsSnapshot handles null billing', () => {
    const json = serializeDiagnosticsSnapshot({
      appVersion: 'test',
      context: 'KDS',
      timestampIso: '2025-01-01T00:00:00.000Z',
      deviceRole: 'KDS',
      online: true,
      kiosk: { supported: false, active: false },
      offlineQueue: {
        queuedCount: 0,
        failedCount: 0,
        conflictCount: 0,
        historyCount: 0,
      },
      cache: {
        menuItemsCount: 0,
        menuStale: false,
        menuAgeMs: null,
        openOrdersCount: 0,
        openOrdersStale: false,
        openOrdersAgeMs: null,
      },
      storage: {
        usageBytes: null,
        quotaBytes: null,
      },
      environment: {
        userAgent: null,
        platform: null,
        serviceWorkerSupported: false,
        language: null,
        locationHref: null,
        screen: { width: null, height: null },
        nodeEnv: null,
        apiBaseUrl: null,
      },
      lastError: {
        hasError: false,
        context: null,
        message: null,
        timestampIso: null,
      },
      billing: null,
    });

    expect(json).toContain('"billing": null');
  });
});
