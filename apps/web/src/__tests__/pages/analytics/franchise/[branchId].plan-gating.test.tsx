import React from 'react';
import { render, screen } from '@testing-library/react';

// Define mock functions first
const mockUsePlanCapabilities = jest.fn();
const mockUseRouter = jest.fn();
const mockUseFranchiseBranchKpis = jest.fn();
const mockUseFranchiseBranchMultiMonthSeries = jest.fn();

// Mock all hooks and components before importing the page
jest.mock('@/hooks/usePlanCapabilities', () => ({
  usePlanCapabilities: () => mockUsePlanCapabilities(),
}));

jest.mock('next/router', () => ({
  useRouter: () => mockUseRouter(),
}));

jest.mock('@/hooks/useFranchiseBranchKpis', () => ({
  useFranchiseBranchKpis: (opts: any) => mockUseFranchiseBranchKpis(opts),
}));

jest.mock('@/hooks/useFranchiseBranchMultiMonthSeries', () => ({
  useFranchiseBranchMultiMonthSeries: (opts: any) => mockUseFranchiseBranchMultiMonthSeries(opts),
}));

jest.mock('@/components/analytics/franchise/FranchiseBranchHeader', () => ({
  FranchiseBranchHeader: () => <div data-testid="branch-header">Branch Header</div>,
}));

jest.mock('@/components/analytics/franchise/FranchiseBranchTrendChart', () => ({
  FranchiseBranchTrendChart: () => <div data-testid="trend-chart">Trend Chart</div>,
}));

// Import page AFTER mocks are defined
import FranchiseBranchPage from '@/pages/analytics/franchise/[branchId]';

describe('FranchiseBranchPage - Plan Gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({ query: { branchId: 'branch-123' }, push: jest.fn() });
    mockUseFranchiseBranchKpis.mockReturnValue({ branch: { id: 'branch-123', name: 'Test Branch' }, isLoading: false });
    mockUseFranchiseBranchMultiMonthSeries.mockReturnValue({ data: [], isLoading: false });
  });

  it('shows loading state while checking plan capabilities', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: null,
      capabilities: { canUseFranchiseAnalytics: true, canUseDevPortal: true, canUseKdsMultiStation: true, canUseFranchiseExports: true, canUseApiUsageAnalytics: true },
      isLoading: true,
      error: null,
      reload: jest.fn(),
    });

    render(<FranchiseBranchPage />);
    expect(screen.getByText('Checking your plan permissions…')).toBeInTheDocument();
  });

  it('shows upsell gate when plan does not allow franchise analytics', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: { planId: 'MICROS_PRO' } as any,
      capabilities: { canUseFranchiseAnalytics: false, canUseDevPortal: false, canUseKdsMultiStation: true, canUseFranchiseExports: false, canUseApiUsageAnalytics: false },
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(<FranchiseBranchPage />);
    expect(screen.getByText(/Upgrade required to use Franchise branch analytics/)).toBeInTheDocument();
    expect(screen.getByText(/View plans & upgrade/)).toBeInTheDocument();
  });

  it('shows branch analytics content when plan allows access', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: { planId: 'FRANCHISE_CORE' } as any,
      capabilities: { canUseFranchiseAnalytics: true, canUseDevPortal: true, canUseKdsMultiStation: true, canUseFranchiseExports: true, canUseApiUsageAnalytics: true },
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(<FranchiseBranchPage />);
    expect(screen.getByTestId('branch-header')).toBeInTheDocument();
    expect(screen.getByTestId('trend-chart')).toBeInTheDocument();
  });

  it('shows branch analytics when billing service fails (fail-open)', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: null,
      capabilities: { canUseFranchiseAnalytics: true, canUseDevPortal: true, canUseKdsMultiStation: true, canUseFranchiseExports: true, canUseApiUsageAnalytics: true },
      isLoading: false,
      error: new Error('Billing service unavailable'),
      reload: jest.fn(),
    });

    render(<FranchiseBranchPage />);
    expect(screen.getByTestId('branch-header')).toBeInTheDocument();
    expect(screen.queryByText(/Upgrade required/)).not.toBeInTheDocument();
  });
});
