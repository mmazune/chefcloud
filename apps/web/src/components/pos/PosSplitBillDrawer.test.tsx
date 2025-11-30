/**
 * M26-EXT1: Tests for PosSplitBillDrawer
 * 
 * Validates split bill UX behavior:
 * - Rendering order total and split parts
 * - Adjusting split count recalculates rows
 * - Balance validation
 * - Submit payload structure
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PosSplitBillDrawer } from './PosSplitBillDrawer';

describe('PosSplitBillDrawer', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    orderId: 'O-123',
    orderTotal: 100,
    currency: 'UGX',
    onSubmitSplit: jest.fn().mockResolvedValue(undefined),
    isSubmitting: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders order total and split parts', () => {
    render(<PosSplitBillDrawer {...defaultProps} />);

    expect(screen.getByText(/Order O-123/i)).toBeInTheDocument();
    expect(screen.getByText(/Total 100\.00 UGX/i)).toBeInTheDocument();
    expect(screen.getByText('Number of parts')).toBeInTheDocument();
  });

  it('initializes with 2-way split by default', () => {
    render(<PosSplitBillDrawer {...defaultProps} />);

    // Should have 2 payment rows
    const partLabels = screen.getAllByText(/Part \d+/);
    expect(partLabels).toHaveLength(2);

    // Split count display should show 2
    const splitCountDisplay = screen.getByText('2');
    expect(splitCountDisplay).toBeInTheDocument();
  });

  it('shows "Balanced" when total matches order total', () => {
    render(<PosSplitBillDrawer {...defaultProps} />);

    // Default 2-way split of 100 should be balanced (50 + 50)
    expect(screen.getByText('Balanced')).toBeInTheDocument();
  });

  it('shows balance delta when payments do not match total', async () => {
    render(<PosSplitBillDrawer {...defaultProps} />);

    // Find first payment amount input and change it
    const amountInputs = screen.getAllByRole('spinbutton', { name: '' });
    const firstAmountInput = amountInputs[0];

    fireEvent.change(firstAmountInput, { target: { value: '40' } });

    await waitFor(() => {
      // Total payments would be 40 + 50 = 90, under by 10
      expect(screen.getByText(/Under by 10\.00 UGX/i)).toBeInTheDocument();
    });
  });

  it('increases split count and redistributes amounts', async () => {
    render(<PosSplitBillDrawer {...defaultProps} />);

    // Click the + button to increase split count
    const increaseButton = screen.getByRole('button', { name: '+' });
    fireEvent.click(increaseButton);

    await waitFor(() => {
      // Should now have 3 parts
      const partLabels = screen.getAllByText(/Part \d+/);
      expect(partLabels).toHaveLength(3);

      // Split count display should show 3
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('decreases split count and redistributes amounts', async () => {
    render(<PosSplitBillDrawer {...defaultProps} />);

    // Start with 2, click - button (should do nothing since minimum is 1)
    const decreaseButton = screen.getByRole('button', { name: '−' });
    
    // Should have 2 parts initially
    let partLabels = screen.getAllByText(/Part \d+/);
    expect(partLabels).toHaveLength(2);

    // Click decrease once (goes to 1)
    fireEvent.click(decreaseButton);

    await waitFor(() => {
      partLabels = screen.getAllByText(/Part \d+/);
      expect(partLabels).toHaveLength(1);
    });
  });

  it('calls onSubmitSplit with correct payload when balanced', async () => {
    const onSubmitSplit = jest.fn().mockResolvedValue(undefined);
    render(<PosSplitBillDrawer {...defaultProps} onSubmitSplit={onSubmitSplit} />);

    // Click submit button
    const submitButton = screen.getByRole('button', { name: /Apply split & charge/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmitSplit).toHaveBeenCalledTimes(1);
      const payload = onSubmitSplit.mock.calls[0][0];
      
      // Should have 2 payments
      expect(payload.payments).toHaveLength(2);
      
      // Sum should equal order total
      const sum = payload.payments.reduce((acc: number, p: any) => acc + p.amount + (p.tipAmount ?? 0), 0);
      expect(sum).toBe(100);
    });
  });

  it('disables submit button when unbalanced', async () => {
    render(<PosSplitBillDrawer {...defaultProps} />);

    // Change first payment to make it unbalanced
    const amountInputs = screen.getAllByRole('spinbutton', { name: '' });
    fireEvent.change(amountInputs[0], { target: { value: '30' } });

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /Apply split & charge/i });
      expect(submitButton).toBeDisabled();
    });
  });

  it('removes a payment row when Remove button clicked', async () => {
    render(<PosSplitBillDrawer {...defaultProps} />);

    // Should start with 2 parts
    let partLabels = screen.getAllByText(/Part \d+/);
    expect(partLabels).toHaveLength(2);

    // Click first Remove button
    const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      partLabels = screen.getAllByText(/Part \d+/);
      expect(partLabels).toHaveLength(1);
    });
  });

  it('calls onClose when Cancel button clicked', () => {
    const onClose = jest.fn();
    render(<PosSplitBillDrawer {...defaultProps} onClose={onClose} />);

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose after successful submit', async () => {
    const onClose = jest.fn();
    const onSubmitSplit = jest.fn().mockResolvedValue(undefined);
    
    render(
      <PosSplitBillDrawer
        {...defaultProps}
        onClose={onClose}
        onSubmitSplit={onSubmitSplit}
      />
    );

    const submitButton = screen.getByRole('button', { name: /Apply split & charge/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmitSplit).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('shows error message when submit fails', async () => {
    const onSubmitSplit = jest.fn().mockRejectedValue(new Error('Network error'));
    
    render(<PosSplitBillDrawer {...defaultProps} onSubmitSplit={onSubmitSplit} />);

    const submitButton = screen.getByRole('button', { name: /Apply split & charge/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it('does not render when isOpen is false', () => {
    render(<PosSplitBillDrawer {...defaultProps} isOpen={false} />);

    expect(screen.queryByText(/Split bill/i)).not.toBeInTheDocument();
  });
});
