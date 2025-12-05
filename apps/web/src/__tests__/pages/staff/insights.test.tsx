/**
 * M34-FE-PARITY-S2: Tests for Staff Insights & Awards page
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import StaffInsightsPage from '@/pages/staff/insights';
import { useQuery } from '@tanstack/react-query';

// Mock AppShell to avoid context providers
jest.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children, title }: any) => (
    <div data-testid="app-shell" data-title={title}>{children}</div>
  ),
}));

// Mock useQuery
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/staff/insights',
    push: jest.fn(),
  }),
}));

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;

describe('StaffInsightsPage', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: {
        topPerformers: [],
        recentAwards: [],
        promotionSuggestions: [],
        allStaffKpis: [],
      },
      isLoading: false,
      error: null,
    } as any);
  });

  it('renders heading and sections', () => {
    render(<StaffInsightsPage />);

    expect(
      screen.getByRole('heading', { name: /staff insights/i })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/kpis, awards and promotion opportunities/i)
    ).toBeInTheDocument();
  });

  it('shows Employee of the Month section', () => {
    render(<StaffInsightsPage />);

    expect(screen.getByText(/employee of the month/i)).toBeInTheDocument();
  });

  it('shows Promotion Candidates section', () => {
    render(<StaffInsightsPage />);

    expect(screen.getByText(/promotion candidates/i)).toBeInTheDocument();
  });
});
