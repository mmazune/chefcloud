/**
 * useRotateDevWebhookSecret hook for E23-DEVPORTAL-FE-S2
 * Rotates webhook endpoint signing secret
 */

import { useState } from 'react';
import { DevWebhookEndpointDto } from '@/types/devPortal';
import { rotateDevWebhookSecret } from '@/lib/devPortalApi';

interface Result {
  isRotating: boolean;
  error: Error | null;
  rotateSecret: (id: string) => Promise<DevWebhookEndpointDto | null>;
}

export function useRotateDevWebhookSecret(
  onRotated?: (endpoint: DevWebhookEndpointDto) => void,
): Result {
  const [isRotating, setIsRotating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function rotateSecretFn(
    id: string,
  ): Promise<DevWebhookEndpointDto | null> {
    setIsRotating(true);
    setError(null);
    try {
      const endpoint = await rotateDevWebhookSecret(id);
      onRotated?.(endpoint);
      return endpoint;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsRotating(false);
    }
  }

  return { isRotating, error, rotateSecret: rotateSecretFn };
}
