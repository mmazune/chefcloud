/**
 * useDevApiKeys Hook
 * E23-DEVPORTAL-FE-S1: Fetch and manage list of API keys
 */

import { useCallback, useEffect, useState } from 'react';
import { DevApiKeyDto } from '@/types/devPortal';
import { fetchDevApiKeys } from '@/lib/devPortalApi';

interface UseDevApiKeysResult {
  keys: DevApiKeyDto[];
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useDevApiKeys(): UseDevApiKeysResult {
  const [keys, setKeys] = useState<DevApiKeyDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchDevApiKeys();
      setKeys(result);
    } catch (err) {
      setError(err as Error);
      setKeys([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { keys, isLoading, error, reload: load };
}
