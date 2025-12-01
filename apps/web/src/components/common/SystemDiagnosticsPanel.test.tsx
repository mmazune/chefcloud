import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SystemDiagnosticsPanel } from './SystemDiagnosticsPanel';

// Mock hooks it uses
jest.mock('@/hooks/useDeviceRole', () => ({
  useDeviceRole: () => ({ role: 'POS', isLoaded: true }),
}));
jest.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => ({ isOnline: true }),
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

describe('SystemDiagnosticsPanel', () => {
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
  });
});
