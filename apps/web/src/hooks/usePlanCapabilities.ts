import { useCallback, useEffect, useState } from 'react';
import { OrgSubscriptionDto } from '@/types/billing';
import { fetchOrgSubscription } from '@/lib/billingApi';
import { getPlanCapabilities, PlanCapabilities } from '@/config/planCapabilities';

interface UsePlanCapabilitiesResult {
  subscription: OrgSubscriptionDto | null;
  capabilities: PlanCapabilities;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
}

const DEFAULT_CAPS: PlanCapabilities = getPlanCapabilities(null);

export function usePlanCapabilities(): UsePlanCapabilitiesResult {
  const [subscription, setSubscription] = useState<OrgSubscriptionDto | null>(null);
  const [capabilities, setCapabilities] = useState<PlanCapabilities>(DEFAULT_CAPS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const sub = await fetchOrgSubscription();
      setSubscription(sub ?? null);
      setCapabilities(getPlanCapabilities(sub?.planId));
    } catch (err) {
      // Fail-open for capabilities if billing is down
      setSubscription(null);
      setCapabilities(DEFAULT_CAPS);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    subscription,
    capabilities,
    isLoading,
    error,
    reload: load,
  };
}
