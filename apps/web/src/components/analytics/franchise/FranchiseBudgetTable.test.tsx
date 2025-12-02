/**
 * Tests for FranchiseBudgetTable component
 * E22-FRANCHISE-FE-S1
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { FranchiseBudgetTable } from './FranchiseBudgetTable';
import { FranchiseBudgetVarianceResponseDto } from '@/types/franchise';

describe('FranchiseBudgetTable', () => {
  it('renders "No budget data" when branches list is empty', () => {
    const emptyVariance: FranchiseBudgetVarianceResponseDto = {
      year: 2025,
      month: 1,
      branches: [],
    };

    render(<FranchiseBudgetTable variance={emptyVariance} currency="UGX" />);

    expect(screen.getByText(/No budget data for this month/i)).toBeInTheDocument();
  });

  it('renders branch rows with budget, actual, and variance columns', () => {
    const varianceData: FranchiseBudgetVarianceResponseDto = {
      year: 2025,
      month: 2,
      branches: [
        {
          branchId: 'b1',
          branchName: 'Downtown Branch',
          budgetAmountCents: 1000000, // 10,000
          actualNetSalesCents: 1200000, // 12,000
          varianceAmountCents: 200000, // +2,000
          variancePercent: 20.0,
        },
        {
          branchId: 'b2',
          branchName: 'Uptown Branch',
          budgetAmountCents: 800000, // 8,000
          actualNetSalesCents: 750000, // 7,500
          varianceAmountCents: -50000, // -500
          variancePercent: -6.25,
        },
      ],
    };

    render(<FranchiseBudgetTable variance={varianceData} currency="UGX" />);

    // Check branch names
    expect(screen.getByText('Downtown Branch')).toBeInTheDocument();
    expect(screen.getByText('Uptown Branch')).toBeInTheDocument();

    // Check budget values (formatted with commas)
    expect(screen.getByText(/UGX 10,000/)).toBeInTheDocument();
    expect(screen.getByText(/UGX 8,000/)).toBeInTheDocument();

    // Check variance percentages
    expect(screen.getByText(/\+20\.0%/)).toBeInTheDocument();
    expect(screen.getByText(/-6\.3%/)).toBeInTheDocument(); // -6.25% rounds to -6.3%
  });

  it('applies emerald color class for positive variance', () => {
    const positiveVariance: FranchiseBudgetVarianceResponseDto = {
      year: 2025,
      month: 3,
      branches: [
        {
          branchId: 'b1',
          branchName: 'Test Branch',
          budgetAmountCents: 1000000,
          actualNetSalesCents: 1100000,
          varianceAmountCents: 100000,
          variancePercent: 10.0,
        },
      ],
    };

    const { container } = render(
      <FranchiseBudgetTable variance={positiveVariance} currency="UGX" />
    );

    // Check that emerald color is applied to positive variance
    const varianceCells = container.querySelectorAll('.text-emerald-400');
    expect(varianceCells.length).toBeGreaterThan(0);
  });

  it('applies rose color class for negative variance', () => {
    const negativeVariance: FranchiseBudgetVarianceResponseDto = {
      year: 2025,
      month: 3,
      branches: [
        {
          branchId: 'b1',
          branchName: 'Test Branch',
          budgetAmountCents: 1000000,
          actualNetSalesCents: 900000,
          varianceAmountCents: -100000,
          variancePercent: -10.0,
        },
      ],
    };

    const { container } = render(
      <FranchiseBudgetTable variance={negativeVariance} currency="UGX" />
    );

    // Check that rose color is applied to negative variance
    const varianceCells = container.querySelectorAll('.text-rose-400');
    expect(varianceCells.length).toBeGreaterThan(0);
  });
});
