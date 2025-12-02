import { renderHook, waitFor } from '@testing-library/react';
import { useBillingOverview } from '../useBillingOverview';
import * as billingApi from '@/lib/billingApi';

jest.mock('@/lib/billingApi');

const mockFetchBillingPlans = billingApi.fetchBillingPlans as jest.MockedFunction<typeof billingApi.fetchBillingPlans>;
const mockFetchOrgSubscription = billingApi.fetchOrgSubscription as jest.MockedFunction<typeof billingApi.fetchOrgSubscription>;
const mockFetchBillingUsage = billingApi.fetchBillingUsage as jest.MockedFunction<typeof billingApi.fetchBillingUsage>;

describe('useBillingOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful responses
    mockFetchBillingPlans.mockResolvedValue([
      {
        id: 'MICROS_STARTER',
        name: 'Micros Starter',
        description: 'Essential features',
        interval: 'MONTHLY',
        priceCents: 4900,
        currency: 'USD',
        features: ['Up to 5 seats'],
        isRecommended: false,
        isMicrosTier: true,
        isFranchiseTier: false,
      },
    ]);

    mockFetchOrgSubscription.mockResolvedValue({
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
    });

    mockFetchBillingUsage.mockResolvedValue({
      window: 'CURRENT_PERIOD',
      periodStartIso: '2024-11-01T00:00:00Z',
      periodEndIso: '2024-12-01T00:00:00Z',
      apiRequestsUsed: 5000,
      apiRequestsLimit: 10000,
      smsUsed: 50,
      smsLimit: 100,
      storageMbUsed: 100,
      storageMbLimit: null,
    });
  });

  it('loads plans, subscription, and usage on mount', async () => {
    const { result } = renderHook(() => useBillingOverview());

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.plans).toEqual([]);
    expect(result.current.subscription).toBeNull();
    expect(result.current.usage).toBeNull();
    expect(result.current.error).toBeNull();

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // All data should be loaded
    expect(result.current.plans).toHaveLength(1);
    expect(result.current.plans?.[0].id).toBe('MICROS_STARTER');
    expect(result.current.subscription?.planId).toBe('MICROS_STARTER');
    expect(result.current.usage?.apiRequestsUsed).toBe(5000);
    expect(result.current.error).toBeNull();

    // All three API calls should have been made
    expect(mockFetchBillingPlans).toHaveBeenCalledTimes(1);
    expect(mockFetchOrgSubscription).toHaveBeenCalledTimes(1);
    expect(mockFetchBillingUsage).toHaveBeenCalledTimes(1);
  });

  it('sets error when any API call fails', async () => {
    const testError = new Error('Failed to fetch plans');
    mockFetchBillingPlans.mockRejectedValueOnce(testError);

    const { result } = renderHook(() => useBillingOverview());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual(testError);
    expect(result.current.plans).toHaveLength(0);
    expect(result.current.subscription).toBeNull();
    expect(result.current.usage).toBeNull();
  });

  it('sets error when subscription fetch fails', async () => {
    const testError = new Error('Subscription not found');
    mockFetchOrgSubscription.mockRejectedValueOnce(testError);

    const { result } = renderHook(() => useBillingOverview());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual(testError);
  });

  it('sets error when usage fetch fails', async () => {
    const testError = new Error('Usage data unavailable');
    mockFetchBillingUsage.mockRejectedValueOnce(testError);

    const { result } = renderHook(() => useBillingOverview());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual(testError);
  });

  it('reload triggers another fetch', async () => {
    const { result } = renderHook(() => useBillingOverview());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Initial calls
    expect(mockFetchBillingPlans).toHaveBeenCalledTimes(1);
    expect(mockFetchOrgSubscription).toHaveBeenCalledTimes(1);
    expect(mockFetchBillingUsage).toHaveBeenCalledTimes(1);

    // Trigger reload
    result.current.reload();

    await waitFor(() => {
      expect(mockFetchBillingPlans).toHaveBeenCalledTimes(2);
    });

    expect(mockFetchOrgSubscription).toHaveBeenCalledTimes(2);
    expect(mockFetchBillingUsage).toHaveBeenCalledTimes(2);
  });

  it('clears error on successful reload after error', async () => {
    const testError = new Error('Network error');
    mockFetchBillingPlans.mockRejectedValueOnce(testError);

    const { result } = renderHook(() => useBillingOverview());

    await waitFor(() => {
      expect(result.current.error).toEqual(testError);
    });

    // Mock successful responses for reload
    mockFetchBillingPlans.mockResolvedValueOnce([
      {
        id: 'MICROS_PRO',
        name: 'Micros Pro',
        description: 'Advanced features',
        interval: 'MONTHLY',
        priceCents: 9900,
        currency: 'USD',
        features: ['Up to 20 seats'],
        isRecommended: true,
        isMicrosTier: true,
        isFranchiseTier: false,
      },
    ]);

    result.current.reload();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.plans).toHaveLength(1);
  });
});
