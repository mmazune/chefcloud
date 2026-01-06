/**
 * M11.5: Inventory Costing Pages Smoke Tests
 *
 * Smoke tests for M11.5 costing UI pages:
 * - /inventory/valuation
 * - /inventory/cogs
 *
 * These tests verify that pages render correctly with mocked data.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/inventory/valuation',
    query: {},
    asPath: '/inventory/valuation',
  }),
}));

// Mock the API client
const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
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

// Mock valuation data
const mockValuationData = {
  success: true,
  data: {
    branchId: 'test-branch-id',
    branchName: 'Main Branch',
    lines: [
      {
        itemId: 'item-1',
        itemCode: 'BEEF-001',
        itemName: 'Ground Beef',
        categoryName: 'Meat',
        onHandQty: 50,
        wac: 8.5,
        totalValue: 425,
        lastCostLayerAt: '2024-01-15T10:00:00Z',
      },
      {
        itemId: 'item-2',
        itemCode: 'POTATO-001',
        itemName: 'Potatoes',
        categoryName: 'Produce',
        onHandQty: 100,
        wac: 2.25,
        totalValue: 225,
        lastCostLayerAt: '2024-01-14T15:30:00Z',
      },
    ],
    totalValue: 650,
    itemCount: 2,
    asOfDate: '2024-01-15T12:00:00Z',
  },
};

// Mock COGS data
const mockCogsData = {
  success: true,
  data: {
    branchId: 'test-branch-id',
    branchName: 'Main Branch',
    fromDate: '2024-01-01T00:00:00Z',
    toDate: '2024-01-15T23:59:59Z',
    lines: [
      {
        depletionId: 'dep-1',
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        itemId: 'item-1',
        itemCode: 'BEEF-001',
        itemName: 'Ground Beef',
        qtyDepleted: 2.5,
        unitCost: 8.5,
        lineCogs: 21.25,
        depletedAt: '2024-01-15T11:30:00Z',
      },
      {
        depletionId: 'dep-2',
        orderId: 'order-2',
        orderNumber: 'ORD-002',
        itemId: 'item-2',
        itemCode: 'POTATO-001',
        itemName: 'Potatoes',
        qtyDepleted: 5,
        unitCost: 2.25,
        lineCogs: 11.25,
        depletedAt: '2024-01-15T12:00:00Z',
      },
    ],
    totalCogs: 32.5,
    lineCount: 2,
  },
};

// Mock TanStack Query
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn().mockImplementation(({ queryKey }) => {
    if (queryKey[0] === 'inventory-valuation') {
      return {
        data: mockValuationData.data,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      };
    }
    if (queryKey[0] === 'inventory-cogs') {
      return {
        data: mockCogsData.data,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      };
    }
    if (queryKey[0] === 'inventory-categories') {
      return {
        data: [
          { id: 'cat-1', name: 'Meat' },
          { id: 'cat-2', name: 'Produce' },
        ],
        isLoading: false,
        error: null,
      };
    }
    return { data: null, isLoading: false, error: null };
  }),
}));

// Mock components that might not exist yet
jest.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

jest.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  ),
}));

jest.mock('@/components/ui/data-table', () => ({
  DataTable: ({ data, columns }: { data: any[]; columns: any[] }) => (
    <table data-testid="data-table">
      <thead>
        <tr>
          {columns.map((col: any, i: number) => (
            <th key={i}>{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row: any, i: number) => (
          <tr key={i} data-testid="data-row">
            {columns.map((col: any, j: number) => (
              <td key={j}>{typeof col.accessor === 'function' ? 'cell' : row[col.accessor]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button data-testid="button" onClick={onClick}>{children}</button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ placeholder, onChange }: { placeholder?: string; onChange?: (e: any) => void }) => (
    <input data-testid="input" placeholder={placeholder} onChange={onChange} />
  ),
}));

jest.mock('@/components/ui/select', () => {
  const Select = ({ children, onValueChange }: { children: React.ReactNode; onValueChange?: (v: string) => void }) => (
    <select data-testid="select" onChange={(e) => onValueChange?.(e.target.value)}>{children}</select>
  );
  Select.Option = ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  );
  return { Select };
});

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, id }: { checked: boolean; onCheckedChange: (v: boolean) => void; id: string }) => (
    <input type="checkbox" id={id} checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} data-testid="switch" />
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({ selected, onSelect }: { selected: Date; onSelect: (d: Date | undefined) => void }) => (
    <input
      type="date"
      data-testid="date-picker"
      value={selected?.toISOString().split('T')[0]}
      onChange={(e) => onSelect(new Date(e.target.value))}
    />
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Search: () => <span>🔍</span>,
  Download: () => <span>⬇️</span>,
  RefreshCw: () => <span>🔄</span>,
  DollarSign: () => <span>💲</span>,
  Package: () => <span>📦</span>,
  Layers: () => <span>📚</span>,
  TrendingDown: () => <span>📉</span>,
  Receipt: () => <span>🧾</span>,
  Calendar: () => <span>📅</span>,
}));

describe('M11.5 Inventory Costing Pages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Valuation Page', () => {
    let ValuationPage: React.ComponentType;

    beforeAll(async () => {
      const pageModule = await import('@/pages/inventory/valuation');
      ValuationPage = pageModule.default;
    });

    it('should render page header with title', () => {
      render(<ValuationPage />);
      expect(screen.getByText('Inventory Valuation')).toBeInTheDocument();
      expect(screen.getByText(/Weighted Average Cost/)).toBeInTheDocument();
    });

    it('should render summary cards with total value', () => {
      render(<ValuationPage />);
      expect(screen.getByText('Total Value')).toBeInTheDocument();
      expect(screen.getByText('Items with Stock')).toBeInTheDocument();
      expect(screen.getByText('Avg. Item Value')).toBeInTheDocument();
    });

    it('should render data table with valuation lines', () => {
      render(<ValuationPage />);
      const table = screen.getByTestId('data-table');
      expect(table).toBeInTheDocument();
      
      const rows = screen.getAllByTestId('data-row');
      expect(rows.length).toBe(2); // Two items in mock data
    });

    it('should render search input', () => {
      render(<ValuationPage />);
      const searchInput = screen.getByPlaceholderText('Search items...');
      expect(searchInput).toBeInTheDocument();
    });

    it('should render export button', () => {
      render(<ValuationPage />);
      expect(screen.getByText(/Export CSV/)).toBeInTheDocument();
    });

    it('should render category filter', () => {
      render(<ValuationPage />);
      expect(screen.getByText('All Categories')).toBeInTheDocument();
    });

    it('should render include zero stock toggle', () => {
      render(<ValuationPage />);
      expect(screen.getByText('Include zero stock')).toBeInTheDocument();
    });
  });

  describe('COGS Page', () => {
    let CogsPage: React.ComponentType;

    beforeAll(async () => {
      const pageModule = await import('@/pages/inventory/cogs');
      CogsPage = pageModule.default;
    });

    it('should render page header with title', () => {
      render(<CogsPage />);
      expect(screen.getByText('Cost of Goods Sold')).toBeInTheDocument();
      expect(screen.getByText(/COGS calculated/)).toBeInTheDocument();
    });

    it('should render summary cards with total COGS', () => {
      render(<CogsPage />);
      expect(screen.getByText('Total COGS')).toBeInTheDocument();
      expect(screen.getByText('Orders')).toBeInTheDocument();
      expect(screen.getByText('Avg. COGS/Order')).toBeInTheDocument();
    });

    it('should render data table with COGS lines', () => {
      render(<CogsPage />);
      const table = screen.getByTestId('data-table');
      expect(table).toBeInTheDocument();
      
      const rows = screen.getAllByTestId('data-row');
      expect(rows.length).toBe(2); // Two COGS lines in mock data
    });

    it('should render date pickers for from/to dates', () => {
      render(<CogsPage />);
      const datePickers = screen.getAllByTestId('date-picker');
      expect(datePickers.length).toBe(2); // From and To date pickers
    });

    it('should render export button', () => {
      render(<CogsPage />);
      expect(screen.getByText(/Export CSV/)).toBeInTheDocument();
    });

    it('should render search input', () => {
      render(<CogsPage />);
      const searchInput = screen.getByPlaceholderText('Search items or orders...');
      expect(searchInput).toBeInTheDocument();
    });
  });
});
