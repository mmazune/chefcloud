/**
 * useDevWebhookDeliveries hook for E23-DEVPORTAL-FE-S3
 * Fetches and manages webhook delivery history
 */

import { useCallback, useEffect, useState } from 'react';
import {
  DevWebhookDeliveryDto,
  DevWebhookDeliveryStatus,
} from '@/types/devPortal';
import { fetchDevWebhookDeliveries } from '@/lib/devPortalApi';

interface Params {
  endpointId: string;
  limit?: number;
  status?: DevWebhookDeliveryStatus | 'ALL';
  eventType?: string;
}

interface Result {
  deliveries: DevWebhookDeliveryDto[];
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useDevWebhookDeliveries({
  endpointId,
  limit = 50,
  status = 'ALL',
  eventType,
}: Params): Result {
  const [deliveries, setDeliveries] = useState<DevWebhookDeliveryDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!endpointId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchDevWebhookDeliveries({
        endpointId,
        limit,
        status,
        eventType,
      });
      setDeliveries(res.deliveries ?? []);
    } catch (err) {
      setError(err as Error);
      setDeliveries([]);
    } finally {
      setIsLoading(false);
    }
  }, [endpointId, limit, status, eventType]);

  useEffect(() => {
    void load();
  }, [load]);

  return { deliveries, isLoading, error, reload: load };
}
