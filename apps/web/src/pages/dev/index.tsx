/**
 * Developer Portal Shell Page
 * E23-DEVPORTAL-FE-S1: API Keys management interface
 * E23-DEVPORTAL-FE-S2: Webhooks management interface
 * E23-DEVPORTAL-FE-S4: Docs & quickstart tab
 * E23-DEVPORTAL-FE-S5: Usage & error analytics tab
 */

import type { NextPage } from 'next';
import Link from 'next/link';
import { useState } from 'react';
import { useDevApiKeys } from '@/hooks/useDevApiKeys';
import { DevKeysPanel } from '@/components/dev/DevKeysPanel';
import { DevWebhooksPanel } from '@/components/dev/DevWebhooksPanel';
import { DevDocsQuickstartTab } from '@/components/dev/docs/DevDocsQuickstartTab';
import { DevUsageTab } from '@/components/dev/DevUsageTab';

const DevPortalPage: NextPage = () => {
  const [activeTab, setActiveTab] = useState<'keys' | 'webhooks' | 'docs' | 'usage'>('keys');
  const { keys, isLoading, error, reload } = useDevApiKeys();

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
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

        {/* Tab navigation */}
        <div className="border-b border-slate-800">
          <nav className="-mb-px flex gap-4 text-sm">
            <button
              type="button"
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
              className={`border-b-2 pb-2 ${
                activeTab === 'docs'
                  ? 'border-emerald-400 text-slate-100'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
              onClick={() => setActiveTab('docs')}
            >
              Docs &amp; quickstart
            </button>
            <button
              type="button"
              className={`border-b-2 pb-2 ${
                activeTab === 'usage'
                  ? 'border-emerald-400 text-slate-100'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
              onClick={() => setActiveTab('usage')}
            >
              Usage
            </button>
          </nav>
        </div>

        {activeTab === 'keys' && (
          <DevKeysPanel
            keys={keys}
            isLoading={isLoading}
            error={error}
            onRefresh={reload}
          />
        )}

        {activeTab === 'webhooks' && <DevWebhooksPanel />}

        {activeTab === 'docs' && <DevDocsQuickstartTab />}

        {activeTab === 'usage' && <DevUsageTab />}
      </div>
    </div>
  );
};

export default DevPortalPage;
