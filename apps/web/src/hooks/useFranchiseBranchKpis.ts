/**
 * useFranchiseBranchKpis Hook
 * E22-FRANCHISE-FE-S3: Fetch KPIs for a single branch from franchise overview
 */

import { useCallback, useEffect, useState } from 'react';
import {
  FranchiseOverviewResponseDto,
  FranchiseOverviewBranchKpi,
} from '@/types/franchise';
import { fetchFranchiseOverview } from '@/lib/franchiseAnalyticsApi';

interface Params {
  year: number;
  month: number;
  branchId: string;
}

interface Result {
  branch: FranchiseOverviewBranchKpi | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useFranchiseBranchKpis({ year, month, branchId }: Params): Result {
  const [branch, setBranch] = useState<FranchiseOverviewBranchKpi | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const overview: FranchiseOverviewResponseDto = await fetchFranchiseOverview({
        year,
        month,
      });
      const found =
        overview.branches.find((b) => b.branchId === branchId) ?? null;
      setBranch(found);
    } catch (err) {
      setError(err as Error);
      setBranch(null);
    } finally {
      setIsLoading(false);
    }
  }, [year, month, branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { branch, isLoading, error, reload: load };
}
