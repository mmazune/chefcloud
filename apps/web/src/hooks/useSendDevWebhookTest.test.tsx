/**
 * Tests for useSendDevWebhookTest hook (E23-DEVPORTAL-FE-S2)
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useSendDevWebhookTest } from './useSendDevWebhookTest';
import * as devPortalApi from '@/lib/devPortalApi';
import { DevWebhookTestEventResponseDto } from '@/types/devPortal';

jest.mock('@/lib/devPortalApi');

const mockSendDevWebhookTestEvent =
  devPortalApi.sendDevWebhookTestEvent as jest.MockedFunction<
    typeof devPortalApi.sendDevWebhookTestEvent
  >;

describe('useSendDevWebhookTest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends test event successfully', async () => {
    const mockResponse: DevWebhookTestEventResponseDto = {
      deliveryId: 'del_123',
      statusCode: 200,
    };

    mockSendDevWebhookTestEvent.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useSendDevWebhookTest());

    const response = await result.current.sendTest({
      endpointId: '1',
      eventType: 'test.event',
    });

    await waitFor(() => expect(result.current.isSending).toBe(false));

    expect(mockSendDevWebhookTestEvent).toHaveBeenCalledWith({
      endpointId: '1',
      eventType: 'test.event',
    });
    expect(response).toEqual(mockResponse);
    expect(result.current.lastResult).toEqual(mockResponse);
    expect(result.current.error).toBeNull();
  });

  it('updates lastResult after successful send', async () => {
    const mockResponse: DevWebhookTestEventResponseDto = {
      deliveryId: 'del_456',
      statusCode: 201,
    };

    mockSendDevWebhookTestEvent.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useSendDevWebhookTest());

    expect(result.current.lastResult).toBeNull();

    await result.current.sendTest({
      endpointId: '2',
      eventType: 'order.created',
    });

    await waitFor(() =>
      expect(result.current.lastResult).toEqual(mockResponse),
    );
  });

  it('handles errors during send', async () => {
    const mockError = new Error('Failed to send test event');
    mockSendDevWebhookTestEvent.mockRejectedValue(mockError);

    const { result } = renderHook(() => useSendDevWebhookTest());

    const response = await result.current.sendTest({
      endpointId: '1',
      eventType: 'test.event',
    });

    await waitFor(() => expect(result.current.error).toEqual(mockError));

    expect(response).toBeNull();
    expect(result.current.lastResult).toBeNull();
    expect(result.current.isSending).toBe(false);
  });

  it('tracks isSending state correctly', async () => {
    const mockResponse: DevWebhookTestEventResponseDto = {
      deliveryId: 'del_789',
      statusCode: 200,
    };

    mockSendDevWebhookTestEvent.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(mockResponse), 50),
        ),
    );

    const { result } = renderHook(() => useSendDevWebhookTest());

    expect(result.current.isSending).toBe(false);

    const promise = result.current.sendTest({
      endpointId: '1',
      eventType: 'test.event',
    });

    await waitFor(() => expect(result.current.isSending).toBe(true));

    await promise;

    await waitFor(() => expect(result.current.isSending).toBe(false));
  });

  it('handles test events with error messages', async () => {
    const mockResponse: DevWebhookTestEventResponseDto = {
      deliveryId: 'del_error',
      statusCode: 500,
      errorMessage: 'Connection timeout',
    };

    mockSendDevWebhookTestEvent.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useSendDevWebhookTest());

    await result.current.sendTest({
      endpointId: '1',
      eventType: 'test.event',
    });

    await waitFor(() =>
      expect(result.current.lastResult).toEqual(mockResponse),
    );

    expect(result.current.lastResult?.errorMessage).toBe('Connection timeout');
  });

  it('clears error on subsequent successful send', async () => {
    const mockError = new Error('Failed');
    mockSendDevWebhookTestEvent.mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useSendDevWebhookTest());

    await result.current.sendTest({
      endpointId: '1',
      eventType: 'test.event',
    });

    await waitFor(() => expect(result.current.error).toEqual(mockError));

    const mockResponse: DevWebhookTestEventResponseDto = {
      deliveryId: 'del_success',
      statusCode: 200,
    };

    mockSendDevWebhookTestEvent.mockResolvedValueOnce(mockResponse);

    await result.current.sendTest({
      endpointId: '1',
      eventType: 'test.event',
    });

    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
