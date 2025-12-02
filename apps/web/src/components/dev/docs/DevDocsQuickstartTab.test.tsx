/**
 * Unit tests for DevDocsQuickstartTab component (E23-S4)
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { DevDocsQuickstartTab } from './DevDocsQuickstartTab';

jest.mock('@/config/devPortalConfig', () => ({
  devPortalConfig: {
    sandboxBaseUrl: 'https://sandbox-api.test.com',
    productionBaseUrl: 'https://api.test.com',
    docsExternalUrl: undefined,
  },
}));

jest.mock('@/components/dev/docs/DevQuickstartSnippets', () => ({
  DevQuickstartSnippets: jest.fn(() => (
    <div data-testid="quickstart-snippets">Snippets</div>
  )),
}));

jest.mock('@/components/dev/docs/DevWebhooksOverviewCard', () => ({
  DevWebhooksOverviewCard: jest.fn(() => (
    <div data-testid="webhooks-overview">Webhooks</div>
  )),
}));

jest.mock('@/components/dev/docs/DevSecurityBestPracticesCard', () => ({
  DevSecurityBestPracticesCard: jest.fn(() => (
    <div data-testid="security-practices">Security</div>
  )),
}));

describe('DevDocsQuickstartTab', () => {
  it('should render main heading', () => {
    render(<DevDocsQuickstartTab />);

    expect(
      screen.getByText('Get started with the ChefCloud API'),
    ).toBeInTheDocument();
  });

  it('should render quickstart steps', () => {
    render(<DevDocsQuickstartTab />);

    expect(
      screen.getByText(/1\) Create an API key · 2\) Configure a webhook endpoint/),
    ).toBeInTheDocument();
  });

  it('should display sandbox base URL', () => {
    render(<DevDocsQuickstartTab />);

    expect(screen.getByText('Sandbox base URL:')).toBeInTheDocument();
    expect(
      screen.getByText('https://sandbox-api.test.com'),
    ).toBeInTheDocument();
  });

  it('should display production base URL', () => {
    render(<DevDocsQuickstartTab />);

    expect(screen.getByText('Production base URL:')).toBeInTheDocument();
    expect(screen.getByText('https://api.test.com')).toBeInTheDocument();
  });

  it('should not show external docs link when not configured', () => {
    render(<DevDocsQuickstartTab />);

    expect(
      screen.queryByText('Open external documentation'),
    ).not.toBeInTheDocument();
  });

  it('should render child components', () => {
    render(<DevDocsQuickstartTab />);

    expect(screen.getByTestId('quickstart-snippets')).toBeInTheDocument();
    expect(screen.getByTestId('webhooks-overview')).toBeInTheDocument();
    expect(screen.getByTestId('security-practices')).toBeInTheDocument();
  });
});

describe('DevDocsQuickstartTab with external docs', () => {
  it('should show external docs link when configured', () => {
    // Re-mock with external URL
    jest.resetModules();
    jest.doMock('@/config/devPortalConfig', () => ({
      devPortalConfig: {
        sandboxBaseUrl: 'https://sandbox-api.test.com',
        productionBaseUrl: 'https://api.test.com',
        docsExternalUrl: 'https://docs.example.com',
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DevDocsQuickstartTab: Tab } = require('./DevDocsQuickstartTab');
    render(<Tab />);

    const link = screen.getByText('Open external documentation');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://docs.example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });
});
