/**
 * M11.10: Stocktakes Pages Smoke Tests
 *
 * Smoke tests for M11.10 stocktake v2 UI pages:
 * - /inventory/stocktakes (list)
 * - /inventory/stocktakes/[id] (detail)
 *
 * These tests verify that pages render correctly with mocked data.
 * Covers H8: Tests do not hang (proper cleanup)
 */
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as nextRouter from 'next/router';

// Mock next/router
const mockPush = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: mockPush,
    pathname: '/inventory/stocktakes',
    query: {},
    asPath: '/inventory/stocktakes',
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

// Sample test data
const mockStocktakeSessions = {
  data: [
    {
      id: 'session-1',
      sessionNumber: 'ST-20240115-001',
      name: 'Q1 Full Count',
      status: 'DRAFT',
      blindCount: true,
      totalLines: 50,
      linesWithVariance: 0,
      createdAt: '2024-01-15T10:00:00Z',
      startedAt: null,
      submittedAt: null,
      createdBy: { firstName: 'John', lastName: 'Doe' },
      location: null,
    },
    {
      id: 'session-2',
      sessionNumber: 'ST-20240114-002',
      name: 'Kitchen Count',
      status: 'IN_PROGRESS',
      blindCount: true,
      totalLines: 25,
      linesWithVariance: 5,
      createdAt: '2024-01-14T14:00:00Z',
      startedAt: '2024-01-14T14:30:00Z',
      submittedAt: null,
      createdBy: { firstName: 'Jane', lastName: 'Smith' },
      location: { code: 'KITCHEN', name: 'Kitchen Storage' },
    },
    {
      id: 'session-3',
      sessionNumber: 'ST-20240113-001',
      name: 'Month End Count',
      status: 'POSTED',
      blindCount: false,
      totalLines: 100,
      linesWithVariance: 12,
      createdAt: '2024-01-13T09:00:00Z',
      startedAt: '2024-01-13T09:30:00Z',
      submittedAt: '2024-01-13T12:00:00Z',
      createdBy: { firstName: 'Admin', lastName: 'User' },
      location: { code: 'MAIN', name: 'Main Storage' },
    },
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 3,
    totalPages: 1,
  },
};

const mockStocktakeDetail = {
  id: 'session-1',
  sessionNumber: 'ST-20240115-001',
  name: 'Q1 Full Count',
  description: 'Quarterly stocktake',
  status: 'IN_PROGRESS',
  blindCount: true,
  totalLines: 50,
  linesWithVariance: 3,
  createdAt: '2024-01-15T10:00:00Z',
  startedAt: '2024-01-15T10:30:00Z',
  submittedAt: null,
  approvedAt: null,
  postedAt: null,
  voidedAt: null,
  voidReason: null,
  createdBy: { firstName: 'John', lastName: 'Doe' },
  startedBy: { firstName: 'John', lastName: 'Doe' },
  submittedBy: null,
  approvedBy: null,
  postedBy: null,
  voidedBy: null,
  location: { code: 'MAIN', name: 'Main Storage' },
};

const mockStocktakeLines = [
  {
    id: 'line-1',
    itemId: 'item-1',
    locationId: 'loc-1',
    snapshotQty: '100',
    countedQty: '95',
    variance: '-5',
    notes: null,
    countedAt: '2024-01-15T11:00:00Z',
    item: { id: 'item-1', sku: 'BEEF-001', name: 'Ground Beef' },
    location: { id: 'loc-1', code: 'MAIN', name: 'Main Storage' },
    countedBy: { firstName: 'John', lastName: 'Doe' },
  },
  {
    id: 'line-2',
    itemId: 'item-2',
    locationId: 'loc-1',
    snapshotQty: '50',
    countedQty: null,
    variance: null,
    notes: null,
    countedAt: null,
    item: { id: 'item-2', sku: 'POTATO-001', name: 'Potatoes' },
    location: { id: 'loc-1', code: 'MAIN', name: 'Main Storage' },
    countedBy: null,
  },
];

// Import after mocks are set up
import StocktakesListPage from '@/pages/inventory/stocktakes/index';
import StocktakeDetailPage from '@/pages/inventory/stocktakes/[id]';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('M11.10: Stocktakes List Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/inventory/stocktakes')) {
        return Promise.resolve({ data: mockStocktakeSessions });
      }
      if (url.includes('/inventory/foundation/locations')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: null });
    });
  });

  it('should render page header with title', async () => {
    renderWithProviders(<StocktakesListPage />);

    await waitFor(() => {
      expect(screen.getByText('Stocktakes')).toBeInTheDocument();
    });
  });

  it('should render create button', async () => {
    renderWithProviders(<StocktakesListPage />);

    await waitFor(() => {
      expect(screen.getByTestId('create-stocktake-btn')).toBeInTheDocument();
    });
  });

  it('should render search input', async () => {
    renderWithProviders(<StocktakesListPage />);

    await waitFor(() => {
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });
  });

  it('should render status filter', async () => {
    renderWithProviders(<StocktakesListPage />);

    await waitFor(() => {
      expect(screen.getByTestId('status-filter')).toBeInTheDocument();
    });
  });

  it('should render stocktakes table after loading', async () => {
    renderWithProviders(<StocktakesListPage />);

    await waitFor(() => {
      expect(screen.getByTestId('stocktakes-table')).toBeInTheDocument();
    });
  });

  it('should display session numbers in table', async () => {
    renderWithProviders(<StocktakesListPage />);

    await waitFor(() => {
      expect(screen.getByText('ST-20240115-001')).toBeInTheDocument();
      expect(screen.getByText('ST-20240114-002')).toBeInTheDocument();
    });
  });

  it('should show empty state when no sessions', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/inventory/stocktakes')) {
        return Promise.resolve({ data: { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<StocktakesListPage />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });
});

describe('M11.10: Stocktake Detail Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock router with id parameter
    jest.spyOn(nextRouter, 'useRouter').mockReturnValue({
      push: mockPush,
      pathname: '/inventory/stocktakes/session-1',
      query: { id: 'session-1' },
      asPath: '/inventory/stocktakes/session-1',
    } as unknown as nextRouter.NextRouter);

    // Mock API calls
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/lines')) {
        return Promise.resolve({ data: mockStocktakeLines });
      }
      if (url.includes('/inventory/stocktakes/')) {
        return Promise.resolve({ data: mockStocktakeDetail });
      }
      return Promise.resolve({ data: null });
    });
  });

  it('should render session number as title', async () => {
    renderWithProviders(<StocktakeDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('ST-20240115-001')).toBeInTheDocument();
    });
  });

  it('should render workflow section', async () => {
    renderWithProviders(<StocktakeDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Workflow')).toBeInTheDocument();
    });
  });

  it('should render lines table', async () => {
    renderWithProviders(<StocktakeDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('lines-table')).toBeInTheDocument();
    });
  });

  it('should display item names in lines table', async () => {
    renderWithProviders(<StocktakeDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Ground Beef')).toBeInTheDocument();
      expect(screen.getByText('Potatoes')).toBeInTheDocument();
    });
  });

  it('should show export button for non-DRAFT sessions', async () => {
    renderWithProviders(<StocktakeDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('export-btn')).toBeInTheDocument();
    });
  });

  it('should show submit button for IN_PROGRESS sessions', async () => {
    renderWithProviders(<StocktakeDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
    });
  });
});

describe('M11.10: Tests Cleanup (H8)', () => {
  it('should complete without hanging', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/inventory/stocktakes')) {
        return Promise.resolve({ data: mockStocktakeSessions });
      }
      return Promise.resolve({ data: [] });
    });

    const { unmount } = renderWithProviders(<StocktakesListPage />);

    await waitFor(() => {
      expect(screen.getByText('Stocktakes')).toBeInTheDocument();
    });

    // Unmount should complete without issues
    unmount();
    expect(true).toBe(true);
  });
});
