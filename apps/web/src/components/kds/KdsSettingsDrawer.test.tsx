// M31-A11Y-S1: KdsSettingsDrawer accessibility tests
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { KdsSettingsDrawer } from './KdsSettingsDrawer';

// Mock the preferences hook
jest.mock('@/hooks/useKdsPreferences', () => ({
  useKdsPreferences: () => ({
    prefs: {
      priority: {
        dueSoonMinutes: 10,
        lateMinutes: 20,
      },
      display: {
        hideServed: false,
        dimReadyAfterMinutes: 5,
      },
      sounds: {
        enableNewTicketSound: true,
        enableLateTicketSound: true,
      },
    },
    isLoaded: true,
    updatePrefs: jest.fn(),
    resetPrefs: jest.fn(),
  }),
}));

describe('KdsSettingsDrawer - Accessibility', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    isRealtimeConnected: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('has dialog role and is labeled', () => {
    render(<KdsSettingsDrawer {...defaultProps} />);

    const dialog = screen.getByRole('dialog', { name: /KDS Settings/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('tabindex', '-1');
  });

  it('closes when Escape key is pressed', () => {
    const onClose = jest.fn();
    render(<KdsSettingsDrawer {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('close button has accessible label', () => {
    render(<KdsSettingsDrawer {...defaultProps} />);

    const closeButton = screen.getByRole('button', { name: /close settings/i });
    expect(closeButton).toBeInTheDocument();
  });

  it('close button triggers onClose', () => {
    const onClose = jest.fn();
    render(<KdsSettingsDrawer {...defaultProps} onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: /close settings/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render when isOpen is false', () => {
    render(<KdsSettingsDrawer {...defaultProps} isOpen={false} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
