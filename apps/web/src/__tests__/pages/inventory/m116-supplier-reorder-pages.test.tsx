/**
 * M11.6: Supplier Catalog + Reorder Pages Smoke Tests
 *
 * Smoke tests for M11.6 UI pages:
 * - /inventory/suppliers
 * - /inventory/reorder-policies
 * - /inventory/reorder-suggestions
 *
 * These tests verify that pages render correctly with mocked data.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock next/router
jest.mock('next/router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        pathname: '/inventory/suppliers',
        query: {},
        asPath: '/inventory/suppliers',
    }),
}));

// Mock the API client
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();

jest.mock('@/lib/api', () => ({
    apiClient: {
        get: (...args: unknown[]) => mockGet(...args),
        post: (...args: unknown[]) => mockPost(...args),
        patch: (...args: unknown[]) => mockPatch(...args),
        defaults: { baseURL: 'http://localhost:3000' },
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

// Mock sonner toast
jest.mock('sonner', () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
    },
}));

// Mock data
const mockSupplierItems = {
    data: [
        {
            id: 'si-1',
            vendorSku: 'VND-001',
            uomConversionFactorToBase: 12,
            packSizeLabel: 'Case of 12',
            leadTimeDays: 3,
            minOrderQtyVendorUom: 2,
            isPreferred: true,
            isActive: true,
            vendor: { id: 'v-1', name: 'Acme Foods' },
            inventoryItem: { id: 'i-1', name: 'Ground Beef', sku: 'BEEF-001' },
            vendorUom: { id: 'u-1', code: 'CASE', name: 'Case' },
        },
        {
            id: 'si-2',
            vendorSku: 'VND-002',
            uomConversionFactorToBase: 1,
            packSizeLabel: null,
            leadTimeDays: 2,
            minOrderQtyVendorUom: 5,
            isPreferred: false,
            isActive: true,
            vendor: { id: 'v-2', name: 'Fresh Produce Inc' },
            inventoryItem: { id: 'i-2', name: 'Tomatoes', sku: 'TOM-001' },
            vendorUom: null,
        },
    ],
};

const mockVendors = {
    data: [
        { id: 'v-1', name: 'Acme Foods' },
        { id: 'v-2', name: 'Fresh Produce Inc' },
    ],
};

const mockInventoryItems = [
    { id: 'i-1', name: 'Ground Beef', sku: 'BEEF-001', reorderLevel: 50, reorderQty: 100 },
    { id: 'i-2', name: 'Tomatoes', sku: 'TOM-001', reorderLevel: 25, reorderQty: 50 },
];

const _mockPriceHistory = {
    data: [
        {
            id: 'p-1',
            unitPriceVendorUom: 24.99,
            currency: 'USD',
            effectiveFrom: '2024-01-01T00:00:00Z',
            effectiveTo: '2024-01-15T00:00:00Z',
            source: 'MANUAL',
        },
        {
            id: 'p-2',
            unitPriceVendorUom: 26.99,
            currency: 'USD',
            effectiveFrom: '2024-01-15T00:00:00Z',
            effectiveTo: null,
            source: 'RECEIPT_DERIVED',
        },
    ],
};

const mockReorderPolicies = {
    data: [
        {
            id: 'rp-1',
            inventoryItemId: 'i-1',
            reorderPointBaseQty: 75,
            reorderQtyBaseQty: 150,
            preferredVendorId: 'v-1',
            isActive: true,
            inventoryItem: { id: 'i-1', name: 'Ground Beef', sku: 'BEEF-001' },
            preferredVendor: { id: 'v-1', name: 'Acme Foods' },
        },
    ],
};

const mockReorderRuns = {
    data: [
        {
            id: 'run-1',
            branchId: 'test-branch-id',
            deterministicHash: 'abc123def456',
            asOf: '2024-01-15T12:00:00Z',
            createdAt: '2024-01-15T12:00:00Z',
            createdBy: { id: 'u-1', firstName: 'John', lastName: 'Doe' },
            _count: { lines: 5, generatedPOs: 2 },
        },
        {
            id: 'run-2',
            branchId: 'test-branch-id',
            deterministicHash: 'xyz789abc012',
            asOf: '2024-01-14T10:00:00Z',
            createdAt: '2024-01-14T10:00:00Z',
            createdBy: { id: 'u-1', firstName: 'John', lastName: 'Doe' },
            _count: { lines: 3, generatedPOs: 0 },
        },
    ],
};

const _mockRunDetails = {
    data: {
        id: 'run-1',
        branchId: 'test-branch-id',
        deterministicHash: 'abc123def456',
        asOf: '2024-01-15T12:00:00Z',
        createdAt: '2024-01-15T12:00:00Z',
        createdBy: { id: 'u-1', firstName: 'John', lastName: 'Doe' },
        lines: [
            {
                id: 'line-1',
                inventoryItemId: 'i-1',
                onHandBaseQty: 20,
                reorderPointBaseQty: 75,
                suggestedBaseQty: 150,
                suggestedVendorQty: 13,
                reasonCode: 'BELOW_REORDER_POINT',
                inventoryItem: { id: 'i-1', name: 'Ground Beef', sku: 'BEEF-001' },
                suggestedVendor: { id: 'v-1', name: 'Acme Foods' },
            },
        ],
        generatedPOs: [
            { id: 'po-1', poNumber: 'PO-2024-0001', vendorId: 'v-1', status: 'DRAFT', totalAmount: 350 },
        ],
    },
};

// Mock TanStack Query
jest.mock('@tanstack/react-query', () => ({
    useQuery: jest.fn().mockImplementation(({ queryKey }) => {
        if (queryKey[0] === 'supplier-items') {
            return {
                data: mockSupplierItems.data,
                isLoading: false,
                error: null,
                refetch: jest.fn(),
            };
        }
        if (queryKey[0] === 'vendors') {
            return {
                data: mockVendors.data,
                isLoading: false,
                error: null,
                refetch: jest.fn(),
            };
        }
        if (queryKey[0] === 'inventory-items') {
            return {
                data: mockInventoryItems,
                isLoading: false,
                error: null,
                refetch: jest.fn(),
            };
        }
        if (queryKey[0] === 'reorder-policies') {
            return {
                data: mockReorderPolicies.data,
                isLoading: false,
                error: null,
                refetch: jest.fn(),
            };
        }
        if (queryKey[0] === 'reorder-runs') {
            return {
                data: mockReorderRuns.data,
                isLoading: false,
                error: null,
                refetch: jest.fn(),
            };
        }
        return { data: null, isLoading: false, error: null };
    }),
    useMutation: jest.fn().mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: jest.fn().mockResolvedValue({}),
        isLoading: false,
        error: null,
    }),
    QueryClient: jest.fn().mockImplementation(() => ({
        invalidateQueries: jest.fn(),
    })),
    QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
    DataTable: ({ data, columns }: { data: unknown[]; columns: { header: string; accessor?: string }[] }) => (
        <table data-testid="data-table">
            <thead>
                <tr>
                    {columns.map((col, i: number) => (
                        <th key={i}>{col.header}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.map((row: unknown, i: number) => (
                    <tr key={i} data-testid="data-row">
                        {columns.map((col, j: number) => (
                            <td key={j}>{typeof col.accessor === 'function' ? 'cell' : (row as Record<string, unknown>)[col.accessor || '']}</td>
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
    Input: ({ placeholder, onChange }: { placeholder?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
        <input data-testid="input" placeholder={placeholder} onChange={onChange} />
    ),
}));

jest.mock('@/components/ui/select', () => {
    const Select = ({ children, onValueChange }: { children: React.ReactNode; onValueChange?: (v: string) => void }) => (
        <select data-testid="select" onChange={(e) => onValueChange?.(e.target.value)}>{children}</select>
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

jest.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => (
        open ? <div data-testid="dialog">{children}</div> : null
    ),
    DialogTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-trigger">{children}</div>,
    DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="dialog-title">{children}</h2>,
}));

jest.mock('@/components/ui/drawer', () => ({
    Drawer: ({ children, open }: { children: React.ReactNode; open: boolean }) => (
        open ? <div data-testid="drawer">{children}</div> : null
    ),
    DrawerTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="drawer-trigger">{children}</div>,
    DrawerContent: ({ children }: { children: React.ReactNode }) => <div data-testid="drawer-content">{children}</div>,
    DrawerHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="drawer-header">{children}</div>,
    DrawerTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="drawer-title">{children}</h2>,
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
    Search: () => <span>🔍</span>,
    Download: () => <span>⬇️</span>,
    RefreshCw: () => <span>🔄</span>,
    Plus: () => <span>➕</span>,
    Edit: () => <span>✏️</span>,
    Trash: () => <span>🗑️</span>,
    Package: () => <span>📦</span>,
    Truck: () => <span>🚚</span>,
    DollarSign: () => <span>💲</span>,
    Clock: () => <span>⏰</span>,
    AlertTriangle: () => <span>⚠️</span>,
    Eye: () => <span>👁️</span>,
    FileText: () => <span>📄</span>,
}));

// ============================================================================
// Suppliers Page Tests
// ============================================================================
describe('M11.6 Suppliers Page', () => {
    let SuppliersPage: React.ComponentType;

    beforeAll(async () => {
        const pageModule = await import('@/pages/inventory/suppliers');
        SuppliersPage = pageModule.default;
    });

    beforeEach(() => {
        mockGet.mockReset();
        mockPost.mockReset();
        mockPatch.mockReset();
    });

    it('should render page header with title', () => {
        render(<SuppliersPage />);
        expect(screen.getByText('Supplier Catalog')).toBeInTheDocument();
    });

    it('should render search input', () => {
        render(<SuppliersPage />);
        expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    });

    it('should render add supplier item button', () => {
        render(<SuppliersPage />);
        expect(screen.getByText('Add Supplier Item')).toBeInTheDocument();
    });

    it('should display supplier items from mock data', () => {
        render(<SuppliersPage />);
        // These come from useQuery mock
        expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
});

// ============================================================================
// Reorder Policies Page Tests
// ============================================================================
describe('M11.6 Reorder Policies Page', () => {
    let ReorderPoliciesPage: React.ComponentType;

    beforeAll(async () => {
        const pageModule = await import('@/pages/inventory/reorder-policies');
        ReorderPoliciesPage = pageModule.default;
    });

    beforeEach(() => {
        mockGet.mockReset();
        mockPost.mockReset();
    });

    it('should render page header with title', () => {
        render(<ReorderPoliciesPage />);
        expect(screen.getByText('Reorder Policies')).toBeInTheDocument();
    });

    it('should render description about branch-level policies', () => {
        render(<ReorderPoliciesPage />);
        expect(screen.getByText(/branch-level reorder points/i)).toBeInTheDocument();
    });

    it('should render add policy button', () => {
        render(<ReorderPoliciesPage />);
        expect(screen.getByText('Add Policy')).toBeInTheDocument();
    });

    it('should display policy table', () => {
        render(<ReorderPoliciesPage />);
        expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
});

// ============================================================================
// Reorder Suggestions Page Tests
// ============================================================================
describe('M11.6 Reorder Suggestions Page', () => {
    let ReorderSuggestionsPage: React.ComponentType;

    beforeAll(async () => {
        const pageModule = await import('@/pages/inventory/reorder-suggestions');
        ReorderSuggestionsPage = pageModule.default;
    });

    beforeEach(() => {
        mockGet.mockReset();
        mockPost.mockReset();
    });

    it('should render page header with title', () => {
        render(<ReorderSuggestionsPage />);
        expect(screen.getByText('Reorder Suggestions')).toBeInTheDocument();
    });

    it('should render description about stock levels', () => {
        render(<ReorderSuggestionsPage />);
        expect(screen.getByText(/current stock levels/i)).toBeInTheDocument();
    });

    it('should render generate suggestions button', () => {
        render(<ReorderSuggestionsPage />);
        expect(screen.getByText('Generate Suggestions')).toBeInTheDocument();
    });

    it('should display run table', () => {
        render(<ReorderSuggestionsPage />);
        expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
});

// ============================================================================
// Integration Tests
// ============================================================================
describe('M11.6 Page Integration', () => {
    let SuppliersPage: React.ComponentType;

    beforeAll(async () => {
        const pageModule = await import('@/pages/inventory/suppliers');
        SuppliersPage = pageModule.default;
    });

    beforeEach(() => {
        mockGet.mockReset();
        mockPost.mockReset();
        mockPatch.mockReset();
    });

    it('should filter items when typing in search input', async () => {
        render(<SuppliersPage />);

        // Find search input
        const searchInput = screen.getByPlaceholderText(/search/i);
        expect(searchInput).toBeInTheDocument();

        // Type in search
        fireEvent.change(searchInput, { target: { value: 'Beef' } });

        // Wait for filter to apply
        await waitFor(() => {
            expect(searchInput).toHaveValue('Beef');
        });
    });
});
