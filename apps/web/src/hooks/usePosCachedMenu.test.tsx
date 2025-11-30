/**
 * M27-S9: Tests for usePosCachedMenu
 * 
 * Validates cache-first menu loading strategy:
 * - Loads from IndexedDB cache instantly when available
 * - Updates from network when online
 * - Handles offline scenarios gracefully
 * - Detects staleness correctly
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { usePosCachedMenu } from './usePosCachedMenu';

// Mock the posIndexedDb module
jest.mock('@/lib/posIndexedDb', () => ({
  loadPosSnapshot: jest.fn(),
  savePosSnapshot: jest.fn(),
  isSnapshotStale: jest.fn(),
  getSnapshotAgeMs: jest.fn(),
}));

import * as posDb from '@/lib/posIndexedDb';

describe('usePosCachedMenu', () => {
  const mockMenuCached = [{ id: 'item-1', name: 'Cached Espresso' }];
  const mockMenuNetwork = [{ id: 'item-1', name: 'Network Espresso' }];

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

  it('uses cache when available and offline (no network call)', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    jest.spyOn(posDb, 'loadPosSnapshot').mockResolvedValue({
      key: 'menu',
      updatedAt: new Date().toISOString(),
      data: mockMenuCached,
    } as any);

    jest.spyOn(posDb, 'isSnapshotStale').mockReturnValue(false);
    jest.spyOn(posDb, 'getSnapshotAgeMs').mockReturnValue(300000);

    const { result } = renderHook(() => usePosCachedMenu());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.menu).toEqual(mockMenuCached);
    expect(result.current.source).toBe('cache');
    expect((global.fetch as jest.Mock)).not.toHaveBeenCalled();
  });

  it('falls back to cache when offline and no network available', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    jest.spyOn(posDb, 'loadPosSnapshot').mockResolvedValue({
      key: 'menu',
      updatedAt: new Date().toISOString(),
      data: mockMenuCached,
    } as any);

    jest.spyOn(posDb, 'isSnapshotStale').mockReturnValue(false);
    jest.spyOn(posDb, 'getSnapshotAgeMs').mockReturnValue(300000);

    const { result } = renderHook(() => usePosCachedMenu());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.menu).toEqual(mockMenuCached);
    expect(result.current.error).toBeNull();
  });

  it('prefers network and saves snapshot when online', async () => {
    jest.spyOn(posDb, 'loadPosSnapshot').mockResolvedValue(null);
    jest.spyOn(posDb, 'isSnapshotStale').mockReturnValue(false);
    jest.spyOn(posDb, 'getSnapshotAgeMs').mockReturnValue(0);

    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true,
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockMenuNetwork,
    } as any);

    const saveSpy = jest.spyOn(posDb, 'savePosSnapshot').mockResolvedValue();

    const { result } = renderHook(() => usePosCachedMenu());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.menu).toEqual(mockMenuNetwork);
    expect(result.current.source).toBe('network');
    expect(saveSpy).toHaveBeenCalledWith('menu', mockMenuNetwork);
  });

  it('marks snapshot stale when updatedAt is old', async () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    jest.spyOn(posDb, 'loadPosSnapshot').mockResolvedValue({
      key: 'menu',
      updatedAt: old,
      data: mockMenuCached,
    } as any);

    jest.spyOn(posDb, 'isSnapshotStale').mockReturnValue(true);
    jest.spyOn(posDb, 'getSnapshotAgeMs').mockReturnValue(48 * 60 * 60 * 1000);

    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    const { result } = renderHook(() => usePosCachedMenu());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.menu).toEqual(mockMenuCached);
    expect(result.current.isStale).toBe(true);
    expect(result.current.ageMs).not.toBeNull();
  });
});
