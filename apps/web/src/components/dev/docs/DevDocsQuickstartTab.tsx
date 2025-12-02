/**
 * DevDocsQuickstartTab component for E23-DEVPORTAL-FE-S4
 * Main docs & quickstart hub for the Developer Portal
 */

import React from 'react';
import { devPortalConfig } from '@/config/devPortalConfig';
import { DevQuickstartSnippets } from '@/components/dev/docs/DevQuickstartSnippets';
import { DevWebhooksOverviewCard } from '@/components/dev/docs/DevWebhooksOverviewCard';
import { DevSecurityBestPracticesCard } from '@/components/dev/docs/DevSecurityBestPracticesCard';

export const DevDocsQuickstartTab: React.FC = () => {
  const { sandboxBaseUrl, productionBaseUrl, docsExternalUrl } =
    devPortalConfig;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Get started with the ChefCloud API
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              1) Create an API key · 2) Configure a webhook endpoint · 3) Call
              the API from your stack.
            </p>
          </div>
          <div className="text-[11px] text-slate-300">
            <div>
              Sandbox base URL:{' '}
              <span className="font-mono">{sandboxBaseUrl}</span>
            </div>
            <div>
              Production base URL:{' '}
              <span className="font-mono">{productionBaseUrl}</span>
            </div>
          </div>
        </div>
        {docsExternalUrl && (
          <div className="mt-3 text-[11px] text-slate-400">
            Full docs:{' '}
            <a
              href={docsExternalUrl}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-300 underline-offset-2 hover:underline"
            >
              Open external documentation
            </a>
          </div>
        )}
      </section>

      <DevQuickstartSnippets />

      <div className="grid gap-4 md:grid-cols-2">
        <DevWebhooksOverviewCard />
        <DevSecurityBestPracticesCard />
      </div>
    </div>
  );
};
