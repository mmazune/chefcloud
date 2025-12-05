import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BillingPage from '../../../pages/billing/index';
import { useBillingOverview } from '@/hooks/useBillingOverview';

// Mock the hook
jest.mock('@/hooks/useBillingOverview');

// Mock all child components to simplify testing
jest.mock('@/components/billing/BillingCurrentPlanCard', () => ({
  BillingCurrentPlanCard: ({ subscription }: any) => (
    <div data-testid="current-plan-card">
      Current Plan Card - {subscription ? subscription.planName : 'No subscription'}
    </div>
  ),
}));

jest.mock('@/components/billing/BillingUsageCard', () => ({
  BillingUsageCard: ({ usage }: any) => (
    <div data-testid="usage-card">
      Usage Card - {usage ? 'Has usage' : 'No usage'}
    </div>
  ),
}));

jest.mock('@/components/billing/BillingPlansGrid', () => ({
  BillingPlansGrid: ({ plans, currentPlanId }: any) => (
    <div data-testid="plans-grid">
      Plans Grid - {plans.length} plans - {currentPlanId ? `Plan: ${currentPlanId}` : 'No plan'}
    </div>
  ),
}));

jest.mock('@/components/billing/BillingStatusBanner', () => ({
  BillingStatusBanner: ({ subscription }: any) => {
    if (!subscription) return null;
    return (
      <aside data-testid="billing-status-banner" aria-label="Billing status">
        {subscription.status === 'PAST_DUE' && (
          <>
            <div>Payment is past due</div>
            <a href="/billing/payment">Update payment details</a>
          </>
        )}
        {subscription.status === 'ACTIVE' && <div>Your subscription is active</div>}
      </aside>
    );
  },
}));

const mockUseBillingOverview = useBillingOverview as jest.MockedFunction<typeof useBillingOverview>;

describe('Billing Page', () => {
  const mockPlans = [
    {
      id: 'MICROS_STARTER',
      name: 'Micros Starter',
      description: 'Essential features',
      interval: 'MONTHLY' as const,
      priceCents: 4900,
      currency: 'USD',
      features: ['Up to 5 seats'],
      isRecommended: false,
      isMicrosTier: true,
      isFranchiseTier: false,
    },
    {
      id: 'MICROS_PRO',
      name: 'Micros Pro',
      description: 'Advanced features',
      interval: 'MONTHLY' as const,
      priceCents: 9900,
      currency: 'USD',
      features: ['Up to 20 seats'],
      isRecommended: true,
      isMicrosTier: true,
      isFranchiseTier: false,
    },
  ];

  const mockSubscription = {
    planId: 'MICROS_PRO',
    planName: 'Micros Pro',
    status: 'ACTIVE' as const,
    interval: 'MONTHLY' as const,
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

  const mockUsage = {
    window: 'CURRENT_PERIOD' as const,
    periodStartIso: '2024-11-01T00:00:00Z',
    periodEndIso: '2024-12-01T00:00:00Z',
    apiRequestsUsed: 45230,
    apiRequestsLimit: 100000,
    smsUsed: 128,
    smsLimit: 500,
    storageMbUsed: 340,
    storageMbLimit: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page heading', () => {
    mockUseBillingOverview.mockReturnValue({
      plans: mockPlans,
      subscription: mockSubscription,
      usage: mockUsage,
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(<BillingPage />);

    expect(screen.getByText('Billing & subscription')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    mockUseBillingOverview.mockReturnValue({
      plans: [],
      subscription: null,
      usage: null,
      isLoading: true,
      error: null,
      reload: jest.fn(),
    });

    render(<BillingPage />);

    expect(screen.getByText('Loading billing data…')).toBeInTheDocument();
  });

  it('shows error banner when error exists', () => {
    mockUseBillingOverview.mockReturnValue({
      plans: null,
      subscription: null,
      usage: null,
      isLoading: false,
      error: new Error('Failed to load billing data'),
      reload: jest.fn(),
    });

    render(<BillingPage />);

    expect(screen.getByText(/Failed to load billing data/)).toBeInTheDocument();
  });

  it('renders all billing components when data is loaded', () => {
    mockUseBillingOverview.mockReturnValue({
      plans: mockPlans,
      subscription: mockSubscription,
      usage: mockUsage,
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(<BillingPage />);

    expect(screen.getByTestId('current-plan-card')).toBeInTheDocument();
    expect(screen.getByTestId('usage-card')).toBeInTheDocument();
    expect(screen.getByTestId('plans-grid')).toBeInTheDocument();
  });

  it('passes correct props to BillingCurrentPlanCard', () => {
    mockUseBillingOverview.mockReturnValue({
      plans: mockPlans,
      subscription: mockSubscription,
      usage: mockUsage,
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(<BillingPage />);

    const card = screen.getByTestId('current-plan-card');
    expect(card).toHaveTextContent('Micros Pro');
  });

  it('passes correct props to BillingUsageCard', () => {
    mockUseBillingOverview.mockReturnValue({
      plans: mockPlans,
      subscription: mockSubscription,
      usage: mockUsage,
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(<BillingPage />);

    const card = screen.getByTestId('usage-card');
    expect(card).toHaveTextContent('Has usage');
  });

  it('passes correct props to BillingPlansGrid', () => {
    mockUseBillingOverview.mockReturnValue({
      plans: mockPlans,
      subscription: mockSubscription,
      usage: mockUsage,
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(<BillingPage />);

    const grid = screen.getByTestId('plans-grid');
    expect(grid).toHaveTextContent('2 plans');
    expect(grid).toHaveTextContent('Plan: MICROS_PRO');
  });

  it('renders refresh button', () => {
    mockUseBillingOverview.mockReturnValue({
      plans: mockPlans,
      subscription: mockSubscription,
      usage: mockUsage,
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(<BillingPage />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    expect(refreshButton).toBeInTheDocument();
  });

  it('calls reload when refresh button is clicked', async () => {
    const mockReload = jest.fn();
    mockUseBillingOverview.mockReturnValue({
      plans: mockPlans,
      subscription: mockSubscription,
      usage: mockUsage,
      isLoading: false,
      error: null,
      reload: mockReload,
    });

    render(<BillingPage />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalledTimes(1);
    });
  });

  it('disables refresh button while loading', () => {
    mockUseBillingOverview.mockReturnValue({
      plans: null,
      subscription: null,
      usage: null,
      isLoading: true,
      error: null,
      reload: jest.fn(),
    });

    render(<BillingPage />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    expect(refreshButton).toBeDisabled();
  });

  it('handles empty plans array gracefully', () => {
    mockUseBillingOverview.mockReturnValue({
      plans: [],
      subscription: mockSubscription,
      usage: mockUsage,
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(<BillingPage />);

    // Should still render but with empty plans
    expect(screen.getByTestId('plans-grid')).toBeInTheDocument();
  });

  it('handles null subscription gracefully', () => {
    mockUseBillingOverview.mockReturnValue({
      plans: mockPlans,
      subscription: null,
      usage: mockUsage,
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(<BillingPage />);

    const card = screen.getByTestId('current-plan-card');
    expect(card).toHaveTextContent('No subscription');
  });

  it('handles null usage gracefully', () => {
    mockUseBillingOverview.mockReturnValue({
      plans: mockPlans,
      subscription: mockSubscription,
      usage: null,
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });

    render(<BillingPage />);

    const card = screen.getByTestId('usage-card');
    expect(card).toHaveTextContent('No usage');
  });

  it('error does not prevent showing refresh button', () => {
    mockUseBillingOverview.mockReturnValue({
      plans: null,
      subscription: null,
      usage: null,
      isLoading: false,
      error: new Error('Network error'),
      reload: jest.fn(),
    });

    render(<BillingPage />);

    // Refresh button should still be available
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    expect(refreshButton).toBeInTheDocument();
  });

  // E24-BILLING-FE-S4: Billing status banner integration tests
  describe('BillingStatusBanner integration', () => {
    it('shows banner with past due warning when subscription status is PAST_DUE', () => {
      const pastDueSubscription = {
        ...mockSubscription,
        status: 'PAST_DUE' as const,
      };

      mockUseBillingOverview.mockReturnValue({
        plans: mockPlans,
        subscription: pastDueSubscription,
        usage: mockUsage,
        isLoading: false,
        error: null,
        reload: jest.fn(),
      });

      render(<BillingPage />);

      expect(screen.getByLabelText('Billing status')).toBeInTheDocument();
      expect(screen.getByText(/Payment is past due/i)).toBeInTheDocument();
      expect(screen.getByText(/Update payment details/i)).toBeInTheDocument();
    });

    it('does not show banner when subscription is null', () => {
      mockUseBillingOverview.mockReturnValue({
        plans: mockPlans,
        subscription: null,
        usage: mockUsage,
        isLoading: false,
        error: null,
        reload: jest.fn(),
      });

      render(<BillingPage />);

      expect(screen.queryByLabelText('Billing status')).not.toBeInTheDocument();
      expect(screen.queryByTestId('billing-status-banner')).not.toBeInTheDocument();
    });

    it('shows banner with active status when subscription is ACTIVE', () => {
      mockUseBillingOverview.mockReturnValue({
        plans: mockPlans,
        subscription: mockSubscription, // status is ACTIVE
        usage: mockUsage,
        isLoading: false,
        error: null,
        reload: jest.fn(),
      });

      render(<BillingPage />);

      expect(screen.getByLabelText('Billing status')).toBeInTheDocument();
      expect(screen.getByText(/Your subscription is active/i)).toBeInTheDocument();
    });
  });
});
