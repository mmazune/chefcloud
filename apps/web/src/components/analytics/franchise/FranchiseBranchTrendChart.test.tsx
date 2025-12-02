/**
 * FranchiseBranchTrendChart Component Tests
 * E22-FRANCHISE-FE-S3: Test branch trend chart rendering
 */

import React from 'react';
import { render } from '@testing-library/react';
import { FranchiseBranchTrendChart } from './FranchiseBranchTrendChart';
import { FranchiseBranchMonthlyPoint } from '@/types/franchise';

describe('FranchiseBranchTrendChart', () => {
  const mockData: FranchiseBranchMonthlyPoint[] = [
    {
      year: 2025,
      month: 10,
      label: 'Oct 2025',
      budgetNetSalesCents: 2000000,
      actualNetSalesCents: 2100000,
      forecastNetSalesCents: 2150000,
    },
    {
      year: 2025,
      month: 11,
      label: 'Nov 2025',
      budgetNetSalesCents: 2200000,
      actualNetSalesCents: 2300000,
      forecastNetSalesCents: 2350000,
    },
    {
      year: 2025,
      month: 12,
      label: 'Dec 2025',
      budgetNetSalesCents: 2500000,
      actualNetSalesCents: 2600000,
      forecastNetSalesCents: 2650000,
    },
  ];

  it('renders "No data" message when data array is empty', () => {
    const { container } = render(
      <FranchiseBranchTrendChart data={[]} currency="UGX" />,
    );

    expect(container.textContent).toContain('No data for this branch and period');
  });

  it('renders chart container with data', () => {
    const { container } = render(
      <FranchiseBranchTrendChart data={mockData} currency="UGX" />,
    );

    expect(container.querySelector('.h-72')).toBeInTheDocument();
  });

  it('renders without errors when given valid data', () => {
    const { container } = render(
      <FranchiseBranchTrendChart data={mockData} currency="UGX" />,
    );

    expect(container.querySelector('.rounded-lg')).toBeInTheDocument();
  });

  it('renders with correct dark theme styling', () => {
    const { container } = render(
      <FranchiseBranchTrendChart data={mockData} currency="UGX" />,
    );

    expect(container.querySelector('.border-slate-800')).toBeInTheDocument();
    expect(container.querySelector('.bg-slate-950\\/60')).toBeInTheDocument();
  });

  it('handles single data point without errors', () => {
    const singlePoint = [mockData[0]];

    const { container } = render(
      <FranchiseBranchTrendChart data={singlePoint} currency="UGX" />,
    );

    expect(container.querySelector('.h-72')).toBeInTheDocument();
  });

  it('handles large numbers (millions) without errors', () => {
    const largeData: FranchiseBranchMonthlyPoint[] = [
      {
        year: 2025,
        month: 12,
        label: 'Dec 2025',
        budgetNetSalesCents: 500000000, // 5 million
        actualNetSalesCents: 520000000,
        forecastNetSalesCents: 530000000,
      },
    ];

    const { container } = render(
      <FranchiseBranchTrendChart data={largeData} currency="UGX" />,
    );

    expect(container.querySelector('.h-72')).toBeInTheDocument();
  });
});
