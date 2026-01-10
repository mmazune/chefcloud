#!/usr/bin/env node
/**
 * Production Preflight Verification Script
 * Phase F2 — Production Monitoring Baseline
 *
 * Non-destructive verification that production environment has secure defaults:
 * - Health check responds
 * - Auth guards are active (protected endpoints return 401)
 * - Feature flags are disabled (DOCS, DEVPORTAL, METRICS off by default)
 * - CORS headers are present
 *
 * Usage:
 *   API_BASE_URL=https://your-prod-api.example.com node scripts/verify/production-preflight.mjs
 *
 * Exit codes:
 *   0 = All checks passed
 *   1 = One or more checks failed
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

// Color helpers
const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

// Fetch with timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// Assertion definitions - Production-specific checks
const assertions = [
  // ─────────────────────────────────────────────────────────────────────────
  // Core Health
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'Health Check (Liveness)',
    description: 'GET /healthz returns 200',
    category: 'health',
    test: async () => {
      try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/healthz`);
        if (response.status !== 200) {
          return { passed: false, message: `Expected 200, got ${response.status}` };
        }
        const body = await response.json().catch(() => null);
        if (!body || body.status !== 'ok') {
          return { passed: false, message: `Expected { status: 'ok' }, got ${JSON.stringify(body)}` };
        }
        return { passed: true, message: 'Status 200, { status: "ok" }' };
      } catch (error) {
        return { passed: false, message: `Request failed: ${error.message}` };
      }
    },
  },
  {
    name: 'Readiness Check',
    description: 'GET /readiness returns 200 or 503',
    category: 'health',
    test: async () => {
      try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/readiness`);
        if (![200, 503].includes(response.status)) {
          return { passed: false, message: `Expected 200 or 503, got ${response.status}` };
        }
        return { passed: true, message: `Status ${response.status}` };
      } catch (error) {
        return { passed: false, message: `Request failed: ${error.message}` };
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Authentication Guards
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'Auth Guard Active',
    description: 'Protected endpoint returns 401 without token',
    category: 'security',
    test: async () => {
      try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/inventory/items`, {
          headers: { Accept: 'application/json' },
        });
        if (response.status !== 401) {
          return {
            passed: false,
            message: `Expected 401, got ${response.status}. JWT_SECRET may not be set!`,
          };
        }
        return { passed: true, message: 'Status 401 (auth working)' };
      } catch (error) {
        return { passed: false, message: `Request failed: ${error.message}` };
      }
    },
  },
  {
    name: 'Auth Guard on User Route',
    description: 'GET /auth/me returns 401 without token',
    category: 'security',
    test: async () => {
      try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/me`, {
          headers: { Accept: 'application/json' },
        });
        if (response.status !== 401) {
          return {
            passed: false,
            message: `Expected 401, got ${response.status}`,
          };
        }
        return { passed: true, message: 'Status 401 (auth working)' };
      } catch (error) {
        return { passed: false, message: `Request failed: ${error.message}` };
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Feature Flags (Should be OFF by default)
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'DOCS_ENABLED=0 (Default)',
    description: '/docs returns 404 when disabled',
    category: 'feature-flags',
    test: async () => {
      try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/docs`);
        // Accept 404 as "disabled"; 200 means it's enabled (fail for production)
        if (response.status === 200) {
          return {
            passed: false,
            message: `Status 200 - DOCS_ENABLED=1! Should be 0 in production.`,
          };
        }
        if (![404, 302, 403].includes(response.status)) {
          return { passed: false, message: `Unexpected status ${response.status}` };
        }
        return { passed: true, message: `Status ${response.status} (docs disabled)` };
      } catch (error) {
        return { passed: false, message: `Request failed: ${error.message}` };
      }
    },
  },
  {
    name: 'DEVPORTAL_ENABLED=0 (Default)',
    description: '/dev/status returns 404 when disabled',
    category: 'feature-flags',
    test: async () => {
      try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/dev/status`, {
          headers: { Accept: 'application/json' },
        });
        if (response.status === 200 || response.status === 401) {
          // 401 means module is loaded (guarded); still bad for default
          return {
            passed: false,
            message: `Status ${response.status} - DEVPORTAL_ENABLED=1! Should be 0 in production.`,
          };
        }
        if (response.status !== 404) {
          return { passed: false, message: `Expected 404, got ${response.status}` };
        }
        return { passed: true, message: 'Status 404 (devportal disabled)' };
      } catch (error) {
        return { passed: false, message: `Request failed: ${error.message}` };
      }
    },
  },
  {
    name: 'METRICS_ENABLED=0 (Default)',
    description: '/metrics returns disabled message when flag off',
    category: 'feature-flags',
    test: async () => {
      try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/metrics`);
        const body = await response.text();
        // When disabled, metrics returns "# metrics disabled\n"
        if (body.includes('metrics disabled')) {
          return { passed: true, message: 'Metrics disabled (secure default)' };
        }
        // If we get actual Prometheus metrics, flag is ON
        if (body.includes('# HELP') || body.includes('# TYPE')) {
          return {
            passed: false,
            message: 'METRICS_ENABLED=1 - Metrics exposed! Should be 0 unless secured.',
          };
        }
        return { passed: true, message: `Status ${response.status}, metrics appear disabled` };
      } catch (error) {
        return { passed: false, message: `Request failed: ${error.message}` };
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CORS Configuration
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'CORS Headers Present',
    description: 'OPTIONS request returns CORS headers',
    category: 'security',
    test: async () => {
      try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/healthz`, {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://example.com',
            'Access-Control-Request-Method': 'GET',
          },
        });
        // Check for CORS-related headers
        const hasVary = response.headers.get('vary')?.toLowerCase().includes('origin');
        const hasCorsHeaders = response.headers.get('access-control-allow-methods') !== null;
        if (!hasVary && !hasCorsHeaders) {
          return {
            passed: false,
            message: 'No CORS headers detected. CORS_ORIGINS may not be configured.',
          };
        }
        return { passed: true, message: 'CORS headers present' };
      } catch (error) {
        return { passed: false, message: `Request failed: ${error.message}` };
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Request Correlation
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'X-Request-Id Header',
    description: 'API returns X-Request-Id for tracing',
    category: 'observability',
    test: async () => {
      try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/healthz`);
        const requestId = response.headers.get('x-request-id');
        if (!requestId) {
          return { passed: false, message: 'X-Request-Id header not present' };
        }
        if (requestId.length < 10) {
          return { passed: false, message: `X-Request-Id too short: ${requestId}` };
        }
        return { passed: true, message: `X-Request-Id: ${requestId.substring(0, 8)}...` };
      } catch (error) {
        return { passed: false, message: `Request failed: ${error.message}` };
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Security Headers
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'Security Headers (Helmet)',
    description: 'X-Content-Type-Options, X-Frame-Options present',
    category: 'security',
    test: async () => {
      try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/healthz`);
        const xContentType = response.headers.get('x-content-type-options');
        const xFrame = response.headers.get('x-frame-options');
        const missing = [];
        if (!xContentType) missing.push('X-Content-Type-Options');
        if (!xFrame) missing.push('X-Frame-Options');
        if (missing.length > 0) {
          return { passed: false, message: `Missing: ${missing.join(', ')}` };
        }
        return { passed: true, message: 'Security headers present (Helmet active)' };
      } catch (error) {
        return { passed: false, message: `Request failed: ${error.message}` };
      }
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────

async function runAssertions() {
  console.log(colors.bold('\n═══════════════════════════════════════════════════════════════'));
  console.log(colors.bold('  ChefCloud Production Preflight Verification'));
  console.log(colors.bold('═══════════════════════════════════════════════════════════════\n'));
  console.log(`  ${colors.dim('Target:')} ${colors.cyan(API_BASE_URL)}\n`);

  const results = [];
  const categories = [...new Set(assertions.map((a) => a.category))];

  for (const category of categories) {
    console.log(colors.bold(`\n  ── ${category.toUpperCase()} ──`));
    const categoryAssertions = assertions.filter((a) => a.category === category);

    for (const assertion of categoryAssertions) {
      process.stdout.write(`    ${assertion.name}... `);
      const result = await assertion.test();
      results.push({ ...assertion, ...result });

      if (result.passed) {
        console.log(colors.green(`✓ PASS`) + colors.dim(` (${result.message})`));
      } else {
        console.log(colors.red(`✗ FAIL`) + colors.dim(` (${result.message})`));
      }
    }
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(colors.bold('\n═══════════════════════════════════════════════════════════════'));
  console.log(colors.bold('  SUMMARY'));
  console.log(colors.bold('═══════════════════════════════════════════════════════════════\n'));

  console.log(`    ${colors.green('Passed:')} ${passed}/${total}`);
  console.log(`    ${colors.red('Failed:')} ${failed}/${total}`);

  if (failed > 0) {
    console.log(colors.red('\n  ✗ PREFLIGHT FAILED\n'));
    console.log('  Failed checks:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`    - ${r.name}: ${r.message}`);
      });
    console.log('');
    process.exit(1);
  }

  console.log(colors.green('\n  ✓ PREFLIGHT PASSED\n'));
  console.log('  Production environment has secure defaults.\n');
  process.exit(0);
}

// Run
runAssertions().catch((error) => {
  console.error(colors.red(`\n  ✗ FATAL ERROR: ${error.message}\n`));
  process.exit(1);
});
