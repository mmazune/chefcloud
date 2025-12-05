/**
 * Developer Portal Shell Page
 * E23-DEVPORTAL-FE-S1: API Keys management interface
 * E23-DEVPORTAL-FE-S2: Webhooks management interface
 * E23-DEVPORTAL-FE-S4: Docs & quickstart tab
 */

import type { NextPage } from 'next';
import Link from 'next/link';
import { useState } from 'react';
import { useDevApiKeys } from '@/hooks/useDevApiKeys';
import { usePlanCapabilities } from '@/hooks/usePlanCapabilities';
import { BillingUpsellGate } from '@/components/billing/BillingUpsellGate';
import { BillingInlineRiskBanner } from '@/components/billing/BillingInlineRiskBanner';
import { DevKeysPanel } from '@/components/dev/DevKeysPanel';
import { DevWebhooksPanel } from '@/components/dev/DevWebhooksPanel';
import { DevDocsQuickstartTab } from '@/components/dev/docs/DevDocsQuickstartTab';

const DevPortalPage: NextPage = () => {
  const [activeTab, setActiveTab] = useState<'keys' | 'webhooks' | 'docs'>('keys');
  const { keys, isLoading, error, reload } = useDevApiKeys();
  const { subscription, capabilities, isLoading: isLoadingPlan } = usePlanCapabilities();

  // E24-BILLING-FE-S3: Plan gating for Dev Portal (Franchise tier+)
  if (isLoadingPlan) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-slate-400">Checking your plan permissions…</p>
        </div>
      </div>
    );
  }

  if (!capabilities.canUseDevPortal) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="mx-auto max-w-7xl">
          <BillingUpsellGate
            featureLabel="Developer Portal"
            requiredPlanHint="Franchise Core or higher"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <main id="main-content" role="main" className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">
              Developer portal
            </h1>
            <p className="text-sm text-slate-400">
              Manage API keys and webhooks for third-party integrations.
            </p>
          </div>
          {/* Optional: link back to dashboard or docs */}
          <Link
            href="/analytics"
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            ← Back to analytics
          </Link>
        </header>

        {/* E24-BILLING-FE-S5: Billing risk warning for PAST_DUE/EXPIRED/CANCELED */}
        <BillingInlineRiskBanner
          subscription={subscription}
          contextLabel="Developer Portal"
        />

        {/* Tab navigation */}
        <div className="border-b border-slate-800">
          <div role="tablist" aria-label="Developer Portal sections" className="-mb-px flex gap-4 text-sm">
            <button
              type="button"
              role="tab"
              id="dev-tab-keys"
              aria-selected={activeTab === 'keys'}
              aria-controls="dev-tabpanel-keys"
              tabIndex={activeTab === 'keys' ? 0 : -1}
              className={`border-b-2 pb-2 ${
                activeTab === 'keys'
                  ? 'border-emerald-400 text-slate-100'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
              onClick={() => setActiveTab('keys')}
            >
              API keys
            </button>
            <button
              type="button"
              role="tab"
              id="dev-tab-webhooks"
              aria-selected={activeTab === 'webhooks'}
              aria-controls="dev-tabpanel-webhooks"
              tabIndex={activeTab === 'webhooks' ? 0 : -1}
              className={`border-b-2 pb-2 ${
                activeTab === 'webhooks'
                  ? 'border-emerald-400 text-slate-100'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
              onClick={() => setActiveTab('webhooks')}
            >
              Webhooks
            </button>
            <button
              type="button"
              role="tab"
              id="dev-tab-docs"
              aria-selected={activeTab === 'docs'}
              aria-controls="dev-tabpanel-docs"
              tabIndex={activeTab === 'docs' ? 0 : -1}
              className={`border-b-2 pb-2 ${
                activeTab === 'docs'
                  ? 'border-emerald-400 text-slate-100'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
              onClick={() => setActiveTab('docs')}
            >
              Docs &amp; quickstart
            </button>
          </div>
        </div>

        {activeTab === 'keys' && (
          <div
            role="tabpanel"
            id="dev-tabpanel-keys"
            aria-labelledby="dev-tab-keys"
          >
            <DevKeysPanel
              keys={keys}
              isLoading={isLoading}
              error={error}
              onRefresh={reload}
            />
          </div>
        )}

        {activeTab === 'webhooks' && (
          <div
            role="tabpanel"
            id="dev-tabpanel-webhooks"
            aria-labelledby="dev-tab-webhooks"
          >
            <DevWebhooksPanel />
          </div>
        )}

        {activeTab === 'docs' && (
          <div
            role="tabpanel"
            id="dev-tabpanel-docs"
            aria-labelledby="dev-tab-docs"
          >
            <DevDocsQuickstartTab />
          </div>
        )}
      </main>
    </div>
  );
};

export default DevPortalPage;
