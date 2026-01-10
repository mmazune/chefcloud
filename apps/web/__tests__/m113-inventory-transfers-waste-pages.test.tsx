/**
 * M11.3 Inventory Transfers + Waste Pages UI Smoke Tests (Jest-compatible)
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

describe('M11.3 Inventory Transfers Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApiClient.get.mockResolvedValue({ data: [] });
  });

  it('renders transfers list page', async () => {
    const { default: TransfersPage } = await import('../src/pages/inventory/transfers');
    render(<TransfersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });
  });
});

describe('M11.3 Waste Log Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApiClient.get.mockResolvedValue({ data: [] });
  });

  it('renders waste log page', async () => {
    const { default: WasteLogPage } = await import('../src/pages/inventory/waste');
    render(<WasteLogPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });
  });
});
