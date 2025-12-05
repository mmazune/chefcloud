/**
 * M34-FE-PARITY-S2: Tests for Finance Budgets & Variance page
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import FinanceBudgetsPage from '@/pages/reports/budgets';

// Mock AppShell to avoid context providers
jest.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children, title }: any) => (
    <div data-testid="app-shell" data-title={title}>{children}</div>
  ),
}));

// Mock hooks
jest.mock('@/hooks/useFranchiseBudgetVariance', () => ({
  useFranchiseBudgetVariance: jest.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
}));

jest.mock('@/hooks/usePlanCapabilities', () => ({
  usePlanCapabilities: jest.fn(() => ({
    analytics: true,
  })),
}));

jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/reports/budgets',
    push: jest.fn(),
  }),
}));

// Mock child components
jest.mock('@/components/analytics/franchise/FranchiseVarianceCard', () => ({
  FranchiseVarianceCard: () => <div data-testid="variance-card">Variance Card</div>,
}));

jest.mock('@/components/analytics/franchise/FranchiseBudgetTable', () => ({
  FranchiseBudgetTable: () => <div data-testid="budget-table">Budget Table</div>,
}));

jest.mock('@/components/billing/BillingUpsellGate', () => ({
  BillingUpsellGate: () => <div data-testid="upsell-gate">Upgrade Required</div>,
}));

describe('FinanceBudgetsPage', () => {
  it('renders heading and month/year selectors', () => {
    render(<FinanceBudgetsPage />);

    expect(
      screen.getByRole('heading', { name: /budgets & variance/i })
    ).toBeInTheDocument();

    // Check for month and year select elements
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it('shows subtitle describing the page', () => {
    render(<FinanceBudgetsPage />);

    expect(
      screen.getByText(/finance view of budget vs actual performance/i)
    ).toBeInTheDocument();
  });
});
