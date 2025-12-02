/**
 * Tests for useRotateDevWebhookSecret hook (E23-DEVPORTAL-FE-S2)
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useRotateDevWebhookSecret } from './useRotateDevWebhookSecret';
import * as devPortalApi from '@/lib/devPortalApi';
import { DevWebhookEndpointDto } from '@/types/devPortal';

jest.mock('@/lib/devPortalApi');

const mockRotateDevWebhookSecret =
  devPortalApi.rotateDevWebhookSecret as jest.MockedFunction<
    typeof devPortalApi.rotateDevWebhookSecret
  >;

describe('useRotateDevWebhookSecret', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rotates secret successfully', async () => {
    const mockEndpoint: DevWebhookEndpointDto = {
      id: '1',
      label: 'Test Webhook',
      url: 'https://example.com/webhook',
      environment: 'SANDBOX',
      status: 'ACTIVE',
      secretSuffix: 'newS',
      createdAt: '2025-01-01T00:00:00Z',
      lastDeliveryAt: null,
      lastDeliveryStatusCode: null,
    };

    mockRotateDevWebhookSecret.mockResolvedValue(mockEndpoint);

    const { result } = renderHook(() => useRotateDevWebhookSecret());

    const endpoint = await result.current.rotateSecret('1');

    await waitFor(() => expect(result.current.isRotating).toBe(false));

    expect(mockRotateDevWebhookSecret).toHaveBeenCalledWith('1');
    expect(endpoint).toEqual(mockEndpoint);
    expect(result.current.error).toBeNull();
  });

  it('calls onRotated callback after successful rotation', async () => {
    const mockEndpoint: DevWebhookEndpointDto = {
      id: '1',
      label: 'Test Webhook',
      url: 'https://example.com/webhook',
      environment: 'PRODUCTION',
      status: 'ACTIVE',
      secretSuffix: 'xyz2',
      createdAt: '2025-01-01T00:00:00Z',
      lastDeliveryAt: null,
      lastDeliveryStatusCode: null,
    };

    mockRotateDevWebhookSecret.mockResolvedValue(mockEndpoint);

    const onRotated = jest.fn();
    const { result } = renderHook(() => useRotateDevWebhookSecret(onRotated));

    await result.current.rotateSecret('1');

    await waitFor(() => expect(onRotated).toHaveBeenCalledWith(mockEndpoint));
  });

  it('handles errors during rotation', async () => {
    const mockError = new Error('Failed to rotate secret');
    mockRotateDevWebhookSecret.mockRejectedValue(mockError);

    const { result } = renderHook(() => useRotateDevWebhookSecret());

    const endpoint = await result.current.rotateSecret('1');

    await waitFor(() => expect(result.current.error).toEqual(mockError));

    expect(endpoint).toBeNull();
    expect(result.current.isRotating).toBe(false);
  });

  it('tracks isRotating state correctly', async () => {
    const mockEndpoint: DevWebhookEndpointDto = {
      id: '1',
      label: 'Test Webhook',
      url: 'https://example.com/webhook',
      environment: 'SANDBOX',
      status: 'ACTIVE',
      secretSuffix: 'newS',
      createdAt: '2025-01-01T00:00:00Z',
      lastDeliveryAt: null,
      lastDeliveryStatusCode: null,
    };

    mockRotateDevWebhookSecret.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(mockEndpoint), 50),
        ),
    );

    const { result } = renderHook(() => useRotateDevWebhookSecret());

    expect(result.current.isRotating).toBe(false);

    const promise = result.current.rotateSecret('1');

    await waitFor(() => expect(result.current.isRotating).toBe(true));

    await promise;

    await waitFor(() => expect(result.current.isRotating).toBe(false));
  });

  it('clears error on subsequent successful rotation', async () => {
    const mockError = new Error('Failed');
    mockRotateDevWebhookSecret.mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useRotateDevWebhookSecret());

    await result.current.rotateSecret('1');

    await waitFor(() => expect(result.current.error).toEqual(mockError));

    const mockEndpoint: DevWebhookEndpointDto = {
      id: '1',
      label: 'Test Webhook',
      url: 'https://example.com/webhook',
      environment: 'SANDBOX',
      status: 'ACTIVE',
      secretSuffix: 'newS',
      createdAt: '2025-01-01T00:00:00Z',
      lastDeliveryAt: null,
      lastDeliveryStatusCode: null,
    };

    mockRotateDevWebhookSecret.mockResolvedValueOnce(mockEndpoint);

    await result.current.rotateSecret('1');

    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
