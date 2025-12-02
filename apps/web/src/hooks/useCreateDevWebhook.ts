/**
 * useCreateDevWebhook hook for E23-DEVPORTAL-FE-S2
 * Creates new webhook endpoints
 */

import { useState } from 'react';
import {
  CreateDevWebhookRequestDto,
  DevWebhookEndpointDto,
} from '@/types/devPortal';
import { createDevWebhook } from '@/lib/devPortalApi';

interface Result {
  isCreating: boolean;
  error: Error | null;
  createWebhook: (
    payload: CreateDevWebhookRequestDto,
  ) => Promise<DevWebhookEndpointDto | null>;
}

export function useCreateDevWebhook(
  onCreated?: (endpoint: DevWebhookEndpointDto) => void,
): Result {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function createWebhookFn(
    payload: CreateDevWebhookRequestDto,
  ): Promise<DevWebhookEndpointDto | null> {
    setIsCreating(true);
    setError(null);
    try {
      const endpoint = await createDevWebhook(payload);
      onCreated?.(endpoint);
      return endpoint;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsCreating(false);
    }
  }

  return { isCreating, error, createWebhook: createWebhookFn };
}
