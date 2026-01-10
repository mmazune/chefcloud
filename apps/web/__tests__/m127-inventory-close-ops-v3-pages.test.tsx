/**
 * M12.7 Close Ops v3 Pages - UI Smoke Tests (Jest-compatible)
 * 
 * Global mocks for AuthContext, api client, router are in jest.setup.ts
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/router';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockedUseRouter = useRouter as jest.Mock;

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

describe('M12.7 Blockers Check Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue({
      pathname: '/inventory/period-dashboard',
      query: { id: 'period-test-1' },
      push: jest.fn(),
      replace: jest.fn(),
      isReady: true,
    });
    mockedApiClient.get.mockResolvedValue({
      data: {
        blockers: [],
        summary: { total: 0, byType: {} },
      },
    });
  });

  it('renders period dashboard with blockers section', async () => {
    const { default: PeriodDashboardPage } = await import('../src/pages/inventory/period-dashboard');
    render(<PeriodDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });
  });
});
