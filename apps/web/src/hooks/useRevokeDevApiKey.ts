/**
 * useRevokeDevApiKey Hook
 * E23-DEVPORTAL-FE-S1: Revoke API keys
 */

import { useState } from 'react';
import { DevApiKeyDto } from '@/types/devPortal';
import { revokeDevApiKey } from '@/lib/devPortalApi';

interface Result {
  isRevoking: boolean;
  error: Error | null;
  revokeKey: (id: string) => Promise<DevApiKeyDto | null>;
}

export function useRevokeDevApiKey(onRevoked?: (key: DevApiKeyDto) => void): Result {
  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function revokeKey(id: string): Promise<DevApiKeyDto | null> {
    setIsRevoking(true);
    setError(null);
    try {
      const res = await revokeDevApiKey(id);
      const key = res.apiKey;
      onRevoked?.(key);
      return key;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsRevoking(false);
    }
  }

  return { isRevoking, error, revokeKey };
}
