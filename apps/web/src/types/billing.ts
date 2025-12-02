/**
 * Billing & Subscription Types
 * E24-BILLING-FE-S1
 *
 * Frontend types mirroring E24 backend billing DTOs
 */

export type BillingPlanId =
  | 'MICROS_STARTER'
  | 'MICROS_PRO'
  | 'FRANCHISE_CORE'
  | 'FRANCHISE_PLUS'
  | string; // allow future plans

export type BillingInterval = 'MONTHLY' | 'YEARLY';

export interface BillingPlanDto {
  id: BillingPlanId;
  name: string;
  description: string;
  interval: BillingInterval;
  priceCents: number;
  currency: string; // 'UGX', 'USD', etc.
  features: string[];
  isRecommended: boolean;
  isMicrosTier: boolean;
  isFranchiseTier: boolean;
}

export type BillingSubscriptionStatus =
  | 'IN_TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'EXPIRED'
  | 'CANCELED';

export interface OrgSubscriptionDto {
  planId: BillingPlanId;
  planName: string;
  status: BillingSubscriptionStatus;
  interval: BillingInterval;
  currency: string;
  unitPriceCents: number;
  nextRenewalIso: string | null;
  trialEndsIso: string | null;
  seats: number;
  branchesIncluded: number;
  branchesUsed: number;
  microsOrgsIncluded: number;
  microsOrgsUsed: number;
}

export interface BillingUsageDto {
  window: 'CURRENT_PERIOD' | 'LAST_30_DAYS';
  periodStartIso: string;
  periodEndIso: string;
  apiRequestsUsed: number;
  apiRequestsLimit: number | null;
  smsUsed: number;
  smsLimit: number | null;
  storageMbUsed: number;
  storageMbLimit: number | null;
}

export interface PlanChangeQuoteDto {
  currentPlan: OrgSubscriptionDto;
  targetPlan: BillingPlanDto;
  prorationCents: number;
  currency: string;
  effectiveFromIso: string;
  note: string | null;
}
