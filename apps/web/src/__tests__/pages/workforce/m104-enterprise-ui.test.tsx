/**
 * M10.4 Workforce Enterprise UI Smoke Tests
 *
 * Tests for Policies, Pay Periods, Timesheets, and Payroll Export pages.
 * Each test verifies page renders with expected elements for role-appropriate access.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import PoliciesPage from '@/pages/workforce/policies';
import PayPeriodsPage from '@/pages/workforce/pay-periods';
import TimesheetsPage from '@/pages/workforce/timesheets';
import PayrollExportPage from '@/pages/workforce/payroll-export';
import { useQuery, useMutation } from '@tanstack/react-query';

// Mock useQuery and useMutation
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
  })),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
  })),
}));

// Mock useAuth for L4+ role
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-id',
      email: 'manager@test.com',
      roleLevel: 'L4',
      orgId: 'test-org-id',
    },
    isLoading: false,
  }),
}));

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/workforce/policies',
    push: jest.fn(),
    query: {},
  }),
}));

// Mock toast
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;
const mockUseMutation = useMutation as jest.MockedFunction<typeof useMutation>;

describe('Policies Page (M10.4)', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: {
        id: 'policy-1',
        orgId: 'test-org-id',
        dailyOtThresholdMinutes: 480,
        weeklyOtThresholdMinutes: 2400,
        roundingMode: 'NEAREST_15',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);
    mockUseMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as any);
  });

  it('renders heading and description', () => {
    render(<PoliciesPage />);

    expect(
      screen.getByRole('heading', { name: /workforce policies/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/configure overtime thresholds/i)).toBeInTheDocument();
  });

  it('shows daily OT threshold input', () => {
    render(<PoliciesPage />);

    expect(screen.getByLabelText(/daily overtime threshold/i)).toBeInTheDocument();
  });

  it('shows weekly OT threshold input', () => {
    render(<PoliciesPage />);

    expect(screen.getByLabelText(/weekly overtime threshold/i)).toBeInTheDocument();
  });

  it('shows rounding mode selector', () => {
    render(<PoliciesPage />);

    expect(screen.getByLabelText(/time rounding mode/i)).toBeInTheDocument();
  });

  it('shows save button', () => {
    render(<PoliciesPage />);

    expect(screen.getByRole('button', { name: /save policy/i })).toBeInTheDocument();
  });
});

describe('Pay Periods Page (M10.4)', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'period-1',
          orgId: 'test-org-id',
          startDate: '2024-01-01',
          endDate: '2024-01-14',
          status: 'OPEN',
          closedAt: null,
        },
        {
          id: 'period-2',
          orgId: 'test-org-id',
          startDate: '2024-01-15',
          endDate: '2024-01-28',
          status: 'CLOSED',
          closedAt: '2024-01-29T00:00:00.000Z',
        },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);
    mockUseMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as any);
  });

  it('renders heading and description', () => {
    render(<PayPeriodsPage />);

    expect(
      screen.getByRole('heading', { name: /pay periods/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/manage payroll periods/i)).toBeInTheDocument();
  });

  it('shows generate periods button for L4+', () => {
    render(<PayPeriodsPage />);

    expect(screen.getByRole('button', { name: /generate periods/i })).toBeInTheDocument();
  });

  it('shows open and closed period counts', () => {
    render(<PayPeriodsPage />);

    expect(screen.getByText(/open periods/i)).toBeInTheDocument();
    expect(screen.getByText(/closed periods/i)).toBeInTheDocument();
  });

  it('shows status filter', () => {
    render(<PayPeriodsPage />);

    expect(screen.getByText(/all statuses/i)).toBeInTheDocument();
  });

  it('renders periods table', () => {
    render(<PayPeriodsPage />);

    expect(screen.getByText(/start date/i)).toBeInTheDocument();
    expect(screen.getByText(/end date/i)).toBeInTheDocument();
  });
});

describe('Timesheets Page (M10.4)', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'approval-1',
          userId: 'user-1',
          status: 'PENDING',
          totalMinutes: 2400,
          regularMinutes: 2400,
          overtimeMinutes: 0,
          user: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
          payPeriod: { id: 'period-1', startDate: '2024-01-01', endDate: '2024-01-14' },
        },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);
    mockUseMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as any);
  });

  it('renders heading and description', () => {
    render(<TimesheetsPage />);

    expect(
      screen.getByRole('heading', { name: /timesheet approvals/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/review and approve employee timesheets/i)).toBeInTheDocument();
  });

  it('shows pending review count', () => {
    render(<TimesheetsPage />);

    expect(screen.getByText(/pending review/i)).toBeInTheDocument();
  });

  it('shows approve selected button', () => {
    render(<TimesheetsPage />);

    expect(screen.getByRole('button', { name: /approve selected/i })).toBeInTheDocument();
  });

  it('shows reject selected button', () => {
    render(<TimesheetsPage />);

    expect(screen.getByRole('button', { name: /reject selected/i })).toBeInTheDocument();
  });

  it('renders employee column in table', () => {
    render(<TimesheetsPage />);

    expect(screen.getByText(/employee/i)).toBeInTheDocument();
  });
});

describe('Payroll Export Page (M10.4)', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'period-1',
          startDate: '2024-01-01',
          endDate: '2024-01-14',
          status: 'CLOSED',
        },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);
    mockUseMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as any);
  });

  it('renders heading and description', () => {
    render(<PayrollExportPage />);

    expect(
      screen.getByRole('heading', { name: /payroll export/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/export approved timesheets/i)).toBeInTheDocument();
  });

  it('shows select pay period label', () => {
    render(<PayrollExportPage />);

    expect(screen.getByText(/select pay period/i)).toBeInTheDocument();
  });

  it('shows period dropdown', () => {
    render(<PayrollExportPage />);

    expect(screen.getByText(/select a period/i)).toBeInTheDocument();
  });

  it('shows generate export button', () => {
    render(<PayrollExportPage />);

    expect(screen.getByRole('button', { name: /generate export/i })).toBeInTheDocument();
  });
});

// RBAC tests - verify L3 users see appropriate UI
describe('RBAC: L3 User Access', () => {
  beforeEach(() => {
    // Reset to L3 (Supervisor)
    jest.doMock('@/contexts/AuthContext', () => ({
      useAuth: () => ({
        user: {
          id: 'test-user-id',
          email: 'supervisor@test.com',
          roleLevel: 'L3',
          orgId: 'test-org-id',
        },
        isLoading: false,
      }),
    }));
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);
  });

  it('Timesheets page allows L3 access', () => {
    // L3 should be able to view timesheets page
    render(<TimesheetsPage />);
    expect(screen.getByRole('heading', { name: /timesheet approvals/i })).toBeInTheDocument();
  });
});
