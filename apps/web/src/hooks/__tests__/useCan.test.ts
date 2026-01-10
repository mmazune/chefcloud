/**
 * useCan Hook Tests
 * 
 * Tests for the action guard hook that checks if a user can perform actions.
 */

import { renderHook } from '@testing-library/react';
import { useCan, useCanMultiple, useCanAccessRoute } from '@/hooks/useCan';

// Mock the AuthContext
const mockUser = {
  id: 'user-1',
  email: 'owner@test.com',
  name: 'Test Owner',
  jobRole: 'OWNER',
  roleLevel: 'L5' as const,
  branchId: 'branch-1',
  tenantId: 'tenant-1',
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: mockUser,
    loading: false,
    error: null,
  })),
}));

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(() => ({
    pathname: '/pos',
    query: {},
    push: jest.fn(),
    replace: jest.fn(),
  })),
}));

// Get the mocked useAuth
import { useAuth } from '@/contexts/AuthContext';
const mockedUseAuth = useAuth as jest.Mock;

describe('useCan Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      error: null,
    });
  });

  describe('useCan', () => {
    it('returns true for action user can perform', () => {
      const { result } = renderHook(() => useCan('pos-new-order'));
      expect(result.current).toBe(true);
    });

    it('returns false for unknown action', () => {
      const { result } = renderHook(() => useCan('non-existent-action-xyz'));
      expect(result.current).toBe(false);
    });

    it('returns false when user is not authenticated', () => {
      mockedUseAuth.mockReturnValue({
        user: null,
        loading: false,
        error: null,
      });

      const { result } = renderHook(() => useCan('pos-new-order'));
      expect(result.current).toBe(false);
    });

    it('returns false when user has no jobRole', () => {
      mockedUseAuth.mockReturnValue({
        user: { ...mockUser, jobRole: null },
        loading: false,
        error: null,
      });

      const { result } = renderHook(() => useCan('pos-new-order'));
      expect(result.current).toBe(false);
    });

    it('respects routeScoped option', () => {
      // pos-new-order is on /pos route
      const { result: onPosRoute } = renderHook(() => 
        useCan('pos-new-order', { routeScoped: true })
      );
      expect(onPosRoute.current).toBe(true);

      // If we're on a different route, it should still work
      // because the router mock returns /pos
    });
  });

  describe('useCanMultiple', () => {
    it('returns permissions for multiple actions', () => {
      const { result } = renderHook(() => 
        useCanMultiple(['pos-new-order', 'pos-checkout', 'non-existent-action'])
      );

      expect(result.current['pos-new-order']).toBe(true);
      expect(result.current['pos-checkout']).toBe(true);
      expect(result.current['non-existent-action']).toBe(false);
    });

    it('returns all false when user is not authenticated', () => {
      mockedUseAuth.mockReturnValue({
        user: null,
        loading: false,
        error: null,
      });

      const { result } = renderHook(() => 
        useCanMultiple(['pos-new-order', 'pos-checkout'])
      );

      expect(result.current['pos-new-order']).toBe(false);
      expect(result.current['pos-checkout']).toBe(false);
    });
  });

  describe('useCanAccessRoute', () => {
    it('returns true for accessible route', () => {
      const { result } = renderHook(() => useCanAccessRoute('/pos'));
      expect(result.current).toBe(true);
    });

    it('returns true for nested accessible route', () => {
      const { result } = renderHook(() => useCanAccessRoute('/pos/checkout/123'));
      expect(result.current).toBe(true);
    });

    it('returns false when user is not authenticated', () => {
      mockedUseAuth.mockReturnValue({
        user: null,
        loading: false,
        error: null,
      });

      const { result } = renderHook(() => useCanAccessRoute('/pos'));
      expect(result.current).toBe(false);
    });
  });
});

describe('useCan with WAITER role', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      user: { ...mockUser, jobRole: 'WAITER' },
      loading: false,
      error: null,
    });
  });

  it('WAITER can access POS actions', () => {
    const { result } = renderHook(() => useCan('pos-new-order'));
    expect(result.current).toBe(true);
  });

  it('WAITER cannot access finance routes', () => {
    const { result } = renderHook(() => useCanAccessRoute('/finance'));
    expect(result.current).toBe(false);
  });

  it('WAITER can access reservation actions', () => {
    const { result } = renderHook(() => useCan('reservation-cancel'));
    expect(result.current).toBe(true);
  });
});
