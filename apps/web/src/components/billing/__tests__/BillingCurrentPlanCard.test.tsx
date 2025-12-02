import { render, screen } from '@testing-library/react';
import { BillingCurrentPlanCard } from '../BillingCurrentPlanCard';
import type { OrgSubscriptionDto } from '@/types/billing';

describe('BillingCurrentPlanCard', () => {
  it('renders empty state when subscription is null', () => {
    render(<BillingCurrentPlanCard subscription={null} />);
    
    expect(screen.getByText('Current Plan')).toBeInTheDocument();
    expect(screen.getByText('No active subscription found.')).toBeInTheDocument();
  });

  it('renders populated subscription with monthly pricing', () => {
    const mockSubscription: OrgSubscriptionDto = {
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

    render(<BillingCurrentPlanCard subscription={mockSubscription} />);

    expect(screen.getByText('Micros Pro')).toBeInTheDocument();
    expect(screen.getByText('$99.00/mo')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText(/Next renewal:/)).toBeInTheDocument();
  });

  it('renders yearly pricing correctly', () => {
    const mockSubscription: OrgSubscriptionDto = {
      planId: 'MICROS_STARTER',
      planName: 'Micros Starter',
      status: 'ACTIVE',
      interval: 'YEARLY',
      currency: 'USD',
      unitPriceCents: 49000,
      nextRenewalIso: '2025-11-01T00:00:00Z',
      trialEndsIso: null,
      seats: 5,
      branchesIncluded: 2,
      branchesUsed: 1,
      microsOrgsIncluded: null,
      microsOrgsUsed: null,
    };

    render(<BillingCurrentPlanCard subscription={mockSubscription} />);

    expect(screen.getByText('$490.00/yr')).toBeInTheDocument();
  });

  it('displays trial end date when in trial', () => {
    const mockSubscription: OrgSubscriptionDto = {
      planId: 'MICROS_PRO',
      planName: 'Micros Pro',
      status: 'IN_TRIAL',
      interval: 'MONTHLY',
      currency: 'USD',
      unitPriceCents: 9900,
      nextRenewalIso: null,
      trialEndsIso: '2024-12-10T00:00:00Z',
      seats: 20,
      branchesIncluded: 10,
      branchesUsed: 3,
      microsOrgsIncluded: null,
      microsOrgsUsed: null,
    };

    render(<BillingCurrentPlanCard subscription={mockSubscription} />);

    expect(screen.getByText('IN_TRIAL')).toBeInTheDocument();
    expect(screen.getByText(/Trial ends:/)).toBeInTheDocument();
  });

  it('displays renewal date when not in trial', () => {
    const mockSubscription: OrgSubscriptionDto = {
      planId: 'MICROS_PRO',
      planName: 'Micros Pro',
      status: 'ACTIVE',
      interval: 'MONTHLY',
      currency: 'USD',
      unitPriceCents: 9900,
      nextRenewalIso: '2024-12-15T00:00:00Z',
      trialEndsIso: null,
      seats: 20,
      branchesIncluded: 10,
      branchesUsed: 5,
      microsOrgsIncluded: null,
      microsOrgsUsed: null,
    };

    render(<BillingCurrentPlanCard subscription={mockSubscription} />);

    expect(screen.getByText(/Next renewal:/)).toBeInTheDocument();
    expect(screen.queryByText(/Trial ends:/)).not.toBeInTheDocument();
  });

  it('renders seat usage information', () => {
    const mockSubscription: OrgSubscriptionDto = {
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

    render(<BillingCurrentPlanCard subscription={mockSubscription} />);

    expect(screen.getByText('Seats')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('renders branch usage information', () => {
    const mockSubscription: OrgSubscriptionDto = {
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

    render(<BillingCurrentPlanCard subscription={mockSubscription} />);

    expect(screen.getByText('Branches')).toBeInTheDocument();
    expect(screen.getByText('7 / 10')).toBeInTheDocument();
  });

  it('renders micros org usage when applicable', () => {
    const mockSubscription: OrgSubscriptionDto = {
      planId: 'FRANCHISE_CORE',
      planName: 'Franchise Core',
      status: 'ACTIVE',
      interval: 'MONTHLY',
      currency: 'USD',
      unitPriceCents: 29900,
      nextRenewalIso: '2024-12-15T00:00:00Z',
      trialEndsIso: null,
      seats: 50,
      branchesIncluded: null,
      branchesUsed: null,
      microsOrgsIncluded: 5,
      microsOrgsUsed: 3,
    };

    render(<BillingCurrentPlanCard subscription={mockSubscription} />);

    expect(screen.getByText('Micros Orgs')).toBeInTheDocument();
    expect(screen.getByText('3 / 5')).toBeInTheDocument();
  });

  it('handles enterprise pricing (0 cents)', () => {
    const mockSubscription: OrgSubscriptionDto = {
      planId: 'ENTERPRISE',
      planName: 'Enterprise',
      status: 'ACTIVE',
      interval: 'YEARLY',
      currency: 'USD',
      unitPriceCents: 0,
      nextRenewalIso: '2025-01-01T00:00:00Z',
      trialEndsIso: null,
      seats: 100,
      branchesIncluded: null,
      branchesUsed: null,
      microsOrgsIncluded: 20,
      microsOrgsUsed: 15,
    };

    render(<BillingCurrentPlanCard subscription={mockSubscription} />);

    expect(screen.getByText('Enterprise')).toBeInTheDocument();
    expect(screen.getByText('Custom pricing')).toBeInTheDocument();
  });

  it('renders PAST_DUE status', () => {
    const mockSubscription: OrgSubscriptionDto = {
      planId: 'MICROS_STARTER',
      planName: 'Micros Starter',
      status: 'PAST_DUE',
      interval: 'MONTHLY',
      currency: 'USD',
      unitPriceCents: 4900,
      nextRenewalIso: '2024-11-20T00:00:00Z',
      trialEndsIso: null,
      seats: 5,
      branchesIncluded: 2,
      branchesUsed: 2,
      microsOrgsIncluded: null,
      microsOrgsUsed: null,
    };

    render(<BillingCurrentPlanCard subscription={mockSubscription} />);

    expect(screen.getByText('PAST_DUE')).toBeInTheDocument();
  });

  it('renders EXPIRED status', () => {
    const mockSubscription: OrgSubscriptionDto = {
      planId: 'MICROS_STARTER',
      planName: 'Micros Starter',
      status: 'EXPIRED',
      interval: 'MONTHLY',
      currency: 'USD',
      unitPriceCents: 4900,
      nextRenewalIso: null,
      trialEndsIso: null,
      seats: 5,
      branchesIncluded: 2,
      branchesUsed: 2,
      microsOrgsIncluded: null,
      microsOrgsUsed: null,
    };

    render(<BillingCurrentPlanCard subscription={mockSubscription} />);

    expect(screen.getByText('EXPIRED')).toBeInTheDocument();
  });

  it('renders CANCELED status', () => {
    const mockSubscription: OrgSubscriptionDto = {
      planId: 'MICROS_PRO',
      planName: 'Micros Pro',
      status: 'CANCELED',
      interval: 'MONTHLY',
      currency: 'USD',
      unitPriceCents: 9900,
      nextRenewalIso: null,
      trialEndsIso: null,
      seats: 20,
      branchesIncluded: 10,
      branchesUsed: 8,
      microsOrgsIncluded: null,
      microsOrgsUsed: null,
    };

    render(<BillingCurrentPlanCard subscription={mockSubscription} />);

    expect(screen.getByText('CANCELED')).toBeInTheDocument();
  });
});
