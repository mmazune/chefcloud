/**
 * Unit tests for useRetryDevWebhookDelivery hook (E23-S3)
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useRetryDevWebhookDelivery } from './useRetryDevWebhookDelivery';
import * as devPortalApi from '@/lib/devPortalApi';

jest.mock('@/lib/devPortalApi');

const mockRetryDevWebhookDelivery =
  devPortalApi.retryDevWebhookDelivery as jest.Mock;

describe('useRetryDevWebhookDelivery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should have correct initial state', () => {
    const { result } = renderHook(() => useRetryDevWebhookDelivery());

    expect(result.current.isRetrying).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.retry).toBe('function');
  });

  it('should retry delivery successfully', async () => {
    const mockDelivery = {
      id: 'del123',
      endpointId: 'ep123',
      environment: 'SANDBOX' as const,
      eventType: 'order.created',
      status: 'SUCCESS' as const,
      statusCode: 200,
      createdAt: '2024-01-01T00:00:00Z',
      deliveredAt: '2024-01-01T00:00:01Z',
      attemptCount: 2,
      lastErrorMessage: null,
      durationMs: 120,
    };

    mockRetryDevWebhookDelivery.mockResolvedValue(mockDelivery);

    const { result } = renderHook(() => useRetryDevWebhookDelivery());

    const res = await result.current.retry('del123');

    await waitFor(() => expect(result.current.isRetrying).toBe(false));

    expect(res).toEqual(mockDelivery);
    expect(result.current.error).toBeNull();
    expect(mockRetryDevWebhookDelivery).toHaveBeenCalledWith('del123');
  });

  it('should invoke onRetried callback after successful retry', async () => {
    const mockDelivery = {
      id: 'del123',
      endpointId: 'ep123',
      environment: 'SANDBOX' as const,
      eventType: 'order.created',
      status: 'SUCCESS' as const,
      statusCode: 200,
      createdAt: '2024-01-01T00:00:00Z',
      deliveredAt: '2024-01-01T00:00:01Z',
      attemptCount: 2,
      lastErrorMessage: null,
      durationMs: 120,
    };

    mockRetryDevWebhookDelivery.mockResolvedValue(mockDelivery);

    const onRetried = jest.fn();
    const { result } = renderHook(() => useRetryDevWebhookDelivery(onRetried));

    await result.current.retry('del123');

    await waitFor(() => expect(onRetried).toHaveBeenCalledWith(mockDelivery));
  });

  it('should handle retry error', async () => {
    const mockError = new Error('Retry failed');
    mockRetryDevWebhookDelivery.mockRejectedValue(mockError);

    const { result } = renderHook(() => useRetryDevWebhookDelivery());

    const res = await result.current.retry('del123');

    await waitFor(() => expect(result.current.isRetrying).toBe(false));

    expect(res).toBeNull();
    expect(result.current.error).toEqual(mockError);
  });

  it('should not invoke onRetried callback on error', async () => {
    const mockError = new Error('Retry failed');
    mockRetryDevWebhookDelivery.mockRejectedValue(mockError);

    const onRetried = jest.fn();
    const { result } = renderHook(() => useRetryDevWebhookDelivery(onRetried));

    await result.current.retry('del123');

    await waitFor(() => expect(result.current.isRetrying).toBe(false));

    expect(onRetried).not.toHaveBeenCalled();
  });

  it('should clear previous error on new retry attempt', async () => {
    const mockError = new Error('First error');
    mockRetryDevWebhookDelivery.mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useRetryDevWebhookDelivery());

    await result.current.retry('del1');

    await waitFor(() => expect(result.current.error).toEqual(mockError));

    // Second attempt succeeds
    const mockDelivery = {
      id: 'del2',
      endpointId: 'ep123',
      environment: 'SANDBOX' as const,
      eventType: 'order.created',
      status: 'SUCCESS' as const,
      statusCode: 200,
      createdAt: '2024-01-01T00:00:00Z',
      deliveredAt: '2024-01-01T00:00:01Z',
      attemptCount: 2,
      lastErrorMessage: null,
      durationMs: 120,
    };
    mockRetryDevWebhookDelivery.mockResolvedValue(mockDelivery);

    await result.current.retry('del2');

    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
