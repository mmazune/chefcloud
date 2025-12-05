import React from 'react';
import { render, screen } from '@testing-library/react';

// Define mock functions first
const mockUsePlanCapabilities = jest.fn();
const mockUseDevApiKeys = jest.fn();

// Mock the hooks before importing the page
jest.mock('@/hooks/usePlanCapabilities', () => ({
  usePlanCapabilities: () => mockUsePlanCapabilities(),
}));

jest.mock('@/hooks/useDevApiKeys', () => ({
  useDevApiKeys: () => mockUseDevApiKeys(),
}));

// Import page AFTER mocks are defined
import DevPortalPage from '@/pages/dev';

describe('DevPortalPage - Plan Gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseDevApiKeys.mockReturnValue({
      keys: [],
      isLoading: false,
      error: null,
      reload: jest.fn(),
      createKey: jest.fn(),
      deleteKey: jest.fn(),
      regenerateKey: jest.fn(),
    });
  });

  it('shows loading state while checking plan capabilities', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: null,
      capabilities: {
        canUseFranchiseAnalytics: true,
        canUseDevPortal: true,
        canUseKdsMultiStation: true,
        canUseFranchiseExports: true,
        canUseApiUsageAnalytics: true,
      },
      isLoading: true,
      error: null,
      reload: jest.fn(),
    });

    render(<DevPortalPage />);

    expect(screen.getByText('Checking your plan permissions…')).toBeInTheDocument();
  });

  it('shows upsell gate when plan does not allow Dev Portal access', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: { planId: 'MICROS_PRO' } as any,
      capabilities: {
        canUseFranchiseAnalytics: false,
        canUseDevPortal: false,
        canUseKdsMultiStation: true,
        canUseFranchiseExports: false,
        canUseApiUsageAnalytics: false,
      },
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(<DevPortalPage />);

    expect(screen.getByText(/Upgrade required to use Developer Portal/)).toBeInTheDocument();
    expect(screen.getByText(/View plans & upgrade/)).toBeInTheDocument();
  });

  it('shows Dev Portal content when plan allows access', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: { planId: 'FRANCHISE_CORE' } as any,
      capabilities: {
        canUseFranchiseAnalytics: true,
        canUseDevPortal: true,
        canUseKdsMultiStation: true,
        canUseFranchiseExports: true,
        canUseApiUsageAnalytics: true,
      },
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(<DevPortalPage />);

    expect(screen.getByText('Developer portal')).toBeInTheDocument();
    expect(screen.getByText(/Manage API keys and webhooks/)).toBeInTheDocument();
  });

  it('shows Dev Portal when billing fails (fail-open)', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: null,
      capabilities: {
        canUseFranchiseAnalytics: true,
        canUseDevPortal: true,
        canUseKdsMultiStation: true,
        canUseFranchiseExports: true,
        canUseApiUsageAnalytics: true,
      },
      isLoading: false,
      error: new Error('Billing service unavailable'),
      reload: jest.fn(),
    });

    render(<DevPortalPage />);

    expect(screen.getByText('Developer portal')).toBeInTheDocument();
    expect(screen.queryByText(/Upgrade required/)).not.toBeInTheDocument();
  });
});
