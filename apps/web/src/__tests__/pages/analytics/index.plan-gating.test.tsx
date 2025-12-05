import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Define mock functions first
const mockUsePlanCapabilities = jest.fn();
const mockUseQuery = jest.fn();

// Mock the hooks before importing the page
jest.mock('@/hooks/usePlanCapabilities', () => ({
  usePlanCapabilities: () => mockUsePlanCapabilities(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => mockUseQuery(options),
}));

jest.mock('@/hooks/useFranchiseBudgetVariance', () => ({
  useFranchiseBudgetVariance: () => ({ data: { branches: [] }, isLoading: false }),
}));

jest.mock('@/hooks/useFranchiseForecast', () => ({
  useFranchiseForecast: () => ({ data: { branches: [] }, isLoading: false }),
}));

jest.mock('@/hooks/useFranchiseMultiMonthSeries', () => ({
  useFranchiseMultiMonthSeries: () => ({ data: [], isLoading: false }),
}));

jest.mock('@/components/analytics/franchise/FranchiseBudgetTable', () => ({
  FranchiseBudgetTable: () => <div data-testid="budget-table">Budget Table</div>,
}));

jest.mock('@/components/analytics/franchise/FranchiseVarianceCard', () => ({
  FranchiseVarianceCard: () => <div data-testid="variance-card">Variance Card</div>,
}));

jest.mock('@/components/analytics/franchise/FranchiseForecastCard', () => ({
  FranchiseForecastCard: () => <div data-testid="forecast-card">Forecast Card</div>,
}));

jest.mock('@/components/analytics/franchise/FranchiseMultiMonthChart', () => ({
  FranchiseMultiMonthChart: () => <div data-testid="multi-month-chart">Multi-Month Chart</div>,
}));

jest.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

// Import page AFTER mocks are defined
import AnalyticsPage from '@/pages/analytics';

describe('AnalyticsPage - Franchise View Plan Gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockImplementation(() => {
      // Return arrays for all query keys to avoid null.length errors
      return { data: [], isLoading: false };
    });
  });

  it('shows upsell gate when plan does not allow franchise analytics', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: { planId: 'MICROS_PRO' } as any,
      capabilities: { canUseFranchiseAnalytics: false, canUseDevPortal: false, canUseKdsMultiStation: true, canUseFranchiseExports: false, canUseApiUsageAnalytics: false },
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(<AnalyticsPage />);
    fireEvent.click(screen.getByText('Franchise'));

    expect(screen.getByText(/Upgrade required to use Franchise analytics/)).toBeInTheDocument();
    expect(screen.getByText(/View plans & upgrade/)).toBeInTheDocument();
  });

  it('shows franchise analytics when plan allows access', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: { planId: 'FRANCHISE_CORE' } as any,
      capabilities: { canUseFranchiseAnalytics: true, canUseDevPortal: true, canUseKdsMultiStation: true, canUseFranchiseExports: true, canUseApiUsageAnalytics: true },
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(<AnalyticsPage />);
    fireEvent.click(screen.getByText('Franchise'));

    expect(screen.getByTestId('budget-table')).toBeInTheDocument();
  });

  it('shows loading state while checking plan capabilities for franchise view', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: null,
      capabilities: { canUseFranchiseAnalytics: true, canUseDevPortal: true, canUseKdsMultiStation: true, canUseFranchiseExports: true, canUseApiUsageAnalytics: true },
      isLoading: true,
      error: null,
      reload: jest.fn(),
    });

    render(<AnalyticsPage />);
    fireEvent.click(screen.getByText('Franchise'));

    expect(screen.getByText('Checking your plan permissions…')).toBeInTheDocument();
  });

  it('does not gate Overview tab (available to all plans)', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: { planId: 'MICROS_STARTER' } as any,
      capabilities: { canUseFranchiseAnalytics: false, canUseDevPortal: false, canUseKdsMultiStation: true, canUseFranchiseExports: false, canUseApiUsageAnalytics: false },
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(<AnalyticsPage />);

    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.queryByText(/Upgrade required/)).not.toBeInTheDocument();
  });

  it('shows franchise analytics when billing service fails (fail-open)', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: null,
      capabilities: { canUseFranchiseAnalytics: true, canUseDevPortal: true, canUseKdsMultiStation: true, canUseFranchiseExports: true, canUseApiUsageAnalytics: true },
      isLoading: false,
      error: new Error('Billing service unavailable'),
      reload: jest.fn(),
    });

    render(<AnalyticsPage />);
    fireEvent.click(screen.getByText('Franchise'));

    expect(screen.getByTestId('budget-table')).toBeInTheDocument();
    expect(screen.queryByText(/Upgrade required/)).not.toBeInTheDocument();
  });
});
