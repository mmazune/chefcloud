/**
 * Tests for useUpdateDevWebhook hook (E23-DEVPORTAL-FE-S2)
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useUpdateDevWebhook } from './useUpdateDevWebhook';
import * as devPortalApi from '@/lib/devPortalApi';
import { DevWebhookEndpointDto } from '@/types/devPortal';

jest.mock('@/lib/devPortalApi');

const mockUpdateDevWebhook = devPortalApi.updateDevWebhook as jest.MockedFunction<
  typeof devPortalApi.updateDevWebhook
>;

describe('useUpdateDevWebhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates webhook successfully', async () => {
    const mockEndpoint: DevWebhookEndpointDto = {
      id: '1',
      label: 'Updated Webhook',
      url: 'https://example.com/updated',
      environment: 'SANDBOX',
      status: 'DISABLED',
      secretSuffix: 'abcd',
      createdAt: '2025-01-01T00:00:00Z',
      lastDeliveryAt: null,
      lastDeliveryStatusCode: null,
    };

    mockUpdateDevWebhook.mockResolvedValue(mockEndpoint);

    const { result } = renderHook(() => useUpdateDevWebhook());

    const endpoint = await result.current.updateWebhook('1', {
      label: 'Updated Webhook',
      url: 'https://example.com/updated',
      status: 'DISABLED',
    });

    await waitFor(() => expect(result.current.isUpdating).toBe(false));

    expect(mockUpdateDevWebhook).toHaveBeenCalledWith('1', {
      label: 'Updated Webhook',
      url: 'https://example.com/updated',
      status: 'DISABLED',
    });
    expect(endpoint).toEqual(mockEndpoint);
    expect(result.current.error).toBeNull();
  });

  it('calls onUpdated callback after successful update', async () => {
    const mockEndpoint: DevWebhookEndpointDto = {
      id: '1',
      label: 'Updated',
      url: 'https://example.com/webhook',
      environment: 'PRODUCTION',
      status: 'ACTIVE',
      secretSuffix: 'xyz1',
      createdAt: '2025-01-01T00:00:00Z',
      lastDeliveryAt: null,
      lastDeliveryStatusCode: null,
    };

    mockUpdateDevWebhook.mockResolvedValue(mockEndpoint);

    const onUpdated = jest.fn();
    const { result } = renderHook(() => useUpdateDevWebhook(onUpdated));

    await result.current.updateWebhook('1', {
      label: 'Updated',
      url: 'https://example.com/webhook',
      status: 'ACTIVE',
    });

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(mockEndpoint));
  });

  it('handles errors during update', async () => {
    const mockError = new Error('Failed to update webhook');
    mockUpdateDevWebhook.mockRejectedValue(mockError);

    const { result } = renderHook(() => useUpdateDevWebhook());

    const endpoint = await result.current.updateWebhook('1', {
      label: 'Updated',
      url: 'https://example.com/webhook',
      status: 'ACTIVE',
    });

    await waitFor(() => expect(result.current.error).toEqual(mockError));

    expect(endpoint).toBeNull();
    expect(result.current.isUpdating).toBe(false);
  });

  it('tracks isUpdating state correctly', async () => {
    const mockEndpoint: DevWebhookEndpointDto = {
      id: '1',
      label: 'Updated',
      url: 'https://example.com/webhook',
      environment: 'SANDBOX',
      status: 'ACTIVE',
      secretSuffix: 'abcd',
      createdAt: '2025-01-01T00:00:00Z',
      lastDeliveryAt: null,
      lastDeliveryStatusCode: null,
    };

    mockUpdateDevWebhook.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(mockEndpoint), 50),
        ),
    );

    const { result } = renderHook(() => useUpdateDevWebhook());

    expect(result.current.isUpdating).toBe(false);

    const promise = result.current.updateWebhook('1', {
      label: 'Updated',
      url: 'https://example.com/webhook',
      status: 'ACTIVE',
    });

    await waitFor(() => expect(result.current.isUpdating).toBe(true));

    await promise;

    await waitFor(() => expect(result.current.isUpdating).toBe(false));
  });
});
