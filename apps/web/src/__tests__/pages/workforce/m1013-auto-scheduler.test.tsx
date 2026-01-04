/**
 * M10.13 Auto-Scheduler UI Tests
 *
 * Tests for Auto-Scheduler page including:
 * - Page renders with expected elements
 * - RBAC enforcement (L4+ write, L3+ read)
 * - Generate/Apply/Void button states
 * - Suggestions table display
 * - Impact report display
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AutoSchedulerPage from '@/pages/workforce/auto-scheduler';

// Mock next/router
const mockPush = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/workforce/auto-scheduler',
    push: mockPush,
    query: {},
  }),
}));

// Mock API client
const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

// Helper to create query client wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// ===== Access Denied Tests =====
describe('Auto-Scheduler Page - Access Control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ data: [] });
  });

  it('should show access denied for L1 users', async () => {
    // Mock L1 user
    jest.doMock('@/contexts/AuthContext', () => ({
      useAuth: () => ({
        user: {
          id: 'user-1',
          email: 'waiter@test.com',
          displayName: 'Waiter',
          roleLevel: 'L1',
          org: { id: 'org-1', name: 'Test Org' },
        },
        loading: false,
        error: null,
      }),
    }));

    render(<AutoSchedulerPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
    });
  });

  it('should show access denied for L2 users', async () => {
    // Mock L2 user
    jest.doMock('@/contexts/AuthContext', () => ({
      useAuth: () => ({
        user: {
          id: 'user-2',
          email: 'hostess@test.com',
          displayName: 'Hostess',
          roleLevel: 'L2',
          org: { id: 'org-1', name: 'Test Org' },
        },
        loading: false,
        error: null,
      }),
    }));

    render(<AutoSchedulerPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
    });
  });
});

// ===== L3 User Tests (Read-Only) =====
describe('Auto-Scheduler Page - L3 User (Read Access)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock L3 user
    jest.doMock('@/contexts/AuthContext', () => ({
      useAuth: () => ({
        user: {
          id: 'chef-1',
          email: 'chef@test.com',
          displayName: 'Chef',
          roleLevel: 'L3',
          org: { id: 'org-1', name: 'Test Org' },
          branchId: 'branch-1',
        },
        loading: false,
        error: null,
      }),
    }));

    // Mock branches
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/orgs/branches')) {
        return Promise.resolve({
          data: [{ id: 'branch-1', name: 'Downtown' }],
        });
      }
      if (url.includes('/auto-schedule?')) {
        return Promise.resolve({
          data: {
            id: 'run-1',
            date: '2025-01-05',
            status: 'DRAFT',
            inputsHash: 'abc123',
            generatedAt: '2025-01-04T12:00:00Z',
            suggestions: [
              {
                id: 'sug-1',
                roleKey: 'WAITER',
                startAt: '2025-01-05T10:00:00Z',
                endAt: '2025-01-05T14:00:00Z',
                headcount: 2,
                candidateUserIds: ['user-1', 'user-2'],
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: null });
    });
  });

  it('should render page title', async () => {
    render(<AutoSchedulerPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Auto-Scheduler')).toBeInTheDocument();
    });
  });

  it('should show date picker', async () => {
    render(<AutoSchedulerPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText(/Date:/i)).toBeInTheDocument();
    });
  });

  it('should show Generate button as disabled for L3', async () => {
    render(<AutoSchedulerPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      const generateBtn = screen.getByRole('button', { name: /Generate Suggestions/i });
      expect(generateBtn).toBeDisabled();
    });
  });
});

// ===== L4 User Tests (Write Access) =====
describe('Auto-Scheduler Page - L4 User (Write Access)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock L4 user
    jest.doMock('@/contexts/AuthContext', () => ({
      useAuth: () => ({
        user: {
          id: 'manager-1',
          email: 'manager@test.com',
          displayName: 'Manager',
          roleLevel: 'L4',
          org: { id: 'org-1', name: 'Test Org' },
          branchId: 'branch-1',
        },
        loading: false,
        error: null,
      }),
    }));

    // Mock branches
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/orgs/branches')) {
        return Promise.resolve({
          data: [{ id: 'branch-1', name: 'Downtown' }],
        });
      }
      return Promise.resolve({ data: null });
    });
  });

  it('should show Generate button as enabled for L4', async () => {
    render(<AutoSchedulerPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      const generateBtn = screen.getByRole('button', { name: /Generate Suggestions/i });
      expect(generateBtn).toBeEnabled();
    });
  });

  it('should call generate API on button click', async () => {
    mockPost.mockResolvedValue({
      data: {
        id: 'run-1',
        status: 'DRAFT',
        suggestions: [],
      },
    });

    render(<AutoSchedulerPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      const generateBtn = screen.getByRole('button', { name: /Generate Suggestions/i });
      fireEvent.click(generateBtn);
    });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining('/workforce/planning/auto-schedule/generate'),
      );
    });
  });
});

// ===== Suggestions Table Tests =====
describe('Auto-Scheduler Page - Suggestions Display', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock L4 user
    jest.doMock('@/contexts/AuthContext', () => ({
      useAuth: () => ({
        user: {
          id: 'manager-1',
          email: 'manager@test.com',
          displayName: 'Manager',
          roleLevel: 'L4',
          org: { id: 'org-1', name: 'Test Org' },
          branchId: 'branch-1',
        },
        loading: false,
        error: null,
      }),
    }));

    // Mock run with suggestions
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/orgs/branches')) {
        return Promise.resolve({
          data: [{ id: 'branch-1', name: 'Downtown' }],
        });
      }
      if (url.includes('/auto-schedule?')) {
        return Promise.resolve({
          data: {
            id: 'run-1',
            date: '2025-01-05',
            status: 'DRAFT',
            inputsHash: 'abc123',
            generatedAt: '2025-01-04T12:00:00Z',
            suggestions: [
              {
                id: 'sug-1',
                roleKey: 'WAITER',
                startAt: '2025-01-05T10:00:00Z',
                endAt: '2025-01-05T14:00:00Z',
                headcount: 2,
                candidateUserIds: ['user-1', 'user-2'],
              },
              {
                id: 'sug-2',
                roleKey: 'COOK',
                startAt: '2025-01-05T08:00:00Z',
                endAt: '2025-01-05T16:00:00Z',
                headcount: 1,
                candidateUserIds: ['user-3'],
              },
            ],
          },
        });
      }
      if (url.includes('/impact')) {
        return Promise.resolve({
          data: {
            summary: {
              totalDemand: 10,
              totalCoverageBefore: 2,
              totalCoverageAfter: 8,
              varianceBefore: -8,
              varianceAfter: -2,
              improvementPct: 75,
            },
            residualGaps: [
              { hour: 12, roleKey: 'WAITER', varianceAfter: -1 },
            ],
          },
        });
      }
      return Promise.resolve({ data: null });
    });
  });

  it('should render suggestions table with role column', async () => {
    render(<AutoSchedulerPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Shift Suggestions')).toBeInTheDocument();
      expect(screen.getByText('WAITER')).toBeInTheDocument();
      expect(screen.getByText('COOK')).toBeInTheDocument();
    });
  });

  it('should show Apply button for DRAFT status', async () => {
    render(<AutoSchedulerPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Apply Schedule/i })).toBeInTheDocument();
    });
  });

  it('should show Void button for DRAFT status', async () => {
    render(<AutoSchedulerPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Void/i })).toBeInTheDocument();
    });
  });

  it('should display run status badge', async () => {
    render(<AutoSchedulerPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('DRAFT')).toBeInTheDocument();
    });
  });

  it('should display stats cards', async () => {
    render(<AutoSchedulerPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Shift Blocks')).toBeInTheDocument();
      expect(screen.getByText('Total Positions')).toBeInTheDocument();
      expect(screen.getByText('Residual Gaps')).toBeInTheDocument();
    });
  });
});

// ===== Empty State Tests =====
describe('Auto-Scheduler Page - Empty State', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock L4 user
    jest.doMock('@/contexts/AuthContext', () => ({
      useAuth: () => ({
        user: {
          id: 'manager-1',
          email: 'manager@test.com',
          displayName: 'Manager',
          roleLevel: 'L4',
          org: { id: 'org-1', name: 'Test Org' },
          branchId: 'branch-1',
        },
        loading: false,
        error: null,
      }),
    }));

    // Mock no run exists
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/orgs/branches')) {
        return Promise.resolve({
          data: [{ id: 'branch-1', name: 'Downtown' }],
        });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  it('should show empty state when no run exists', async () => {
    render(<AutoSchedulerPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No Auto-Schedule Run')).toBeInTheDocument();
    });
  });
});
