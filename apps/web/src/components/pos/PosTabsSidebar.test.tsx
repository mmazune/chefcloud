/**
 * M26-EXT3: PosTabsSidebar Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PosTabsSidebar } from './PosTabsSidebar';
import type { PosOrderTabInfo } from '@/types/pos';

describe('PosTabsSidebar', () => {
  const mockTabs: PosOrderTabInfo[] = [
    {
      orderId: 'tab-1',
      tabName: 'John – Bar',
      serviceType: 'BAR',
      tableLabel: 'Table 5',
      guestCount: 2,
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
      lastModifiedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      itemCount: 3,
      orderTotal: 45.50,
      status: 'OPEN',
    },
    {
      orderId: 'tab-2',
      tabName: null,
      serviceType: 'DINE_IN',
      tableLabel: 'Table 10',
      guestCount: 4,
      createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 60 mins ago
      lastModifiedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      itemCount: 5,
      orderTotal: 120.00,
      status: 'OPEN',
    },
  ];

  const mockHandlers = {
    onClose: jest.fn(),
    onResumeTab: jest.fn(),
    onRenameTab: jest.fn(),
    onDetachTab: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders null when not open', () => {
    const { container } = render(
      <PosTabsSidebar
        open={false}
        onClose={mockHandlers.onClose}
        tabs={mockTabs}
        onResumeTab={mockHandlers.onResumeTab}
        onRenameTab={mockHandlers.onRenameTab}
        onDetachTab={mockHandlers.onDetachTab}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders sidebar when open with tab count', () => {
    render(
      <PosTabsSidebar
        open={true}
        onClose={mockHandlers.onClose}
        tabs={mockTabs}
        onResumeTab={mockHandlers.onResumeTab}
        onRenameTab={mockHandlers.onRenameTab}
        onDetachTab={mockHandlers.onDetachTab}
      />
    );

    expect(screen.getByText('Open Tabs')).toBeInTheDocument();
    // Check for badge with exact text '2' in the header (not in guest count)
    const badge = screen.getByText('Open Tabs').parentElement?.querySelector('.bg-blue-100');
    expect(badge?.textContent).toBe('2');
  });

  it('displays custom tab names', () => {
    render(
      <PosTabsSidebar
        open={true}
        onClose={mockHandlers.onClose}
        tabs={mockTabs}
        onResumeTab={mockHandlers.onResumeTab}
        onRenameTab={mockHandlers.onRenameTab}
        onDetachTab={mockHandlers.onDetachTab}
      />
    );

    expect(screen.getByText('John – Bar')).toBeInTheDocument();
    expect(screen.getByText('Table 10')).toBeInTheDocument();
  });

  it('shows active tab indicator', () => {
    render(
      <PosTabsSidebar
        open={true}
        onClose={mockHandlers.onClose}
        tabs={mockTabs}
        activeTabId="tab-1"
        onResumeTab={mockHandlers.onResumeTab}
        onRenameTab={mockHandlers.onRenameTab}
        onDetachTab={mockHandlers.onDetachTab}
      />
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('filters tabs by search query', () => {
    render(
      <PosTabsSidebar
        open={true}
        onClose={mockHandlers.onClose}
        tabs={mockTabs}
        onResumeTab={mockHandlers.onResumeTab}
        onRenameTab={mockHandlers.onRenameTab}
        onDetachTab={mockHandlers.onDetachTab}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search tabs...');
    fireEvent.change(searchInput, { target: { value: 'john' } });

    expect(screen.getByText('John – Bar')).toBeInTheDocument();
    expect(screen.queryByText('Table 10')).not.toBeInTheDocument();
  });

  it('calls onResumeTab and closes sidebar when Resume is clicked', () => {
    render(
      <PosTabsSidebar
        open={true}
        onClose={mockHandlers.onClose}
        tabs={mockTabs}
        onResumeTab={mockHandlers.onResumeTab}
        onRenameTab={mockHandlers.onRenameTab}
        onDetachTab={mockHandlers.onDetachTab}
      />
    );

    const resumeButtons = screen.getAllByText('Resume');
    fireEvent.click(resumeButtons[0]);

    // Tabs are sorted oldest first, so tab-2 (60 mins) comes before tab-1 (30 mins)
    expect(mockHandlers.onResumeTab).toHaveBeenCalledWith('tab-2');
    expect(mockHandlers.onClose).toHaveBeenCalled();
  });

  it('calls onRenameTab when Rename button is clicked', () => {
    render(
      <PosTabsSidebar
        open={true}
        onClose={mockHandlers.onClose}
        tabs={mockTabs}
        onResumeTab={mockHandlers.onResumeTab}
        onRenameTab={mockHandlers.onRenameTab}
        onDetachTab={mockHandlers.onDetachTab}
      />
    );

    const renameButtons = screen.getAllByLabelText('Rename tab');
    fireEvent.click(renameButtons[0]);

    // Tabs are sorted oldest first, so tab-2 (60 mins) comes before tab-1 (30 mins)
    expect(mockHandlers.onRenameTab).toHaveBeenCalledWith('tab-2');
  });

  it('calls onDetachTab when Detach button is clicked', () => {
    render(
      <PosTabsSidebar
        open={true}
        onClose={mockHandlers.onClose}
        tabs={mockTabs}
        onResumeTab={mockHandlers.onResumeTab}
        onRenameTab={mockHandlers.onRenameTab}
        onDetachTab={mockHandlers.onDetachTab}
      />
    );

    const detachButtons = screen.getAllByLabelText('Close tab without payment');
    fireEvent.click(detachButtons[0]);

    // Tabs are sorted oldest first, so tab-2 (60 mins) comes before tab-1 (30 mins)
    expect(mockHandlers.onDetachTab).toHaveBeenCalledWith('tab-2');
  });

  it('shows empty state when no tabs', () => {
    render(
      <PosTabsSidebar
        open={true}
        onClose={mockHandlers.onClose}
        tabs={[]}
        onResumeTab={mockHandlers.onResumeTab}
        onRenameTab={mockHandlers.onRenameTab}
        onDetachTab={mockHandlers.onDetachTab}
      />
    );

    expect(screen.getByText('No open tabs')).toBeInTheDocument();
  });

  it('shows empty state when search has no matches', () => {
    render(
      <PosTabsSidebar
        open={true}
        onClose={mockHandlers.onClose}
        tabs={mockTabs}
        onResumeTab={mockHandlers.onResumeTab}
        onRenameTab={mockHandlers.onRenameTab}
        onDetachTab={mockHandlers.onDetachTab}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search tabs...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText('No tabs match your search')).toBeInTheDocument();
  });
});
