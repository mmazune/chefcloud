/**
 * M11.2: Procurement Pages UI Smoke Tests
 * 
 * Tests that the procurement pages render without errors
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    query: {},
    push: jest.fn(),
    replace: jest.fn(),
    pathname: '/inventory/purchase-orders',
  }),
}));

// Mock useAuth hook
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-id',
      firstName: 'Test',
      lastName: 'User',
      roleLevel: 'L4',
      orgId: 'test-org-id',
      branchId: 'test-branch-id',
    },
    loading: false,
  }),
}));

// Mock hasRoleLevel
jest.mock('@/lib/auth', () => ({
  RoleLevel: { L1: 'L1', L2: 'L2', L3: 'L3', L4: 'L4', L5: 'L5' },
  hasRoleLevel: () => true,
}));

// Mock apiClient
jest.mock('@/lib/api', () => ({
  apiClient: {
    get: jest.fn().mockImplementation((url: string) => {
      if (url.includes('purchase-orders')) {
        return Promise.resolve({
          data: [
            {
              id: 'po-1',
              poNumber: 'PO-001',
              status: 'DRAFT',
              vendor: { id: 'v-1', name: 'Test Vendor' },
              branch: { id: 'b-1', name: 'Main Branch' },
              lines: [],
              createdAt: new Date().toISOString(),
            },
          ],
        });
      }
      if (url.includes('receipts')) {
        return Promise.resolve({
          data: [
            {
              id: 'r-1',
              receiptNumber: 'RCP-001',
              status: 'POSTED',
              purchaseOrderId: 'po-1',
              purchaseOrder: {
                poNumber: 'PO-001',
                vendor: { id: 'v-1', name: 'Test Vendor' },
              },
              receivedAt: new Date().toISOString(),
              postedAt: new Date().toISOString(),
            },
          ],
        });
      }
      if (url.includes('vendors')) {
        return Promise.resolve({ data: [{ id: 'v-1', name: 'Test Vendor' }] });
      }
      if (url.includes('inventory-items') || url.includes('items')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('uom')) {
        return Promise.resolve({ data: [{ id: 'u-1', code: 'EA', name: 'Each' }] });
      }
      if (url.includes('locations')) {
        return Promise.resolve({ data: [{ id: 'l-1', code: 'LOC1', name: 'Location 1' }] });
      }
      return Promise.resolve({ data: [] });
    }),
    post: jest.fn().mockResolvedValue({ data: {} }),
  },
}));

// Mock AppShell
jest.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

// Mock PageHeader
jest.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title, description }: { title: React.ReactNode; description?: string }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  ),
}));

// Mock DataTable
jest.mock('@/components/ui/data-table', () => ({
  DataTable: ({ data }: { data: unknown[] }) => (
    <div data-testid="data-table">
      {data.length} rows
    </div>
  ),
}));

// Helper to wrap with QueryClient
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

describe('M11.2: Procurement Pages UI', () => {
  describe('Purchase Orders List Page', () => {
    it('should render purchase orders page with header', async () => {
      const PurchaseOrdersPage = require('@/pages/inventory/purchase-orders/index').default;
      
      render(<PurchaseOrdersPage />, { wrapper: createWrapper() });

      expect(screen.getByTestId('app-shell')).toBeInTheDocument();
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
      expect(screen.getByText('Purchase Orders')).toBeInTheDocument();
    });

    it('should show create button for L3+ users', async () => {
      const PurchaseOrdersPage = require('@/pages/inventory/purchase-orders/index').default;
      
      render(<PurchaseOrdersPage />, { wrapper: createWrapper() });

      // L4 user should see create button
      expect(screen.getByText(/Create PO/i)).toBeInTheDocument();
    });
  });

  describe('Receipts List Page', () => {
    it('should render receipts page with header', async () => {
      const ReceiptsPage = require('@/pages/inventory/receipts/index').default;
      
      render(<ReceiptsPage />, { wrapper: createWrapper() });

      expect(screen.getByTestId('app-shell')).toBeInTheDocument();
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
      expect(screen.getByText('Goods Receipts')).toBeInTheDocument();
    });

    it('should show create receipt button for L3+ users', async () => {
      const ReceiptsPage = require('@/pages/inventory/receipts/index').default;
      
      render(<ReceiptsPage />, { wrapper: createWrapper() });

      expect(screen.getByText(/Create Receipt/i)).toBeInTheDocument();
    });
  });
});
