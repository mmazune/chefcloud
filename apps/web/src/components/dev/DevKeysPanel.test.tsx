/**
 * DevKeysPanel Component Tests
 * E23-DEVPORTAL-FE-S1: Test API keys management UI
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DevKeysPanel } from './DevKeysPanel';
import type { DevApiKeyDto } from '@/types/devPortal';

const mockKeys: DevApiKeyDto[] = [
  {
    id: 'key-1',
    label: 'Pourify Integration',
    environment: 'SANDBOX',
    status: 'ACTIVE',
    createdAt: '2025-12-01T10:00:00Z',
    lastUsedAt: '2025-12-01T12:00:00Z',
    truncatedKey: 'sk_test_****abcd',
  },
  {
    id: 'key-2',
    label: 'Production Key',
    environment: 'PRODUCTION',
    status: 'ACTIVE',
    createdAt: '2025-11-01T10:00:00Z',
    lastUsedAt: null,
    truncatedKey: 'sk_live_****wxyz',
  },
  {
    id: 'key-3',
    label: 'Old Key',
    environment: 'SANDBOX',
    status: 'REVOKED',
    createdAt: '2025-10-01T10:00:00Z',
    lastUsedAt: '2025-10-15T08:00:00Z',
    truncatedKey: 'sk_test_****1234',
  },
];

describe('DevKeysPanel', () => {
  it('displays loading state', () => {
    render(
      <DevKeysPanel
        keys={[]}
        isLoading={true}
        error={null}
        onRefresh={() => {}}
      />,
    );

    expect(screen.getByText(/Loading API keys/i)).toBeInTheDocument();
  });

  it('displays error state', () => {
    render(
      <DevKeysPanel
        keys={[]}
        isLoading={false}
        error={new Error('API failure')}
        onRefresh={() => {}}
      />,
    );

    expect(screen.getByText(/Failed to load API keys/i)).toBeInTheDocument();
    expect(screen.getByText(/API failure/i)).toBeInTheDocument();
  });

  it('displays empty state when no keys exist', () => {
    render(
      <DevKeysPanel
        keys={[]}
        isLoading={false}
        error={null}
        onRefresh={() => {}}
      />,
    );

    expect(
      screen.getByText(/No API keys yet. Create your first key/i),
    ).toBeInTheDocument();
  });

  it('renders API keys table with all columns', () => {
    render(
      <DevKeysPanel
        keys={mockKeys}
        isLoading={false}
        error={null}
        onRefresh={() => {}}
      />,
    );

    expect(screen.getByText('Pourify Integration')).toBeInTheDocument();
    expect(screen.getByText('Production Key')).toBeInTheDocument();
    expect(screen.getByText('Old Key')).toBeInTheDocument();

    expect(screen.getByText('sk_test_****abcd')).toBeInTheDocument();
    expect(screen.getByText('sk_live_****wxyz')).toBeInTheDocument();
  });

  it('displays environment badges correctly', () => {
    render(
      <DevKeysPanel
        keys={mockKeys}
        isLoading={false}
        error={null}
        onRefresh={() => {}}
      />,
    );

    const sandboxBadges = screen.getAllByText('SANDBOX');
    const productionBadges = screen.getAllByText('PRODUCTION');

    expect(sandboxBadges).toHaveLength(2);
    expect(productionBadges).toHaveLength(1);
  });

  it('displays status badges correctly', () => {
    render(
      <DevKeysPanel
        keys={mockKeys}
        isLoading={false}
        error={null}
        onRefresh={() => {}}
      />,
    );

    const activeBadges = screen.getAllByText('Active');
    const revokedBadges = screen.getAllByText('Revoked');

    expect(activeBadges).toHaveLength(2);
    expect(revokedBadges).toHaveLength(1);
  });

  it('displays last used timestamp or "Never"', () => {
    render(
      <DevKeysPanel
        keys={mockKeys}
        isLoading={false}
        error={null}
        onRefresh={() => {}}
      />,
    );

    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('shows revoke button only for active keys', () => {
    render(
      <DevKeysPanel
        keys={mockKeys}
        isLoading={false}
        error={null}
        onRefresh={() => {}}
      />,
    );

    const revokeButtons = screen.getAllByText('Revoke');

    expect(revokeButtons).toHaveLength(2);
  });

  it('opens create dialog when "New API key" button clicked', async () => {
    render(
      <DevKeysPanel
        keys={mockKeys}
        isLoading={false}
        error={null}
        onRefresh={() => {}}
      />,
    );

    const newKeyButton = screen.getByText('New API key');
    fireEvent.click(newKeyButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Pourify integration/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Sandbox')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('closes create dialog when cancel button clicked', async () => {
    render(
      <DevKeysPanel
        keys={mockKeys}
        isLoading={false}
        error={null}
        onRefresh={() => {}}
      />,
    );

    const newKeyButton = screen.getByText('New API key');
    fireEvent.click(newKeyButton);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/Pourify integration/i)).not.toBeInTheDocument();
    });
  });

  it('toggles environment in create dialog', async () => {
    render(
      <DevKeysPanel
        keys={mockKeys}
        isLoading={false}
        error={null}
        onRefresh={() => {}}
      />,
    );

    const newKeyButton = screen.getByText('New API key');
    fireEvent.click(newKeyButton);

    await waitFor(() => {
      expect(screen.getByText('Sandbox')).toBeInTheDocument();
    });

    const productionButton = screen.getByText('Production');
    fireEvent.click(productionButton);

    expect(productionButton.className).toContain('bg-rose-500');
  });

  it('shows confirmation dialog when revoking a key', () => {
    window.confirm = jest.fn(() => false);

    render(
      <DevKeysPanel
        keys={mockKeys}
        isLoading={false}
        error={null}
        onRefresh={() => {}}
      />,
    );

    const revokeButtons = screen.getAllByText('Revoke');
    fireEvent.click(revokeButtons[0]);

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Revoke this API key'),
    );
  });

  it('calls onRefresh after successful key creation', async () => {
    const mockRefresh = jest.fn();

    render(
      <DevKeysPanel
        keys={mockKeys}
        isLoading={false}
        error={null}
        onRefresh={mockRefresh}
      />,
    );

    const newKeyButton = screen.getByText('New API key');
    fireEvent.click(newKeyButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Pourify integration/i)).toBeInTheDocument();
    });

    const labelInput = screen.getByPlaceholderText(/Pourify integration/i);
    fireEvent.change(labelInput, { target: { value: 'Test Integration' } });

    const createButton = screen.getByText('Create key');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
