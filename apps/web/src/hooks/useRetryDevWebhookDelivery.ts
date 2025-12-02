/**
 * useRetryDevWebhookDelivery hook for E23-DEVPORTAL-FE-S3
 * Retries failed webhook deliveries
 */

import { useState } from 'react';
import { DevWebhookDeliveryDto } from '@/types/devPortal';
import { retryDevWebhookDelivery } from '@/lib/devPortalApi';

interface Result {
  isRetrying: boolean;
  error: Error | null;
  retry: (deliveryId: string) => Promise<DevWebhookDeliveryDto | null>;
}

export function useRetryDevWebhookDelivery(
  onRetried?: (delivery: DevWebhookDeliveryDto) => void,
): Result {
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function retry(
    deliveryId: string,
  ): Promise<DevWebhookDeliveryDto | null> {
    setIsRetrying(true);
    setError(null);
    try {
      const res = await retryDevWebhookDelivery(deliveryId);
      onRetried?.(res);
      return res;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsRetrying(false);
    }
  }

  return { isRetrying, error, retry };
}
