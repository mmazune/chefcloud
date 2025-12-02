/**
 * useFranchiseBranchKpis Hook Tests
 * E22-FRANCHISE-FE-S3: Test branch KPI fetching from overview API
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useFranchiseBranchKpis } from './useFranchiseBranchKpis';
import * as franchiseApi from '@/lib/franchiseAnalyticsApi';

jest.mock('@/lib/franchiseAnalyticsApi');

const mockFetchOverview = franchiseApi.fetchFranchiseOverview as jest.MockedFunction<
  typeof franchiseApi.fetchFranchiseOverview
>;

describe('useFranchiseBranchKpis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches and returns the correct branch from overview', async () => {
    const mockOverview = {
      branches: [
        {
          branchId: 'branch-1',
          branchName: 'Downtown',
          grossSalesCents: 5000000,
          netSalesCents: 4500000,
          totalOrders: 150,
          avgCheckCents: 30000,
          totalGuests: 180,
          marginAmountCents: 1350000,
          marginPercent: 30,
          staffKpiScore: 85,
        },
        {
          branchId: 'branch-2',
          branchName: 'Uptown',
          grossSalesCents: 3000000,
          netSalesCents: 2700000,
          totalOrders: 100,
          avgCheckCents: 27000,
          totalGuests: 120,
          marginAmountCents: 810000,
          marginPercent: 30,
          staffKpiScore: 90,
        },
      ],
    };

    mockFetchOverview.mockResolvedValue(mockOverview);

    const { result } = renderHook(() =>
      useFranchiseBranchKpis({
        year: 2025,
        month: 12,
        branchId: 'branch-1',
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFetchOverview).toHaveBeenCalledWith({
      year: 2025,
      month: 12,
    });

    expect(result.current.branch).not.toBeNull();
    expect(result.current.branch?.branchId).toBe('branch-1');
    expect(result.current.branch?.branchName).toBe('Downtown');
    expect(result.current.branch?.netSalesCents).toBe(4500000);
    expect(result.current.error).toBeNull();
  });

  it('returns null when branch not found', async () => {
    const mockOverview = {
      branches: [
        {
          branchId: 'branch-1',
          branchName: 'Downtown',
          grossSalesCents: 5000000,
          netSalesCents: 4500000,
          totalOrders: 150,
          avgCheckCents: 30000,
          totalGuests: 180,
          marginAmountCents: 1350000,
          marginPercent: 30,
        },
      ],
    };

    mockFetchOverview.mockResolvedValue(mockOverview);

    const { result } = renderHook(() =>
      useFranchiseBranchKpis({
        year: 2025,
        month: 12,
        branchId: 'branch-999',
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.branch).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('handles API errors gracefully', async () => {
    mockFetchOverview.mockRejectedValue(new Error('API failure'));

    const { result } = renderHook(() =>
      useFranchiseBranchKpis({
        year: 2025,
        month: 12,
        branchId: 'branch-1',
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.branch).toBeNull();
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('API failure');
  });

  it('provides reload function that re-fetches data', async () => {
    const mockOverview = {
      branches: [
        {
          branchId: 'branch-1',
          branchName: 'Downtown',
          grossSalesCents: 5000000,
          netSalesCents: 4500000,
          totalOrders: 150,
          avgCheckCents: 30000,
          totalGuests: 180,
          marginAmountCents: 1350000,
          marginPercent: 30,
        },
      ],
    };

    mockFetchOverview.mockResolvedValue(mockOverview);

    const { result } = renderHook(() =>
      useFranchiseBranchKpis({
        year: 2025,
        month: 12,
        branchId: 'branch-1',
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFetchOverview).toHaveBeenCalledTimes(1);

    result.current.reload();

    await waitFor(() => expect(mockFetchOverview).toHaveBeenCalledTimes(2));
  });
});
