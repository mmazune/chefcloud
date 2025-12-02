/**
 * useDevWebhooks hook for E23-DEVPORTAL-FE-S2
 * Fetches and manages list of webhook endpoints
 */

import { useCallback, useEffect, useState } from 'react';
import { DevWebhookEndpointDto } from '@/types/devPortal';
import { fetchDevWebhooks } from '@/lib/devPortalApi';

interface Result {
  webhooks: DevWebhookEndpointDto[];
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useDevWebhooks(): Result {
  const [webhooks, setWebhooks] = useState<DevWebhookEndpointDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchDevWebhooks();
      setWebhooks(result);
    } catch (err) {
      setError(err as Error);
      setWebhooks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { webhooks, isLoading, error, reload: load };
}
