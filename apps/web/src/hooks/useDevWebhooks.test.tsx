/**
 * Tests for useDevWebhooks hook (E23-DEVPORTAL-FE-S2)
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useDevWebhooks } from './useDevWebhooks';
import * as devPortalApi from '@/lib/devPortalApi';
import { DevWebhookEndpointDto } from '@/types/devPortal';

jest.mock('@/lib/devPortalApi');

const mockFetchDevWebhooks = devPortalApi.fetchDevWebhooks as jest.MockedFunction<
  typeof devPortalApi.fetchDevWebhooks
>;

describe('useDevWebhooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches webhooks on mount', async () => {
    const mockWebhooks: DevWebhookEndpointDto[] = [
      {
        id: '1',
        label: 'Test Webhook',
        url: 'https://example.com/webhook',
        environment: 'SANDBOX',
        status: 'ACTIVE',
        secretSuffix: 'abcd',
        createdAt: '2025-01-01T00:00:00Z',
        lastDeliveryAt: null,
        lastDeliveryStatusCode: null,
      },
      {
        id: '2',
        label: 'Prod Webhook',
        url: 'https://prod.example.com/webhook',
        environment: 'PRODUCTION',
        status: 'ACTIVE',
        secretSuffix: 'efgh',
        createdAt: '2025-01-02T00:00:00Z',
        lastDeliveryAt: '2025-01-03T00:00:00Z',
        lastDeliveryStatusCode: 200,
      },
    ];

    mockFetchDevWebhooks.mockResolvedValue(mockWebhooks);

    const { result } = renderHook(() => useDevWebhooks());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFetchDevWebhooks).toHaveBeenCalledTimes(1);
    expect(result.current.webhooks).toEqual(mockWebhooks);
    expect(result.current.error).toBeNull();
  });

  it('handles loading state correctly', async () => {
    mockFetchDevWebhooks.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve([]), 100),
        ),
    );

    const { result } = renderHook(() => useDevWebhooks());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.webhooks).toEqual([]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.webhooks).toEqual([]);
  });

  it('handles errors during fetch', async () => {
    const mockError = new Error('Failed to fetch webhooks');
    mockFetchDevWebhooks.mockRejectedValue(mockError);

    const { result } = renderHook(() => useDevWebhooks());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toEqual(mockError);
    expect(result.current.webhooks).toEqual([]);
  });

  it('reload function refetches webhooks', async () => {
    const mockWebhooks: DevWebhookEndpointDto[] = [
      {
        id: '1',
        label: 'Test Webhook',
        url: 'https://example.com/webhook',
        environment: 'SANDBOX',
        status: 'ACTIVE',
        secretSuffix: 'abcd',
        createdAt: '2025-01-01T00:00:00Z',
        lastDeliveryAt: null,
        lastDeliveryStatusCode: null,
      },
    ];

    mockFetchDevWebhooks.mockResolvedValue(mockWebhooks);

    const { result } = renderHook(() => useDevWebhooks());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFetchDevWebhooks).toHaveBeenCalledTimes(1);

    result.current.reload();

    await waitFor(() => expect(mockFetchDevWebhooks).toHaveBeenCalledTimes(2));
  });

  it('clears error on successful reload', async () => {
    const mockError = new Error('Failed to fetch');
    mockFetchDevWebhooks.mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useDevWebhooks());

    await waitFor(() => expect(result.current.error).toEqual(mockError));

    mockFetchDevWebhooks.mockResolvedValueOnce([]);

    result.current.reload();

    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
