/**
 * Integration tests for franchise branch drill-down billing risk banner
 * E24-BILLING-FE-S5
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// Hoist-safe mocking pattern (E24-BILLING-FE-S3)
const mockUseRouter = jest.fn();
const mockUsePlanCapabilities = jest.fn();
const mockUseFranchiseBranchKpis = jest.fn();
const mockUseFranchiseBranchMultiMonthSeries = jest.fn();

jest.mock('next/router', () => ({
  useRouter: () => mockUseRouter(),
}));

jest.mock('@/hooks/usePlanCapabilities', () => ({
  usePlanCapabilities: () => mockUsePlanCapabilities(),
}));

jest.mock('@/hooks/useFranchiseBranchKpis', () => ({
  useFranchiseBranchKpis: () => mockUseFranchiseBranchKpis(),
}));

jest.mock('@/hooks/useFranchiseBranchMultiMonthSeries', () => ({
  useFranchiseBranchMultiMonthSeries: () => mockUseFranchiseBranchMultiMonthSeries(),
}));

import FranchiseBranchPage from '../../../../pages/analytics/franchise/[branchId]';

describe('Franchise Branch Page - Billing Risk Banner Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default router mock
    mockUseRouter.mockReturnValue({
      query: { branchId: 'branch-123' },
      push: jest.fn(),
    });

    // Default KPIs mock
    mockUseFranchiseBranchKpis.mockReturnValue({
      branch: {
        branchId: 'branch-123',
        branchName: 'Downtown Branch',
        grossSalesCents: 50000000,
        netSalesCents: 45000000,
        totalOrders: 1200,
        avgCheckCents: 4166700,
        totalGuests: 1500,
        marginAmountCents: 20000000,
        marginPercent: 40.0,
      },
      isLoading: false,
    });

    // Default series mock
    mockUseFranchiseBranchMultiMonthSeries.mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  it('shows risk banner for PAST_DUE subscription', () => {
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

    render(<FranchiseBranchPage />);

    // Risk banner should be visible
    expect(screen.getByLabelText('Billing risk notice')).toBeInTheDocument();
    expect(screen.getByText(/Billing issue detected for this organisation/i)).toBeInTheDocument();
    expect(screen.getByText(/may impact Franchise branch analytics soon/i)).toBeInTheDocument();
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

    render(<FranchiseBranchPage />);

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

    render(<FranchiseBranchPage />);

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

    render(<FranchiseBranchPage />);

    // Branch content should render
    expect(screen.getByText('Downtown Branch')).toBeInTheDocument();

    // Risk banner should NOT be visible
    expect(screen.queryByLabelText('Billing risk notice')).not.toBeInTheDocument();
  });

  it('does not show risk banner for IN_TRIAL subscription', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: {
        id: 'sub-trial',
        orgId: 'org-123',
        planId: 'FRANCHISE_CORE',
        status: 'IN_TRIAL',
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
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

    render(<FranchiseBranchPage />);

    expect(screen.getByText('Downtown Branch')).toBeInTheDocument();
    expect(screen.queryByLabelText('Billing risk notice')).not.toBeInTheDocument();
  });

  it('does not show risk banner when subscription is null', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: null,
      capabilities: {
        canUseDevPortal: true,
        canUseFranchiseAnalytics: true,
      },
      isLoading: false,
    });

    render(<FranchiseBranchPage />);

    expect(screen.getByText('Downtown Branch')).toBeInTheDocument();
    expect(screen.queryByLabelText('Billing risk notice')).not.toBeInTheDocument();
  });

  it('risk banner is non-blocking - branch analytics content still visible', () => {
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

    render(<FranchiseBranchPage />);

    // Both risk banner AND branch content should be visible
    expect(screen.getByLabelText('Billing risk notice')).toBeInTheDocument();
    expect(screen.getByText('Downtown Branch')).toBeInTheDocument();
    expect(screen.getByText(/6-Month Trend/i)).toBeInTheDocument();
  });

  it('shows back button with risk banner', () => {
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

    render(<FranchiseBranchPage />);

    expect(screen.getByText('← Back to analytics')).toBeInTheDocument();
    expect(screen.getByLabelText('Billing risk notice')).toBeInTheDocument();
  });
});
