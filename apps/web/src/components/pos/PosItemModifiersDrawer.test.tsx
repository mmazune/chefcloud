/**
 * M26-EXT2: Tests for PosItemModifiersDrawer Component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { PosItemModifiersDrawer } from './PosItemModifiersDrawer';
import { PosMenuItem, PosModifierGroup } from '@/types/pos';

describe('PosItemModifiersDrawer', () => {
  const mockModifierGroups: PosModifierGroup[] = [
    {
      id: 'g1',
      name: 'Size',
      minSelections: 1,
      maxSelections: 1,
      isRequired: true,
      options: [
        { id: 'o1', name: 'Small', priceDelta: -1000 },
        { id: 'o2', name: 'Medium', priceDelta: 0 },
        { id: 'o3', name: 'Large', priceDelta: 1000 },
      ],
    },
    {
      id: 'g2',
      name: 'Extras',
      description: 'Add extra toppings',
      minSelections: 0,
      maxSelections: 2,
      isRequired: false,
      options: [
        { id: 'o4', name: 'Extra cheese', priceDelta: 2000 },
        { id: 'o5', name: 'Bacon', priceDelta: 3000 },
      ],
    },
  ];

  const mockItem: PosMenuItem = {
    id: 'item1',
    name: 'Burger',
    price: 10000,
    modifierGroups: mockModifierGroups,
  };

  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <PosItemModifiersDrawer
        open={false}
        onClose={mockOnClose}
        item={mockItem}
        basePrice={10000}
        onConfirm={mockOnConfirm}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders modifier groups and options when open', () => {
    render(
      <PosItemModifiersDrawer
        open={true}
        onClose={mockOnClose}
        item={mockItem}
        basePrice={10000}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByText('Configure Modifiers')).toBeInTheDocument();
    expect(screen.getByText('Burger')).toBeInTheDocument();
    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('Extras')).toBeInTheDocument();
    expect(screen.getByText('Add extra toppings')).toBeInTheDocument();
    expect(screen.getByText('Small')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Large')).toBeInTheDocument();
    expect(screen.getByText('Extra cheese')).toBeInTheDocument();
    expect(screen.getByText('Bacon')).toBeInTheDocument();
  });

  it('enforces required group validation (save disabled until valid)', () => {
    render(
      <PosItemModifiersDrawer
        open={true}
        onClose={mockOnClose}
        item={mockItem}
        basePrice={10000}
        onConfirm={mockOnConfirm}
      />
    );

    const saveButton = screen.getByText('Save');
    
    // Initially disabled (required group not satisfied)
    expect(saveButton).toBeDisabled();

    // Select a size option
    const mediumButton = screen.getByText('Medium');
    fireEvent.click(mediumButton);

    // Now enabled
    expect(saveButton).not.toBeDisabled();
  });

  it('computes price summary correctly', () => {
    render(
      <PosItemModifiersDrawer
        open={true}
        onClose={mockOnClose}
        item={mockItem}
        basePrice={10000}
        onConfirm={mockOnConfirm}
      />
    );

    // Initially just base price (check in the price summary section)
    expect(screen.getByText(/Base price:/)).toBeInTheDocument();
    expect(screen.getAllByText('10000 UGX').length).toBeGreaterThan(0);

    // Select large (+1000)
    const largeButton = screen.getByText('Large');
    fireEvent.click(largeButton);

    // Should show modifiers line and updated total
    expect(screen.getByText(/\+1000 UGX/)).toBeInTheDocument();
    expect(screen.getAllByText('11000 UGX').length).toBeGreaterThan(0);

    // Select extra cheese (+2000)
    const cheeseButton = screen.getByText('Extra cheese');
    fireEvent.click(cheeseButton);

    // Total should be 10000 + 1000 + 2000 = 13000
    expect(screen.getByText(/\+3000 UGX/)).toBeInTheDocument();
    expect(screen.getAllByText('13000 UGX').length).toBeGreaterThan(0);
  });

  it('pre-populates from existingModifiers', () => {
    render(
      <PosItemModifiersDrawer
        open={true}
        onClose={mockOnClose}
        item={mockItem}
        basePrice={10000}
        existingModifiers={[
          {
            groupId: 'g1',
            groupName: 'Size',
            optionId: 'o3',
            optionName: 'Large',
            priceDelta: 1000,
          },
        ]}
        onConfirm={mockOnConfirm}
      />
    );

    // Large should be selected (check for emerald highlight class)
    const largeButton = screen.getByText('Large');
    expect(largeButton.closest('button')).toHaveClass('border-emerald-500');
    
    // Total should include the modifier
    expect(screen.getAllByText('11000 UGX').length).toBeGreaterThan(0);
  });

  it('calls onConfirm with selected modifiers and total price on save', () => {
    render(
      <PosItemModifiersDrawer
        open={true}
        onClose={mockOnClose}
        item={mockItem}
        basePrice={10000}
        onConfirm={mockOnConfirm}
      />
    );

    // Select medium (0 delta)
    const mediumButton = screen.getByText('Medium');
    fireEvent.click(mediumButton);

    // Select extra cheese (+2000)
    const cheeseButton = screen.getByText('Extra cheese');
    fireEvent.click(cheeseButton);

    // Click save
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    expect(mockOnConfirm).toHaveBeenCalledWith(
      [
        {
          groupId: 'g1',
          groupName: 'Size',
          optionId: 'o2',
          optionName: 'Medium',
          priceDelta: 0,
        },
        {
          groupId: 'g2',
          groupName: 'Extras',
          optionId: 'o4',
          optionName: 'Extra cheese',
          priceDelta: 2000,
        },
      ],
      12000 // 10000 + 0 + 2000
    );
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes drawer when cancel is clicked', () => {
    render(
      <PosItemModifiersDrawer
        open={true}
        onClose={mockOnClose}
        item={mockItem}
        basePrice={10000}
        onConfirm={mockOnConfirm}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });
});
