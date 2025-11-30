/**
 * M28-KDS-S1: Tests for KdsOrderCard
 * M28-KDS-S4: Extended with tests for preference props
 * 
 * Validates KDS order card rendering, action buttons, and configurable behavior.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { KdsOrderCard } from './KdsOrderCard';
import type { KdsOrder } from '@/types/pos';

const baseOrder: KdsOrder = {
  id: 'o1',
  createdAt: new Date().toISOString(),
  status: 'NEW',
  items: [
    { 
      id: 'i1', 
      name: 'Burger', 
      quantity: 2, 
      modifiers: ['No onions'], 
      notes: 'Extra spicy', 
      status: 'NEW' 
    },
  ],
  tableLabel: 'T1',
  guestCount: 2,
};

describe('KdsOrderCard', () => {
  // M28-KDS-S4: Include preference props in default test props
  const defaultProps = {
    onStart: jest.fn(),
    onReady: jest.fn(),
    onRecall: jest.fn(),
    onServed: jest.fn(),
    dueSoonMinutes: 8,
    lateMinutes: 15,
    dimReadyAfterMinutes: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders order details and actions', () => {
    render(<KdsOrderCard order={baseOrder} {...defaultProps} />);

    expect(screen.getByText(/Burger/)).toBeInTheDocument();
    expect(screen.getByText(/Start ticket/)).toBeInTheDocument();
    expect(screen.getByText(/Mark ready/)).toBeInTheDocument();
  });

  it('shows table label and guest count', () => {
    render(<KdsOrderCard order={baseOrder} {...defaultProps} />);

    expect(screen.getByText('T1')).toBeInTheDocument();
    expect(screen.getByText(/2 guests/)).toBeInTheDocument();
  });

  it('shows modifiers and notes', () => {
    render(<KdsOrderCard order={baseOrder} {...defaultProps} />);

    expect(screen.getByText(/No onions/)).toBeInTheDocument();
    expect(screen.getByText(/Note: Extra spicy/)).toBeInTheDocument();
  });

  it('calls onStart when Start ticket clicked', () => {
    render(<KdsOrderCard order={baseOrder} {...defaultProps} />);

    fireEvent.click(screen.getByText(/Start ticket/));
    expect(defaultProps.onStart).toHaveBeenCalledTimes(1);
  });

  it('calls onReady when Mark ready clicked', () => {
    render(<KdsOrderCard order={baseOrder} {...defaultProps} />);

    fireEvent.click(screen.getByText(/Mark ready/));
    expect(defaultProps.onReady).toHaveBeenCalledTimes(1);
  });

  it('shows Recall and Mark served buttons for READY status', () => {
    const readyOrder: KdsOrder = { ...baseOrder, status: 'READY' };
    render(<KdsOrderCard order={readyOrder} {...defaultProps} />);

    expect(screen.getByText(/Recall/)).toBeInTheDocument();
    expect(screen.getByText(/Mark served/)).toBeInTheDocument();
    expect(screen.queryByText(/Start ticket/)).not.toBeInTheDocument();
  });

  it('calls onRecall when Recall clicked', () => {
    const readyOrder: KdsOrder = { ...baseOrder, status: 'READY' };
    render(<KdsOrderCard order={readyOrder} {...defaultProps} />);

    fireEvent.click(screen.getByText(/Recall/));
    expect(defaultProps.onRecall).toHaveBeenCalledTimes(1);
  });

  it('calls onServed when Mark served clicked', () => {
    const readyOrder: KdsOrder = { ...baseOrder, status: 'READY' };
    render(<KdsOrderCard order={readyOrder} {...defaultProps} />);

    fireEvent.click(screen.getByText(/Mark served/));
    expect(defaultProps.onServed).toHaveBeenCalledTimes(1);
  });

  it('shows status badge', () => {
    render(<KdsOrderCard order={baseOrder} {...defaultProps} />);

    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  it('displays age in minutes', () => {
    const old = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago
    const oldOrder: KdsOrder = { ...baseOrder, createdAt: old };
    render(<KdsOrderCard order={oldOrder} {...defaultProps} />);

    expect(screen.getByText(/10 min ago/)).toBeInTheDocument();
  });

  // M28-KDS-S4: Test that priority respects configured thresholds
  it('shows Due soon badge based on dueSoonMinutes threshold', () => {
    const nineMinsAgo = new Date(Date.now() - 9 * 60 * 1000).toISOString();
    const order = { ...baseOrder, createdAt: nineMinsAgo };

    render(<KdsOrderCard order={order} {...defaultProps} />);

    expect(screen.getByText(/Due soon/i)).toBeInTheDocument();
    expect(screen.queryByText(/Late/i)).not.toBeInTheDocument();
  });

  it('shows Late badge based on lateMinutes threshold', () => {
    const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const order = { ...baseOrder, createdAt: twentyMinAgo };

    render(<KdsOrderCard order={order} {...defaultProps} />);

    expect(screen.getByText(/Late/i)).toBeInTheDocument();
    expect(screen.queryByText(/Due soon/i)).not.toBeInTheDocument();
  });

  it('shows no priority badge for tickets below dueSoonMinutes threshold', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const order = { ...baseOrder, createdAt: fiveMinAgo };

    render(<KdsOrderCard order={order} {...defaultProps} />);

    expect(screen.queryByText(/Due soon/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Late/i)).not.toBeInTheDocument();
  });

  // M28-KDS-S4: Test custom thresholds
  it('respects custom dueSoonMinutes threshold', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const order = { ...baseOrder, createdAt: fiveMinAgo };

    // With dueSoonMinutes=3, a 5-min-old ticket should be "due soon"
    render(<KdsOrderCard order={order} {...defaultProps} dueSoonMinutes={3} lateMinutes={10} dimReadyAfterMinutes={10} />);

    expect(screen.getByText(/Due soon/i)).toBeInTheDocument();
  });

  it('respects custom lateMinutes threshold', () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const order = { ...baseOrder, createdAt: tenMinAgo };

    // With lateMinutes=9, a 10-min-old ticket should be "late"
    render(<KdsOrderCard order={order} {...defaultProps} dueSoonMinutes={5} lateMinutes={9} dimReadyAfterMinutes={10} />);

    expect(screen.getByText(/Late/i)).toBeInTheDocument();
  });

  // M28-KDS-S4: Test dimming behavior
  it('dims READY tickets after dimReadyAfterMinutes', () => {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const readyOrder: KdsOrder = { ...baseOrder, status: 'READY', createdAt: fifteenMinAgo };

    const { container } = render(<KdsOrderCard order={readyOrder} {...defaultProps} dimReadyAfterMinutes={10} />);

    // Check for opacity-70 class (dimming)
    const card = container.querySelector('.opacity-70');
    expect(card).toBeInTheDocument();
  });

  it('does not dim READY tickets below dimReadyAfterMinutes threshold', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const readyOrder: KdsOrder = { ...baseOrder, status: 'READY', createdAt: fiveMinAgo };

    const { container } = render(<KdsOrderCard order={readyOrder} {...defaultProps} dimReadyAfterMinutes={10} />);

    // Should not have opacity-70 class
    const card = container.querySelector('.opacity-70');
    expect(card).not.toBeInTheDocument();
  });

  it('does not dim non-READY tickets regardless of age', () => {
    const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const newOrder: KdsOrder = { ...baseOrder, status: 'NEW', createdAt: twentyMinAgo };

    const { container } = render(<KdsOrderCard order={newOrder} {...defaultProps} dimReadyAfterMinutes={10} />);

    // Should not have opacity-70 class (not READY status)
    const card = container.querySelector('.opacity-70');
    expect(card).not.toBeInTheDocument();
  });
});
