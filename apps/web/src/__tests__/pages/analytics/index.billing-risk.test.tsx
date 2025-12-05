/**
 * Integration tests for Analytics franchise tab billing risk banner
 * E24-BILLING-FE-S5
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Hoist-safe mocking pattern (E24-BILLING-FE-S3)
const mockUsePlanCapabilities = jest.fn();
const mockUseFranchiseBudgetVariance = jest.fn();
const mockUseFranchiseForecast = jest.fn();
const mockUseFranchiseMultiMonthSeries = jest.fn();

jest.mock('@/hooks/usePlanCapabilities', () => ({
  usePlanCapabilities: () => mockUsePlanCapabilities(),
}));

jest.mock('@/hooks/useFranchiseBudgetVariance', () => ({
  useFranchiseBudgetVariance: () => mockUseFranchiseBudgetVariance(),
}));

jest.mock('@/hooks/useFranchiseForecast', () => ({
  useFranchiseForecast: () => mockUseFranchiseForecast(),
}));

jest.mock('@/hooks/useFranchiseMultiMonthSeries', () => ({
  useFranchiseMultiMonthSeries: () => mockUseFranchiseMultiMonthSeries(),
}));

jest.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import AnalyticsPage from '../../../pages/analytics/index';

describe('Analytics Franchise Tab - Billing Risk Banner Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Default franchise hooks mocks
    mockUseFranchiseBudgetVariance.mockReturnValue({
      variance: null,
      isLoading: false,
    });

    mockUseFranchiseForecast.mockReturnValue({
      forecast: null,
      isLoading: false,
    });

    mockUseFranchiseMultiMonthSeries.mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  const renderWithQuery = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
    );
  };

  it('shows risk banner for PAST_DUE subscription in franchise tab', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: {
        id: 'sub-pastdue',
        orgId: 'org-123',
        planId: 'FRANCHISE_CORE',
        status: 'PAST_DUE',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      capabilities: {
        canUseDevPortal: true,
        canUseFranchiseAnalytics: true,
      },
      isLoading: false,
    });

    renderWithQuery(<AnalyticsPage />);

    // Switch to franchise tab
    const franchiseTab = screen.getByRole('button', { name: /franchise/i });
    fireEvent.click(franchiseTab);

    // Risk banner should be visible
    expect(screen.getByLabelText('Billing risk notice')).toBeInTheDocument();
    expect(screen.getByText(/Billing issue detected for this organisation/i)).toBeInTheDocument();
    expect(screen.getByText(/may impact Franchise analytics soon/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Go to billing/i })).toBeInTheDocument();
  });

  it('shows risk banner for EXPIRED subscription', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: {
        id: 'sub-expired',
        orgId: 'org-456',
        planId: 'FRANCHISE_PLUS',
        status: 'EXPIRED',
        currentPeriodStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        currentPeriodEnd: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      capabilities: {
        canUseDevPortal: true,
        canUseFranchiseAnalytics: true,
      },
      isLoading: false,
    });

    renderWithQuery(<AnalyticsPage />);

    const franchiseTab = screen.getByRole('button', { name: /franchise/i });
    fireEvent.click(franchiseTab);

    expect(screen.getByLabelText('Billing risk notice')).toBeInTheDocument();
    expect(screen.getByText(/Billing issue detected for this organisation/i)).toBeInTheDocument();
  });

  it('shows risk banner for CANCELED subscription', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: {
        id: 'sub-canceled',
        orgId: 'org-789',
        planId: 'FRANCHISE_CORE',
        status: 'CANCELED',
        canceledAt: new Date().toISOString(),
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      capabilities: {
        canUseDevPortal: true,
        canUseFranchiseAnalytics: true,
      },
      isLoading: false,
    });

    renderWithQuery(<AnalyticsPage />);

    const franchiseTab = screen.getByRole('button', { name: /franchise/i });
    fireEvent.click(franchiseTab);

    expect(screen.getByLabelText('Billing risk notice')).toBeInTheDocument();
  });

  it('does not show risk banner for ACTIVE subscription', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: {
        id: 'sub-active',
        orgId: 'org-123',
        planId: 'FRANCHISE_CORE',
        status: 'ACTIVE',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      capabilities: {
        canUseDevPortal: true,
        canUseFranchiseAnalytics: true,
      },
      isLoading: false,
    });

    renderWithQuery(<AnalyticsPage />);

    const franchiseTab = screen.getByRole('button', { name: /franchise/i });
    fireEvent.click(franchiseTab);

    // Risk banner should NOT be visible
    expect(screen.queryByLabelText('Billing risk notice')).not.toBeInTheDocument();
  });

  it('does not show risk banner in Overview tab (only franchise tab)', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: {
        id: 'sub-pastdue',
        orgId: 'org-123',
        planId: 'FRANCHISE_CORE',
        status: 'PAST_DUE',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      capabilities: {
        canUseDevPortal: true,
        canUseFranchiseAnalytics: true,
      },
      isLoading: false,
    });

    renderWithQuery(<AnalyticsPage />);

    // Default view is Overview tab - no banner
    expect(screen.queryByLabelText('Billing risk notice')).not.toBeInTheDocument();

    // Switch to franchise tab - banner appears
    const franchiseTab = screen.getByRole('button', { name: /franchise/i });
    fireEvent.click(franchiseTab);

    expect(screen.getByLabelText('Billing risk notice')).toBeInTheDocument();
  });

  it('risk banner is non-blocking - franchise analytics content still visible', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: {
        id: 'sub-pastdue',
        orgId: 'org-123',
        planId: 'FRANCHISE_CORE',
        status: 'PAST_DUE',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      capabilities: {
        canUseDevPortal: true,
        canUseFranchiseAnalytics: true,
      },
      isLoading: false,
    });

    renderWithQuery(<AnalyticsPage />);

    const franchiseTab = screen.getByRole('button', { name: /franchise/i });
    fireEvent.click(franchiseTab);

    // Risk banner should be visible in franchise tab
    expect(screen.getByLabelText('Billing risk notice')).toBeInTheDocument();
    expect(screen.getByText(/Billing issue detected/i)).toBeInTheDocument();
    
    // Verify the banner is contextual for franchise analytics
    expect(screen.getByText(/Franchise analytics/i)).toBeInTheDocument();
  });
});
