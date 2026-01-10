/**
 * M12.6 Close Ops UX Pages - UI Smoke Tests (Jest-compatible)
 * 
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
  PageHeader: ({ title }: { title: string }) => <h1 data-testid="page-header">{title}</h1>,
}));

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

describe('M12.6 Close Requests Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApiClient.get.mockResolvedValue({
      data: {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      },
    });
  });

  it('renders close requests page', async () => {
    const { default: CloseRequestsPage } = await import('../src/pages/inventory/close-requests');
    render(<CloseRequestsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });
  });
});

describe('M12.6 Period Dashboard Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApiClient.get.mockResolvedValue({ data: [] });
  });

  it('renders period dashboard page', async () => {
    const { default: PeriodDashboardPage } = await import('../src/pages/inventory/period-dashboard');
    render(<PeriodDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });
  });
});
