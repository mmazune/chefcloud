/**
 * Phase H5: ErrorState Component Tests
 * 
 * Verifies the ErrorState component renders correctly
 * with retry callbacks and various configurations.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorState } from '@/components/ErrorState';

describe('ErrorState', () => {
  it('renders with default props', () => {
    render(<ErrorState />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders with custom title and message', () => {
    render(
      <ErrorState
        title="Failed to load orders"
        message="The server is currently unavailable."
      />
    );

    expect(screen.getByText('Failed to load orders')).toBeInTheDocument();
    expect(screen.getByText('The server is currently unavailable.')).toBeInTheDocument();
  });

  it('calls onRetry when Try again button is clicked', () => {
    const handleRetry = jest.fn();
    
    render(<ErrorState onRetry={handleRetry} />);

    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();
    
    fireEvent.click(retryButton);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('does not show retry button when onRetry is not provided', () => {
    render(<ErrorState />);

    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('shows home link when showHomeLink is true', () => {
    render(<ErrorState showHomeLink />);

    const homeLink = screen.getByRole('link', { name: /go to dashboard/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute('href', '/dashboard');
  });

  it('uses custom home href when provided', () => {
    render(<ErrorState showHomeLink homeHref="/pos" />);

    const homeLink = screen.getByRole('link', { name: /go to dashboard/i });
    expect(homeLink).toHaveAttribute('href', '/pos');
  });

  it('renders in compact variant', () => {
    const { container } = render(<ErrorState variant="compact" />);

    // Compact variant has smaller padding
    expect(container.querySelector('.py-8')).toBeInTheDocument();
  });

  it('renders in default variant', () => {
    const { container } = render(<ErrorState variant="default" />);

    // Default variant has larger padding
    expect(container.querySelector('.py-16')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<ErrorState className="custom-error-class" />);

    expect(screen.getByRole('alert')).toHaveClass('custom-error-class');
  });

  it('is accessible with proper ARIA attributes', () => {
    render(<ErrorState />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  it('shows both retry button and home link together', () => {
    const handleRetry = jest.fn();
    
    render(<ErrorState onRetry={handleRetry} showHomeLink />);

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to dashboard/i })).toBeInTheDocument();
  });
});
