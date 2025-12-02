/**
 * Tests for FranchiseMultiMonthChart component
 * E22-FRANCHISE-FE-S2
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { FranchiseMultiMonthChart } from './FranchiseMultiMonthChart';
import { FranchiseMonthlyAggregatePoint } from '@/types/franchise';

describe('FranchiseMultiMonthChart', () => {
  it('renders "No data" message when data array is empty', () => {
    render(<FranchiseMultiMonthChart data={[]} currency="UGX" />);

    expect(screen.getByText(/No data for selected period/i)).toBeInTheDocument();
  });

  it('renders chart container with data', () => {
    const mockData: FranchiseMonthlyAggregatePoint[] = [
      {
        year: 2025,
        month: 10,
        label: 'Oct 2025',
        budgetNetSalesCents: 10000000,
        actualNetSalesCents: 11000000,
        forecastNetSalesCents: 10500000,
      },
      {
        year: 2025,
        month: 11,
        label: 'Nov 2025',
        budgetNetSalesCents: 12000000,
        actualNetSalesCents: 13000000,
        forecastNetSalesCents: 12500000,
      },
      {
        year: 2025,
        month: 12,
        label: 'Dec 2025',
        budgetNetSalesCents: 15000000,
        actualNetSalesCents: 16000000,
        forecastNetSalesCents: 15500000,
      },
    ];

    const { container } = render(<FranchiseMultiMonthChart data={mockData} currency="UGX" />);

    // Check that chart container renders (Recharts may not fully render in tests)
    const chartContainer = container.querySelector('.h-72');
    expect(chartContainer).toBeInTheDocument();
  });

  it('renders without errors when given valid data', () => {
    const mockData: FranchiseMonthlyAggregatePoint[] = [
      {
        year: 2025,
        month: 11,
        label: 'Nov 2025',
        budgetNetSalesCents: 10000000,
        actualNetSalesCents: 11000000,
        forecastNetSalesCents: 10500000,
      },
    ];

    const { container } = render(<FranchiseMultiMonthChart data={mockData} currency="UGX" />);

    // Should render chart container without errors
    expect(container.querySelector('.rounded-lg')).toBeInTheDocument();
  });

  it('renders with correct dark theme styling', () => {
    const mockData: FranchiseMonthlyAggregatePoint[] = [
      {
        year: 2025,
        month: 12,
        label: 'Dec 2025',
        budgetNetSalesCents: 10000000,
        actualNetSalesCents: 11000000,
        forecastNetSalesCents: 10500000,
      },
    ];

    const { container } = render(<FranchiseMultiMonthChart data={mockData} currency="UGX" />);

    // Check for dark theme classes
    const chartContainer = container.querySelector('.border-slate-800');
    expect(chartContainer).toBeInTheDocument();

    const bgContainer = container.querySelector('.bg-slate-950\\/60');
    expect(bgContainer).toBeInTheDocument();
  });

  it('handles single data point without errors', () => {
    const mockData: FranchiseMonthlyAggregatePoint[] = [
      {
        year: 2025,
        month: 12,
        label: 'Dec 2025',
        budgetNetSalesCents: 10000000,
        actualNetSalesCents: 11000000,
        forecastNetSalesCents: 10500000,
      },
    ];

    const { container } = render(<FranchiseMultiMonthChart data={mockData} currency="UGX" />);

    // Should render without errors
    expect(container.querySelector('.h-72')).toBeInTheDocument();
  });

  it('handles large numbers (millions) without errors', () => {
    const mockData: FranchiseMonthlyAggregatePoint[] = [
      {
        year: 2025,
        month: 11,
        label: 'Nov 2025',
        budgetNetSalesCents: 500000000, // 5 million in cents
        actualNetSalesCents: 550000000, // 5.5 million in cents
        forecastNetSalesCents: 525000000, // 5.25 million in cents
      },
    ];

    // This test just ensures rendering doesn't break with large numbers
    const { container } = render(<FranchiseMultiMonthChart data={mockData} currency="UGX" />);

    // Chart should render container
    expect(container.querySelector('.h-72')).toBeInTheDocument();
  });
});
