/**
 * M11.1: Inventory Pages Smoke Tests
 *
 * Smoke tests for M11.1 inventory foundation UI pages:
 * - /inventory/items
 * - /inventory/locations
 * - /inventory/on-hand
 * - /inventory/adjustments
 *
 * These tests verify that pages render correctly with mocked data.
 */
import { render, screen } from '@testing-library/react';

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/inventory/items',
    query: {},
    asPath: '/inventory/items',
  }),
}));

// Mock the API client
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    patch: (...args: any[]) => mockPatch(...args),
  },
}));

// Mock auth context
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      orgId: 'test-org-id',
      branchId: 'test-branch-id',
      roleLevel: 'L4',
      jobRole: 'MANAGER',
    },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

// Mock TanStack Query
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn().mockImplementation(({ queryKey }) => {
    if (queryKey[0] === 'inventory-items') {
      return {
        data: [
          { id: '1', sku: 'BEEF-001', name: 'Ground Beef', unit: 'kg', category: 'Meat', reorderLevel: 10, isActive: true },
          { id: '2', sku: 'POTATO-001', name: 'Potatoes', unit: 'kg', category: 'Produce', reorderLevel: 20, isActive: true },
        ],
        isLoading: false,
        error: null,
      };
    }
    if (queryKey[0] === 'inventory-locations') {
      return {
        data: [
          { id: 'loc-1', code: 'MAIN', name: 'Main Storage', type: 'STORAGE', isActive: true, isDefaultReceiving: true },
          { id: 'loc-2', code: 'KITCHEN', name: 'Kitchen', type: 'KITCHEN', isActive: true, isDefaultReceiving: false },
        ],
        isLoading: false,
        error: null,
      };
    }
    if (queryKey[0] === 'inventory-on-hand') {
      return {
        data: [
          { itemId: '1', itemName: 'Ground Beef', itemSku: 'BEEF-001', locationId: 'loc-1', locationName: 'Main Storage', onHand: 50, uom: 'kg' },
          { itemId: '2', itemName: 'Potatoes', itemSku: 'POTATO-001', locationId: 'loc-1', locationName: 'Main Storage', onHand: 100, uom: 'kg' },
        ],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      };
    }
    if (queryKey[0] === 'stock-adjustments') {
      return {
        data: [
          { id: 'adj-1', reason: 'ADJUSTMENT', status: 'APPROVED', itemName: 'Ground Beef', locationName: 'Main Storage', qtyDelta: 10, createdAt: '2025-01-01T00:00:00Z', createdByName: 'Test User' },
        ],
        isLoading: false,
        error: null,
      };
    }
    return { data: [], isLoading: false, error: null };
  }),
  useMutation: jest.fn().mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
    isError: false,
  }),
  useQueryClient: jest.fn().mockReturnValue({
    invalidateQueries: jest.fn(),
  }),
}));

// Mock the layout components
jest.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: any) => <div data-testid="app-shell">{children}</div>,
}));

jest.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title, subtitle, actions }: any) => (
    <header data-testid="page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {actions && <div data-testid="page-header-actions">{actions}</div>}
    </header>
  ),
}));

// Mock UI components
jest.mock('@/components/ui/data-table', () => ({
  DataTable: ({ data }: any) => (
    <table data-testid="data-table">
      <tbody>
        {data?.map((row: any, idx: number) => (
          <tr key={idx} data-testid={`table-row-${idx}`}>
            <td>{row.name || row.itemName || row.code || 'N/A'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => <span data-testid="badge" data-variant={variant}>{children}</span>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, 'data-testid': dataTestId, ...props }: any) => (
    <button onClick={onClick} data-testid={dataTestId} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange, ...props }: any) => (
    <select value={value} onChange={(e) => onValueChange?.(e.target.value)} {...props}>
      {children}
    </select>
  ),
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
}));

jest.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />,
}));

// Import pages after mocks
import InventoryItemsPage from '../../../pages/inventory/items';
import InventoryLocationsPage from '../../../pages/inventory/locations';
import OnHandPage from '../../../pages/inventory/on-hand';
import AdjustmentsPage from '../../../pages/inventory/adjustments';

describe('M11.1 Inventory Items Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the page with header and table', async () => {
    render(<InventoryItemsPage />);

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('page-header')).toBeInTheDocument();
    expect(screen.getByText('Inventory Items')).toBeInTheDocument();
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
  });

  it('displays the create item button', () => {
    render(<InventoryItemsPage />);

    expect(screen.getByTestId('create-item-btn')).toBeInTheDocument();
  });

  it('has a search input', () => {
    render(<InventoryItemsPage />);

    expect(screen.getByTestId('item-search-input')).toBeInTheDocument();
  });

  it('shows stats cards', () => {
    render(<InventoryItemsPage />);

    expect(screen.getByText('Total Items')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });
});

describe('M11.1 Inventory Locations Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the page with header', async () => {
    render(<InventoryLocationsPage />);

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByText('Inventory Locations')).toBeInTheDocument();
  });

  it('displays the create location button', () => {
    render(<InventoryLocationsPage />);

    expect(screen.getByTestId('create-location-btn')).toBeInTheDocument();
  });

  it('has a search input', () => {
    render(<InventoryLocationsPage />);

    expect(screen.getByTestId('location-search-input')).toBeInTheDocument();
  });

  it('renders the locations table', () => {
    render(<InventoryLocationsPage />);

    expect(screen.getByTestId('data-table')).toBeInTheDocument();
  });
});

describe('M11.1 On-Hand Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the page with header', async () => {
    render(<OnHandPage />);

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByText('On-Hand Inventory')).toBeInTheDocument();
  });

  it('displays export and refresh buttons', () => {
    render(<OnHandPage />);

    expect(screen.getByTestId('export-btn')).toBeInTheDocument();
    expect(screen.getByTestId('refresh-btn')).toBeInTheDocument();
  });

  it('has search and location filter', () => {
    render(<OnHandPage />);

    expect(screen.getByTestId('on-hand-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('location-filter-select')).toBeInTheDocument();
  });

  it('shows stats cards', () => {
    render(<OnHandPage />);

    expect(screen.getByText('Total Items')).toBeInTheDocument();
    expect(screen.getByText('Locations')).toBeInTheDocument();
    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
  });
});

describe('M11.1 Adjustments Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the page with header', async () => {
    render(<AdjustmentsPage />);

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByText('Stock Adjustments')).toBeInTheDocument();
  });

  it('displays the new adjustment button', () => {
    render(<AdjustmentsPage />);

    expect(screen.getByTestId('create-adjustment-btn')).toBeInTheDocument();
  });

  it('has search and status filter', () => {
    render(<AdjustmentsPage />);

    expect(screen.getByTestId('adjustment-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('status-filter-select')).toBeInTheDocument();
  });

  it('renders the adjustments table', () => {
    render(<AdjustmentsPage />);

    expect(screen.getByTestId('data-table')).toBeInTheDocument();
  });
});

describe('M11.1 Page Accessibility', () => {
  it('items page has accessible search input', () => {
    render(<InventoryItemsPage />);
    const searchInput = screen.getByTestId('item-search-input');
    expect(searchInput).toHaveAttribute('placeholder');
  });

  it('locations page has accessible form elements', () => {
    render(<InventoryLocationsPage />);
    const searchInput = screen.getByTestId('location-search-input');
    expect(searchInput).toHaveAttribute('placeholder');
  });

  it('on-hand page has accessible stats', () => {
    render(<OnHandPage />);
    // Stats cards should have text content
    expect(screen.getByText('Total Items')).toBeInTheDocument();
  });

  it('adjustments page has accessible filter', () => {
    render(<AdjustmentsPage />);
    const select = screen.getByTestId('status-filter-select');
    expect(select).toBeInTheDocument();
  });
});
