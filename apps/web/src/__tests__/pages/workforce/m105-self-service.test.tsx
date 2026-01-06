/**
 * M10.5 Workforce Self-Service UI Smoke Tests
 * 
 * Tests for My Schedule, My Time, and My Timesheet pages.
 * Each test verifies page renders with expected elements.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import MySchedulePage from '@/pages/workforce/my-schedule';
import MyTimePage from '@/pages/workforce/my-time';
import MyTimesheetPage from '@/pages/workforce/my-timesheet';
import { useQuery, useMutation } from '@tanstack/react-query';

// Mock AppShell to avoid context providers
jest.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children, title }: { children: React.ReactNode, title: string }) => (
    <div data-testid="app-shell" data-title={title}>{children}</div>
  ),
}));

// Mock useQuery
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
}));

// Mock useAuth - staff role (L2)
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'test-staff-id',
      email: 'waiter@test.com',
      roleLevel: 2,
      branchId: 'test-branch-id',
    },
    isLoading: false,
  }),
}));

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/workforce/my-schedule',
    push: jest.fn(),
    query: {},
  }),
}));

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;
const mockUseMutation = useMutation as jest.MockedFunction<typeof useMutation>;

describe('My Schedule Page', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'shift-1',
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          role: 'WAITER',
          status: 'PUBLISHED',
          branch: { name: 'Main Branch' },
        },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useQuery>);
  });

  it('renders page heading', () => {
    render(<MySchedulePage />);

    expect(
      screen.getByRole('heading', { name: /my schedule/i })
    ).toBeInTheDocument();
  });

  it('shows date range filter', () => {
    render(<MySchedulePage />);

    expect(screen.getByLabelText(/from/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/to/i)).toBeInTheDocument();
  });

  it('renders upcoming shifts section', async () => {
    render(<MySchedulePage />);

    await waitFor(() => {
      expect(screen.getByText(/upcoming shifts/i)).toBeInTheDocument();
    });
  });

  it('shows shift details in list', async () => {
    render(<MySchedulePage />);

    await waitFor(() => {
      expect(screen.getByText(/WAITER/i)).toBeInTheDocument();
      expect(screen.getByText(/Main Branch/i)).toBeInTheDocument();
    });
  });
});

describe('My Time Page', () => {
  beforeEach(() => {
    // Mock clock status
    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'clockStatus') {
        return {
          data: {
            isClockedIn: false,
            isOnBreak: false,
            currentEntry: null,
          },
          isLoading: false,
          error: null,
          refetch: jest.fn(),
        } as unknown as ReturnType<typeof useQuery>;
      }
      // time entries
      return {
        data: [
          {
            id: 'entry-1',
            clockInAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            clockOutAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            approved: true,
            breaks: [],
          },
        ],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      } as unknown as ReturnType<typeof useQuery>;
    });
  });

  it('renders page heading', () => {
    render(<MyTimePage />);

    expect(
      screen.getByRole('heading', { name: /my time/i })
    ).toBeInTheDocument();
  });

  it('shows clock status card', () => {
    render(<MyTimePage />);

    expect(screen.getByText(/clock status/i)).toBeInTheDocument();
  });

  it('shows clocked out status when not clocked in', () => {
    render(<MyTimePage />);

    expect(screen.getByText(/clocked out/i)).toBeInTheDocument();
  });

  it('renders time entries section', async () => {
    render(<MyTimePage />);

    await waitFor(() => {
      expect(screen.getByText(/recent entries/i)).toBeInTheDocument();
    });
  });
});

describe('My Timesheet Page', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: {
        regularMinutes: 2400,
        overtimeMinutes: 120,
        breakMinutes: 60,
        paidMinutes: 2520,
        approvalStatus: 'PENDING',
        isLocked: false,
        entryCount: 5,
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useQuery>);

    mockUseMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useMutation>);
  });

  it('renders page heading', () => {
    render(<MyTimesheetPage />);

    expect(
      screen.getByRole('heading', { name: /my timesheet/i })
    ).toBeInTheDocument();
  });

  it('shows timesheet totals', async () => {
    render(<MyTimesheetPage />);

    await waitFor(() => {
      expect(screen.getByText(/regular hours/i)).toBeInTheDocument();
      expect(screen.getByText(/overtime/i)).toBeInTheDocument();
    });
  });

  it('shows computed hour values', async () => {
    render(<MyTimesheetPage />);

    await waitFor(() => {
      // 2400 minutes = 40 hours
      expect(screen.getByText(/40/)).toBeInTheDocument();
    });
  });

  it('shows approval status', async () => {
    render(<MyTimesheetPage />);

    await waitFor(() => {
      expect(screen.getByText(/pending/i)).toBeInTheDocument();
    });
  });

  it('shows unlocked indicator when period open', async () => {
    render(<MyTimesheetPage />);

    await waitFor(() => {
      // Should show unlocked status
      expect(screen.queryByText(/locked/i)).not.toBeInTheDocument();
    });
  });

  it('renders pay period selector', () => {
    render(<MyTimesheetPage />);

    expect(screen.getByText(/pay period/i)).toBeInTheDocument();
  });
});
