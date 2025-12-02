/**
 * Tests for FranchiseForecastCard component
 * E22-FRANCHISE-FE-S1
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { FranchiseForecastCard } from './FranchiseForecastCard';
import { FranchiseForecastResponseDto } from '@/types/franchise';

describe('FranchiseForecastCard', () => {
  it('renders "No forecast data" when branches list is empty', () => {
    const emptyForecast: FranchiseForecastResponseDto = {
      year: 2025,
      month: 2,
      lookbackMonths: 3,
      branches: [],
    };

    render(<FranchiseForecastCard forecast={emptyForecast} currency="UGX" />);

    expect(screen.getByText(/No forecast data available/i)).toBeInTheDocument();
  });

  it('renders total forecast, historical, and growth percentage', () => {
    const forecastData: FranchiseForecastResponseDto = {
      year: 2025,
      month: 2,
      lookbackMonths: 3,
      branches: [
        {
          branchId: 'b1',
          branchName: 'Downtown Branch',
          year: 2025,
          month: 2,
          forecastNetSalesCents: 1500000, // 15,000
          historicalNetSalesCents: 1200000, // 12,000
          avgDailyNetSalesCents: 40000,
          coverageDays: 30,
        },
        {
          branchId: 'b2',
          branchName: 'Uptown Branch',
          year: 2025,
          month: 2,
          forecastNetSalesCents: 1000000, // 10,000
          historicalNetSalesCents: 900000, // 9,000
          avgDailyNetSalesCents: 30000,
          coverageDays: 30,
        },
      ],
    };

    render(<FranchiseForecastCard forecast={forecastData} currency="UGX" />);

    // Check total forecast (15,000 + 10,000 = 25,000)
    expect(screen.getByText(/UGX 25,000/)).toBeInTheDocument();

    // Check historical total (12,000 + 9,000 = 21,000)
    expect(screen.getByText(/UGX 21,000/)).toBeInTheDocument();

    // Check growth percentage ((25000 - 21000) / 21000 * 100 = 19.0%)
    expect(screen.getByText(/\+19\.0%/)).toBeInTheDocument();
  });

  it('shows top 3 forecast branches sorted by forecast amount', () => {
    const forecastData: FranchiseForecastResponseDto = {
      year: 2025,
      month: 3,
      lookbackMonths: 3,
      branches: [
        {
          branchId: 'b1',
          branchName: 'High Branch',
          year: 2025,
          month: 3,
          forecastNetSalesCents: 3000000,
          historicalNetSalesCents: 2500000,
          avgDailyNetSalesCents: 80000,
          coverageDays: 30,
        },
        {
          branchId: 'b2',
          branchName: 'Medium Branch',
          year: 2025,
          month: 3,
          forecastNetSalesCents: 2000000,
          historicalNetSalesCents: 1800000,
          avgDailyNetSalesCents: 60000,
          coverageDays: 30,
        },
        {
          branchId: 'b3',
          branchName: 'Low Branch',
          year: 2025,
          month: 3,
          forecastNetSalesCents: 1000000,
          historicalNetSalesCents: 900000,
          avgDailyNetSalesCents: 30000,
          coverageDays: 30,
        },
      ],
    };

    render(<FranchiseForecastCard forecast={forecastData} currency="UGX" />);

    // Check that branches appear in order
    expect(screen.getByText(/1\. High Branch/)).toBeInTheDocument();
    expect(screen.getByText(/2\. Medium Branch/)).toBeInTheDocument();
    expect(screen.getByText(/3\. Low Branch/)).toBeInTheDocument();
  });

  it('displays lookback period and target month metadata', () => {
    const forecastData: FranchiseForecastResponseDto = {
      year: 2025,
      month: 4,
      lookbackMonths: 6,
      branches: [
        {
          branchId: 'b1',
          branchName: 'Test Branch',
          year: 2025,
          month: 4,
          forecastNetSalesCents: 1000000,
          historicalNetSalesCents: 950000,
          avgDailyNetSalesCents: 30000,
          coverageDays: 30,
        },
      ],
    };

    render(<FranchiseForecastCard forecast={forecastData} currency="UGX" />);

    // Check lookback period
    expect(screen.getByText(/6 months/)).toBeInTheDocument();

    // Check target month (2025-04)
    expect(screen.getByText(/2025-04/)).toBeInTheDocument();
  });

  it('shows positive growth in emerald color', () => {
    const positiveGrowthForecast: FranchiseForecastResponseDto = {
      year: 2025,
      month: 2,
      lookbackMonths: 3,
      branches: [
        {
          branchId: 'b1',
          branchName: 'Growing Branch',
          year: 2025,
          month: 2,
          forecastNetSalesCents: 1200000,
          historicalNetSalesCents: 1000000,
          avgDailyNetSalesCents: 40000,
          coverageDays: 30,
        },
      ],
    };

    const { container } = render(
      <FranchiseForecastCard forecast={positiveGrowthForecast} currency="UGX" />
    );

    // Check that emerald color is applied to growth percentage
    const growthElement = container.querySelector('.text-emerald-400');
    expect(growthElement).toBeInTheDocument();
  });
});
