// apps/web/src/types/kds.test.ts
// M28-KDS-S7: Tests for KDS preference validation and sanitization

import {
  sanitizeKdsPreferences,
  defaultKdsPreferences,
  KdsPreferences,
} from './kds';

describe('sanitizeKdsPreferences', () => {
  test('returns defaults when input is null/undefined', () => {
    expect(sanitizeKdsPreferences(undefined)).toEqual(defaultKdsPreferences);
    expect(sanitizeKdsPreferences(null)).toEqual(defaultKdsPreferences);
  });

  test('clamps negative or NaN values to minimums', () => {
    const dirty: Partial<KdsPreferences> = {
      priority: {
        dueSoonMinutes: -5,
        lateMinutes: -10,
      },
      display: {
        hideServed: true,
        dimReadyAfterMinutes: -1,
      },
    };

    const result = sanitizeKdsPreferences(dirty);

    expect(result.priority.dueSoonMinutes).toBeGreaterThanOrEqual(1);
    expect(result.priority.lateMinutes).toBeGreaterThan(result.priority.dueSoonMinutes);
    expect(result.display.dimReadyAfterMinutes).toBeGreaterThanOrEqual(0);
  });

  test('ensures lateMinutes is strictly greater than dueSoonMinutes', () => {
    const dirty: Partial<KdsPreferences> = {
      priority: {
        dueSoonMinutes: 10,
        lateMinutes: 5,
      },
    };

    const result = sanitizeKdsPreferences(dirty);

    expect(result.priority.dueSoonMinutes).toBe(10);
    expect(result.priority.lateMinutes).toBeGreaterThan(10);
  });

  test('clamps extremely large values to maximums', () => {
    const dirty: Partial<KdsPreferences> = {
      priority: {
        dueSoonMinutes: 999,
        lateMinutes: 999,
      },
      display: {
        hideServed: false,
        dimReadyAfterMinutes: 999,
      },
    };

    const result = sanitizeKdsPreferences(dirty);

    expect(result.priority.dueSoonMinutes).toBeLessThanOrEqual(60);
    expect(result.priority.lateMinutes).toBeLessThanOrEqual(240);
    expect(result.display.dimReadyAfterMinutes).toBeLessThanOrEqual(240);
  });

  test('preserves valid values as-is', () => {
    const dirty: Partial<KdsPreferences> = {
      priority: {
        dueSoonMinutes: 7,
        lateMinutes: 20,
      },
      display: {
        hideServed: true,
        dimReadyAfterMinutes: 15,
      },
      sounds: {
        enableNewTicketSound: true,
        enableLateTicketSound: false,
      },
    };

    const result = sanitizeKdsPreferences(dirty);

    expect(result.priority.dueSoonMinutes).toBe(7);
    expect(result.priority.lateMinutes).toBe(20);
    expect(result.display.hideServed).toBe(true);
    expect(result.display.dimReadyAfterMinutes).toBe(15);
    expect(result.sounds.enableNewTicketSound).toBe(true);
    expect(result.sounds.enableLateTicketSound).toBe(false);
  });

  test('handles NaN values (from invalid input parsing)', () => {
    const dirty: Partial<KdsPreferences> = {
      priority: {
        dueSoonMinutes: NaN,
        lateMinutes: NaN,
      },
      display: {
        hideServed: true,
        dimReadyAfterMinutes: NaN,
      },
    };

    const result = sanitizeKdsPreferences(dirty);

    // Should fall back to safe minimums
    expect(result.priority.dueSoonMinutes).toBe(1);
    expect(result.priority.lateMinutes).toBeGreaterThan(1);
    expect(result.display.dimReadyAfterMinutes).toBe(0);
  });

  test('handles Infinity values', () => {
    const dirty: Partial<KdsPreferences> = {
      priority: {
        dueSoonMinutes: Infinity,
        lateMinutes: Infinity,
      },
      display: {
        hideServed: false,
        dimReadyAfterMinutes: Infinity,
      },
    };

    const result = sanitizeKdsPreferences(dirty);

    // Should clamp to maximums
    expect(result.priority.dueSoonMinutes).toBe(60);
    expect(result.priority.lateMinutes).toBe(240);
    expect(result.display.dimReadyAfterMinutes).toBe(240);
  });

  test('handles edge case: dueSoonMinutes equals lateMinutes', () => {
    const dirty: Partial<KdsPreferences> = {
      priority: {
        dueSoonMinutes: 10,
        lateMinutes: 10,
      },
    };

    const result = sanitizeKdsPreferences(dirty);

    expect(result.priority.dueSoonMinutes).toBe(10);
    expect(result.priority.lateMinutes).toBe(11); // Should be dueSoon + 1
  });

  test('handles edge case: dueSoonMinutes at max, lateMinutes less', () => {
    const dirty: Partial<KdsPreferences> = {
      priority: {
        dueSoonMinutes: 60,
        lateMinutes: 50,
      },
    };

    const result = sanitizeKdsPreferences(dirty);

    expect(result.priority.dueSoonMinutes).toBe(60);
    expect(result.priority.lateMinutes).toBe(61); // Should be dueSoon + 1, clamped to 240 max
  });

  test('handles partial input with only priority', () => {
    const dirty: Partial<KdsPreferences> = {
      priority: {
        dueSoonMinutes: 12,
        lateMinutes: 25,
      },
    };

    const result = sanitizeKdsPreferences(dirty);

    expect(result.priority.dueSoonMinutes).toBe(12);
    expect(result.priority.lateMinutes).toBe(25);
    // Should use defaults for display and sounds
    expect(result.display).toEqual(defaultKdsPreferences.display);
    expect(result.sounds).toEqual(defaultKdsPreferences.sounds);
  });

  test('handles partial input with only display', () => {
    const dirty: Partial<KdsPreferences> = {
      display: {
        hideServed: false,
        dimReadyAfterMinutes: 20,
      },
    };

    const result = sanitizeKdsPreferences(dirty);

    expect(result.display.hideServed).toBe(false);
    expect(result.display.dimReadyAfterMinutes).toBe(20);
    // Should use defaults for priority and sounds
    expect(result.priority).toEqual(defaultKdsPreferences.priority);
    expect(result.sounds).toEqual(defaultKdsPreferences.sounds);
  });

  test('handles empty object', () => {
    const result = sanitizeKdsPreferences({});

    expect(result).toEqual(defaultKdsPreferences);
  });

  test('allows dimReadyAfterMinutes to be 0 (no dimming)', () => {
    const dirty: Partial<KdsPreferences> = {
      display: {
        hideServed: true,
        dimReadyAfterMinutes: 0,
      },
    };

    const result = sanitizeKdsPreferences(dirty);

    expect(result.display.dimReadyAfterMinutes).toBe(0);
  });
});
