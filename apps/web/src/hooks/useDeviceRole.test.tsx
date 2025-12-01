/**
 * M29-PWA-S2: Tests for useDeviceRole hook
 * 
 * Verifies device role persistence, validation, and defaults.
 */

import { renderHook, act } from '@testing-library/react';
import { useDeviceRole } from './useDeviceRole';
import { DEVICE_ROLE_STORAGE_KEY, DEVICE_ROLE_DEFAULT } from '@/types/deviceRole';

describe('useDeviceRole', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to POS when no role is stored', () => {
    const { result } = renderHook(() => useDeviceRole());

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.role).toBe('POS');
  });

  it('loads stored role from localStorage', () => {
    localStorage.setItem(DEVICE_ROLE_STORAGE_KEY, 'KDS');

    const { result } = renderHook(() => useDeviceRole());

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.role).toBe('KDS');
  });

  it('persists role when setRole is called', () => {
    const { result } = renderHook(() => useDeviceRole());

    act(() => {
      result.current.setRole('BACKOFFICE');
    });

    expect(result.current.role).toBe('BACKOFFICE');
    expect(localStorage.getItem(DEVICE_ROLE_STORAGE_KEY)).toBe('BACKOFFICE');
  });

  it('resets to default when clearRole is called', () => {
    localStorage.setItem(DEVICE_ROLE_STORAGE_KEY, 'KDS');

    const { result } = renderHook(() => useDeviceRole());

    act(() => {
      result.current.clearRole();
    });

    expect(result.current.role).toBe(DEVICE_ROLE_DEFAULT);
    expect(localStorage.getItem(DEVICE_ROLE_STORAGE_KEY)).toBeNull();
  });

  it('falls back to default when invalid role is stored', () => {
    localStorage.setItem(DEVICE_ROLE_STORAGE_KEY, 'INVALID_ROLE');

    const { result } = renderHook(() => useDeviceRole());

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.role).toBe(DEVICE_ROLE_DEFAULT);
  });
});
