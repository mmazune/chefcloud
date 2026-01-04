/**
 * M10.6 Payroll Runs UI Tests
 *
 * Tests for Payroll Runs list page, detail page, and create page.
 * Each test verifies page renders with expected elements and role-based actions.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PayrollRunsListPage from '@/pages/workforce/payroll-runs/index';
import PayrollRunDetailPage from '@/pages/workforce/payroll-runs/[id]';
import CreatePayrollRunPage from '@/pages/workforce/payroll-runs/new';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Mock AppShell
jest.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">
      {children}
    </div>
  ),
}));

// Mock react-query
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

// Mock next/router
const mockPush = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/workforce/payroll-runs',
    push: mockPush,
    query: { id: 'test-run-id' },
  }),
}));

// Mock API client
jest.mock('@/lib/api', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue({ data: [] }),
    post: jest.fn().mockResolvedValue({ data: { id: 'new-run' } }),
  },
}));

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;
const mockUseMutation = useMutation as jest.MockedFunction<typeof useMutation>;
const mockUseQueryClient = useQueryClient as jest.MockedFunction<typeof useQueryClient>;

describe('Payroll Runs List Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQueryClient.mockReturnValue({
      invalidateQueries: jest.fn(),
    } as unknown as ReturnType<typeof useQueryClient>);

    mockUseQuery.mockImplementation((options: unknown) => {
      const opts = options as { queryKey: string[] };
      if (opts.queryKey[0] === 'payrollRuns') {
        return {
          data: [
            {
              id: 'run-1',
              status: 'DRAFT',
              regularHours: '40',
              overtimeHours: '5',
              paidHours: '45',
              grossAmount: null,
              createdAt: new Date().toISOString(),
              payPeriod: {
                startDate: '2024-01-01',
                endDate: '2024-01-15',
              },
              branch: { id: 'b1', name: 'Main Branch' },
              _count: { lines: 3 },
            },
            {
              id: 'run-2',
              status: 'POSTED',
              regularHours: '80',
              overtimeHours: '10',
              paidHours: '90',
              grossAmount: '2500.00',
              createdAt: new Date().toISOString(),
              payPeriod: {
                startDate: '2024-01-16',
                endDate: '2024-01-31',
              },
              branch: null,
              _count: { lines: 5 },
            },
          ],
          isLoading: false,
          refetch: jest.fn(),
        } as unknown as ReturnType<typeof useQuery>;
      }
      return {
        data: [],
        isLoading: false,
        refetch: jest.fn(),
      } as unknown as ReturnType<typeof useQuery>;
    });
  });

  describe('as Manager (L4)', () => {
    beforeEach(() => {
      jest.doMock('@/contexts/AuthContext', () => ({
        useAuth: () => ({
          user: { id: 'mgr1', email: 'manager@test.com', roleLevel: 'L4' },
          loading: false,
        }),
      }));
    });

    it('renders page heading', () => {
      jest.isolateModules(() => {
        const { useAuth } = jest.requireMock('@/contexts/AuthContext');
        (useAuth as jest.Mock).mockReturnValue({
          user: { id: 'mgr1', email: 'manager@test.com', roleLevel: 'L4' },
          loading: false,
        });
      });

      render(<PayrollRunsListPage />);
      expect(screen.getByText(/payroll runs/i)).toBeInTheDocument();
    });

    it('renders filter dropdowns', () => {
      render(<PayrollRunsListPage />);
      expect(screen.getByText(/all statuses/i)).toBeInTheDocument();
      expect(screen.getByText(/all branches/i)).toBeInTheDocument();
    });

    it('renders payroll runs table', async () => {
      render(<PayrollRunsListPage />);

      await waitFor(() => {
        expect(screen.getByText('DRAFT')).toBeInTheDocument();
        expect(screen.getByText('POSTED')).toBeInTheDocument();
      });
    });

    it('shows branch names in table', async () => {
      render(<PayrollRunsListPage />);

      await waitFor(() => {
        expect(screen.getByText('Main Branch')).toBeInTheDocument();
        expect(screen.getByText('Org-Wide')).toBeInTheDocument();
      });
    });
  });

  describe('as Staff (L3)', () => {
    beforeEach(() => {
      jest.doMock('@/contexts/AuthContext', () => ({
        useAuth: () => ({
          user: { id: 's1', email: 'staff@test.com', roleLevel: 'L3' },
          loading: false,
        }),
      }));
    });

    it('does not show create button for staff', () => {
      jest.isolateModules(() => {
        const { useAuth } = jest.requireMock('@/contexts/AuthContext');
        (useAuth as jest.Mock).mockReturnValue({
          user: { id: 's1', email: 'staff@test.com', roleLevel: 'L3' },
          loading: false,
        });
      });

      render(<PayrollRunsListPage />);
      expect(screen.queryByText(/create payroll run/i)).not.toBeInTheDocument();
    });
  });
});

describe('Payroll Run Detail Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQueryClient.mockReturnValue({
      invalidateQueries: jest.fn(),
    } as unknown as ReturnType<typeof useQueryClient>);

    mockUseMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useMutation>);

    mockUseQuery.mockReturnValue({
      data: {
        id: 'run-1',
        status: 'CALCULATED',
        regularHours: '120',
        overtimeHours: '15',
        breakHours: '5',
        paidHours: '130',
        grossAmount: '3250.00',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        payPeriod: {
          id: 'pp1',
          startDate: '2024-01-01',
          endDate: '2024-01-15',
          locked: false,
        },
        branch: { id: 'b1', name: 'Main Branch' },
        createdBy: { email: 'manager@test.com' },
        approvedBy: null,
        postedBy: null,
        paidBy: null,
        voidedBy: null,
        lines: [
          {
            id: 'line-1',
            regularHours: '40',
            overtimeHours: '5',
            breakHours: '2',
            paidHours: '43',
            hourlyRate: '25.00',
            grossAmount: '1100.00',
            user: { id: 'u1', email: 'emp1@test.com', name: 'John Doe' },
          },
          {
            id: 'line-2',
            regularHours: '40',
            overtimeHours: '10',
            breakHours: '3',
            paidHours: '47',
            hourlyRate: '30.00',
            grossAmount: '1500.00',
            user: { id: 'u2', email: 'emp2@test.com', name: 'Jane Smith' },
          },
        ],
        journalLinks: [],
      },
      isLoading: false,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useQuery>);
  });

  describe('as Owner (L5)', () => {
    beforeEach(() => {
      jest.doMock('@/contexts/AuthContext', () => ({
        useAuth: () => ({
          user: { id: 'owner1', email: 'owner@test.com', roleLevel: 'L5' },
          loading: false,
        }),
      }));
    });

    it('renders page heading with status', () => {
      render(<PayrollRunDetailPage />);
      expect(screen.getByText('Payroll Run')).toBeInTheDocument();
      expect(screen.getByText('CALCULATED')).toBeInTheDocument();
    });

    it('shows summary cards', () => {
      render(<PayrollRunDetailPage />);
      expect(screen.getByText('Employees')).toBeInTheDocument();
      expect(screen.getByText('Regular Hours')).toBeInTheDocument();
      expect(screen.getByText('Overtime Hours')).toBeInTheDocument();
      expect(screen.getByText('Total Paid Hours')).toBeInTheDocument();
    });

    it('shows employee line items table', async () => {
      render(<PayrollRunDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('shows approve action button for CALCULATED status', () => {
      render(<PayrollRunDetailPage />);
      expect(screen.getByText('Approve')).toBeInTheDocument();
    });

    it('shows back link', () => {
      render(<PayrollRunDetailPage />);
      expect(screen.getByText(/back to payroll runs/i)).toBeInTheDocument();
    });
  });

  describe('as Manager (L4) with APPROVED status', () => {
    beforeEach(() => {
      jest.doMock('@/contexts/AuthContext', () => ({
        useAuth: () => ({
          user: { id: 'mgr1', email: 'manager@test.com', roleLevel: 'L4' },
          loading: false,
        }),
      }));

      mockUseQuery.mockReturnValue({
        data: {
          id: 'run-2',
          status: 'APPROVED',
          regularHours: '80',
          overtimeHours: '10',
          breakHours: '4',
          paidHours: '86',
          grossAmount: '2150.00',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          payPeriod: {
            id: 'pp2',
            startDate: '2024-01-16',
            endDate: '2024-01-31',
            locked: false,
          },
          branch: null,
          createdBy: { email: 'manager@test.com' },
          approvedBy: { email: 'manager@test.com' },
          postedBy: null,
          paidBy: null,
          voidedBy: null,
          lines: [],
          journalLinks: [],
        },
        isLoading: false,
        refetch: jest.fn(),
      } as unknown as ReturnType<typeof useQuery>);
    });

    it('does not show Post button for manager (L4)', () => {
      render(<PayrollRunDetailPage />);
      // Manager (L4) cannot post - need L5
      expect(screen.queryByText('Post to GL')).not.toBeInTheDocument();
    });
  });
});

describe('Create Payroll Run Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useMutation>);

    mockUseQuery.mockImplementation((options: unknown) => {
      const opts = options as { queryKey: string[] };
      if (opts.queryKey[0] === 'payPeriods') {
        return {
          data: [
            { id: 'pp1', startDate: '2024-01-01', endDate: '2024-01-15', locked: false },
            { id: 'pp2', startDate: '2024-01-16', endDate: '2024-01-31', locked: true },
          ],
          isLoading: false,
        } as unknown as ReturnType<typeof useQuery>;
      }
      if (opts.queryKey[0] === 'branches') {
        return {
          data: [
            { id: 'b1', name: 'Downtown' },
            { id: 'b2', name: 'Uptown' },
          ],
          isLoading: false,
        } as unknown as ReturnType<typeof useQuery>;
      }
      return {
        data: [],
        isLoading: false,
      } as unknown as ReturnType<typeof useQuery>;
    });
  });

  describe('as Manager (L4)', () => {
    beforeEach(() => {
      jest.doMock('@/contexts/AuthContext', () => ({
        useAuth: () => ({
          user: { id: 'mgr1', email: 'manager@test.com', roleLevel: 'L4' },
          loading: false,
        }),
      }));
    });

    it('renders page heading', () => {
      render(<CreatePayrollRunPage />);
      expect(screen.getByText(/create payroll run/i)).toBeInTheDocument();
    });

    it('shows pay period dropdown', () => {
      render(<CreatePayrollRunPage />);
      expect(screen.getByText(/pay period/i)).toBeInTheDocument();
      expect(screen.getByText(/select a pay period/i)).toBeInTheDocument();
    });

    it('shows branch dropdown', () => {
      render(<CreatePayrollRunPage />);
      expect(screen.getByText(/branch/i)).toBeInTheDocument();
      expect(screen.getByText(/org-wide/i)).toBeInTheDocument();
    });

    it('shows submit button', () => {
      render(<CreatePayrollRunPage />);
      expect(screen.getByRole('button', { name: /create payroll run/i })).toBeInTheDocument();
    });

    it('shows workflow explanation', () => {
      render(<CreatePayrollRunPage />);
      expect(screen.getByText(/what happens next/i)).toBeInTheDocument();
      expect(screen.getByText(/click.*calculate/i)).toBeInTheDocument();
    });
  });
});
