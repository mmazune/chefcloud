/**
 * Integration tests for Dev Portal billing risk banner
 * E24-BILLING-FE-S5
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// Hoist-safe mocking pattern (E24-BILLING-FE-S3)
const mockUsePlanCapabilities = jest.fn();
const mockUseDevApiKeys = jest.fn();

jest.mock('@/hooks/usePlanCapabilities', () => ({
  usePlanCapabilities: () => mockUsePlanCapabilities(),
}));

jest.mock('@/hooks/useDevApiKeys', () => ({
  useDevApiKeys: () => mockUseDevApiKeys(),
}));

import DevPortalPage from '../../../pages/dev/index';

describe('Dev Portal - Billing Risk Banner Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default API keys mock
    mockUseDevApiKeys.mockReturnValue({
      keys: [],
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });
  });

  it('shows risk banner for PAST_DUE subscription on Franchise plan', () => {
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

    render(<DevPortalPage />);

    // Risk banner should be visible
    expect(screen.getByLabelText('Billing risk notice')).toBeInTheDocument();
    expect(screen.getByText(/Billing issue detected for this organisation/i)).toBeInTheDocument();
    expect(screen.getByText(/may impact Developer Portal soon/i)).toBeInTheDocument();
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

    render(<DevPortalPage />);

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

    render(<DevPortalPage />);

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

    render(<DevPortalPage />);

    // Dev Portal should render
    expect(screen.getByText('Developer portal')).toBeInTheDocument();

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

    render(<DevPortalPage />);

    expect(screen.getByText('Developer portal')).toBeInTheDocument();
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

    render(<DevPortalPage />);

    expect(screen.getByText('Developer portal')).toBeInTheDocument();
    expect(screen.queryByLabelText('Billing risk notice')).not.toBeInTheDocument();
  });

  it('risk banner is non-blocking - Dev Portal content still visible', () => {
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

    render(<DevPortalPage />);

    // Both risk banner AND Dev Portal content should be visible
    expect(screen.getByLabelText('Billing risk notice')).toBeInTheDocument();
    expect(screen.getByText('Developer portal')).toBeInTheDocument();
    expect(screen.getByText('API keys')).toBeInTheDocument();
    expect(screen.getByText('Webhooks')).toBeInTheDocument();
  });
});
