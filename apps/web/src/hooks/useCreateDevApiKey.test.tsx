/**
 * useCreateDevApiKey Hook Tests
 * E23-DEVPORTAL-FE-S1: Test API key creation
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useCreateDevApiKey } from './useCreateDevApiKey';
import * as devPortalApi from '@/lib/devPortalApi';
import type { DevApiKeyDto } from '@/types/devPortal';

jest.mock('@/lib/devPortalApi');

const mockCreateDevApiKey = devPortalApi.createDevApiKey as jest.MockedFunction<
  typeof devPortalApi.createDevApiKey
>;

describe('useCreateDevApiKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a new API key successfully', async () => {
    const mockKey: DevApiKeyDto = {
      id: 'key-123',
      label: 'New Integration',
      environment: 'SANDBOX',
      status: 'ACTIVE',
      createdAt: '2025-12-01T10:00:00Z',
      lastUsedAt: null,
      truncatedKey: 'sk_test_****abcd',
    };

    mockCreateDevApiKey.mockResolvedValue({ apiKey: mockKey });

    const { result } = renderHook(() => useCreateDevApiKey());

    let createdKey: DevApiKeyDto | null = null;

    await act(async () => {
      createdKey = await result.current.createKey({
        label: 'New Integration',
        environment: 'SANDBOX',
      });
    });

    expect(mockCreateDevApiKey).toHaveBeenCalledWith({
      label: 'New Integration',
      environment: 'SANDBOX',
    });
    expect(createdKey).toEqual(mockKey);
    expect(result.current.error).toBeNull();
  });

  it('invokes onCreated callback after successful creation', async () => {
    const mockKey: DevApiKeyDto = {
      id: 'key-456',
      label: 'Callback Test',
      environment: 'PRODUCTION',
      status: 'ACTIVE',
      createdAt: '2025-12-01T11:00:00Z',
      lastUsedAt: null,
      truncatedKey: 'sk_live_****wxyz',
    };

    mockCreateDevApiKey.mockResolvedValue({ apiKey: mockKey });

    const onCreated = jest.fn();

    const { result } = renderHook(() => useCreateDevApiKey(onCreated));

    await act(async () => {
      await result.current.createKey({
        label: 'Callback Test',
        environment: 'PRODUCTION',
      });
    });

    expect(onCreated).toHaveBeenCalledWith(mockKey);
  });

  it('handles creation errors gracefully', async () => {
    mockCreateDevApiKey.mockRejectedValue(new Error('Creation failed'));

    const { result } = renderHook(() => useCreateDevApiKey());

    let createdKey: DevApiKeyDto | null = null;

    await act(async () => {
      createdKey = await result.current.createKey({
        label: 'Failing Key',
        environment: 'SANDBOX',
      });
    });

    expect(createdKey).toBeNull();
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('Creation failed');
  });

  it('sets isCreating to true during creation', async () => {
    mockCreateDevApiKey.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    const { result } = renderHook(() => useCreateDevApiKey());

    act(() => {
      void result.current.createKey({
        label: 'Slow Key',
        environment: 'SANDBOX',
      });
    });

    await waitFor(() => expect(result.current.isCreating).toBe(true));
  });

  it('clears error state before new creation attempt', async () => {
    mockCreateDevApiKey.mockRejectedValueOnce(new Error('First failure'));

    const { result } = renderHook(() => useCreateDevApiKey());

    await act(async () => {
      await result.current.createKey({
        label: 'First Attempt',
        environment: 'SANDBOX',
      });
    });

    expect(result.current.error).toBeTruthy();

    const mockKey: DevApiKeyDto = {
      id: 'key-789',
      label: 'Second Attempt',
      environment: 'SANDBOX',
      status: 'ACTIVE',
      createdAt: '2025-12-01T12:00:00Z',
      lastUsedAt: null,
      truncatedKey: 'sk_test_****efgh',
    };

    mockCreateDevApiKey.mockResolvedValueOnce({ apiKey: mockKey });

    await act(async () => {
      await result.current.createKey({
        label: 'Second Attempt',
        environment: 'SANDBOX',
      });
    });

    expect(result.current.error).toBeNull();
  });
});
