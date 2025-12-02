/**
 * useFranchiseBranchMultiMonthSeries Hook
 * E22-FRANCHISE-FE-S3: Fetch multi-month trend data for a single branch
 */

import { useCallback, useEffect, useState } from 'react';
import {
  FranchiseBranchMonthlyPoint,
  FranchiseBudgetVarianceResponseDto,
  FranchiseForecastResponseDto,
} from '@/types/franchise';
import {
  fetchFranchiseBudgetVariance,
  fetchFranchiseForecast,
} from '@/lib/franchiseAnalyticsApi';

interface Params {
  branchId: string;
  startYear: number;
  startMonth: number; // 1–12
  months: number;
  lookbackMonths?: number;
}

interface Result {
  data: FranchiseBranchMonthlyPoint[];
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
}

function monthLabel(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function offsetMonth(year: number, month: number, offset: number) {
  const d = new Date(Date.UTC(year, month - 1, 1));
  d.setUTCMonth(d.getUTCMonth() + offset);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function useFranchiseBranchMultiMonthSeries(
  params: Params,
): Result {
  const { branchId, startYear, startMonth, months, lookbackMonths = 3 } = params;

  const [data, setData] = useState<FranchiseBranchMonthlyPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const monthParams: { year: number; month: number }[] = [];
      for (let i = 0; i < months; i++) {
        monthParams.push(offsetMonth(startYear, startMonth, -i));
      }
      monthParams.reverse();

      const points: FranchiseBranchMonthlyPoint[] = [];

      await Promise.all(
        monthParams.map(async ({ year, month }) => {
          const [variance, forecast]: [
            FranchiseBudgetVarianceResponseDto,
            FranchiseForecastResponseDto,
          ] = await Promise.all([
            fetchFranchiseBudgetVariance({
              year,
              month,
              branchIds: [branchId],
            } as any),
            fetchFranchiseForecast({
              year,
              month,
              lookbackMonths,
              branchIds: [branchId],
            } as any),
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

          points.push({
            year,
            month,
            label: monthLabel(year, month),
            budgetNetSalesCents: budgetTotal,
            actualNetSalesCents: actualTotal,
            forecastNetSalesCents: forecastTotal,
          });
        }),
      );

      points.sort((a, b) =>
        a.year === b.year ? a.month - b.month : a.year - b.year,
      );

      setData(points);
    } catch (err) {
      setError(err as Error);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [branchId, startYear, startMonth, months, lookbackMonths]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, reload: load };
}
