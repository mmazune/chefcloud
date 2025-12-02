/**
 * Tests for useFranchiseMultiMonthSeries hook
 * E22-FRANCHISE-FE-S2
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useFranchiseMultiMonthSeries } from './useFranchiseMultiMonthSeries';
import * as franchiseApi from '@/lib/franchiseAnalyticsApi';

// Mock the API functions
jest.mock('@/lib/franchiseAnalyticsApi');

const mockFetchBudgetVariance = franchiseApi.fetchFranchiseBudgetVariance as jest.MockedFunction<
  typeof franchiseApi.fetchFranchiseBudgetVariance
>;

const mockFetchForecast = franchiseApi.fetchFranchiseForecast as jest.MockedFunction<
  typeof franchiseApi.fetchFranchiseForecast
>;

describe('useFranchiseMultiMonthSeries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches data for correct number of months', async () => {
    mockFetchBudgetVariance.mockResolvedValue({
      year: 2025,
      month: 12,
      branches: [
        {
          branchId: 'b1',
          branchName: 'Branch 1',
          budgetAmountCents: 1000000,
          actualNetSalesCents: 1100000,
          varianceAmountCents: 100000,
          variancePercent: 10.0,
        },
      ],
    });

    mockFetchForecast.mockResolvedValue({
      year: 2025,
      month: 12,
      lookbackMonths: 3,
      branches: [
        {
          branchId: 'b1',
          branchName: 'Branch 1',
          year: 2025,
          month: 12,
          forecastNetSalesCents: 1200000,
          historicalNetSalesCents: 1050000,
          avgDailyNetSalesCents: 35000,
          coverageDays: 30,
        },
      ],
    });

    const { result } = renderHook(() =>
      useFranchiseMultiMonthSeries({
        startYear: 2025,
        startMonth: 12,
        months: 3,
        lookbackMonths: 3,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should have called API for 3 months
    expect(mockFetchBudgetVariance).toHaveBeenCalledTimes(3);
    expect(mockFetchForecast).toHaveBeenCalledTimes(3);

    // Should have 3 data points
    expect(result.current.data).toHaveLength(3);
  });

  it('aggregates branch data correctly', async () => {
    mockFetchBudgetVariance.mockResolvedValue({
      year: 2025,
      month: 11,
      branches: [
        {
          branchId: 'b1',
          branchName: 'Branch 1',
          budgetAmountCents: 1000000,
          actualNetSalesCents: 900000,
          varianceAmountCents: -100000,
          variancePercent: -10.0,
        },
        {
          branchId: 'b2',
          branchName: 'Branch 2',
          budgetAmountCents: 2000000,
          actualNetSalesCents: 2200000,
          varianceAmountCents: 200000,
          variancePercent: 10.0,
        },
      ],
    });

    mockFetchForecast.mockResolvedValue({
      year: 2025,
      month: 11,
      lookbackMonths: 3,
      branches: [
        {
          branchId: 'b1',
          branchName: 'Branch 1',
          year: 2025,
          month: 11,
          forecastNetSalesCents: 1100000,
          historicalNetSalesCents: 950000,
          avgDailyNetSalesCents: 32000,
          coverageDays: 30,
        },
        {
          branchId: 'b2',
          branchName: 'Branch 2',
          year: 2025,
          month: 11,
          forecastNetSalesCents: 2300000,
          historicalNetSalesCents: 2100000,
          avgDailyNetSalesCents: 70000,
          coverageDays: 30,
        },
      ],
    });

    const { result } = renderHook(() =>
      useFranchiseMultiMonthSeries({
        startYear: 2025,
        startMonth: 11,
        months: 1,
        lookbackMonths: 3,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const dataPoint = result.current.data[0];

    // Budget: 1M + 2M = 3M
    expect(dataPoint.budgetNetSalesCents).toBe(3000000);

    // Actual: 900k + 2.2M = 3.1M
    expect(dataPoint.actualNetSalesCents).toBe(3100000);

    // Forecast: 1.1M + 2.3M = 3.4M
    expect(dataPoint.forecastNetSalesCents).toBe(3400000);
  });

  it('sorts data points by year and month ascending', async () => {
    // Mock returns don't matter much here, just testing order
    mockFetchBudgetVariance.mockResolvedValue({
      year: 2025,
      month: 1,
      branches: [],
    });

    mockFetchForecast.mockResolvedValue({
      year: 2025,
      month: 1,
      lookbackMonths: 3,
      branches: [],
    });

    const { result } = renderHook(() =>
      useFranchiseMultiMonthSeries({
        startYear: 2025,
        startMonth: 3, // March
        months: 3, // Will get Jan, Feb, Mar
        lookbackMonths: 3,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const data = result.current.data;
    expect(data).toHaveLength(3);

    // Should be in ascending order
    expect(data[0].month).toBe(1); // January
    expect(data[1].month).toBe(2); // February
    expect(data[2].month).toBe(3); // March
  });

  it('handles errors gracefully', async () => {
    mockFetchBudgetVariance.mockRejectedValue(new Error('API Error'));
    mockFetchForecast.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() =>
      useFranchiseMultiMonthSeries({
        startYear: 2025,
        startMonth: 12,
        months: 2,
        lookbackMonths: 3,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.data).toHaveLength(0);
  });

  it('provides reload function', async () => {
    mockFetchBudgetVariance.mockResolvedValue({
      year: 2025,
      month: 12,
      branches: [],
    });

    mockFetchForecast.mockResolvedValue({
      year: 2025,
      month: 12,
      lookbackMonths: 3,
      branches: [],
    });

    const { result } = renderHook(() =>
      useFranchiseMultiMonthSeries({
        startYear: 2025,
        startMonth: 12,
        months: 1,
        lookbackMonths: 3,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Clear mocks and call reload
    jest.clearAllMocks();
    result.current.reload();

    await waitFor(() => {
      expect(mockFetchBudgetVariance).toHaveBeenCalledTimes(1);
      expect(mockFetchForecast).toHaveBeenCalledTimes(1);
    });
  });
});
