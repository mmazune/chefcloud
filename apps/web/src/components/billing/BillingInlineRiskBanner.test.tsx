/**
 * Unit tests for BillingInlineRiskBanner component
 * E24-BILLING-FE-S5
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BillingInlineRiskBanner } from './BillingInlineRiskBanner';
import { OrgSubscriptionDto } from '@/types/billing';

describe('BillingInlineRiskBanner', () => {
  describe('when subscription is null', () => {
    it('renders nothing', () => {
      const { container } = render(
        <BillingInlineRiskBanner subscription={null} contextLabel="Test Feature" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('does not render billing risk notice', () => {
      render(<BillingInlineRiskBanner subscription={null} contextLabel="Test Feature" />);
      expect(screen.queryByLabelText('Billing risk notice')).not.toBeInTheDocument();
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

    it('renders billing risk notice', () => {
      render(
        <BillingInlineRiskBanner subscription={pastDueSubscription} contextLabel="Developer Portal" />
      );
      expect(screen.getByLabelText('Billing risk notice')).toBeInTheDocument();
    });

    it('displays billing issue message', () => {
      render(
        <BillingInlineRiskBanner subscription={pastDueSubscription} contextLabel="Developer Portal" />
      );
      expect(screen.getByText(/Billing issue detected for this organisation/i)).toBeInTheDocument();
    });

    it('includes context label in warning message', () => {
      render(
        <BillingInlineRiskBanner subscription={pastDueSubscription} contextLabel="Developer Portal" />
      );
      expect(screen.getByText(/Your subscription status may impact Developer Portal soon/i)).toBeInTheDocument();
    });

    it('shows "Go to billing" link', () => {
      render(
        <BillingInlineRiskBanner subscription={pastDueSubscription} contextLabel="Developer Portal" />
      );
      const billingLink = screen.getByRole('link', { name: /Go to billing/i });
      expect(billingLink).toBeInTheDocument();
      expect(billingLink).toHaveAttribute('href', '/billing');
    });

    it('shows "Contact support" link with mailto', () => {
      render(
        <BillingInlineRiskBanner subscription={pastDueSubscription} contextLabel="Developer Portal" />
      );
      const supportLink = screen.getByRole('link', { name: /Contact support/i });
      expect(supportLink).toBeInTheDocument();
      expect(supportLink).toHaveAttribute('href', expect.stringContaining('mailto:support@chefcloud.app'));
    });

    it('has warning styling (amber)', () => {
      render(
        <BillingInlineRiskBanner subscription={pastDueSubscription} contextLabel="Developer Portal" />
      );
      const banner = screen.getByLabelText('Billing risk notice');
      expect(banner).toHaveClass('border-amber-700/70');
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

    it('renders billing risk notice', () => {
      render(
        <BillingInlineRiskBanner subscription={expiredSubscription} contextLabel="Franchise analytics" />
      );
      expect(screen.getByLabelText('Billing risk notice')).toBeInTheDocument();
    });

    it('displays billing issue message', () => {
      render(
        <BillingInlineRiskBanner subscription={expiredSubscription} contextLabel="Franchise analytics" />
      );
      expect(screen.getByText(/Billing issue detected for this organisation/i)).toBeInTheDocument();
    });

    it('shows both CTAs', () => {
      render(
        <BillingInlineRiskBanner subscription={expiredSubscription} contextLabel="Franchise analytics" />
      );
      expect(screen.getByRole('link', { name: /Go to billing/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Contact support/i })).toBeInTheDocument();
    });

    it('has danger styling (rose)', () => {
      render(
        <BillingInlineRiskBanner subscription={expiredSubscription} contextLabel="Franchise analytics" />
      );
      const banner = screen.getByLabelText('Billing risk notice');
      expect(banner).toHaveClass('border-rose-800/80');
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

    it('renders billing risk notice', () => {
      render(
        <BillingInlineRiskBanner subscription={canceledSubscription} contextLabel="Franchise branch analytics" />
      );
      expect(screen.getByLabelText('Billing risk notice')).toBeInTheDocument();
    });

    it('shows both CTAs', () => {
      render(
        <BillingInlineRiskBanner subscription={canceledSubscription} contextLabel="Franchise branch analytics" />
      );
      expect(screen.getByRole('link', { name: /Go to billing/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Contact support/i })).toBeInTheDocument();
    });

    it('has danger styling (rose)', () => {
      render(
        <BillingInlineRiskBanner subscription={canceledSubscription} contextLabel="Franchise branch analytics" />
      );
      const banner = screen.getByLabelText('Billing risk notice');
      expect(banner).toHaveClass('border-rose-800/80');
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

    it('does not render banner', () => {
      render(
        <BillingInlineRiskBanner subscription={activeSubscription} contextLabel="Developer Portal" />
      );
      expect(screen.queryByLabelText('Billing risk notice')).not.toBeInTheDocument();
    });

    it('returns empty container', () => {
      const { container } = render(
        <BillingInlineRiskBanner subscription={activeSubscription} contextLabel="Developer Portal" />
      );
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

    it('does not render banner', () => {
      render(
        <BillingInlineRiskBanner subscription={trialSubscription} contextLabel="Developer Portal" />
      );
      expect(screen.queryByLabelText('Billing risk notice')).not.toBeInTheDocument();
    });
  });

  describe('context label variations', () => {
    const pastDueSubscription: OrgSubscriptionDto = {
      id: 'sub-pastdue',
      orgId: 'org-123',
      planId: 'FRANCHISE_CORE',
      status: 'PAST_DUE',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('displays "Developer Portal" context label correctly', () => {
      render(
        <BillingInlineRiskBanner subscription={pastDueSubscription} contextLabel="Developer Portal" />
      );
      expect(screen.getByText(/may impact Developer Portal soon/i)).toBeInTheDocument();
    });

    it('displays "Franchise analytics" context label correctly', () => {
      render(
        <BillingInlineRiskBanner subscription={pastDueSubscription} contextLabel="Franchise analytics" />
      );
      expect(screen.getByText(/may impact Franchise analytics soon/i)).toBeInTheDocument();
    });

    it('displays "Franchise branch analytics" context label correctly', () => {
      render(
        <BillingInlineRiskBanner subscription={pastDueSubscription} contextLabel="Franchise branch analytics" />
      );
      expect(screen.getByText(/may impact Franchise branch analytics soon/i)).toBeInTheDocument();
    });
  });
});
