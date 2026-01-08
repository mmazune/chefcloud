/**
 * M12.6 Close Ops UX Pages - UI Smoke Tests
 *
 * Verifies the close requests and period dashboard pages render without errors
 * and show core UI elements.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CloseRequestsPage from '../src/pages/inventory/close-requests';
import PeriodDashboardPage from '../src/pages/inventory/period-dashboard';

// Mock next/router
vi.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/',
    query: {},
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock the API client
vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/inventory/periods/close-requests')) {
        return Promise.resolve({
          data: [
            {
              id: 'req-1',
              periodId: 'period-1',
              status: 'SUBMITTED',
              requestedAt: '2026-01-15T10:00:00.000Z',
              approvedAt: null,
              rejectedAt: null,
              rejectionReason: null,
              period: {
                id: 'period-1',
                startDate: '2026-01-01T00:00:00.000Z',
                endDate: '2026-01-31T23:59:59.999Z',
                branch: { name: 'Downtown' },
              },
              requestedByUser: { firstName: 'John', lastName: 'Doe' },
            },
            {
              id: 'req-2',
              periodId: 'period-2',
              status: 'APPROVED',
              requestedAt: '2026-01-10T10:00:00.000Z',
              approvedAt: '2026-01-11T10:00:00.000Z',
              rejectedAt: null,
              rejectionReason: null,
              period: {
                id: 'period-2',
                startDate: '2025-12-01T00:00:00.000Z',
                endDate: '2025-12-31T23:59:59.999Z',
                branch: { name: 'Uptown' },
              },
              requestedByUser: { firstName: 'Jane', lastName: 'Doe' },
              approvedByUser: { firstName: 'Admin', lastName: 'User' },
            },
          ],
        });
      }
      if (url.includes('/inventory/periods/dashboard')) {
        return Promise.resolve({
          data: {
            summary: {
              totalBranches: 3,
              healthyCount: 2,
              warningCount: 1,
              criticalCount: 0,
              pendingRequests: 1,
            },
            rows: [
              {
                branchId: 'branch-1',
                branchName: 'Downtown',
                healthStatus: 'HEALTHY',
                daysSinceLastClose: 15,
                lastCloseDate: '2026-01-01T00:00:00.000Z',
                openPeriodCount: 1,
                pendingCloseRequests: 0,
                precloseStatus: 'READY',
              },
              {
                branchId: 'branch-2',
                branchName: 'Uptown',
                healthStatus: 'WARNING',
                daysSinceLastClose: 35,
                lastCloseDate: '2025-12-01T00:00:00.000Z',
                openPeriodCount: 2,
                pendingCloseRequests: 1,
                precloseStatus: 'NEEDS_ATTENTION',
              },
            ],
          },
        });
      }
      if (url.includes('/branches')) {
        return Promise.resolve({
          data: [
            { id: 'branch-1', name: 'Downtown' },
            { id: 'branch-2', name: 'Uptown' },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { orgId: 'org-1', role: 'OWNER', roleLevel: 'L5' },
    loading: false,
    isAuthenticated: true,
  }),
}));

// Mock Layout component
vi.mock('@/components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

// Test wrapper with query client
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('M12.6 Close Requests Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title', async () => {
    render(<CloseRequestsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('heading')).toBeInTheDocument();
    });
  });

  it('renders branch filter select', async () => {
    render(<CloseRequestsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText(/branch/i)).toBeInTheDocument();
    });
  });

  it('renders status filter select', async () => {
    render(<CloseRequestsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    });
  });

  it('renders export CSV button', async () => {
    render(<CloseRequestsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
    });
  });

  it('renders data table with requests', async () => {
    render(<CloseRequestsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  it('shows approve/reject buttons for SUBMITTED requests', async () => {
    render(<CloseRequestsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /approve/i }).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByRole('button', { name: /reject/i }).length).toBeGreaterThan(0);
  });

  it('opens approve dialog on button click', async () => {
    render(<CloseRequestsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /approve/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /approve/i })[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('opens reject dialog on button click', async () => {
    render(<CloseRequestsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /reject/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /reject/i })[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});

describe('M12.6 Period Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title', async () => {
    render(<PeriodDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('heading')).toBeInTheDocument();
    });
  });

  it('renders summary cards', async () => {
    render(<PeriodDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/total branches/i)).toBeInTheDocument();
    });
  });

  it('renders healthy count in summary', async () => {
    render(<PeriodDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/healthy/i)).toBeInTheDocument();
    });
  });

  it('renders warning count in summary', async () => {
    render(<PeriodDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/warning/i)).toBeInTheDocument();
    });
  });

  it('renders branch data table', async () => {
    render(<PeriodDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  it('shows branch names in table', async () => {
    render(<PeriodDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Downtown')).toBeInTheDocument();
      expect(screen.getByText('Uptown')).toBeInTheDocument();
    });
  });

  it('shows health status indicators', async () => {
    render(<PeriodDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      const healthyIndicators = screen.getAllByText(/healthy/i);
      expect(healthyIndicators.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows days since last close', async () => {
    render(<PeriodDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/15 days/i)).toBeInTheDocument();
    });
  });

  it('shows preclose status indicators', async () => {
    render(<PeriodDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/ready/i)).toBeInTheDocument();
    });
  });
});
