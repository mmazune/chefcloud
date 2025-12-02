/**
 * useUpdateDevWebhook hook for E23-DEVPORTAL-FE-S2
 * Updates existing webhook endpoints
 */

import { useState } from 'react';
import {
  DevWebhookEndpointDto,
  UpdateDevWebhookRequestDto,
} from '@/types/devPortal';
import { updateDevWebhook } from '@/lib/devPortalApi';

interface Result {
  isUpdating: boolean;
  error: Error | null;
  updateWebhook: (
    id: string,
    payload: UpdateDevWebhookRequestDto,
  ) => Promise<DevWebhookEndpointDto | null>;
}

export function useUpdateDevWebhook(
  onUpdated?: (endpoint: DevWebhookEndpointDto) => void,
): Result {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function updateWebhookFn(
    id: string,
    payload: UpdateDevWebhookRequestDto,
  ): Promise<DevWebhookEndpointDto | null> {
    setIsUpdating(true);
    setError(null);
    try {
      const endpoint = await updateDevWebhook(id, payload);
      onUpdated?.(endpoint);
      return endpoint;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsUpdating(false);
    }
  }

  return { isUpdating, error, updateWebhook: updateWebhookFn };
}
