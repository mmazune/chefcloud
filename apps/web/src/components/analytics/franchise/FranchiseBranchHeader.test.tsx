/**
 * FranchiseBranchHeader Component Tests
 * E22-FRANCHISE-FE-S3: Test branch header display
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { FranchiseBranchHeader } from './FranchiseBranchHeader';
import { FranchiseOverviewBranchKpi } from '@/types/franchise';

describe('FranchiseBranchHeader', () => {
  const mockBranch: FranchiseOverviewBranchKpi = {
    branchId: 'branch-1',
    branchName: 'Downtown Branch',
    grossSalesCents: 5000000,
    netSalesCents: 4500000,
    totalOrders: 150,
    avgCheckCents: 30000,
    totalGuests: 180,
    marginAmountCents: 1350000,
    marginPercent: 30,
    staffKpiScore: 85,
  };

  it('renders branch name correctly', () => {
    render(<FranchiseBranchHeader branch={mockBranch} currency="UGX" />);

    expect(screen.getByText('Downtown Branch')).toBeInTheDocument();
  });

  it('renders net sales with currency formatting', () => {
    render(<FranchiseBranchHeader branch={mockBranch} currency="UGX" />);

    expect(screen.getByText('UGX 45,000')).toBeInTheDocument();
  });

  it('renders margin percentage', () => {
    render(<FranchiseBranchHeader branch={mockBranch} currency="UGX" />);

    expect(screen.getByText('30.0%')).toBeInTheDocument();
  });

  it('renders staff KPI score when available', () => {
    render(<FranchiseBranchHeader branch={mockBranch} currency="UGX" />);

    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('renders placeholder when staff KPI score is missing', () => {
    const branchWithoutKpi = { ...mockBranch, staffKpiScore: undefined };

    render(<FranchiseBranchHeader branch={branchWithoutKpi} currency="UGX" />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('displays description text', () => {
    render(<FranchiseBranchHeader branch={mockBranch} currency="UGX" />);

    expect(
      screen.getByText('Detailed franchise analytics for this location.'),
    ).toBeInTheDocument();
  });
});
