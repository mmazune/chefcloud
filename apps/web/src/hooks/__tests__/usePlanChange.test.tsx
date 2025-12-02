import { renderHook, act, waitFor } from '@testing-library/react';
import { usePlanChange } from '../usePlanChange';
import * as billingApi from '@/lib/billingApi';

jest.mock('@/lib/billingApi');

const mockFetchPlanChangeQuote = billingApi.fetchPlanChangeQuote as jest.MockedFunction<typeof billingApi.fetchPlanChangeQuote>;
const mockApplyPlanChange = billingApi.applyPlanChange as jest.MockedFunction<typeof billingApi.applyPlanChange>;

describe('usePlanChange', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requestQuote stores quote and clears error', async () => {
    const mockQuote = {
      currentPlan: 'MICROS_STARTER',
      targetPlan: 'MICROS_PRO',
      prorationCents: 2500,
      currency: 'USD',
      effectiveFromIso: '2024-12-02T00:00:00Z',
      note: 'Upgrade will be applied immediately',
    };

    mockFetchPlanChangeQuote.mockResolvedValueOnce(mockQuote);

    const { result } = renderHook(() => usePlanChange());

    expect(result.current.quote).toBeNull();
    expect(result.current.isQuoting).toBe(false);

    // Request quote
    await act(async () => {
      await result.current.requestQuote('MICROS_PRO');
    });

    await waitFor(() => {
      expect(result.current.isQuoting).toBe(false);
    });

    expect(result.current.quote).toEqual(mockQuote);
    expect(result.current.error).toBeNull();
    expect(mockFetchPlanChangeQuote).toHaveBeenCalledWith('MICROS_PRO');
  });

  it('confirmChange calls API and triggers onChanged callback', async () => {
    const mockUpdatedSubscription = {
      planId: 'MICROS_PRO',
      planName: 'Micros Pro',
      status: 'ACTIVE' as const,
      interval: 'MONTHLY' as const,
      currency: 'USD',
      unitPriceCents: 9900,
      nextRenewalIso: '2024-12-15T00:00:00Z',
      trialEndsIso: null,
      seats: 20,
      branchesIncluded: 10,
      branchesUsed: 5,
      microsOrgsIncluded: null,
      microsOrgsUsed: null,
    };

    mockApplyPlanChange.mockResolvedValueOnce(mockUpdatedSubscription);

    const onChangedMock = jest.fn();
    const { result } = renderHook(() => usePlanChange(onChangedMock));

    expect(result.current.isChanging).toBe(false);

    // Confirm change
    await act(async () => {
      await result.current.confirmChange('MICROS_PRO');
    });

    await waitFor(() => {
      expect(result.current.isChanging).toBe(false);
    });

    expect(mockApplyPlanChange).toHaveBeenCalledWith('MICROS_PRO');
    expect(onChangedMock).toHaveBeenCalledWith(mockUpdatedSubscription);
    expect(result.current.error).toBeNull();
    expect(result.current.quote).toBeNull(); // Should clear quote after success
  });

  it('handles error on quote failure', async () => {
    const testError = new Error('Failed to generate quote');
    mockFetchPlanChangeQuote.mockRejectedValueOnce(testError);

    const { result } = renderHook(() => usePlanChange());

    await act(async () => {
      await result.current.requestQuote('MICROS_PRO');
    });

    await waitFor(() => {
      expect(result.current.isQuoting).toBe(false);
    });

    expect(result.current.error).toEqual(testError);
    expect(result.current.quote).toBeNull();
  });

  it('handles error on change failure', async () => {
    const testError = new Error('Payment method required');
    mockApplyPlanChange.mockRejectedValueOnce(testError);

    const onChangedMock = jest.fn();
    const { result } = renderHook(() => usePlanChange(onChangedMock));

    await act(async () => {
      await result.current.confirmChange('MICROS_PRO');
    });

    await waitFor(() => {
      expect(result.current.isChanging).toBe(false);
    });

    expect(result.current.error).toEqual(testError);
    expect(onChangedMock).not.toHaveBeenCalled();
  });

  it('clearQuote resets quote and error state', async () => {
    const mockQuote = {
      currentPlan: 'MICROS_STARTER',
      targetPlan: 'MICROS_PRO',
      prorationCents: 2500,
      currency: 'USD',
      effectiveFromIso: '2024-12-02T00:00:00Z',
      note: 'Test note',
    };

    mockFetchPlanChangeQuote.mockResolvedValueOnce(mockQuote);

    const { result } = renderHook(() => usePlanChange());

    // Request quote to populate state
    await act(async () => {
      await result.current.requestQuote('MICROS_PRO');
    });

    await waitFor(() => {
      expect(result.current.quote).toEqual(mockQuote);
    });

    // Clear quote
    act(() => {
      result.current.clearQuote();
    });

    expect(result.current.quote).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('sets isQuoting during quote request', async () => {
    let resolveQuote: (value: any) => void;
    const quotePromise = new Promise((resolve) => {
      resolveQuote = resolve;
    });

    mockFetchPlanChangeQuote.mockReturnValue(quotePromise as any);

    const { result } = renderHook(() => usePlanChange());

    // Start requesting quote
    act(() => {
      result.current.requestQuote('MICROS_PRO');
    });

    // Should be quoting immediately
    expect(result.current.isQuoting).toBe(true);

    // Resolve the promise
    await act(async () => {
      resolveQuote!({
        currentPlan: 'MICROS_STARTER',
        targetPlan: 'MICROS_PRO',
        prorationCents: 2500,
        currency: 'USD',
        effectiveFromIso: '2024-12-02T00:00:00Z',
        note: 'Test',
      });
      await quotePromise;
    });

    await waitFor(() => {
      expect(result.current.isQuoting).toBe(false);
    });
  });

  it('sets isChanging during plan change', async () => {
    let resolveChange: (value: any) => void;
    const changePromise = new Promise((resolve) => {
      resolveChange = resolve;
    });

    mockApplyPlanChange.mockReturnValue(changePromise as any);

    const { result } = renderHook(() => usePlanChange());

    // Start confirming change
    act(() => {
      result.current.confirmChange('MICROS_PRO');
    });

    // Should be changing immediately
    expect(result.current.isChanging).toBe(true);

    // Resolve the promise
    await act(async () => {
      resolveChange!({
        planId: 'MICROS_PRO',
        planName: 'Micros Pro',
        status: 'ACTIVE',
        interval: 'MONTHLY',
        currency: 'USD',
        unitPriceCents: 9900,
        nextRenewalIso: '2024-12-15T00:00:00Z',
        trialEndsIso: null,
        seats: 20,
        branchesIncluded: 10,
        branchesUsed: 5,
        microsOrgsIncluded: null,
        microsOrgsUsed: null,
      });
      await changePromise;
    });

    await waitFor(() => {
      expect(result.current.isChanging).toBe(false);
    });
  });
});
