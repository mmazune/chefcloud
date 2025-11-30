// apps/web/src/hooks/useKdsSoundAlerts.test.tsx
// M28-KDS-S5: Tests for sound alerts hook
import React from 'react';
import { renderHook } from '@testing-library/react';
import { useKdsSoundAlerts } from './useKdsSoundAlerts';
import type { KdsOrder } from '@/types/pos';
import type { KdsPreferences } from '@/types/kds';
import { defaultKdsPreferences } from '@/types/kds';

jest.mock('@/lib/kdsAudio', () => ({
  playNewTicketSound: jest.fn().mockResolvedValue(undefined),
  playLateTicketSound: jest.fn().mockResolvedValue(undefined),
}));

import { playNewTicketSound, playLateTicketSound } from '@/lib/kdsAudio';

const basePrefs: KdsPreferences = defaultKdsPreferences;

const makeOrder = (overrides: Partial<KdsOrder> = {}): KdsOrder => ({
  id: 'o1',
  createdAt: new Date().toISOString(),
  status: 'NEW',
  items: [],
  ...overrides,
});

describe('useKdsSoundAlerts', () => {
  beforeEach(() => {
    (playNewTicketSound as jest.Mock).mockClear();
    (playLateTicketSound as jest.Mock).mockClear();
  });

  test('plays new ticket sound for unseen orders when enabled', async () => {
    const orders: KdsOrder[] = [makeOrder({ id: 'o-new' })];
    const prefs: KdsPreferences = {
      ...basePrefs,
      sounds: {
        enableNewTicketSound: true,
        enableLateTicketSound: false,
      },
    };

    const { rerender } = renderHook(
      props => useKdsSoundAlerts(props),
      {
        initialProps: {
          orders: [],
          prefs,
          isOnline: true,
        },
      }
    );

    // Simulate new orders arriving
    rerender({ orders, prefs, isOnline: true });

    // Let microtasks flush
    await Promise.resolve();

    expect(playNewTicketSound).toHaveBeenCalledTimes(1);
    expect(playLateTicketSound).not.toHaveBeenCalled();
  });

  test('plays late ticket sound when order crosses late threshold', async () => {
    const now = Date.now();
    const fifteenMinutesAgo = new Date(now - 15 * 60_000).toISOString();

    const orderLate: KdsOrder = makeOrder({
      id: 'o-late',
      createdAt: fifteenMinutesAgo,
      status: 'IN_PROGRESS',
    });

    const prefs: KdsPreferences = {
      ...basePrefs,
      priority: {
        ...basePrefs.priority,
        dueSoonMinutes: 8,
        lateMinutes: 15,
      },
      sounds: {
        enableNewTicketSound: false,
        enableLateTicketSound: true,
      },
    };

    renderHook(() =>
      useKdsSoundAlerts({
        orders: [orderLate],
        prefs,
        isOnline: true,
      })
    );

    await Promise.resolve();

    expect(playNewTicketSound).not.toHaveBeenCalled();
    expect(playLateTicketSound).toHaveBeenCalledTimes(1);
  });

  test('does not play sounds when offline', async () => {
    const orders: KdsOrder[] = [makeOrder({ id: 'o-new' })];
    const prefs: KdsPreferences = {
      ...basePrefs,
      sounds: {
        enableNewTicketSound: true,
        enableLateTicketSound: true,
      },
    };

    renderHook(() =>
      useKdsSoundAlerts({
        orders,
        prefs,
        isOnline: false,
      })
    );

    await Promise.resolve();

    expect(playNewTicketSound).not.toHaveBeenCalled();
    expect(playLateTicketSound).not.toHaveBeenCalled();
  });

  test('does not play new ticket sound when disabled', async () => {
    const orders: KdsOrder[] = [makeOrder({ id: 'o-new' })];
    const prefs: KdsPreferences = {
      ...basePrefs,
      sounds: {
        enableNewTicketSound: false, // Disabled
        enableLateTicketSound: false,
      },
    };

    renderHook(() =>
      useKdsSoundAlerts({
        orders,
        prefs,
        isOnline: true,
      })
    );

    await Promise.resolve();

    expect(playNewTicketSound).not.toHaveBeenCalled();
    expect(playLateTicketSound).not.toHaveBeenCalled();
  });

  test('does not play late sound for SERVED tickets', async () => {
    const now = Date.now();
    const twentyMinutesAgo = new Date(now - 20 * 60_000).toISOString();

    const orderServed: KdsOrder = makeOrder({
      id: 'o-served',
      createdAt: twentyMinutesAgo,
      status: 'SERVED', // Not active
    });

    const prefs: KdsPreferences = {
      ...basePrefs,
      priority: {
        ...basePrefs.priority,
        lateMinutes: 15,
      },
      sounds: {
        enableNewTicketSound: false,
        enableLateTicketSound: true,
      },
    };

    renderHook(() =>
      useKdsSoundAlerts({
        orders: [orderServed],
        prefs,
        isOnline: true,
      })
    );

    await Promise.resolve();

    expect(playNewTicketSound).not.toHaveBeenCalled();
    expect(playLateTicketSound).not.toHaveBeenCalled();
  });

  test('plays late sound only once per ticket', async () => {
    const now = Date.now();
    const twentyMinutesAgo = new Date(now - 20 * 60_000).toISOString();

    const orderLate: KdsOrder = makeOrder({
      id: 'o-late',
      createdAt: twentyMinutesAgo,
      status: 'IN_PROGRESS',
    });

    const prefs: KdsPreferences = {
      ...basePrefs,
      priority: {
        ...basePrefs.priority,
        lateMinutes: 15,
      },
      sounds: {
        enableNewTicketSound: false,
        enableLateTicketSound: true,
      },
    };

    const { rerender } = renderHook(
      props => useKdsSoundAlerts(props),
      {
        initialProps: {
          orders: [orderLate],
          prefs,
          isOnline: true,
        },
      }
    );

    await Promise.resolve();

    expect(playLateTicketSound).toHaveBeenCalledTimes(1);

    // Rerender with same orders (simulating polling refresh)
    (playLateTicketSound as jest.Mock).mockClear();
    rerender({ orders: [orderLate], prefs, isOnline: true });

    await Promise.resolve();

    // Should NOT play again
    expect(playLateTicketSound).not.toHaveBeenCalled();
  });

  test('plays new ticket sound only once per ticket', async () => {
    const order1: KdsOrder = makeOrder({ id: 'o-1' });

    const prefs: KdsPreferences = {
      ...basePrefs,
      sounds: {
        enableNewTicketSound: true,
        enableLateTicketSound: false,
      },
    };

    const { rerender } = renderHook(
      props => useKdsSoundAlerts(props),
      {
        initialProps: {
          orders: [],
          prefs,
          isOnline: true,
        },
      }
    );

    // New order arrives
    rerender({ orders: [order1], prefs, isOnline: true });
    await Promise.resolve();

    expect(playNewTicketSound).toHaveBeenCalledTimes(1);

    // Same order in next update
    (playNewTicketSound as jest.Mock).mockClear();
    rerender({ orders: [order1], prefs, isOnline: true });
    await Promise.resolve();

    // Should NOT play again
    expect(playNewTicketSound).not.toHaveBeenCalled();
  });
});
