/**
 * Hook for fetching franchise budgets for a given month
 * E22-FRANCHISE-FE-S1
 */

import { useEffect, useState, useCallback } from 'react';
import { FranchiseBudgetDto } from '@/types/franchise';
import { fetchFranchiseBudgets } from '@/lib/franchiseAnalyticsApi';

export function useFranchiseBudgets(params: { year: number; month: number }) {
  const [data, setData] = useState<FranchiseBudgetDto[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchFranchiseBudgets(params);
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
