import { useCallback, useEffect, useState } from 'react';
import {
  BillingPlanDto,
  OrgSubscriptionDto,
  BillingUsageDto,
} from '@/types/billing';
import {
  fetchBillingPlans,
  fetchOrgSubscription,
  fetchBillingUsage,
} from '@/lib/billingApi';

interface BillingOverviewState {
  plans: BillingPlanDto[];
  subscription: OrgSubscriptionDto | null;
  usage: BillingUsageDto | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useBillingOverview(): BillingOverviewState {
  const [plans, setPlans] = useState<BillingPlanDto[]>([]);
  const [subscription, setSubscription] = useState<OrgSubscriptionDto | null>(
    null,
  );
  const [usage, setUsage] = useState<BillingUsageDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [plansRes, subRes, usageRes] = await Promise.all([
        fetchBillingPlans(),
        fetchOrgSubscription(),
        fetchBillingUsage(),
      ]);
      setPlans(plansRes);
      setSubscription(subRes);
      setUsage(usageRes);
    } catch (err) {
      setError(err as Error);
      setPlans([]);
      setSubscription(null);
      setUsage(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    plans,
    subscription,
    usage,
    isLoading,
    error,
    reload: load,
  };
}
