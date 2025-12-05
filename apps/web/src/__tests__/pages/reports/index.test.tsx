/**
 * M34-FE-PARITY-S2: Tests for Reports & Digests Hub page
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import ReportsHubPage from '@/pages/reports';

// Mock AppShell to avoid context providers
jest.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children, title }: any) => (
    <div data-testid="app-shell" data-title={title}>{children}</div>
  ),
}));

jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/reports',
    push: jest.fn(),
  }),
}));

describe('ReportsHubPage', () => {
  it('renders main heading', () => {
    render(<ReportsHubPage />);

    expect(
      screen.getByRole('heading', { name: /reports & digests/i })
    ).toBeInTheDocument();
  });

  it('lists key reports', () => {
    render(<ReportsHubPage />);

    // Check for key report names
    expect(screen.getByText(/budgets & variance/i)).toBeInTheDocument();
    expect(screen.getByText(/staff insights/i)).toBeInTheDocument();
    expect(screen.getByText(/franchise analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/customer feedback & nps/i)).toBeInTheDocument();
  });

  it('shows report categories', () => {
    render(<ReportsHubPage />);

    // Check for category badges
    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('HR')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
  });

  it('shows CSV export indicators', () => {
    render(<ReportsHubPage />);

    const csvBadges = screen.getAllByText(/csv export/i);
    expect(csvBadges.length).toBeGreaterThan(0);
  });

  it('shows Tapas demo info', () => {
    render(<ReportsHubPage />);

    expect(screen.getByText(/for tapas demo users/i)).toBeInTheDocument();
    expect(screen.getByText(/employee of the month/i)).toBeInTheDocument();
  });
});
