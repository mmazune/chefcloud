/**
 * M26-EXT3: PosTabNameDialog Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PosTabNameDialog } from './PosTabNameDialog';

describe('PosTabNameDialog', () => {
  const mockHandlers = {
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders null when not open', () => {
    const { container } = render(
      <PosTabNameDialog
        open={false}
        onClose={mockHandlers.onClose}
        mode="create"
        onConfirm={mockHandlers.onConfirm}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders create mode with correct title', () => {
    render(
      <PosTabNameDialog
        open={true}
        onClose={mockHandlers.onClose}
        mode="create"
        onConfirm={mockHandlers.onConfirm}
      />
    );

    expect(screen.getByText('Name Tab')).toBeInTheDocument();
    expect(screen.getByText('Give this tab a custom name for easy identification')).toBeInTheDocument();
  });

  it('renders rename mode with correct title', () => {
    render(
      <PosTabNameDialog
        open={true}
        onClose={mockHandlers.onClose}
        mode="rename"
        currentName="John – Bar"
        onConfirm={mockHandlers.onConfirm}
      />
    );

    expect(screen.getByText('Rename Tab')).toBeInTheDocument();
    expect(screen.getByText('Update the name of this tab')).toBeInTheDocument();
  });

  it('pre-fills input with current name in rename mode', () => {
    render(
      <PosTabNameDialog
        open={true}
        onClose={mockHandlers.onClose}
        mode="rename"
        currentName="John – Bar"
        onConfirm={mockHandlers.onConfirm}
      />
    );

    const input = screen.getByLabelText('Tab Name') as HTMLInputElement;
    expect(input.value).toBe('John – Bar');
  });

  it('disables save button when name is empty', () => {
    render(
      <PosTabNameDialog
        open={true}
        onClose={mockHandlers.onClose}
        mode="create"
        onConfirm={mockHandlers.onConfirm}
      />
    );

    const saveButton = screen.getByText('Create Tab');
    expect(saveButton).toBeDisabled();
  });

  it('enables save button when name is valid', () => {
    render(
      <PosTabNameDialog
        open={true}
        onClose={mockHandlers.onClose}
        mode="create"
        onConfirm={mockHandlers.onConfirm}
      />
    );

    const input = screen.getByLabelText('Tab Name');
    fireEvent.change(input, { target: { value: 'Test Tab' } });

    const saveButton = screen.getByText('Create Tab');
    expect(saveButton).toBeEnabled();
  });

  it('shows character count indicator', () => {
    render(
      <PosTabNameDialog
        open={true}
        onClose={mockHandlers.onClose}
        mode="create"
        onConfirm={mockHandlers.onConfirm}
      />
    );

    expect(screen.getByText('50 characters left')).toBeInTheDocument();

    const input = screen.getByLabelText('Tab Name');
    fireEvent.change(input, { target: { value: 'Test' } });

    expect(screen.getByText('46 characters left')).toBeInTheDocument();
  });

  it('calls onConfirm with trimmed name and closes dialog', () => {
    render(
      <PosTabNameDialog
        open={true}
        onClose={mockHandlers.onClose}
        mode="create"
        onConfirm={mockHandlers.onConfirm}
      />
    );

    const input = screen.getByLabelText('Tab Name');
    fireEvent.change(input, { target: { value: '  Test Tab  ' } });

    const saveButton = screen.getByText('Create Tab');
    fireEvent.click(saveButton);

    expect(mockHandlers.onConfirm).toHaveBeenCalledWith('Test Tab');
    expect(mockHandlers.onClose).toHaveBeenCalled();
  });

  it('calls onClose when Cancel button is clicked', () => {
    render(
      <PosTabNameDialog
        open={true}
        onClose={mockHandlers.onClose}
        mode="create"
        onConfirm={mockHandlers.onConfirm}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockHandlers.onClose).toHaveBeenCalled();
    expect(mockHandlers.onConfirm).not.toHaveBeenCalled();
  });

  it('enforces max length of 50 characters', () => {
    render(
      <PosTabNameDialog
        open={true}
        onClose={mockHandlers.onClose}
        mode="create"
        onConfirm={mockHandlers.onConfirm}
      />
    );

    const input = screen.getByLabelText('Tab Name') as HTMLInputElement;
    
    // Verify maxLength property is set (browsers enforce this automatically)
    expect(input.maxLength).toBe(50);
  });

  it('shows warning when approaching character limit', () => {
    render(
      <PosTabNameDialog
        open={true}
        onClose={mockHandlers.onClose}
        mode="create"
        onConfirm={mockHandlers.onConfirm}
      />
    );

    const input = screen.getByLabelText('Tab Name');
    fireEvent.change(input, { target: { value: 'A'.repeat(45) } });

    const remainingText = screen.getByText('5 characters left');
    expect(remainingText).toHaveClass('text-amber-600');
  });
});
