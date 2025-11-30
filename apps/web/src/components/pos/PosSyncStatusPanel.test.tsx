/**
 * M27-S9: Tests for PosSyncStatusPanel
 * 
 * Validates UI rendering and interaction:
 * - Empty state messages
 * - Status badges (success, pending, failed, conflict)
 * - Cache age and staleness indicators
 * - Control button callbacks
 * - Storage quota display
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PosSyncStatusPanel } from './PosSyncStatusPanel';
import type { SyncLogEntry } from '@/hooks/useOfflineQueue';

const baseProps = {
  isOpen: true,
  onClose: jest.fn(),
  isSyncing: false,
  syncLog: [] as SyncLogEntry[],
  onRetryAll: jest.fn(),
  onClearSnapshots: jest.fn(),
  onClearQueue: jest.fn(),
  onClearSyncHistory: jest.fn(),
  menuAgeMs: null,
  menuIsStale: false,
  openOrdersAgeMs: null,
  openOrdersIsStale: false,
  storageEstimate: {
    usage: 10_000,
    quota: 512 * 1024 * 1024,
    persisted: null,
    isSupported: true,
  },
};

describe('PosSyncStatusPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not render when isOpen is false', () => {
    render(<PosSyncStatusPanel {...baseProps} isOpen={false} />);
    
    expect(screen.queryByText(/Sync Status/i)).not.toBeInTheDocument();
  });

  test('renders empty state message with no log entries', () => {
    render(<PosSyncStatusPanel {...baseProps} />);

    expect(screen.getByText(/No offline actions yet this session/i)).toBeInTheDocument();
  });

  test('shows success badge for successful sync', () => {
    const log: SyncLogEntry[] = [
      {
        id: '1',
        label: 'Create order',
        createdAt: new Date().toISOString(),
        status: 'success',
      },
    ];

    render(<PosSyncStatusPanel {...baseProps} syncLog={log} />);

    expect(screen.getByText('Create order')).toBeInTheDocument();
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });

  test('shows pending badge for pending actions', () => {
    const log: SyncLogEntry[] = [
      {
        id: '1',
        label: 'Add items to order',
        createdAt: new Date().toISOString(),
        status: 'pending',
      },
    ];

    render(<PosSyncStatusPanel {...baseProps} syncLog={log} />);

    expect(screen.getByText('Add items to order')).toBeInTheDocument();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });

  test('shows failed badge and error message', () => {
    const log: SyncLogEntry[] = [
      {
        id: '1',
        label: 'Take payment',
        createdAt: new Date().toISOString(),
        status: 'failed',
        errorMessage: 'HTTP 500: Internal Server Error',
      },
    ];

    render(<PosSyncStatusPanel {...baseProps} syncLog={log} />);

    expect(screen.getByText('Take payment')).toBeInTheDocument();
    const failedElements = screen.getAllByText(/failed/i);
    expect(failedElements.length).toBeGreaterThan(0);
    expect(screen.getByText(/HTTP 500: Internal Server Error/i)).toBeInTheDocument();
  });

  test('shows conflict badge with details', () => {
    const log: SyncLogEntry[] = [
      {
        id: '1',
        label: 'Void order',
        createdAt: new Date().toISOString(),
        status: 'conflict',
        errorMessage: 'Order is already CLOSED on server',
        conflictDetails: {
          reason: 'Order is already CLOSED on server',
          orderId: 'order-123',
          serverStatus: 'CLOSED',
        },
      },
    ];

    render(<PosSyncStatusPanel {...baseProps} syncLog={log} />);

    expect(screen.getByText('Void order')).toBeInTheDocument();
    const conflictElements = screen.getAllByText(/conflict/i);
    expect(conflictElements.length).toBeGreaterThan(0);
    expect(screen.getByText(/Order is already CLOSED/i)).toBeInTheDocument();
  });

  test('displays failed actions alert banner', () => {
    const log: SyncLogEntry[] = [
      {
        id: '1',
        label: 'Pay order',
        createdAt: new Date().toISOString(),
        status: 'failed',
        errorMessage: 'Network timeout',
      },
    ];

    render(<PosSyncStatusPanel {...baseProps} syncLog={log} />);

    expect(screen.getByText(/failed actions present/i)).toBeInTheDocument();
  });

  test('displays conflicts detected alert banner', () => {
    const log: SyncLogEntry[] = [
      {
        id: '1',
        label: 'Void order',
        createdAt: new Date().toISOString(),
        status: 'conflict',
        errorMessage: 'Order already paid',
        conflictDetails: {
          reason: 'Order already paid',
          orderId: 'order-456',
          serverStatus: 'PAID',
        },
      },
    ];

    render(<PosSyncStatusPanel {...baseProps} syncLog={log} />);

    expect(screen.getByText(/Conflicts detected/i)).toBeInTheDocument();
  });

  test('invokes onClose when close button clicked', () => {
    const onClose = jest.fn();
    render(<PosSyncStatusPanel {...baseProps} onClose={onClose} />);

    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    fireEvent.click(closeButtons[0]); // Click the first Close button (header)

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('invokes onRetryAll when retry button clicked', () => {
    const onRetryAll = jest.fn();
    const log: SyncLogEntry[] = [
      {
        id: '1',
        label: 'Create order',
        createdAt: new Date().toISOString(),
        status: 'failed',
      },
    ];

    render(<PosSyncStatusPanel {...baseProps} syncLog={log} onRetryAll={onRetryAll} />);

    const retryButton = screen.getByText(/Retry failed/i);
    fireEvent.click(retryButton);

    expect(onRetryAll).toHaveBeenCalledTimes(1);
  });

  test('invokes onClearSnapshots when clear cache button clicked', () => {
    const onClearSnapshots = jest.fn();
    render(<PosSyncStatusPanel {...baseProps} onClearSnapshots={onClearSnapshots} />);

    const clearButton = screen.getByText(/Clear cached POS data/i);
    fireEvent.click(clearButton);

    expect(onClearSnapshots).toHaveBeenCalledTimes(1);
  });

  test('invokes onClearQueue when clear queue button clicked', () => {
    const onClearQueue = jest.fn();
    render(<PosSyncStatusPanel {...baseProps} onClearQueue={onClearQueue} />);

    const clearButton = screen.getByText(/Clear offline queue/i);
    fireEvent.click(clearButton);

    expect(onClearQueue).toHaveBeenCalledTimes(1);
  });

  test('invokes onClearSyncHistory when clear history button clicked', () => {
    const onClearSyncHistory = jest.fn();
    render(<PosSyncStatusPanel {...baseProps} onClearSyncHistory={onClearSyncHistory} />);

    const clearButton = screen.getByText(/Clear sync history/i);
    fireEvent.click(clearButton);

    expect(onClearSyncHistory).toHaveBeenCalledTimes(1);
  });

  test('displays cache age for menu', () => {
    const fiveMinutesMs = 5 * 60 * 1000;
    
    render(<PosSyncStatusPanel {...baseProps} menuAgeMs={fiveMinutesMs} />);

    expect(screen.getByText(/5 min/i)).toBeInTheDocument();
  });

  test('displays stale indicator for menu', () => {
    const twentyFiveHoursMs = 25 * 60 * 60 * 1000;
    
    render(
      <PosSyncStatusPanel
        {...baseProps}
        menuAgeMs={twentyFiveHoursMs}
        menuIsStale={true}
      />
    );

    expect(screen.getByText(/stale/i)).toBeInTheDocument();
  });

  test('displays cache age for open orders', () => {
    const twoMinutesMs = 2 * 60 * 1000;
    
    render(<PosSyncStatusPanel {...baseProps} openOrdersAgeMs={twoMinutesMs} />);

    expect(screen.getByText(/2 min/i)).toBeInTheDocument();
  });

  test('displays storage quota information', () => {
    const storage = {
      usage: 5 * 1024 * 1024, // 5 MB
      quota: 512 * 1024 * 1024, // 512 MB
      persisted: true,
      isSupported: true,
    };

    render(<PosSyncStatusPanel {...baseProps} storageEstimate={storage} />);

    expect(screen.getByText(/5120 KB/i)).toBeInTheDocument();
    expect(screen.getByText(/512 MB/i)).toBeInTheDocument();
  });

  test('shows syncing indicator when isSyncing is true', () => {
    render(<PosSyncStatusPanel {...baseProps} isSyncing={true} />);

    expect(screen.getByText(/Syncing/i)).toBeInTheDocument();
  });

  test('handles multiple log entries with different statuses', () => {
    const log: SyncLogEntry[] = [
      {
        id: '1',
        label: 'Create order',
        createdAt: new Date().toISOString(),
        status: 'success',
      },
      {
        id: '2',
        label: 'Pay order',
        createdAt: new Date().toISOString(),
        status: 'pending',
      },
      {
        id: '3',
        label: 'Void order',
        createdAt: new Date().toISOString(),
        status: 'failed',
        errorMessage: 'Network error',
      },
      {
        id: '4',
        label: 'Send to kitchen',
        createdAt: new Date().toISOString(),
        status: 'conflict',
        errorMessage: 'Order already sent',
      },
    ];

    render(<PosSyncStatusPanel {...baseProps} syncLog={log} />);

    expect(screen.getByText('Create order')).toBeInTheDocument();
    expect(screen.getByText('Pay order')).toBeInTheDocument();
    expect(screen.getByText('Void order')).toBeInTheDocument();
    expect(screen.getByText('Send to kitchen')).toBeInTheDocument();
    expect(screen.getByText(/failed actions present/i)).toBeInTheDocument();
    expect(screen.getByText(/Conflicts detected/i)).toBeInTheDocument();
  });
});
