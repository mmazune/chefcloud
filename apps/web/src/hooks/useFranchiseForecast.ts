/**
 * Hook for fetching franchise forecast for a given month
 * E22-FRANCHISE-FE-S1
 */

import { useEffect, useState, useCallback } from 'react';
import { FranchiseForecastResponseDto } from '@/types/franchise';
import { fetchFranchiseForecast } from '@/lib/franchiseAnalyticsApi';

export function useFranchiseForecast(params: {
  year: number;
  month: number;
  lookbackMonths?: number;
}) {
  const [data, setData] = useState<FranchiseForecastResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchFranchiseForecast(params);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.year, params.month, params.lookbackMonths]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, reload: load };
}
