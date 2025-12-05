import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SystemDiagnosticsPanel } from './SystemDiagnosticsPanel';

// Hoist-safe mocking pattern (E24-BILLING-FE-S3)
const mockUsePlanCapabilities = jest.fn();

// Mock hooks it uses
jest.mock('@/hooks/useDeviceRole', () => ({
  useDeviceRole: () => ({ role: 'POS', isLoaded: true }),
}));
jest.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));
jest.mock('@/hooks/useOfflineQueue', () => ({
  useOfflineQueue: () => ({
    queue: [{ id: '1' }],
    syncLog: [{ id: 'log-1', status: 'failed' }],
  }),
}));
jest.mock('@/hooks/useOfflineStorageEstimate', () => ({
  useOfflineStorageEstimate: () => ({ usage: 1024 * 1024, quota: 1024 * 1024 * 10 }),
}));
jest.mock('@/hooks/usePosCachedMenu', () => ({
  usePosCachedMenu: () => ({
    menu: [{ id: 'item-1' }],
    isStale: false,
    ageMs: 5 * 60 * 1000,
  }),
}));
jest.mock('@/hooks/usePosCachedOpenOrders', () => ({
  usePosCachedOpenOrders: () => ({
    openOrders: [{ id: 'order-1' }],
    isStale: true,
    ageMs: 60 * 60 * 1000,
  }),
}));
jest.mock('@/hooks/useKioskMode', () => ({
  useKioskMode: () => ({
    isSupported: true,
    isActive: false,
    isFullscreen: false,
    hasWakeLock: false,
    toggleKiosk: jest.fn(),
  }),
}));
jest.mock('@/hooks/useLastErrorRecord', () => ({
  useLastErrorRecord: () => ({
    lastError: null,
    clear: jest.fn(),
  }),
}));
jest.mock('@/hooks/usePlanCapabilities', () => ({
  usePlanCapabilities: () => mockUsePlanCapabilities(),
}));

describe('SystemDiagnosticsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default: subscription not available
    mockUsePlanCapabilities.mockReturnValue({
      subscription: null,
      capabilities: {} as any,
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });
  });

  test('renders key sections when open', () => {
    render(
      <SystemDiagnosticsPanel
        open={true}
        onClose={() => {}}
        context="POS"
      />,
    );

    expect(screen.getByText(/POS diagnostics/i)).toBeInTheDocument();
    expect(screen.getByText(/App & device/i)).toBeInTheDocument();
    expect(screen.getByText(/Offline queue & sync/i)).toBeInTheDocument();
    expect(screen.getByText(/Cache & storage/i)).toBeInTheDocument();
    expect(screen.getByText(/Environment/i)).toBeInTheDocument();

    // Sanity-check one metric
    expect(screen.getByText(/Queued actions/i).closest('div')!).toHaveTextContent('1');

    // New support tools buttons
    expect(screen.getByRole('button', { name: /Copy JSON/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download JSON/i })).toBeInTheDocument();
  });

  test('copy JSON uses clipboard when available', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const { getByRole } = render(
      <SystemDiagnosticsPanel
        open={true}
        onClose={() => {}}
        context="POS"
      />,
    );

    const copyButton = getByRole('button', { name: /Copy JSON/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
  });

  test('shows billing unavailable when subscription is null', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: null,
      capabilities: {} as any,
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(
      <SystemDiagnosticsPanel
        open={true}
        onClose={() => {}}
        context="POS"
      />,
    );

    expect(screen.getByText(/Billing & plan/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Not available \(billing service unreachable or not loaded\)/i),
    ).toBeInTheDocument();
  });

  test('shows billing status and plan for active subscription', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: {
        status: 'ACTIVE',
        planId: 'FRANCHISE_CORE',
      } as any,
      capabilities: {} as any,
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    const { queryByText } = render(
      <SystemDiagnosticsPanel
        open={true}
        onClose={() => {}}
        context="POS"
      />,
    );

    expect(screen.getByText(/ACTIVE/)).toBeInTheDocument();
    expect(screen.getByText(/\(plan: FRANCHISE_CORE\)/)).toBeInTheDocument();
    expect(queryByText(/at risk/i)).toBeNull();
  });

  test('marks billing as at risk for PAST_DUE status', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: {
        status: 'PAST_DUE',
        planId: 'MICROS_PRO',
      } as any,
      capabilities: {} as any,
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(
      <SystemDiagnosticsPanel
        open={true}
        onClose={() => {}}
        context="POS"
      />,
    );

    expect(screen.getByText(/PAST_DUE/)).toBeInTheDocument();
    expect(screen.getByText(/at risk/i)).toBeInTheDocument();
  });

  test('marks billing as at risk for EXPIRED status', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: {
        status: 'EXPIRED',
        planId: 'FRANCHISE_CORE',
      } as any,
      capabilities: {} as any,
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(
      <SystemDiagnosticsPanel
        open={true}
        onClose={() => {}}
        context="KDS"
      />,
    );

    expect(screen.getByText(/EXPIRED/)).toBeInTheDocument();
    expect(screen.getByText(/at risk/i)).toBeInTheDocument();
  });

  test('marks billing as at risk for CANCELED status', () => {
    mockUsePlanCapabilities.mockReturnValue({
      subscription: {
        status: 'CANCELED',
        planId: 'MICROS_PRO',
      } as any,
      capabilities: {} as any,
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(
      <SystemDiagnosticsPanel
        open={true}
        onClose={() => {}}
        context="POS"
      />,
    );

    expect(screen.getByText(/CANCELED/)).toBeInTheDocument();
    expect(screen.getByText(/at risk/i)).toBeInTheDocument();
  });
});
