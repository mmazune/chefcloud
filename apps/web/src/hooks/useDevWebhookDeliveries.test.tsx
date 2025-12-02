/**
 * Unit tests for useDevWebhookDeliveries hook (E23-S3)
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useDevWebhookDeliveries } from './useDevWebhookDeliveries';
import * as devPortalApi from '@/lib/devPortalApi';

jest.mock('@/lib/devPortalApi');

const mockFetchDevWebhookDeliveries =
  devPortalApi.fetchDevWebhookDeliveries as jest.Mock;

describe('useDevWebhookDeliveries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should start loading on mount', () => {
    mockFetchDevWebhookDeliveries.mockResolvedValue({ deliveries: [] });

    const { result } = renderHook(() =>
      useDevWebhookDeliveries({ endpointId: 'ep123' }),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.deliveries).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should fetch deliveries and populate list', async () => {
    const mockDeliveries = [
      {
        id: 'del1',
        endpointId: 'ep123',
        environment: 'SANDBOX' as const,
        eventType: 'order.created',
        status: 'SUCCESS' as const,
        statusCode: 200,
        createdAt: '2024-01-01T00:00:00Z',
        deliveredAt: '2024-01-01T00:00:01Z',
        attemptCount: 1,
        lastErrorMessage: null,
        durationMs: 120,
      },
      {
        id: 'del2',
        endpointId: 'ep123',
        environment: 'SANDBOX' as const,
        eventType: 'order.updated',
        status: 'FAILED' as const,
        statusCode: 500,
        createdAt: '2024-01-01T00:01:00Z',
        deliveredAt: '2024-01-01T00:01:01Z',
        attemptCount: 3,
        lastErrorMessage: 'Connection timeout',
        durationMs: null,
      },
    ];

    mockFetchDevWebhookDeliveries.mockResolvedValue({
      deliveries: mockDeliveries,
    });

    const { result } = renderHook(() =>
      useDevWebhookDeliveries({ endpointId: 'ep123' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.deliveries).toEqual(mockDeliveries);
    expect(result.current.error).toBeNull();
    expect(mockFetchDevWebhookDeliveries).toHaveBeenCalledWith({
      endpointId: 'ep123',
      limit: 50,
      status: 'ALL',
      eventType: undefined,
    });
  });

  it('should apply status filter', async () => {
    mockFetchDevWebhookDeliveries.mockResolvedValue({ deliveries: [] });

    const { result } = renderHook(() =>
      useDevWebhookDeliveries({ endpointId: 'ep123', status: 'FAILED' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFetchDevWebhookDeliveries).toHaveBeenCalledWith({
      endpointId: 'ep123',
      limit: 50,
      status: 'FAILED',
      eventType: undefined,
    });
  });

  it('should apply event type filter', async () => {
    mockFetchDevWebhookDeliveries.mockResolvedValue({ deliveries: [] });

    const { result } = renderHook(() =>
      useDevWebhookDeliveries({
        endpointId: 'ep123',
        eventType: 'order.created',
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFetchDevWebhookDeliveries).toHaveBeenCalledWith({
      endpointId: 'ep123',
      limit: 50,
      status: 'ALL',
      eventType: 'order.created',
    });
  });

  it('should handle fetch error', async () => {
    const mockError = new Error('Network error');
    mockFetchDevWebhookDeliveries.mockRejectedValue(mockError);

    const { result } = renderHook(() =>
      useDevWebhookDeliveries({ endpointId: 'ep123' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.deliveries).toEqual([]);
    expect(result.current.error).toEqual(mockError);
  });

  it('should reload deliveries when reload is called', async () => {
    mockFetchDevWebhookDeliveries.mockResolvedValue({ deliveries: [] });

    const { result } = renderHook(() =>
      useDevWebhookDeliveries({ endpointId: 'ep123' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFetchDevWebhookDeliveries).toHaveBeenCalledTimes(1);

    // Call reload
    result.current.reload();

    await waitFor(() => expect(mockFetchDevWebhookDeliveries).toHaveBeenCalledTimes(2));
  });

  it('should not fetch if endpointId is empty', async () => {
    const { result } = renderHook(() =>
      useDevWebhookDeliveries({ endpointId: '' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFetchDevWebhookDeliveries).not.toHaveBeenCalled();
  });
});
