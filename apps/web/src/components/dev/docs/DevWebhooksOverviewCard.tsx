/**
 * DevWebhooksOverviewCard component for E23-DEVPORTAL-FE-S4
 * Explains webhook setup and usage
 */

import React from 'react';

export const DevWebhooksOverviewCard: React.FC = () => {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-300">
      <h3 className="text-sm font-semibold text-slate-100">
        Webhooks overview
      </h3>
      <p className="mt-1 text-slate-400">
        Webhooks let ChefCloud push real-time events into your systems (e.g.
        orders, payments, shifts).
      </p>

      <ol className="mt-3 list-decimal space-y-2 pl-4">
        <li>
          <span className="font-semibold text-slate-100">
            Create an endpoint:
          </span>{' '}
          In the <span className="font-mono">Webhooks</span> tab, add a URL and
          choose Sandbox or Production.
        </li>
        <li>
          <span className="font-semibold text-slate-100">
            Handle POST requests:
          </span>{' '}
          Your endpoint should accept HTTPS POST with a JSON body and respond
          with
          <span className="font-mono"> 2xx</span> for success.
        </li>
        <li>
          <span className="font-semibold text-slate-100">
            Verify signatures:
          </span>{' '}
          Each delivery is signed with a shared secret. Use the secret shown as
          <span className="font-mono"> ****abcd</span> in the Dev Portal to
          validate the signature header in your code.
        </li>
        <li>
          <span className="font-semibold text-slate-100">
            Test deliveries:
          </span>{' '}
          Use <span className="font-mono">Send test</span> and the delivery log
          (
          <span className="font-mono">View log</span>) to verify your endpoint
          before going live.
        </li>
      </ol>

      <p className="mt-3 text-[11px] text-slate-500">
        Treat webhook secrets like passwords. Rotate them periodically and
        update your code to use the new secret.
      </p>
    </section>
  );
};
