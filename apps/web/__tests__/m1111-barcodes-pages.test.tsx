/**
 * M11.11 Barcodes UI Smoke Tests
 * 
 * Verifies the barcodes page renders without errors and shows core UI elements.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import InventoryBarcodesPage from '../src/pages/inventory/barcodes';

// Mock the API client
vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/inventory/barcodes') && !url.includes('resolve') && !url.includes('export')) {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 'bc-1',
                value: '1234567890123',
                format: 'EAN13',
                type: 'ITEM',
                entityId: 'item-1',
                entityName: 'Test Item',
                entitySku: 'SKU-001',
                isPrimary: true,
                createdAt: '2024-01-15T10:00:00Z',
              },
              {
                id: 'bc-2',
                value: 'LOT-2024-001',
                format: 'CODE128',
                type: 'LOT',
                entityId: 'lot-1',
                entityName: 'Test Lot',
                isPrimary: false,
                createdAt: '2024-01-15T10:00:00Z',
              },
            ],
            total: 2,
          },
        });
      }
      if (url.includes('/inventory/items')) {
        return Promise.resolve({
          data: [
            { id: 'item-1', name: 'Test Item', sku: 'SKU-001' },
            { id: 'item-2', name: 'Another Item', sku: 'SKU-002' },
          ],
        });
      }
      if (url.includes('resolve')) {
        return Promise.resolve({
          data: {
            type: 'ITEM',
            itemId: 'item-1',
            name: 'Test Item',
            sku: 'SKU-001',
            isActive: true,
          },
        });
      }
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 'new-bc', value: 'NEW-BARCODE' } }),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

// Mock the layout components
vi.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

// Create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('InventoryBarcodesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header with correct title', async () => {
    render(<InventoryBarcodesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Inventory Barcodes')).toBeInTheDocument();
      expect(screen.getByText('Manage barcode mappings for items and lots')).toBeInTheDocument();
    });
  });

  it('renders scanner input', async () => {
    render(<InventoryBarcodesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/scan or enter barcode/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /resolve/i })).toBeInTheDocument();
    });
  });

  it('renders action buttons', async () => {
    render(<InventoryBarcodesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add barcode/i })).toBeInTheDocument();
    });
  });

  it('displays barcodes in the table', async () => {
    render(<InventoryBarcodesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('1234567890123')).toBeInTheDocument();
      expect(screen.getByText('LOT-2024-001')).toBeInTheDocument();
      expect(screen.getByText('Test Item')).toBeInTheDocument();
    });
  });

  it('shows barcode format badges', async () => {
    render(<InventoryBarcodesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('EAN13')).toBeInTheDocument();
      expect(screen.getByText('CODE128')).toBeInTheDocument();
    });
  });

  it('shows type badges (ITEM/LOT)', async () => {
    render(<InventoryBarcodesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('ITEM')).toBeInTheDocument();
      expect(screen.getByText('LOT')).toBeInTheDocument();
    });
  });

  it('shows primary badge for primary barcode', async () => {
    render(<InventoryBarcodesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Primary')).toBeInTheDocument();
    });
  });

  it('has search input for filtering', async () => {
    render(<InventoryBarcodesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search barcodes/i)).toBeInTheDocument();
    });
  });

  it('opens add barcode dialog on button click', async () => {
    render(<InventoryBarcodesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add barcode/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /add barcode/i }));

    await waitFor(() => {
      expect(screen.getByText('Add Item Barcode')).toBeInTheDocument();
    });
  });
});

describe('Barcode Scanner Simulation', () => {
  it('resolves barcode and shows result', async () => {
    render(<InventoryBarcodesPage />, { wrapper: createWrapper() });

    const input = await screen.findByPlaceholderText(/scan or enter barcode/i);
    const button = screen.getByRole('button', { name: /resolve/i });

    fireEvent.change(input, { target: { value: '1234567890123' } });
    fireEvent.click(button);

    await waitFor(() => {
      // Check for resolved item info
      expect(screen.getByText('Test Item')).toBeInTheDocument();
    });
  });
});
