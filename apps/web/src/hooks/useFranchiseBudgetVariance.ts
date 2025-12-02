/**
 * Hook for fetching franchise budget variance for a given month
 * E22-FRANCHISE-FE-S1
 */

import { useEffect, useState, useCallback } from 'react';
import { FranchiseBudgetVarianceResponseDto } from '@/types/franchise';
import { fetchFranchiseBudgetVariance } from '@/lib/franchiseAnalyticsApi';

export function useFranchiseBudgetVariance(params: { year: number; month: number }) {
  const [data, setData] = useState<FranchiseBudgetVarianceResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchFranchiseBudgetVariance(params);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.year, params.month]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, reload: load };
}
