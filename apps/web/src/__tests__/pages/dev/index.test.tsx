/**
 * Unit tests for Developer Portal Page (E23-S4)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DevPortalPage from '@/pages/dev';
import * as useDevApiKeysHook from '@/hooks/useDevApiKeys';

jest.mock('@/hooks/useDevApiKeys');
jest.mock('@/hooks/usePlanCapabilities', () => ({
  usePlanCapabilities: () => ({
    subscription: { planId: 'FRANCHISE_CORE' },
    capabilities: {
      canUseFranchiseAnalytics: true,
      canUseDevPortal: true,
      canUseKdsMultiStation: true,
      canUseFranchiseExports: true,
      canUseApiUsageAnalytics: true,
    },
    isLoading: false,
    error: null,
    reload: jest.fn(),
  }),
}));
jest.mock('@/components/dev/DevKeysPanel', () => ({
  DevKeysPanel: jest.fn(() => <div data-testid="keys-panel">Keys Panel</div>),
}));
jest.mock('@/components/dev/DevWebhooksPanel', () => ({
  DevWebhooksPanel: jest.fn(() => (
    <div data-testid="webhooks-panel">Webhooks Panel</div>
  )),
}));
jest.mock('@/components/dev/docs/DevDocsQuickstartTab', () => ({
  DevDocsQuickstartTab: jest.fn(() => (
    <div data-testid="docs-tab">Docs Tab</div>
  )),
}));

const mockUseDevApiKeys = useDevApiKeysHook.useDevApiKeys as jest.Mock;

describe('DevPortalPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDevApiKeys.mockReturnValue({
      keys: [],
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });
  });

  it('should render page heading', () => {
    render(<DevPortalPage />);

    expect(screen.getByText('Developer portal')).toBeInTheDocument();
  });

  it('should render page description', () => {
    render(<DevPortalPage />);

    expect(
      screen.getByText(
        /Manage API keys and webhooks for third-party integrations/,
      ),
    ).toBeInTheDocument();
  });

  it('should render all three tab buttons', () => {
    render(<DevPortalPage />);

    expect(screen.getByRole('button', { name: /API keys/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Webhooks/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Docs & quickstart/i }),
    ).toBeInTheDocument();
  });

  it('should show API keys panel by default', () => {
    render(<DevPortalPage />);

    expect(screen.getByTestId('keys-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('webhooks-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('docs-tab')).not.toBeInTheDocument();
  });

  it('should switch to webhooks panel when webhooks tab clicked', async () => {
    render(<DevPortalPage />);

    const webhooksButton = screen.getByRole('button', { name: /Webhooks/i });
    fireEvent.click(webhooksButton);

    await waitFor(() => {
      expect(screen.getByTestId('webhooks-panel')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('keys-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('docs-tab')).not.toBeInTheDocument();
  });

  it('should switch to docs tab when docs button clicked', async () => {
    render(<DevPortalPage />);

    const docsButton = screen.getByRole('button', {
      name: /Docs & quickstart/i,
    });
    fireEvent.click(docsButton);

    await waitFor(() => {
      expect(screen.getByTestId('docs-tab')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('keys-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('webhooks-panel')).not.toBeInTheDocument();
  });

  it('should highlight active tab button', () => {
    render(<DevPortalPage />);

    const keysButton = screen.getByRole('button', { name: /API keys/i });
    const webhooksButton = screen.getByRole('button', { name: /Webhooks/i });
    const docsButton = screen.getByRole('button', {
      name: /Docs & quickstart/i,
    });

    // Keys is active by default
    expect(keysButton).toHaveClass('border-emerald-400');
    expect(webhooksButton).not.toHaveClass('border-emerald-400');
    expect(docsButton).not.toHaveClass('border-emerald-400');

    // Click webhooks
    fireEvent.click(webhooksButton);

    expect(keysButton).not.toHaveClass('border-emerald-400');
    expect(webhooksButton).toHaveClass('border-emerald-400');
    expect(docsButton).not.toHaveClass('border-emerald-400');

    // Click docs
    fireEvent.click(docsButton);

    expect(keysButton).not.toHaveClass('border-emerald-400');
    expect(webhooksButton).not.toHaveClass('border-emerald-400');
    expect(docsButton).toHaveClass('border-emerald-400');
  });

  it('should render back to analytics link', () => {
    render(<DevPortalPage />);

    const backLink = screen.getByText('← Back to analytics');
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/analytics');
  });
});
