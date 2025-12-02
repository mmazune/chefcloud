/**
 * Tests for useCreateDevWebhook hook (E23-DEVPORTAL-FE-S2)
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useCreateDevWebhook } from './useCreateDevWebhook';
import * as devPortalApi from '@/lib/devPortalApi';
import { DevWebhookEndpointDto } from '@/types/devPortal';

jest.mock('@/lib/devPortalApi');

const mockCreateDevWebhook = devPortalApi.createDevWebhook as jest.MockedFunction<
  typeof devPortalApi.createDevWebhook
>;

describe('useCreateDevWebhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates webhook successfully', async () => {
    const mockEndpoint: DevWebhookEndpointDto = {
      id: '1',
      label: 'New Webhook',
      url: 'https://example.com/webhook',
      environment: 'SANDBOX',
      status: 'ACTIVE',
      secretSuffix: 'abcd',
      createdAt: '2025-01-01T00:00:00Z',
      lastDeliveryAt: null,
      lastDeliveryStatusCode: null,
    };

    mockCreateDevWebhook.mockResolvedValue(mockEndpoint);

    const { result } = renderHook(() => useCreateDevWebhook());

    expect(result.current.isCreating).toBe(false);
    expect(result.current.error).toBeNull();

    const endpoint = await result.current.createWebhook({
      label: 'New Webhook',
      url: 'https://example.com/webhook',
      environment: 'SANDBOX',
    });

    await waitFor(() => expect(result.current.isCreating).toBe(false));

    expect(mockCreateDevWebhook).toHaveBeenCalledWith({
      label: 'New Webhook',
      url: 'https://example.com/webhook',
      environment: 'SANDBOX',
    });
    expect(endpoint).toEqual(mockEndpoint);
    expect(result.current.error).toBeNull();
  });

  it('calls onCreated callback after successful creation', async () => {
    const mockEndpoint: DevWebhookEndpointDto = {
      id: '1',
      label: 'New Webhook',
      url: 'https://example.com/webhook',
      environment: 'PRODUCTION',
      status: 'ACTIVE',
      secretSuffix: 'xyz1',
      createdAt: '2025-01-01T00:00:00Z',
      lastDeliveryAt: null,
      lastDeliveryStatusCode: null,
    };

    mockCreateDevWebhook.mockResolvedValue(mockEndpoint);

    const onCreated = jest.fn();
    const { result } = renderHook(() => useCreateDevWebhook(onCreated));

    await result.current.createWebhook({
      label: 'New Webhook',
      url: 'https://example.com/webhook',
      environment: 'PRODUCTION',
    });

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(mockEndpoint));
  });

  it('handles errors during creation', async () => {
    const mockError = new Error('Failed to create webhook');
    mockCreateDevWebhook.mockRejectedValue(mockError);

    const { result } = renderHook(() => useCreateDevWebhook());

    const endpoint = await result.current.createWebhook({
      label: 'New Webhook',
      url: 'https://example.com/webhook',
      environment: 'SANDBOX',
    });

    await waitFor(() => expect(result.current.error).toEqual(mockError));

    expect(endpoint).toBeNull();
    expect(result.current.isCreating).toBe(false);
  });

  it('tracks isCreating state correctly', async () => {
    const mockEndpoint: DevWebhookEndpointDto = {
      id: '1',
      label: 'New Webhook',
      url: 'https://example.com/webhook',
      environment: 'SANDBOX',
      status: 'ACTIVE',
      secretSuffix: 'abcd',
      createdAt: '2025-01-01T00:00:00Z',
      lastDeliveryAt: null,
      lastDeliveryStatusCode: null,
    };

    mockCreateDevWebhook.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(mockEndpoint), 50),
        ),
    );

    const { result } = renderHook(() => useCreateDevWebhook());

    expect(result.current.isCreating).toBe(false);

    const promise = result.current.createWebhook({
      label: 'New Webhook',
      url: 'https://example.com/webhook',
      environment: 'SANDBOX',
    });

    await waitFor(() => expect(result.current.isCreating).toBe(true));

    await promise;

    await waitFor(() => expect(result.current.isCreating).toBe(false));
  });

  it('clears error on subsequent successful creation', async () => {
    const mockError = new Error('Failed');
    mockCreateDevWebhook.mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useCreateDevWebhook());

    await result.current.createWebhook({
      label: 'Fail',
      url: 'https://example.com/fail',
      environment: 'SANDBOX',
    });

    await waitFor(() => expect(result.current.error).toEqual(mockError));

    const mockEndpoint: DevWebhookEndpointDto = {
      id: '1',
      label: 'Success',
      url: 'https://example.com/success',
      environment: 'SANDBOX',
      status: 'ACTIVE',
      secretSuffix: 'abcd',
      createdAt: '2025-01-01T00:00:00Z',
      lastDeliveryAt: null,
      lastDeliveryStatusCode: null,
    };

    mockCreateDevWebhook.mockResolvedValueOnce(mockEndpoint);

    await result.current.createWebhook({
      label: 'Success',
      url: 'https://example.com/success',
      environment: 'SANDBOX',
    });

    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
