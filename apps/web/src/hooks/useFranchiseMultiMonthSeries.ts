/**
 * Hook for fetching multi-month franchise analytics time series
 * E22-FRANCHISE-FE-S2
 */

import { useCallback, useEffect, useState } from 'react';
import {
  FranchiseMonthlyAggregatePoint,
  FranchiseBudgetVarianceResponseDto,
  FranchiseForecastResponseDto,
} from '@/types/franchise';
import {
  fetchFranchiseBudgetVariance,
  fetchFranchiseForecast,
} from '@/lib/franchiseAnalyticsApi';

interface UseFranchiseMultiMonthSeriesParams {
  startYear: number;
  startMonth: number; // 1–12
  months: number; // e.g. 6
  lookbackMonths?: number; // for forecast, default 3
}

interface UseFranchiseMultiMonthSeriesResult {
  data: FranchiseMonthlyAggregatePoint[];
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
}

function monthLabel(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function offsetMonth(
  year: number,
  month: number,
  offset: number,
): { year: number; month: number } {
  const base = new Date(Date.UTC(year, month - 1, 1));
  base.setUTCMonth(base.getUTCMonth() + offset);
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
  };
}

export function useFranchiseMultiMonthSeries(
  params: UseFranchiseMultiMonthSeriesParams,
): UseFranchiseMultiMonthSeriesResult {
  const { startYear, startMonth, months, lookbackMonths = 3 } = params;

  const [data, setData] = useState<FranchiseMonthlyAggregatePoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const monthParams: { year: number; month: number }[] = [];
      for (let i = 0; i < months; i++) {
        monthParams.push(offsetMonth(startYear, startMonth, -i));
      }
      // Reverse so earliest month first
      monthParams.reverse();

      const results: FranchiseMonthlyAggregatePoint[] = [];

      // Fetch in parallel per month
      await Promise.all(
        monthParams.map(async ({ year, month }) => {
          const [variance, forecast]: [
            FranchiseBudgetVarianceResponseDto,
            FranchiseForecastResponseDto,
          ] = await Promise.all([
            fetchFranchiseBudgetVariance({ year, month }),
            fetchFranchiseForecast({ year, month, lookbackMonths }),
          ]);

          const budgetTotal =
            variance.branches.reduce(
              (sum, b) => sum + (b.budgetAmountCents ?? 0),
              0,
            ) ?? 0;

          const actualTotal =
            variance.branches.reduce(
              (sum, b) => sum + (b.actualNetSalesCents ?? 0),
              0,
            ) ?? 0;

          const forecastTotal =
            forecast.branches.reduce(
              (sum, b) => sum + (b.forecastNetSalesCents ?? 0),
              0,
            ) ?? 0;

          results.push({
            year,
            month,
            label: monthLabel(year, month),
            budgetNetSalesCents: budgetTotal,
            actualNetSalesCents: actualTotal,
            forecastNetSalesCents: forecastTotal,
          });
        }),
      );

      // Sort by year/month ascending
      results.sort((a, b) =>
        a.year === b.year ? a.month - b.month : a.year - b.year,
      );

      setData(results);
    } catch (err) {
      setError(err as Error);
      setData([]);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startYear, startMonth, months, lookbackMonths]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, reload: load };
}
