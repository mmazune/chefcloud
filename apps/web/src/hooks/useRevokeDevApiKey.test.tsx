/**
 * useRevokeDevApiKey Hook Tests
 * E23-DEVPORTAL-FE-S1: Test API key revocation
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useRevokeDevApiKey } from './useRevokeDevApiKey';
import * as devPortalApi from '@/lib/devPortalApi';
import type { DevApiKeyDto } from '@/types/devPortal';

jest.mock('@/lib/devPortalApi');

const mockRevokeDevApiKey = devPortalApi.revokeDevApiKey as jest.MockedFunction<
  typeof devPortalApi.revokeDevApiKey
>;

describe('useRevokeDevApiKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('revokes an API key successfully', async () => {
    const mockKey: DevApiKeyDto = {
      id: 'key-123',
      label: 'Revoked Key',
      environment: 'SANDBOX',
      status: 'REVOKED',
      createdAt: '2025-12-01T10:00:00Z',
      lastUsedAt: '2025-12-01T12:00:00Z',
      truncatedKey: 'sk_test_****abcd',
    };

    mockRevokeDevApiKey.mockResolvedValue({ apiKey: mockKey });

    const { result } = renderHook(() => useRevokeDevApiKey());

    let revokedKey: DevApiKeyDto | null = null;

    await act(async () => {
      revokedKey = await result.current.revokeKey('key-123');
    });

    expect(mockRevokeDevApiKey).toHaveBeenCalledWith('key-123');
    expect(revokedKey).toEqual(mockKey);
    expect(revokedKey?.status).toBe('REVOKED');
    expect(result.current.error).toBeNull();
  });

  it('invokes onRevoked callback after successful revocation', async () => {
    const mockKey: DevApiKeyDto = {
      id: 'key-456',
      label: 'Callback Test',
      environment: 'PRODUCTION',
      status: 'REVOKED',
      createdAt: '2025-11-01T10:00:00Z',
      lastUsedAt: null,
      truncatedKey: 'sk_live_****wxyz',
    };

    mockRevokeDevApiKey.mockResolvedValue({ apiKey: mockKey });

    const onRevoked = jest.fn();

    const { result } = renderHook(() => useRevokeDevApiKey(onRevoked));

    await act(async () => {
      await result.current.revokeKey('key-456');
    });

    expect(onRevoked).toHaveBeenCalledWith(mockKey);
  });

  it('handles revocation errors gracefully', async () => {
    mockRevokeDevApiKey.mockRejectedValue(new Error('Revocation failed'));

    const { result } = renderHook(() => useRevokeDevApiKey());

    let revokedKey: DevApiKeyDto | null = null;

    await act(async () => {
      revokedKey = await result.current.revokeKey('key-789');
    });

    expect(revokedKey).toBeNull();
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('Revocation failed');
  });

  it('sets isRevoking to true during revocation', async () => {
    mockRevokeDevApiKey.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    const { result } = renderHook(() => useRevokeDevApiKey());

    act(() => {
      void result.current.revokeKey('key-slow');
    });

    await waitFor(() => expect(result.current.isRevoking).toBe(true));
  });

  it('clears error state before new revocation attempt', async () => {
    mockRevokeDevApiKey.mockRejectedValueOnce(new Error('First failure'));

    const { result } = renderHook(() => useRevokeDevApiKey());

    await act(async () => {
      await result.current.revokeKey('key-fail-1');
    });

    expect(result.current.error).toBeTruthy();

    const mockKey: DevApiKeyDto = {
      id: 'key-success',
      label: 'Success Key',
      environment: 'SANDBOX',
      status: 'REVOKED',
      createdAt: '2025-12-01T12:00:00Z',
      lastUsedAt: null,
      truncatedKey: 'sk_test_****efgh',
    };

    mockRevokeDevApiKey.mockResolvedValueOnce({ apiKey: mockKey });

    await act(async () => {
      await result.current.revokeKey('key-success');
    });

    expect(result.current.error).toBeNull();
  });
});
