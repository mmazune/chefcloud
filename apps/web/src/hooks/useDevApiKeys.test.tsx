/**
 * useDevApiKeys Hook Tests
 * E23-DEVPORTAL-FE-S1: Test API keys list fetching
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useDevApiKeys } from './useDevApiKeys';
import * as devPortalApi from '@/lib/devPortalApi';

jest.mock('@/lib/devPortalApi');

const mockFetchDevApiKeys = devPortalApi.fetchDevApiKeys as jest.MockedFunction<
  typeof devPortalApi.fetchDevApiKeys
>;

describe('useDevApiKeys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches and returns API keys', async () => {
    const mockKeys = [
      {
        id: 'key-1',
        label: 'Pourify Integration',
        environment: 'SANDBOX' as const,
        status: 'ACTIVE' as const,
        createdAt: '2025-12-01T10:00:00Z',
        lastUsedAt: '2025-12-01T12:00:00Z',
        truncatedKey: 'sk_test_****abcd',
      },
      {
        id: 'key-2',
        label: 'Production Key',
        environment: 'PRODUCTION' as const,
        status: 'ACTIVE' as const,
        createdAt: '2025-11-01T10:00:00Z',
        lastUsedAt: null,
        truncatedKey: 'sk_live_****wxyz',
      },
    ];

    mockFetchDevApiKeys.mockResolvedValue(mockKeys);

    const { result } = renderHook(() => useDevApiKeys());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFetchDevApiKeys).toHaveBeenCalledTimes(1);
    expect(result.current.keys).toHaveLength(2);
    expect(result.current.keys[0].label).toBe('Pourify Integration');
    expect(result.current.keys[1].environment).toBe('PRODUCTION');
    expect(result.current.error).toBeNull();
  });

  it('handles API errors gracefully', async () => {
    mockFetchDevApiKeys.mockRejectedValue(new Error('API failure'));

    const { result } = renderHook(() => useDevApiKeys());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.keys).toHaveLength(0);
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('API failure');
  });

  it('provides reload function that re-fetches data', async () => {
    const mockKeys = [
      {
        id: 'key-1',
        label: 'Test Key',
        environment: 'SANDBOX' as const,
        status: 'ACTIVE' as const,
        createdAt: '2025-12-01T10:00:00Z',
        lastUsedAt: null,
        truncatedKey: 'sk_test_****abcd',
      },
    ];

    mockFetchDevApiKeys.mockResolvedValue(mockKeys);

    const { result } = renderHook(() => useDevApiKeys());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFetchDevApiKeys).toHaveBeenCalledTimes(1);

    result.current.reload();

    await waitFor(() => expect(mockFetchDevApiKeys).toHaveBeenCalledTimes(2));
  });

  it('returns empty array initially', () => {
    mockFetchDevApiKeys.mockResolvedValue([]);

    const { result } = renderHook(() => useDevApiKeys());

    expect(result.current.keys).toHaveLength(0);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });
});
