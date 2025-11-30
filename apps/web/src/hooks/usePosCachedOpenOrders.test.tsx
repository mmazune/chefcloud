/**
 * M27-S9: Tests for usePosCachedOpenOrders
 * 
 * Validates cache-first open orders loading strategy:
 * - Loads from IndexedDB cache instantly when available
 * - Updates from network when online
 * - Handles offline scenarios gracefully
 * - Detects staleness correctly
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { usePosCachedOpenOrders } from './usePosCachedOpenOrders';

// Mock the posIndexedDb module
jest.mock('@/lib/posIndexedDb', () => ({
  loadPosSnapshot: jest.fn(),
  savePosSnapshot: jest.fn(),
  isSnapshotStale: jest.fn(),
  getSnapshotAgeMs: jest.fn(),
}));

import * as posDb from '@/lib/posIndexedDb';

describe('usePosCachedOpenOrders', () => {
  const mockOrdersCached = [{ id: 'order-1', table: 'T1' }];
  const mockOrdersNetwork = [{ id: 'order-1', table: 'T1-network' }];

  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockReset();
    jest.spyOn(posDb, 'loadPosSnapshot').mockReset();
    jest.spyOn(posDb, 'savePosSnapshot').mockReset();
    jest.spyOn(posDb, 'isSnapshotStale').mockReset();
    jest.spyOn(posDb, 'getSnapshotAgeMs').mockReset();

    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses cached open orders when offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    jest.spyOn(posDb, 'loadPosSnapshot').mockResolvedValue({
      key: 'openOrders',
      updatedAt: new Date().toISOString(),
      data: mockOrdersCached,
    } as any);

    jest.spyOn(posDb, 'isSnapshotStale').mockReturnValue(false);
    jest.spyOn(posDb, 'getSnapshotAgeMs').mockReturnValue(120000);

    const { result } = renderHook(() => usePosCachedOpenOrders());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.openOrders).toEqual(mockOrdersCached);
    expect(result.current.source).toBe('cache');
    expect((global.fetch as jest.Mock)).not.toHaveBeenCalled();
  });

  it('loads from network and saves snapshot when online', async () => {
    jest.spyOn(posDb, 'loadPosSnapshot').mockResolvedValue(null);
    jest.spyOn(posDb, 'isSnapshotStale').mockReturnValue(false);
    jest.spyOn(posDb, 'getSnapshotAgeMs').mockReturnValue(0);

    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true,
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockOrdersNetwork,
    } as any);

    const saveSpy = jest.spyOn(posDb, 'savePosSnapshot').mockResolvedValue();

    const { result } = renderHook(() => usePosCachedOpenOrders());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.openOrders).toEqual(mockOrdersNetwork);
    expect(result.current.source).toBe('network');
    expect(saveSpy).toHaveBeenCalledWith('openOrders', mockOrdersNetwork);
  });

  it('marks openOrders snapshot as stale when old', async () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    jest.spyOn(posDb, 'loadPosSnapshot').mockResolvedValue({
      key: 'openOrders',
      updatedAt: old,
      data: mockOrdersCached,
    } as any);

    jest.spyOn(posDb, 'isSnapshotStale').mockReturnValue(true);
    jest.spyOn(posDb, 'getSnapshotAgeMs').mockReturnValue(48 * 60 * 60 * 1000);

    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    const { result } = renderHook(() => usePosCachedOpenOrders());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.openOrders).toEqual(mockOrdersCached);
    expect(result.current.isStale).toBe(true);
    expect(result.current.ageMs).not.toBeNull();
  });

  test('handles fetch errors gracefully', async () => {
    jest.spyOn(posDb, 'loadPosSnapshot').mockResolvedValue(null);

    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true,
    });

    (global.fetch as jest.Mock).mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => usePosCachedOpenOrders());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.openOrders).toBeNull();
  });

  test('returns none source when no cache and offline', async () => {
    jest.spyOn(posDb, 'loadPosSnapshot').mockResolvedValue(null);

    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    const { result } = renderHook(() => usePosCachedOpenOrders());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.openOrders).toBeNull();
    expect(result.current.source).toBe('none');
  });

  test('handles HTTP error responses', async () => {
    jest.spyOn(posDb, 'loadPosSnapshot').mockResolvedValue(null);

    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true,
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    } as any);

    const { result } = renderHook(() => usePosCachedOpenOrders());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toContain('500');
  });
});
