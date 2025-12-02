/**
 * DevSecurityBestPracticesCard component for E23-DEVPORTAL-FE-S4
 * Security guidance for API keys and webhooks
 */

import React from 'react';

export const DevSecurityBestPracticesCard: React.FC = () => {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-300">
      <h3 className="text-sm font-semibold text-slate-100">
        Security best practices
      </h3>
      <ul className="mt-2 space-y-2">
        <li>
          <span className="font-semibold text-slate-100">
            Do not hard-code keys:
          </span>{' '}
          Store API keys and webhook secrets in environment variables or your
          secret manager, never in source control.
        </li>
        <li>
          <span className="font-semibold text-slate-100">
            Use least privilege:
          </span>{' '}
          Prefer Sandbox keys in development and staging. Use Production keys
          only in production services.
        </li>
        <li>
          <span className="font-semibold text-slate-100">
            Rotate regularly:
          </span>{' '}
          Rotate API keys and webhook secrets periodically and after any
          suspected leak.
        </li>
        <li>
          <span className="font-semibold text-slate-100">
            Validate TLS:
          </span>{' '}
          Only call ChefCloud APIs over{' '}
          <span className="font-mono">https://</span>, and ensure your webhook
          endpoints are HTTPS.
        </li>
        <li>
          <span className="font-semibold text-slate-100">Log safely:</span> Log
          request IDs and error messages, but never log full API keys or webhook
          secrets.
        </li>
      </ul>
    </section>
  );
};
