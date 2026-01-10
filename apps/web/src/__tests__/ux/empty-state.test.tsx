/**
 * Phase H5: EmptyState Component Tests
 * 
 * Verifies the EmptyState component renders correctly
 * with various configurations.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '@/components/EmptyState';
import { FileText, Package } from 'lucide-react';

describe('EmptyState', () => {
  it('renders with basic props', () => {
    render(
      <EmptyState
        icon={FileText}
        title="No documents"
        description="Upload your first document to get started."
      />
    );

    expect(screen.getByText('No documents')).toBeInTheDocument();
    expect(screen.getByText('Upload your first document to get started.')).toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    const handleClick = jest.fn();
    
    render(
      <EmptyState
        icon={Package}
        title="No items"
        description="Add items to your inventory."
        action={{
          label: 'Add Item',
          onClick: handleClick,
        }}
      />
    );

    const button = screen.getByRole('button', { name: /add item/i });
    expect(button).toBeInTheDocument();
    
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when not provided', () => {
    render(
      <EmptyState
        icon={FileText}
        title="No data"
        description="Nothing to show here."
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders with different icons', () => {
    const { container } = render(
      <EmptyState
        icon={Package}
        title="Empty inventory"
        description="No items in stock."
      />
    );

    // The icon should be rendered (as an SVG)
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <EmptyState
        icon={FileText}
        title="Test"
        description="Test description"
        className="custom-empty-state"
      />
    );

    expect(container.firstChild).toHaveClass('custom-empty-state');
  });
});
