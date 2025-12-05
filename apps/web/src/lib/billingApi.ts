import {
  BillingPlanDto,
  OrgSubscriptionDto,
  BillingUsageDto,
  PlanChangeQuoteDto,
  BillingPlanId,
} from "@/types/billing";
import { handleAuthHttpError } from "@/lib/authHttpError";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchBillingPlans(): Promise<BillingPlanDto[]> {
  const res = await fetch(`${API_URL}/billing/plans`, {
    credentials: "include",
  });
  
  if (res.status === 401 || res.status === 419) {
    handleAuthHttpError(res.status);
    throw new Error('Unauthorized');
  }
  
  return handleJson<BillingPlanDto[]>(res);
}

export async function fetchOrgSubscription(): Promise<OrgSubscriptionDto> {
  const res = await fetch(`${API_URL}/billing/org-subscription`, {
    credentials: "include",
  });
  
  if (res.status === 401 || res.status === 419) {
    handleAuthHttpError(res.status);
    throw new Error('Unauthorized');
  }
  
  return handleJson<OrgSubscriptionDto>(res);
}

export async function fetchBillingUsage(): Promise<BillingUsageDto> {
  const res = await fetch(`${API_URL}/billing/usage`, {
    credentials: "include",
  });
  
  if (res.status === 401 || res.status === 419) {
    handleAuthHttpError(res.status);
    throw new Error('Unauthorized');
  }
  
  return handleJson<BillingUsageDto>(res);
}

export async function fetchPlanChangeQuote(
  targetPlanId: BillingPlanId,
): Promise<PlanChangeQuoteDto> {
  const res = await fetch(`${API_URL}/billing/org-subscription/quote-change`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetPlanId }),
  });
  
  if (res.status === 401 || res.status === 419) {
    handleAuthHttpError(res.status);
    throw new Error('Unauthorized');
  }
  
  return handleJson<PlanChangeQuoteDto>(res);
}

export async function applyPlanChange(
  targetPlanId: BillingPlanId,
): Promise<OrgSubscriptionDto> {
  const res = await fetch(`${API_URL}/billing/org-subscription/change-plan`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetPlanId }),
  });
  
  if (res.status === 401 || res.status === 419) {
    handleAuthHttpError(res.status);
    throw new Error('Unauthorized');
  }
  
  return handleJson<OrgSubscriptionDto>(res);
}
