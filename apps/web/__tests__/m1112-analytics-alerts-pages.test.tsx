/**
 * M11.12 Analytics + Alerts UI Smoke Tests
 * 
 * Verifies the analytics and alerts pages render without errors and show core UI elements.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import InventoryAnalyticsPage from '../src/pages/inventory/analytics';
import InventoryAlertsPage from '../src/pages/inventory/alerts';

// Mock the API client
vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/inventory/analytics/summary')) {
        return Promise.resolve({
          data: {
            shrink: { totalVarianceQty: '10.0000', totalVarianceValue: '50.0000', itemCount: 3 },
            waste: { totalWasteQty: '5.0000', totalWasteValue: '25.0000', topItemsCount: 2 },
            deadStock: { itemCount: 1, totalOnHand: '100.0000' },
            expiryRisk: { expiredCount: 0, within7Count: 2, within30Count: 5, within60Count: 8 },
            reorderHealth: { belowReorderCount: 4, suggestionRunsTotal: 10 },
          },
        });
      }
      if (url.includes('/inventory/analytics/shrink')) {
        return Promise.resolve({
          data: [
            {
              branchId: 'branch-1',
              branchName: 'Main Branch',
              locationId: 'loc-1',
              locationName: 'Warehouse',
              itemId: 'item-1',
              itemName: 'Test Item',
              sku: 'SKU-001',
              varianceQty: '5.0000',
              varianceValue: '25.0000',
              sessionCount: 2,
            },
          ],
        });
      }
      if (url.includes('/inventory/analytics/dead-stock')) {
        return Promise.resolve({
          data: [
            {
              branchId: 'branch-1',
              branchName: 'Main Branch',
              itemId: 'item-2',
              itemName: 'Dead Stock Item',
              sku: 'SKU-002',
              onHand: '50.0000',
              lastMovementDate: '2024-01-01T00:00:00Z',
              daysSinceMovement: 45,
            },
          ],
        });
      }
      if (url.includes('/inventory/analytics/expiry-risk')) {
        return Promise.resolve({
          data: [
            { bucket: 'expired', lotCount: 0, totalQty: '0', lots: [] },
            { bucket: 'within7', lotCount: 1, totalQty: '10', lots: [
              { lotId: 'lot-1', lotNumber: 'LOT-001', itemId: 'item-3', itemName: 'Expiring Item', expiryDate: '2024-01-20T00:00:00Z', daysToExpiry: 5, qty: '10', status: 'ACTIVE' },
            ]},
            { bucket: 'within30', lotCount: 0, totalQty: '0', lots: [] },
            { bucket: 'within60', lotCount: 0, totalQty: '0', lots: [] },
          ],
        });
      }
      if (url.includes('/inventory/analytics/reorder-health')) {
        return Promise.resolve({
          data: {
            belowReorderCount: 2,
            suggestionRunsTotal: 5,
            suggestionsActionedCount: 3,
            itemsBelowReorder: [
              { itemId: 'item-4', itemName: 'Low Stock Item', sku: 'SKU-004', onHand: '5.0000', reorderLevel: '20.0000', shortfall: '15.0000' },
            ],
          },
        });
      }
      if (url.includes('/inventory/alerts')) {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 'alert-1',
                orgId: 'org-1',
                branchId: 'branch-1',
                type: 'DEAD_STOCK',
                severity: 'WARN',
                entityType: 'InventoryItem',
                entityId: 'item-2',
                title: 'Dead stock: Test Item - 45 days without movement',
                detailsJson: { sku: 'SKU-002', onHand: '50', daysSinceMovement: 45 },
                status: 'OPEN',
                acknowledgedAt: null,
                resolvedAt: null,
                createdAt: '2024-01-15T10:00:00Z',
                updatedAt: '2024-01-15T10:00:00Z',
              },
              {
                id: 'alert-2',
                orgId: 'org-1',
                branchId: 'branch-1',
                type: 'BELOW_REORDER_POINT',
                severity: 'CRITICAL',
                entityType: 'InventoryItem',
                entityId: 'item-4',
                title: 'Below reorder: Low Stock Item (5/20)',
                detailsJson: { sku: 'SKU-004', onHand: '5', reorderLevel: '20' },
                status: 'ACKNOWLEDGED',
                acknowledgedAt: '2024-01-16T10:00:00Z',
                resolvedAt: null,
                createdAt: '2024-01-15T10:00:00Z',
                updatedAt: '2024-01-16T10:00:00Z',
              },
            ],
            total: 2,
            page: 1,
            pageSize: 20,
          },
        });
      }
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/evaluate')) {
        return Promise.resolve({
          data: { created: 2, skippedDuplicate: 1, alertsByType: { DEAD_STOCK: 1, BELOW_REORDER_POINT: 1 } },
        });
      }
      if (url.includes('/acknowledge')) {
        return Promise.resolve({
          data: { id: 'alert-1', status: 'ACKNOWLEDGED', acknowledgedAt: new Date().toISOString() },
        });
      }
      if (url.includes('/resolve')) {
        return Promise.resolve({
          data: { id: 'alert-1', status: 'RESOLVED', resolvedAt: new Date().toISOString() },
        });
      }
      return Promise.resolve({ data: {} });
    }),
  },
}));

// Mock the layout components
vi.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle: string; actions?: React.ReactNode }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size }: { 
    children: React.ReactNode; 
    onClick?: () => void; 
    disabled?: boolean;
    variant?: string;
    size?: string;
  }) => (
    <button data-testid="button" onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid="tabs" data-value={value}>{children}</div>
  ),
  TabsList: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tabs-list">{children}</div>
  ),
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <button data-testid="tab-trigger" data-value={value}>{children}</button>
  ),
  TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid="tab-content" data-value={value}>{children}</div>
  ),
}));

vi.mock('@/components/ui/data-table', () => ({
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
          <tr key={i}>
            {columns.map((col: any, j: number) => (
              <td key={j}>{row[col.accessorKey]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
    open ? <div data-testid="dialog">{children}</div> : null
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, placeholder }: { 
    value?: string; 
    onChange?: (e: any) => void; 
    placeholder?: string 
  }) => (
    <textarea 
      data-testid="textarea" 
      value={value} 
      onChange={onChange}
      placeholder={placeholder}
    />
  ),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// ============================================
// Analytics Page Tests
// ============================================

describe('InventoryAnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header', async () => {
    render(<InventoryAnalyticsPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Inventory Analytics')).toBeInTheDocument();
  });

  it('renders summary cards', async () => {
    render(<InventoryAnalyticsPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getAllByTestId('card').length).toBeGreaterThan(0);
    });
  });

  it('renders tab navigation', async () => {
    render(<InventoryAnalyticsPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByTestId('tabs')).toBeInTheDocument();
    });

    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Shrink')).toBeInTheDocument();
    expect(screen.getByText('Dead Stock')).toBeInTheDocument();
    expect(screen.getByText('Expiry Risk')).toBeInTheDocument();
    expect(screen.getByText('Reorder Health')).toBeInTheDocument();
  });

  it('shows refresh button', async () => {
    render(<InventoryAnalyticsPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });
});

// ============================================
// Alerts Page Tests
// ============================================

describe('InventoryAlertsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header', async () => {
    render(<InventoryAlertsPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Inventory Alerts')).toBeInTheDocument();
  });

  it('renders filter controls', async () => {
    render(<InventoryAlertsPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      // Should have type, severity, and status filters
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('renders evaluate alerts button', async () => {
    render(<InventoryAlertsPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('Evaluate Alerts')).toBeInTheDocument();
    });
  });

  it('renders alerts data table', async () => {
    render(<InventoryAlertsPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  it('renders pagination controls', async () => {
    render(<InventoryAlertsPage />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
  });
});
