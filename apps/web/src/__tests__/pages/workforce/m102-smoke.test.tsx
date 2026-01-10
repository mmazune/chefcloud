/**
 * M10.2 Workforce UI Smoke Tests
 * 
 * Tests for Schedule, Timeclock, Approvals, and Labor pages.
 * Each test verifies page renders with expected elements for role-appropriate access.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import SchedulePage from '@/pages/workforce/schedule';
import TimeclockPage from '@/pages/workforce/timeclock';
import ApprovalsPage from '@/pages/workforce/approvals';
import LaborPage from '@/pages/workforce/labor';
import { useQuery } from '@tanstack/react-query';

// Mock AppShell to avoid context providers
jest.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children, title }: any) => (
    <div data-testid="app-shell" data-title={title}>{children}</div>
  ),
}));

// Mock useQuery with complete react-query exports
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(() => ({ mutate: jest.fn(), isLoading: false })),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
    getQueryData: jest.fn(),
  })),
}));

// useAuth is mocked globally in jest.setup.ts via @/contexts/AuthContext

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/workforce/schedule',
    push: jest.fn(),
    query: {},
  }),
}));

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;

describe('Schedule Page', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: {
        shifts: [],
        templates: [],
        branches: [{ id: 'branch-1', name: 'Main Branch' }],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);
  });

  it('renders heading and main controls', () => {
    render(<SchedulePage />);

    expect(
      screen.getByRole('heading', { name: /schedule management/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/view and manage employee schedules/i)).toBeInTheDocument();
  });

  it('shows branch filter dropdown', () => {
    render(<SchedulePage />);

    expect(screen.getByText(/select branch/i)).toBeInTheDocument();
  });

  it('shows create shift button for L4+ roles', () => {
    render(<SchedulePage />);

    expect(screen.getByRole('button', { name: /create shift/i })).toBeInTheDocument();
  });

  it('shows publish button for L4+ roles', () => {
    render(<SchedulePage />);

    expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument();
  });
});

describe('Timeclock Page', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: {
        currentStatus: null,
        todayShift: null,
        recentEntries: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);
  });

  it('renders heading and status section', () => {
    render(<TimeclockPage />);

    expect(
      screen.getByRole('heading', { name: /time clock/i })
    ).toBeInTheDocument();
  });

  it('shows current status card', () => {
    render(<TimeclockPage />);

    expect(screen.getByText(/current status/i)).toBeInTheDocument();
  });

  it('shows clock-in button when not clocked in', () => {
    render(<TimeclockPage />);

    expect(screen.getByRole('button', { name: /clock in/i })).toBeInTheDocument();
  });
});

describe('Approvals Page', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: {
        pendingShifts: [],
        approvedShifts: [],
        summary: { pending: 0, approved: 0 },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);
  });

  it('renders heading and description', () => {
    render(<ApprovalsPage />);

    expect(
      screen.getByRole('heading', { name: /timesheet approvals/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/review and approve completed shifts/i)).toBeInTheDocument();
  });

  it('shows pending count card', () => {
    render(<ApprovalsPage />);

    expect(screen.getByText(/pending approval/i)).toBeInTheDocument();
  });

  it('shows approved count card', () => {
    render(<ApprovalsPage />);

    expect(screen.getByText(/approved this week/i)).toBeInTheDocument();
  });
});

describe('Labor Page', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: {
        kpis: {
          plannedHours: 0,
          actualHours: 0,
          overtimeHours: 0,
          laborCostPercentage: 0,
        },
        byRole: [],
        byUser: [],
        auditLogs: [],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);
  });

  it('renders heading and KPI cards', () => {
    render(<LaborPage />);

    expect(
      screen.getByRole('heading', { name: /labor reports/i })
    ).toBeInTheDocument();
  });

  it('shows planned hours KPI', () => {
    render(<LaborPage />);

    expect(screen.getByText(/planned hours/i)).toBeInTheDocument();
  });

  it('shows actual hours KPI', () => {
    render(<LaborPage />);

    expect(screen.getByText(/actual hours/i)).toBeInTheDocument();
  });

  it('shows overtime hours KPI', () => {
    render(<LaborPage />);

    expect(screen.getByText(/overtime hours/i)).toBeInTheDocument();
  });

  it('shows export buttons for L4+ roles', () => {
    render(<LaborPage />);

    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export pdf/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export xlsx/i })).toBeInTheDocument();
  });

  it('shows audit log section for owner (L5)', () => {
    // The global mock provides OWNER role by default, which has sufficient access
    render(<LaborPage />);

    expect(screen.getByText(/audit log/i)).toBeInTheDocument();
  });
});
