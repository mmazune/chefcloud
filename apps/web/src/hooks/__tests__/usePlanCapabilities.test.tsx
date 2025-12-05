import { renderHook, waitFor } from '@testing-library/react';
import { usePlanCapabilities } from '../usePlanCapabilities';
import { fetchOrgSubscription } from '@/lib/billingApi';
import { OrgSubscriptionDto } from '@/types/billing';

jest.mock('@/lib/billingApi');

const mockFetchOrgSubscription = fetchOrgSubscription as jest.MockedFunction<
  typeof fetchOrgSubscription
>;

describe('usePlanCapabilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads subscription and sets capabilities on success', async () => {
    const mockSub: OrgSubscriptionDto = {
      planId: 'FRANCHISE_CORE',
      planName: 'Franchise Core',
      status: 'ACTIVE',
      interval: 'MONTHLY',
      currency: 'USD',
      unitPriceCents: 29900,
      nextRenewalIso: '2024-12-15T00:00:00Z',
      trialEndsIso: null,
      seats: 50,
      branchesIncluded: null,
      branchesUsed: null,
      microsOrgsIncluded: 5,
      microsOrgsUsed: 3,
    };

    mockFetchOrgSubscription.mockResolvedValue(mockSub);

    const { result } = renderHook(() => usePlanCapabilities());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.subscription).toEqual(mockSub);
    expect(result.current.capabilities.canUseFranchiseAnalytics).toBe(true);
    expect(result.current.capabilities.canUseDevPortal).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it('loads restricted capabilities for Micros plan', async () => {
    const mockSub: OrgSubscriptionDto = {
      planId: 'MICROS_STARTER',
      planName: 'Micros Starter',
      status: 'ACTIVE',
      interval: 'MONTHLY',
      currency: 'USD',
      unitPriceCents: 4900,
      nextRenewalIso: '2024-12-15T00:00:00Z',
      trialEndsIso: null,
      seats: 5,
      branchesIncluded: 2,
      branchesUsed: 1,
      microsOrgsIncluded: null,
      microsOrgsUsed: null,
    };

    mockFetchOrgSubscription.mockResolvedValue(mockSub);

    const { result } = renderHook(() => usePlanCapabilities());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.subscription).toEqual(mockSub);
    expect(result.current.capabilities.canUseFranchiseAnalytics).toBe(false);
    expect(result.current.capabilities.canUseDevPortal).toBe(false);
    expect(result.current.capabilities.canUseKdsMultiStation).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it('handles null subscription (fail-open)', async () => {
    mockFetchOrgSubscription.mockResolvedValue(null);

    const { result } = renderHook(() => usePlanCapabilities());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.subscription).toBe(null);
    // Fail-open: all capabilities true when no subscription
    expect(result.current.capabilities.canUseFranchiseAnalytics).toBe(true);
    expect(result.current.capabilities.canUseDevPortal).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it('fails open on error and sets error state', async () => {
    const mockError = new Error('Billing service unavailable');
    mockFetchOrgSubscription.mockRejectedValue(mockError);

    const { result } = renderHook(() => usePlanCapabilities());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.subscription).toBe(null);
    // Fail-open: all capabilities true on error
    expect(result.current.capabilities.canUseFranchiseAnalytics).toBe(true);
    expect(result.current.capabilities.canUseDevPortal).toBe(true);
    expect(result.current.error).toEqual(mockError);
  });

  it('reload function triggers another fetch', async () => {
    const mockSub: OrgSubscriptionDto = {
      planId: 'FRANCHISE_CORE',
      planName: 'Franchise Core',
      status: 'ACTIVE',
      interval: 'MONTHLY',
      currency: 'USD',
      unitPriceCents: 29900,
      nextRenewalIso: '2024-12-15T00:00:00Z',
      trialEndsIso: null,
      seats: 50,
      branchesIncluded: null,
      branchesUsed: null,
      microsOrgsIncluded: 5,
      microsOrgsUsed: 3,
    };

    mockFetchOrgSubscription.mockResolvedValue(mockSub);

    const { result } = renderHook(() => usePlanCapabilities());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchOrgSubscription).toHaveBeenCalledTimes(1);

    // Call reload
    result.current.reload();

    await waitFor(() => {
      expect(mockFetchOrgSubscription).toHaveBeenCalledTimes(2);
    });
  });
});
