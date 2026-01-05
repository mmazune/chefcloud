/**
 * M11.3: Inventory Transfers + Waste Pages UI Smoke Tests
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/router
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    query: { id: 'transfer-123' },
    isReady: true,
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      roleLevel: 4,
      role: 'OWNER',
    },
    token: 'test-token',
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

// Create query client wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Mock data
const mockTransfers = {
  data: [
    {
      id: 'transfer-1',
      transferNumber: 'TRF-0001',
      status: 'DRAFT',
      createdAt: '2024-01-01T00:00:00Z',
      fromBranch: { name: 'Branch A' },
      toBranch: { name: 'Branch B' },
      createdBy: { email: 'user@test.com' },
    },
    {
      id: 'transfer-2',
      transferNumber: 'TRF-0002',
      status: 'IN_TRANSIT',
      createdAt: '2024-01-02T00:00:00Z',
      fromBranch: { name: 'Branch A' },
      toBranch: { name: 'Branch C' },
      createdBy: { email: 'user2@test.com' },
    },
  ],
  meta: { total: 2, page: 1, limit: 20 },
};

const mockTransferDetail = {
  id: 'transfer-123',
  transferNumber: 'TRF-0001',
  status: 'DRAFT',
  createdAt: '2024-01-01T00:00:00Z',
  shippedAt: null,
  receivedAt: null,
  notes: 'Test notes',
  fromBranch: { name: 'Branch A' },
  toBranch: { name: 'Branch B' },
  createdBy: { email: 'creator@test.com' },
  shippedBy: null,
  receivedBy: null,
  lines: [
    {
      id: 'line-1',
      item: { sku: 'SKU-001', name: 'Item 1' },
      fromLocation: { code: 'LOC-A' },
      toLocation: { code: 'LOC-B' },
      qtyShipped: 10,
      qtyReceived: null,
    },
  ],
};

const mockWasteDocuments = {
  data: [
    {
      id: 'waste-1',
      wasteNumber: 'WST-0001',
      status: 'DRAFT',
      reason: 'DAMAGED',
      createdAt: '2024-01-01T00:00:00Z',
      branch: { name: 'Branch A' },
      createdBy: { email: 'user@test.com' },
    },
    {
      id: 'waste-2',
      wasteNumber: 'WST-0002',
      status: 'POSTED',
      reason: 'EXPIRED',
      createdAt: '2024-01-02T00:00:00Z',
      branch: { name: 'Branch B' },
      createdBy: { email: 'user2@test.com' },
    },
  ],
  meta: { total: 2, page: 1, limit: 20 },
};

const mockWasteDetail = {
  id: 'waste-123',
  wasteNumber: 'WST-0001',
  status: 'DRAFT',
  reason: 'DAMAGED',
  createdAt: '2024-01-01T00:00:00Z',
  postedAt: null,
  notes: 'Damaged goods',
  branch: { name: 'Branch A' },
  createdBy: { email: 'creator@test.com' },
  postedBy: null,
  lines: [
    {
      id: 'line-1',
      item: { sku: 'SKU-001', name: 'Item 1' },
      location: { code: 'LOC-A' },
      qty: 5,
      unitCost: 10.5,
      reason: 'DAMAGED',
    },
  ],
};

describe('M11.3 Transfers List Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTransfers),
    });
  });

  it('renders transfers list page', async () => {
    const TransfersPage = (await import('@/pages/inventory/transfers/index')).default;
    render(<TransfersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/inventory transfers/i)).toBeInTheDocument();
    });
  });

  it('displays status filter options', async () => {
    const TransfersPage = (await import('@/pages/inventory/transfers/index')).default;
    render(<TransfersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  it('shows create button for authorized users', async () => {
    const TransfersPage = (await import('@/pages/inventory/transfers/index')).default;
    render(<TransfersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new transfer/i })).toBeInTheDocument();
    });
  });
});

describe('M11.3 Transfer Detail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTransferDetail),
    });
  });

  it('renders transfer detail page', async () => {
    const TransferDetailPage = (await import('@/pages/inventory/transfers/[id]')).default;
    render(<TransferDetailPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/TRF-0001/)).toBeInTheDocument();
    });
  });

  it('shows status badge', async () => {
    const TransferDetailPage = (await import('@/pages/inventory/transfers/[id]')).default;
    render(<TransferDetailPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/DRAFT/i)).toBeInTheDocument();
    });
  });

  it('displays lines table with item details', async () => {
    const TransferDetailPage = (await import('@/pages/inventory/transfers/[id]')).default;
    render(<TransferDetailPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Item 1/)).toBeInTheDocument();
      expect(screen.getByText(/SKU-001/)).toBeInTheDocument();
    });
  });
});

describe('M11.3 Waste List Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockWasteDocuments),
    });
  });

  it('renders waste list page', async () => {
    const WastePage = (await import('@/pages/inventory/waste/index')).default;
    render(<WastePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/waste management/i)).toBeInTheDocument();
    });
  });

  it('shows status and reason filter options', async () => {
    const WastePage = (await import('@/pages/inventory/waste/index')).default;
    render(<WastePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      const comboboxes = screen.getAllByRole('combobox');
      expect(comboboxes.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows create button for authorized users', async () => {
    const WastePage = (await import('@/pages/inventory/waste/index')).default;
    render(<WastePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new waste/i })).toBeInTheDocument();
    });
  });
});

describe('M11.3 Waste Detail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockWasteDetail),
    });
  });

  it('renders waste detail page', async () => {
    vi.mock('next/router', () => ({
      useRouter: () => ({
        push: vi.fn(),
        query: { id: 'waste-123' },
        isReady: true,
      }),
    }));

    const WasteDetailPage = (await import('@/pages/inventory/waste/[id]')).default;
    render(<WasteDetailPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/WST-0001/)).toBeInTheDocument();
    });
  });

  it('shows reason badge', async () => {
    const WasteDetailPage = (await import('@/pages/inventory/waste/[id]')).default;
    render(<WasteDetailPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/DAMAGED/i)).toBeInTheDocument();
    });
  });

  it('displays lines table with cost details', async () => {
    const WasteDetailPage = (await import('@/pages/inventory/waste/[id]')).default;
    render(<WasteDetailPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Item 1/)).toBeInTheDocument();
    });
  });
});

describe('M11.3 Action Buttons RBAC', () => {
  it('shows Ship button for DRAFT status and L3+ user', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTransferDetail),
    });

    const TransferDetailPage = (await import('@/pages/inventory/transfers/[id]')).default;
    render(<TransferDetailPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ship/i })).toBeInTheDocument();
    });
  });

  it('shows Post button for DRAFT waste with L3+ user', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockWasteDetail),
    });

    const WasteDetailPage = (await import('@/pages/inventory/waste/[id]')).default;
    render(<WasteDetailPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /post/i })).toBeInTheDocument();
    });
  });

  it('shows Void button for DRAFT status with L4+ user', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTransferDetail),
    });

    const TransferDetailPage = (await import('@/pages/inventory/transfers/[id]')).default;
    render(<TransferDetailPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /void/i })).toBeInTheDocument();
    });
  });
});
