/**
 * useFranchiseBranchMultiMonthSeries Hook Tests
 * E22-FRANCHISE-FE-S3: Test branch multi-month trend data fetching
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useFranchiseBranchMultiMonthSeries } from './useFranchiseBranchMultiMonthSeries';
import * as franchiseApi from '@/lib/franchiseAnalyticsApi';

jest.mock('@/lib/franchiseAnalyticsApi');

const mockFetchBudgetVariance =
  franchiseApi.fetchFranchiseBudgetVariance as jest.MockedFunction<
    typeof franchiseApi.fetchFranchiseBudgetVariance
  >;

const mockFetchForecast = franchiseApi.fetchFranchiseForecast as jest.MockedFunction<
  typeof franchiseApi.fetchFranchiseForecast
>;

describe('useFranchiseBranchMultiMonthSeries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches data for correct number of months with branchId filter', async () => {
    const mockVariance = {
      year: 2025,
      month: 10,
      branches: [
        {
          branchId: 'branch-1',
          branchName: 'Downtown',
          budgetAmountCents: 2000000,
          actualNetSalesCents: 2100000,
          varianceAmountCents: 100000,
          variancePercent: 5,
        },
      ],
    };

    const mockForecast = {
      year: 2025,
      month: 10,
      lookbackMonths: 3,
      branches: [
        {
          branchId: 'branch-1',
          branchName: 'Downtown',
          year: 2025,
          month: 10,
          forecastNetSalesCents: 2150000,
          historicalNetSalesCents: 2000000,
          avgDailyNetSalesCents: 70000,
          coverageDays: 30,
        },
      ],
    };

    mockFetchBudgetVariance.mockResolvedValue(mockVariance);
    mockFetchForecast.mockResolvedValue(mockForecast);

    const { result } = renderHook(() =>
      useFranchiseBranchMultiMonthSeries({
        branchId: 'branch-1',
        startYear: 2025,
        startMonth: 10,
        months: 3,
        lookbackMonths: 3,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFetchBudgetVariance).toHaveBeenCalledTimes(3);
    expect(mockFetchForecast).toHaveBeenCalledTimes(3);

    // Verify branchIds filter is passed
    expect(mockFetchBudgetVariance).toHaveBeenCalledWith(
      expect.objectContaining({
        branchIds: ['branch-1'],
      }),
    );
    expect(mockFetchForecast).toHaveBeenCalledWith(
      expect.objectContaining({
        branchIds: ['branch-1'],
      }),
    );

    expect(result.current.data).toHaveLength(3);
  });

  it('aggregates branch data correctly (single branch)', async () => {
    const mockVariance = {
      year: 2025,
      month: 12,
      branches: [
        {
          branchId: 'branch-1',
          branchName: 'Downtown',
          budgetAmountCents: 3000000,
          actualNetSalesCents: 3200000,
          varianceAmountCents: 200000,
          variancePercent: 6.67,
        },
      ],
    };

    const mockForecast = {
      year: 2025,
      month: 12,
      lookbackMonths: 3,
      branches: [
        {
          branchId: 'branch-1',
          branchName: 'Downtown',
          year: 2025,
          month: 12,
          forecastNetSalesCents: 3300000,
          historicalNetSalesCents: 3000000,
          avgDailyNetSalesCents: 100000,
          coverageDays: 31,
        },
      ],
    };

    mockFetchBudgetVariance.mockResolvedValue(mockVariance);
    mockFetchForecast.mockResolvedValue(mockForecast);

    const { result } = renderHook(() =>
      useFranchiseBranchMultiMonthSeries({
        branchId: 'branch-1',
        startYear: 2025,
        startMonth: 12,
        months: 1,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const dataPoint = result.current.data[0];
    expect(dataPoint.budgetNetSalesCents).toBe(3000000);
    expect(dataPoint.actualNetSalesCents).toBe(3200000);
    expect(dataPoint.forecastNetSalesCents).toBe(3300000);
  });

  it('sorts data points by year and month ascending', async () => {
    mockFetchBudgetVariance.mockImplementation(async ({ year, month }: any) => ({
      year,
      month,
      branches: [
        {
          branchId: 'branch-1',
          branchName: 'Downtown',
          budgetAmountCents: 1000000,
          actualNetSalesCents: 1100000,
          varianceAmountCents: 100000,
          variancePercent: 10,
        },
      ],
    }));

    mockFetchForecast.mockImplementation(async ({ year, month }: any) => ({
      year,
      month,
      lookbackMonths: 3,
      branches: [
        {
          branchId: 'branch-1',
          branchName: 'Downtown',
          year,
          month,
          forecastNetSalesCents: 1200000,
          historicalNetSalesCents: 1000000,
          avgDailyNetSalesCents: 40000,
          coverageDays: 30,
        },
      ],
    }));

    const { result } = renderHook(() =>
      useFranchiseBranchMultiMonthSeries({
        branchId: 'branch-1',
        startYear: 2025,
        startMonth: 3,
        months: 3,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const data = result.current.data;
    expect(data).toHaveLength(3);
    expect(data[0].month).toBe(1); // Jan
    expect(data[1].month).toBe(2); // Feb
    expect(data[2].month).toBe(3); // Mar
  });

  it('handles API errors gracefully', async () => {
    mockFetchBudgetVariance.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useFranchiseBranchMultiMonthSeries({
        branchId: 'branch-1',
        startYear: 2025,
        startMonth: 12,
        months: 3,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeTruthy();
    expect(result.current.data).toHaveLength(0);
  });

  it('provides reload function', async () => {
    const mockVariance = {
      year: 2025,
      month: 12,
      branches: [
        {
          branchId: 'branch-1',
          branchName: 'Downtown',
          budgetAmountCents: 1000000,
          actualNetSalesCents: 1100000,
          varianceAmountCents: 100000,
          variancePercent: 10,
        },
      ],
    };

    const mockForecast = {
      year: 2025,
      month: 12,
      lookbackMonths: 3,
      branches: [
        {
          branchId: 'branch-1',
          branchName: 'Downtown',
          year: 2025,
          month: 12,
          forecastNetSalesCents: 1200000,
          historicalNetSalesCents: 1000000,
          avgDailyNetSalesCents: 40000,
          coverageDays: 31,
        },
      ],
    };

    mockFetchBudgetVariance.mockResolvedValue(mockVariance);
    mockFetchForecast.mockResolvedValue(mockForecast);

    const { result } = renderHook(() =>
      useFranchiseBranchMultiMonthSeries({
        branchId: 'branch-1',
        startYear: 2025,
        startMonth: 12,
        months: 1,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFetchBudgetVariance).toHaveBeenCalledTimes(1);

    result.current.reload();

    await waitFor(() => expect(mockFetchBudgetVariance).toHaveBeenCalledTimes(2));
  });
});
