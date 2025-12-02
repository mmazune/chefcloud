/**
 * useCreateDevApiKey Hook
 * E23-DEVPORTAL-FE-S1: Create new API keys
 */

import { useState } from 'react';
import {
  CreateDevApiKeyRequestDto,
  DevApiKeyDto,
} from '@/types/devPortal';
import { createDevApiKey } from '@/lib/devPortalApi';

interface Result {
  isCreating: boolean;
  error: Error | null;
  createKey: (payload: CreateDevApiKeyRequestDto) => Promise<DevApiKeyDto | null>;
}

export function useCreateDevApiKey(onCreated?: (key: DevApiKeyDto) => void): Result {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function createKey(
    payload: CreateDevApiKeyRequestDto,
  ): Promise<DevApiKeyDto | null> {
    setIsCreating(true);
    setError(null);
    try {
      const res = await createDevApiKey(payload);
      const key = res.apiKey;
      onCreated?.(key);
      return key;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsCreating(false);
    }
  }

  return { isCreating, error, createKey };
}
