import type {
  BillingPlanDto,
  OrgSubscriptionDto,
  BillingUsageDto,
  PlanChangeQuoteDto,
} from '@/types/billing';

// Mock data fixtures
let mockPlans: BillingPlanDto[] = [
  {
    id: 'MICROS_STARTER',
    name: 'Micros Starter',
    description: 'Essential features for small teams',
    interval: 'MONTHLY',
    priceCents: 4900,
    currency: 'USD',
    features: ['Up to 5 seats', '2 branches', '10,000 API calls/month', 'Email support'],
    isRecommended: false,
    isMicrosTier: true,
    isFranchiseTier: false,
  },
  {
    id: 'MICROS_PRO',
    name: 'Micros Pro',
    description: 'Advanced features for growing teams',
    interval: 'MONTHLY',
    priceCents: 9900,
    currency: 'USD',
    features: ['Up to 20 seats', '10 branches', '100,000 API calls/month', 'Priority support', 'Advanced analytics'],
    isRecommended: true,
    isMicrosTier: true,
    isFranchiseTier: false,
  },
];

let mockSubscription: OrgSubscriptionDto | null = {
  planId: 'MICROS_PRO',
  planName: 'Micros Pro',
  status: 'ACTIVE',
  interval: 'MONTHLY',
  currency: 'USD',
  unitPriceCents: 9900,
  nextRenewalIso: '2024-12-15T00:00:00Z',
  trialEndsIso: null,
  seats: 12,
  branchesIncluded: 10,
  branchesUsed: 7,
  microsOrgsIncluded: null,
  microsOrgsUsed: null,
};

let mockUsage: BillingUsageDto | null = {
  window: 'CURRENT_PERIOD',
  periodStartIso: '2024-11-01T00:00:00Z',
  periodEndIso: '2024-12-01T00:00:00Z',
  apiRequestsUsed: 45230,
  apiRequestsLimit: 100000,
  smsUsed: 128,
  smsLimit: 500,
  storageMbUsed: 340,
  storageMbLimit: null,
};

let mockQuote: PlanChangeQuoteDto | null = null;

// Mock API functions
export const fetchBillingPlans = jest.fn(async (): Promise<BillingPlanDto[]> => {
  return Promise.resolve(mockPlans);
});

export const fetchOrgSubscription = jest.fn(async (): Promise<OrgSubscriptionDto> => {
  if (!mockSubscription) {
    throw new Error('No subscription found');
  }
  return Promise.resolve(mockSubscription);
});

export const fetchBillingUsage = jest.fn(async (): Promise<BillingUsageDto> => {
  if (!mockUsage) {
    throw new Error('No usage data found');
  }
  return Promise.resolve(mockUsage);
});

export const fetchPlanChangeQuote = jest.fn(async (targetPlanId: string): Promise<PlanChangeQuoteDto> => {
  if (mockQuote) {
    return Promise.resolve(mockQuote);
  }
  // Default quote if none set
  return Promise.resolve({
    currentPlan: mockSubscription?.planId || 'MICROS_PRO',
    targetPlan: targetPlanId,
    prorationCents: 2500,
    currency: 'USD',
    effectiveFromIso: new Date().toISOString(),
    note: 'Upgrade will be applied immediately with prorated credit',
  });
});

export const applyPlanChange = jest.fn(async (targetPlanId: string): Promise<OrgSubscriptionDto> => {
  if (!mockSubscription) {
    throw new Error('No subscription found');
  }
  // Simulate plan change by updating mock subscription
  const updatedSubscription: OrgSubscriptionDto = {
    ...mockSubscription,
    planId: targetPlanId,
    planName: targetPlanId.replace(/_/g, ' '),
  };
  mockSubscription = updatedSubscription;
  return Promise.resolve(updatedSubscription);
});

// Test helper functions to override mock data
export const __setPlans = (plans: BillingPlanDto[]) => {
  mockPlans = plans;
};

export const __setSubscription = (subscription: OrgSubscriptionDto | null) => {
  mockSubscription = subscription;
};

export const __setUsage = (usage: BillingUsageDto | null) => {
  mockUsage = usage;
};

export const __setQuote = (quote: PlanChangeQuoteDto | null) => {
  mockQuote = quote;
};

// Reset helper to restore defaults between tests
export const __reset = () => {
  mockPlans = [
    {
      id: 'MICROS_STARTER',
      name: 'Micros Starter',
      description: 'Essential features for small teams',
      interval: 'MONTHLY',
      priceCents: 4900,
      currency: 'USD',
      features: ['Up to 5 seats', '2 branches', '10,000 API calls/month', 'Email support'],
      isRecommended: false,
      isMicrosTier: true,
      isFranchiseTier: false,
    },
    {
      id: 'MICROS_PRO',
      name: 'Micros Pro',
      description: 'Advanced features for growing teams',
      interval: 'MONTHLY',
      priceCents: 9900,
      currency: 'USD',
      features: ['Up to 20 seats', '10 branches', '100,000 API calls/month', 'Priority support', 'Advanced analytics'],
      isRecommended: true,
      isMicrosTier: true,
      isFranchiseTier: false,
    },
  ];
  mockSubscription = {
    planId: 'MICROS_PRO',
    planName: 'Micros Pro',
    status: 'ACTIVE',
    interval: 'MONTHLY',
    currency: 'USD',
    unitPriceCents: 9900,
    nextRenewalIso: '2024-12-15T00:00:00Z',
    trialEndsIso: null,
    seats: 12,
    branchesIncluded: 10,
    branchesUsed: 7,
    microsOrgsIncluded: null,
    microsOrgsUsed: null,
  };
  mockUsage = {
    window: 'CURRENT_PERIOD',
    periodStartIso: '2024-11-01T00:00:00Z',
    periodEndIso: '2024-12-01T00:00:00Z',
    apiRequestsUsed: 45230,
    apiRequestsLimit: 100000,
    smsUsed: 128,
    smsLimit: 500,
    storageMbUsed: 340,
    storageMbLimit: null,
  };
  mockQuote = null;

  // Clear jest mock call history
  jest.clearAllMocks();
};
