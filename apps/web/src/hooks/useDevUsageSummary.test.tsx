/**
 * Unit tests for useDevUsageSummary hook (E23-DEVPORTAL-FE-S5)
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useDevUsageSummary } from './useDevUsageSummary';
import * as devPortalApi from '@/lib/devPortalApi';

jest.mock('@/lib/devPortalApi');

const mockFetchDevUsageSummary = devPortalApi.fetchDevUsageSummary as jest.MockedFunction<
  typeof devPortalApi.fetchDevUsageSummary
>;

describe('useDevUsageSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch usage summary with default 24h range on mount', async () => {
    const mockSummary = {
      fromIso: '2025-12-01T10:00:00.000Z',
      toIso: '2025-12-02T10:00:00.000Z',
      range: '24h' as const,
      totalRequests: 1024,
      totalErrors: 32,
      errorRatePercent: 3.125,
      sandboxRequests: 512,
      productionRequests: 512,
      timeseries: [],
      topKeys: [],
    };

    mockFetchDevUsageSummary.mockResolvedValue(mockSummary);

    const { result } = renderHook(() => useDevUsageSummary());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.summary).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summary).toEqual(mockSummary);
    expect(result.current.error).toBeNull();
    expect(result.current.range).toBe('24h');
    expect(mockFetchDevUsageSummary).toHaveBeenCalledWith('24h');
  });

  it('should fetch with custom initial range', async () => {
    const mockSummary = {
      fromIso: '2025-11-25T10:00:00.000Z',
      toIso: '2025-12-02T10:00:00.000Z',
      range: '7d' as const,
      totalRequests: 5120,
      totalErrors: 128,
      errorRatePercent: 2.5,
      sandboxRequests: 2560,
      productionRequests: 2560,
      timeseries: [],
      topKeys: [],
    };

    mockFetchDevUsageSummary.mockResolvedValue(mockSummary);

    const { result } = renderHook(() => useDevUsageSummary('7d'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summary).toEqual(mockSummary);
    expect(result.current.range).toBe('7d');
    expect(mockFetchDevUsageSummary).toHaveBeenCalledWith('7d');
  });

  it('should handle API errors', async () => {
    const mockError = new Error('Failed to fetch usage');
    mockFetchDevUsageSummary.mockRejectedValue(mockError);

    const { result } = renderHook(() => useDevUsageSummary());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual(mockError);
    expect(result.current.summary).toBeNull();
  });

  it('should refetch when range changes', async () => {
    const mockSummary24h = {
      fromIso: '2025-12-01T10:00:00.000Z',
      toIso: '2025-12-02T10:00:00.000Z',
      range: '24h' as const,
      totalRequests: 1024,
      totalErrors: 32,
      errorRatePercent: 3.125,
      sandboxRequests: 512,
      productionRequests: 512,
      timeseries: [],
      topKeys: [],
    };

    const mockSummary7d = {
      fromIso: '2025-11-25T10:00:00.000Z',
      toIso: '2025-12-02T10:00:00.000Z',
      range: '7d' as const,
      totalRequests: 5120,
      totalErrors: 128,
      errorRatePercent: 2.5,
      sandboxRequests: 2560,
      productionRequests: 2560,
      timeseries: [],
      topKeys: [],
    };

    mockFetchDevUsageSummary
      .mockResolvedValueOnce(mockSummary24h)
      .mockResolvedValueOnce(mockSummary7d);

    const { result } = renderHook(() => useDevUsageSummary());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summary).toEqual(mockSummary24h);

    // Change range to 7d
    result.current.setRange('7d');

    await waitFor(() => {
      expect(result.current.range).toBe('7d');
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summary).toEqual(mockSummary7d);
    expect(mockFetchDevUsageSummary).toHaveBeenCalledTimes(2);
    expect(mockFetchDevUsageSummary).toHaveBeenNthCalledWith(1, '24h');
    expect(mockFetchDevUsageSummary).toHaveBeenNthCalledWith(2, '7d');
  });

  it('should reload data when reload is called', async () => {
    const mockSummary1 = {
      fromIso: '2025-12-01T10:00:00.000Z',
      toIso: '2025-12-02T10:00:00.000Z',
      range: '24h' as const,
      totalRequests: 1024,
      totalErrors: 32,
      errorRatePercent: 3.125,
      sandboxRequests: 512,
      productionRequests: 512,
      timeseries: [],
      topKeys: [],
    };

    const mockSummary2 = {
      ...mockSummary1,
      totalRequests: 1100,
      totalErrors: 35,
    };

    mockFetchDevUsageSummary
      .mockResolvedValueOnce(mockSummary1)
      .mockResolvedValueOnce(mockSummary2);

    const { result } = renderHook(() => useDevUsageSummary());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summary?.totalRequests).toBe(1024);

    // Trigger reload
    result.current.reload();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summary?.totalRequests).toBe(1100);
    expect(mockFetchDevUsageSummary).toHaveBeenCalledTimes(2);
  });

  it('should clear error state on successful refetch', async () => {
    const mockError = new Error('Network error');
    const mockSummary = {
      fromIso: '2025-12-01T10:00:00.000Z',
      toIso: '2025-12-02T10:00:00.000Z',
      range: '24h' as const,
      totalRequests: 1024,
      totalErrors: 32,
      errorRatePercent: 3.125,
      sandboxRequests: 512,
      productionRequests: 512,
      timeseries: [],
      topKeys: [],
    };

    mockFetchDevUsageSummary
      .mockRejectedValueOnce(mockError)
      .mockResolvedValueOnce(mockSummary);

    const { result } = renderHook(() => useDevUsageSummary());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual(mockError);
    expect(result.current.summary).toBeNull();

    // Reload
    result.current.reload();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.summary).toEqual(mockSummary);
  });
});
