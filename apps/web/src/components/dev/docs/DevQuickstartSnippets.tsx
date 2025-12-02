/**
 * DevQuickstartSnippets component for E23-DEVPORTAL-FE-S4
 * Shows example API requests with language tabs (curl, Node.js, Python)
 */

import React, { useState } from 'react';
import { devPortalConfig } from '@/config/devPortalConfig';

type SnippetLang = 'curl' | 'node' | 'python';

function buildSnippets(baseUrl: string) {
  const exampleEndpoint = `${baseUrl}/v1/example`;
  return {
    curl: [
      '# Replace YOUR_API_KEY with an API key from the "API keys" tab',
      `curl -X GET '${exampleEndpoint}' \\`,
      "  -H 'Authorization: Bearer YOUR_API_KEY' \\",
      "  -H 'Content-Type: application/json'",
    ].join('\n'),
    node: [
      '// npm install node-fetch (or use your HTTP client of choice)',
      "import fetch from 'node-fetch';",
      '',
      'async function main() {',
      "  const res = await fetch('" + exampleEndpoint + "', {",
      '    headers: {',
      "      Authorization: 'Bearer YOUR_API_KEY',",
      "      'Content-Type': 'application/json',",
      '    },',
      '  });',
      '  const body = await res.json();',
      '  console.log(body);',
      '}',
      '',
      'main().catch(console.error);',
    ].join('\n'),
    python: [
      '# pip install requests',
      'import requests',
      '',
      `url = '${exampleEndpoint}'`,
      'headers = {',
      "    'Authorization': 'Bearer YOUR_API_KEY',",
      "    'Content-Type': 'application/json',",
      '}',
      '',
      'response = requests.get(url, headers=headers)',
      'print(response.status_code, response.json())',
    ].join('\n'),
  };
}

export const DevQuickstartSnippets: React.FC = () => {
  const [lang, setLang] = useState<SnippetLang>('curl');
  const snippets = buildSnippets(devPortalConfig.sandboxBaseUrl);
  const code = snippets[lang];

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Sandbox quickstart
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Use Sandbox keys and URLs while you integrate. Replace YOUR_API_KEY
            with a real key.
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-slate-700 p-0.5 text-[11px]">
          {(['curl', 'node', 'python'] as SnippetLang[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setLang(option)}
              className={`rounded-full px-2 py-0.5 capitalize ${
                lang === option
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-300'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <pre className="max-h-72 overflow-auto rounded-md bg-slate-950 p-3 text-[11px] text-slate-100">
        <code>{code}</code>
      </pre>

      <p className="mt-2 text-[11px] text-slate-500">
        Note: <span className="font-mono">/v1/example</span> is a placeholder.
        Replace it with a real endpoint from the ChefCloud API you intend to
        use.
      </p>
    </section>
  );
};
