import { useState } from 'react';
import {
  BillingPlanId,
  PlanChangeQuoteDto,
  OrgSubscriptionDto,
} from '@/types/billing';
import { fetchPlanChangeQuote, applyPlanChange } from '@/lib/billingApi';

interface Result {
  isQuoting: boolean;
  isChanging: boolean;
  quote: PlanChangeQuoteDto | null;
  error: Error | null;
  requestQuote: (planId: BillingPlanId) => Promise<PlanChangeQuoteDto | null>;
  confirmChange: (planId: BillingPlanId) => Promise<OrgSubscriptionDto | null>;
  clearQuote: () => void;
}

export function usePlanChange(
  onChanged?: (sub: OrgSubscriptionDto) => void,
): Result {
  const [isQuoting, setIsQuoting] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [quote, setQuote] = useState<PlanChangeQuoteDto | null>(null);
  const [error, setError] = useState<Error | null>(null);

  async function requestQuote(
    planId: BillingPlanId,
  ): Promise<PlanChangeQuoteDto | null> {
    setIsQuoting(true);
    setError(null);
    try {
      const res = await fetchPlanChangeQuote(planId);
      setQuote(res);
      return res;
    } catch (err) {
      setError(err as Error);
      setQuote(null);
      return null;
    } finally {
      setIsQuoting(false);
    }
  }

  async function confirmChange(
    planId: BillingPlanId,
  ): Promise<OrgSubscriptionDto | null> {
    setIsChanging(true);
    setError(null);
    try {
      const res = await applyPlanChange(planId);
      onChanged?.(res);
      setQuote(null);
      return res;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsChanging(false);
    }
  }

  function clearQuote() {
    setQuote(null);
    setError(null);
  }

  return {
    isQuoting,
    isChanging,
    quote,
    error,
    requestQuote,
    confirmChange,
    clearQuote,
  };
}
