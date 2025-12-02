/**
 * Unit tests for DevWebhooksOverviewCard component (E23-S4)
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { DevWebhooksOverviewCard } from './DevWebhooksOverviewCard';

describe('DevWebhooksOverviewCard', () => {
  it('should render component heading', () => {
    render(<DevWebhooksOverviewCard />);

    expect(screen.getByText('Webhooks overview')).toBeInTheDocument();
  });

  it('should render description text', () => {
    render(<DevWebhooksOverviewCard />);

    expect(
      screen.getByText(/Webhooks let ChefCloud push real-time events/),
    ).toBeInTheDocument();
  });

  it('should render all four setup steps', () => {
    render(<DevWebhooksOverviewCard />);

    expect(screen.getByText(/Create an endpoint:/)).toBeInTheDocument();
    expect(screen.getByText(/Handle POST requests:/)).toBeInTheDocument();
    expect(screen.getByText(/Verify signatures:/)).toBeInTheDocument();
    expect(screen.getByText(/Test deliveries:/)).toBeInTheDocument();
  });

  it('should mention Webhooks tab', () => {
    render(<DevWebhooksOverviewCard />);

    expect(screen.getByText(/In the/)).toBeInTheDocument();
    expect(
      screen.getByText(/choose Sandbox or Production/),
    ).toBeInTheDocument();
  });

  it('should mention 2xx response requirement', () => {
    render(<DevWebhooksOverviewCard />);

    expect(screen.getByText(/2xx/)).toBeInTheDocument();
    expect(screen.getByText(/for success/)).toBeInTheDocument();
  });

  it('should mention shared secret for signatures', () => {
    render(<DevWebhooksOverviewCard />);

    expect(screen.getByText(/\*\*\*\*abcd/)).toBeInTheDocument();
    expect(
      screen.getByText(/to validate the signature header/),
    ).toBeInTheDocument();
  });

  it('should mention Send test and View log features', () => {
    render(<DevWebhooksOverviewCard />);

    expect(screen.getByText(/Send test/)).toBeInTheDocument();
    expect(screen.getByText(/View log/)).toBeInTheDocument();
    expect(
      screen.getByText(/to verify your endpoint before going live/),
    ).toBeInTheDocument();
  });

  it('should render security note about secrets', () => {
    render(<DevWebhooksOverviewCard />);

    expect(
      screen.getByText(/Treat webhook secrets like passwords/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Rotate them periodically/),
    ).toBeInTheDocument();
  });

  it('should use ordered list for steps', () => {
    const { container } = render(<DevWebhooksOverviewCard />);

    const orderedList = container.querySelector('ol');
    expect(orderedList).toBeInTheDocument();
    expect(orderedList?.children).toHaveLength(4);
  });
});
