/**
 * M27-S9: Tests for useOfflineQueue
 * 
 * Validates core offline queue hook behavior:
 * - Queue management (add, sync, clear)
 * - Sync log tracking (pending, success, failed, conflict)
 * - Conflict detection for risky actions
 * - Online/offline state handling
 * - Service worker message handling
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import * as queueLib from '@/lib/offlineQueue';
import * as syncLogDb from '@/lib/posSyncLogDb';
import { useOfflineQueue } from './useOfflineQueue';

// Mock the modules at the top level
jest.mock('@/lib/offlineQueue');
jest.mock('@/lib/posSyncLogDb');

describe('useOfflineQueue', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset mocks to default implementations
    (queueLib.loadQueue as jest.Mock) = jest.fn().mockReturnValue([]);
    (queueLib.enqueue as jest.Mock) = jest.fn().mockImplementation((input: any) => [
      {
        id: 'q1',
        idempotencyKey: 'idem-q1',
        url: input.url,
        method: input.method,
        body: input.body,
        headers: input.headers,
        createdAt: Date.now(),
      },
    ]);
    (queueLib.saveQueue as jest.Mock) = jest.fn();
    (queueLib.clearQueue as jest.Mock) = jest.fn();

    (syncLogDb.loadPersistedSyncLog as jest.Mock) = jest.fn().mockResolvedValue([]);
    (syncLogDb.savePersistedSyncLog as jest.Mock) = jest.fn().mockResolvedValue();
    (syncLogDb.clearPersistedSyncLog as jest.Mock) = jest.fn().mockResolvedValue();

    (global.fetch as jest.Mock) = jest.fn();

    // Default online
    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true,
    });
  });

  test('initializes with empty queue and online status', () => {
    const { result } = renderHook(() => useOfflineQueue());

    expect(result.current.queue).toEqual([]);
    expect(result.current.syncLog).toEqual([]);
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isSyncing).toBe(false);
  });

  test('loads persisted sync log on mount', async () => {
    const persistedLog = [
      {
        id: 'log-1',
        label: 'Create order',
        createdAt: new Date().toISOString(),
        status: 'success' as const,
      },
    ];

    jest.spyOn(syncLogDb, 'loadPersistedSyncLog').mockResolvedValue(persistedLog);

    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(result.current.syncLog).toEqual(persistedLog);
    });
  });

  test('addToQueue enqueues item and adds pending log entry', () => {
    const { result } = renderHook(() => useOfflineQueue());

    act(() => {
      result.current.addToQueue({
        url: '/api/pos/orders',
        method: 'POST',
        body: { table: 'T1' },
      } as any);
    });

    expect(result.current.queue).toHaveLength(1);
    expect(result.current.syncLog).toHaveLength(1);
    expect(result.current.syncLog[0].status).toBe('pending');
    expect(result.current.syncLog[0].label).toContain('Create order');
  });

  test('syncQueue marks success and removes from queue', async () => {
    (queueLib.loadQueue as jest.Mock).mockReturnValue([
      {
        id: 'q1',
        idempotencyKey: 'idem-q1',
        url: '/api/pos/orders',
        method: 'POST',
        body: { table: 'T1' },
        createdAt: Date.now(),
      },
    ]);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => '',
    } as any);

    const { result } = renderHook(() => useOfflineQueue());

    await act(async () => {
      await result.current.syncQueue();
    });

    expect(queueLib.saveQueue).toHaveBeenCalledWith([]);
    expect(result.current.syncLog[0].status).toBe('success');
  });

  test('syncQueue marks failed when network error occurs', async () => {
    (queueLib.loadQueue as jest.Mock).mockReturnValue([
      {
        id: 'q1',
        idempotencyKey: 'idem-q1',
        url: '/api/pos/orders',
        method: 'POST',
        body: { table: 'T1' },
        createdAt: Date.now(),
      },
    ]);

    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useOfflineQueue());

    await act(async () => {
      await result.current.syncQueue();
    });

    expect(result.current.syncLog[0].status).toBe('failed');
    expect(result.current.syncLog[0].errorMessage).toContain('Network error');
    expect(result.current.queue).toHaveLength(1); // Item stays in queue
  });

  test('syncQueue marks conflict when server order is CLOSED', async () => {
    // Risky action pointing to an order
    (queueLib.loadQueue as jest.Mock).mockReturnValue([
      {
        id: 'q1',
        idempotencyKey: 'idem-q1',
        url: '/api/pos/orders/order-123/pay',
        method: 'POST',
        body: { amount: 50 },
        createdAt: Date.now(),
      },
    ]);

    // Conflict check GET /api/pos/orders/order-123
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url.includes('/api/pos/orders/order-123') && !url.includes('/pay')) {
        return {
          ok: true,
          json: async () => ({ id: 'order-123', status: 'CLOSED' }),
        } as any;
      }
      throw new Error('Unexpected fetch');
    });

    const { result } = renderHook(() => useOfflineQueue());

    await act(async () => {
      await result.current.syncQueue();
    });

    expect(result.current.queue).toHaveLength(0); // Removed from queue
    expect(result.current.syncLog[0].status).toBe('conflict');
    expect(result.current.syncLog[0].errorMessage).toMatch(/CLOSED/);
    expect(result.current.syncLog[0].conflictDetails?.serverStatus).toBe('CLOSED');
  });

  test('syncQueue marks conflict when server order is PAID', async () => {
    (queueLib.loadQueue as jest.Mock).mockReturnValue([
      {
        id: 'q1',
        idempotencyKey: 'idem-q1',
        url: '/api/pos/orders/order-456/void',
        method: 'POST',
        body: {},
        createdAt: Date.now(),
      },
    ]);

    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url.includes('/api/pos/orders/order-456') && !url.includes('/void')) {
        return {
          ok: true,
          json: async () => ({ id: 'order-456', status: 'PAID' }),
        } as any;
      }
      throw new Error('Unexpected fetch');
    });

    const { result } = renderHook(() => useOfflineQueue());

    await act(async () => {
      await result.current.syncQueue();
    });

    expect(result.current.syncLog[0].status).toBe('conflict');
    expect(result.current.syncLog[0].conflictDetails?.serverStatus).toBe('PAID');
  });

  test('clearQueue empties queue and removes non-success history', () => {
    const { result } = renderHook(() => useOfflineQueue());

    // Add some items
    act(() => {
      result.current.addToQueue({
        url: '/api/pos/orders',
        method: 'POST',
        body: {},
      } as any);
    });

    // Manually add success entry
    act(() => {
      (result.current as any).syncLog = [
        {
          id: 'q1',
          label: 'Create order',
          createdAt: new Date().toISOString(),
          status: 'success',
        },
        {
          id: 'q2',
          label: 'Pay order',
          createdAt: new Date().toISOString(),
          status: 'pending',
        },
      ];
    });

    act(() => {
      result.current.clearQueue();
    });

    expect(result.current.queue).toEqual([]);
    // Success entries should remain, pending/failed/conflict removed
    expect(result.current.syncLog.every(e => e.status === 'success')).toBe(true);
  });

  test('clearSyncHistory removes all log entries', () => {
    const { result } = renderHook(() => useOfflineQueue());

    // Add log entries
    act(() => {
      result.current.addToQueue({
        url: '/api/pos/orders',
        method: 'POST',
        body: {},
      } as any);
    });

    expect(result.current.syncLog).toHaveLength(1);

    act(() => {
      result.current.clearSyncHistory();
    });

    expect(result.current.syncLog).toEqual([]);
    expect(syncLogDb.clearPersistedSyncLog).toHaveBeenCalled();
  });

  test('detects offline status changes', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true,
    });

    const { result } = renderHook(() => useOfflineQueue());

    expect(result.current.isOnline).toBe(true);

    // Simulate going offline
    act(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        value: false,
        configurable: true,
      });
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(result.current.isOnline).toBe(false);
    });
  });

  test('handles POS_SYNC_QUEUE message from service worker', async () => {
    (queueLib.loadQueue as jest.Mock).mockReturnValue([
      {
        id: 'q1',
        idempotencyKey: 'idem-q1',
        url: '/api/pos/orders',
        method: 'POST',
        body: {},
        createdAt: Date.now(),
      },
    ]);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => '',
    } as any);

    // Mock navigator.serviceWorker
    const listeners: Array<(event: MessageEvent) => void> = [];
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        addEventListener: jest.fn((event: string, callback: (e: MessageEvent) => void) => {
          if (event === 'message') {
            listeners.push(callback);
          }
        }),
        removeEventListener: jest.fn(),
      },
      configurable: true,
    });

    const { result } = renderHook(() => useOfflineQueue());

    // Simulate service worker message
    await act(async () => {
      const event = new MessageEvent('message', {
        data: { type: 'POS_SYNC_QUEUE' },
      });
      listeners.forEach(listener => listener(event));
    });

    await waitFor(() => {
      expect(result.current.syncLog[0]?.status).toBe('success');
    });
  });

  test('skips conflict check for createOrder action', async () => {
    (queueLib.loadQueue as jest.Mock).mockReturnValue([
      {
        id: 'q1',
        idempotencyKey: 'idem-q1',
        url: '/api/pos/orders',
        method: 'POST',
        body: { table: 'T1' },
        createdAt: Date.now(),
      },
    ]);

    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    } as any);

    (global.fetch as jest.Mock).mockImplementation(fetchSpy);

    const { result } = renderHook(() => useOfflineQueue());

    await act(async () => {
      await result.current.syncQueue();
    });

    // Should only call fetch once (the actual POST), no conflict check GET
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/pos/orders',
      expect.any(Object)
    );
  });
});
