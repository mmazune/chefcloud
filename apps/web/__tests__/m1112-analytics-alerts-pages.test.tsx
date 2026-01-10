/**
 * M11.12 Analytics + Alerts UI Smoke Tests (Jest-compatible)
 * 
 * Verifies the analytics and alerts pages render without errors.
 * Global mocks for AuthContext, api client, router are in jest.setup.ts
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Mock the layout components
jest.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

jest.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  ),
}));

// Mock toast
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('M11.12 Inventory Analytics Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApiClient.get.mockImplementation((url: string) => {
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
      return Promise.resolve({ data: {} });
    });
  });

  it('renders analytics page with header', async () => {
    // Lazy import to allow mocks to be set up first
    const { default: InventoryAnalyticsPage } = await import('../src/pages/inventory/analytics');
    render(<InventoryAnalyticsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });
  });
});

describe('M11.12 Inventory Alerts Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApiClient.get.mockImplementation((url: string) => {
      if (url.includes('/inventory/alerts')) {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 'alert-1',
                type: 'DEAD_STOCK',
                severity: 'WARN',
                title: 'Dead stock: Test Item',
                status: 'OPEN',
                createdAt: '2024-01-15T10:00:00Z',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('renders alerts page with header', async () => {
    const { default: InventoryAlertsPage } = await import('../src/pages/inventory/alerts');
    render(<InventoryAlertsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });
  });
});
