/**
 * Unit tests for BillingStatusBanner component
 * E24-BILLING-FE-S4
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BillingStatusBanner } from './BillingStatusBanner';
import { OrgSubscriptionDto } from '@/types/billing';

describe('BillingStatusBanner', () => {
  describe('when subscription is null', () => {
    it('renders nothing', () => {
      const { container } = render(<BillingStatusBanner subscription={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('does not render billing status section', () => {
      render(<BillingStatusBanner subscription={null} />);
      expect(screen.queryByLabelText('Billing status')).not.toBeInTheDocument();
    });
  });

  describe('when subscription is undefined', () => {
    it('renders nothing', () => {
      const { container } = render(<BillingStatusBanner subscription={undefined as any} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('IN_TRIAL status', () => {
    const trialSubscription: OrgSubscriptionDto = {
      id: 'sub-trial-123',
      orgId: 'org-123',
      planId: 'FRANCHISE_CORE',
      status: 'IN_TRIAL',
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('renders trial label', () => {
      render(<BillingStatusBanner subscription={trialSubscription} />);
      expect(screen.getByText('Trial')).toBeInTheDocument();
    });

    it('renders trial message', () => {
      render(<BillingStatusBanner subscription={trialSubscription} />);
      expect(screen.getByText(/You are currently in a trial period/i)).toBeInTheDocument();
    });

    it('shows "Update payment details" link', () => {
      render(<BillingStatusBanner subscription={trialSubscription} />);
      expect(screen.getByText(/Update payment details/i)).toBeInTheDocument();
    });

    it('does not show "Contact support" link', () => {
      render(<BillingStatusBanner subscription={trialSubscription} />);
      expect(screen.queryByText(/Contact support/i)).not.toBeInTheDocument();
    });

    it('has info styling', () => {
      render(<BillingStatusBanner subscription={trialSubscription} />);
      const banner = screen.getByText('Trial').closest('aside');
      expect(banner).toHaveClass('border-blue-900/60');
      expect(banner).toHaveClass('bg-blue-950/40');
    });
  });

  describe('PAST_DUE status', () => {
    const pastDueSubscription: OrgSubscriptionDto = {
      id: 'sub-pastdue-456',
      orgId: 'org-456',
      planId: 'FRANCHISE_PLUS',
      status: 'PAST_DUE',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('renders payment issue label', () => {
      render(<BillingStatusBanner subscription={pastDueSubscription} />);
      expect(screen.getByText('Payment issue')).toBeInTheDocument();
    });

    it('renders past due headline', () => {
      render(<BillingStatusBanner subscription={pastDueSubscription} />);
      expect(screen.getByText(/Payment is past due/i)).toBeInTheDocument();
    });

    it('shows "Update payment details" link', () => {
      render(<BillingStatusBanner subscription={pastDueSubscription} />);
      expect(screen.getByText(/Update payment details/i)).toBeInTheDocument();
    });

    it('shows "Contact support" link', () => {
      render(<BillingStatusBanner subscription={pastDueSubscription} />);
      expect(screen.getByText(/Contact support/i)).toBeInTheDocument();
    });

    it('has warning styling', () => {
      render(<BillingStatusBanner subscription={pastDueSubscription} />);
      const banner = screen.getByText('Payment issue').closest('aside');
      expect(banner).toHaveClass('border-amber-900/60');
      expect(banner).toHaveClass('bg-amber-950/40');
    });
  });

  describe('EXPIRED status', () => {
    const expiredSubscription: OrgSubscriptionDto = {
      id: 'sub-expired-789',
      orgId: 'org-789',
      planId: 'MICROS_PRO',
      status: 'EXPIRED',
      currentPeriodStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      currentPeriodEnd: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('renders expired label', () => {
      render(<BillingStatusBanner subscription={expiredSubscription} />);
      expect(screen.getByText('Expired')).toBeInTheDocument();
    });

    it('renders expired headline', () => {
      render(<BillingStatusBanner subscription={expiredSubscription} />);
      expect(screen.getByText(/Your subscription has expired/i)).toBeInTheDocument();
    });

    it('shows both CTAs', () => {
      render(<BillingStatusBanner subscription={expiredSubscription} />);
      expect(screen.getByText(/Update payment details/i)).toBeInTheDocument();
      expect(screen.getByText(/Contact support/i)).toBeInTheDocument();
    });

    it('has danger styling', () => {
      render(<BillingStatusBanner subscription={expiredSubscription} />);
      const banner = screen.getByText('Expired').closest('aside');
      expect(banner).toHaveClass('border-rose-900/60');
      expect(banner).toHaveClass('bg-rose-950/40');
    });
  });

  describe('CANCELED status', () => {
    const canceledSubscription: OrgSubscriptionDto = {
      id: 'sub-canceled-abc',
      orgId: 'org-abc',
      planId: 'FRANCHISE_CORE',
      status: 'CANCELED',
      canceledAt: new Date().toISOString(),
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('renders canceled label', () => {
      render(<BillingStatusBanner subscription={canceledSubscription} />);
      expect(screen.getByText('Canceled')).toBeInTheDocument();
    });

    it('renders canceled headline', () => {
      render(<BillingStatusBanner subscription={canceledSubscription} />);
      expect(screen.getByText(/Your subscription has been canceled/i)).toBeInTheDocument();
    });

    it('shows both CTAs', () => {
      render(<BillingStatusBanner subscription={canceledSubscription} />);
      expect(screen.getByText(/Update payment details/i)).toBeInTheDocument();
      // Look for the link element specifically (not the text in subtext)
      const supportLink = screen.getByRole('link', { name: /contact support/i });
      expect(supportLink).toBeInTheDocument();
      expect(supportLink).toHaveAttribute('href', 'mailto:support@chefcloud.io');
    });

    it('has danger styling', () => {
      render(<BillingStatusBanner subscription={canceledSubscription} />);
      const banner = screen.getByText('Canceled').closest('aside');
      expect(banner).toHaveClass('border-rose-900/60');
      expect(banner).toHaveClass('bg-rose-950/40');
    });
  });

  describe('ACTIVE status', () => {
    const activeSubscription: OrgSubscriptionDto = {
      id: 'sub-active-def',
      orgId: 'org-def',
      planId: 'FRANCHISE_PLUS',
      status: 'ACTIVE',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('renders active label', () => {
      render(<BillingStatusBanner subscription={activeSubscription} />);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('renders active headline', () => {
      render(<BillingStatusBanner subscription={activeSubscription} />);
      expect(screen.getByText(/Your subscription is active/i)).toBeInTheDocument();
    });

    it('does not show "Update payment details" link', () => {
      render(<BillingStatusBanner subscription={activeSubscription} />);
      expect(screen.queryByText(/Update payment details/i)).not.toBeInTheDocument();
    });

    it('does not show "Contact support" link', () => {
      render(<BillingStatusBanner subscription={activeSubscription} />);
      expect(screen.queryByText(/Contact support/i)).not.toBeInTheDocument();
    });

    it('has success styling', () => {
      render(<BillingStatusBanner subscription={activeSubscription} />);
      const banner = screen.getByText('Active').closest('aside');
      expect(banner).toHaveClass('border-emerald-900/60');
      expect(banner).toHaveClass('bg-emerald-950/40');
    });
  });

  describe('accessibility', () => {
    it('has aria-label for screen readers', () => {
      const subscription: OrgSubscriptionDto = {
        id: 'sub-a11y',
        orgId: 'org-a11y',
        planId: 'FRANCHISE_CORE',
        status: 'ACTIVE',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      render(<BillingStatusBanner subscription={subscription} />);
      expect(screen.getByLabelText('Billing status')).toBeInTheDocument();
    });
  });
});
