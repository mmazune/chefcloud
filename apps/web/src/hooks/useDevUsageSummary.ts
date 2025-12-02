import { useCallback, useEffect, useState } from 'react';
import { DevUsageRange, DevUsageSummary } from '@/types/devPortal';
import { fetchDevUsageSummary } from '@/lib/devPortalApi';

interface Result {
  range: DevUsageRange;
  setRange: (range: DevUsageRange) => void;
  summary: DevUsageSummary | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useDevUsageSummary(
  initialRange: DevUsageRange = '24h',
): Result {
  const [range, setRangeState] = useState<DevUsageRange>(initialRange);
  const [summary, setSummary] = useState<DevUsageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(
    async (targetRange: DevUsageRange) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetchDevUsageSummary(targetRange);
        setSummary(res);
      } catch (err) {
        setError(err as Error);
        setSummary(null);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(range);
  }, [range, load]);

  function setRange(next: DevUsageRange) {
    setRangeState(next);
  }

  function reload() {
    void load(range);
  }

  return { range, setRange, summary, isLoading, error, reload };
}
