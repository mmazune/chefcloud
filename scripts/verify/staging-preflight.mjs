#!/usr/bin/env node
/**
 * Staging Preflight Verification Script
 * Phase E4 — Staging Verification Pack
 *
 * Verifies staging environment is correctly configured:
 * - Health check responds
 * - Auth guards are active (protected endpoints return 401)
 * - Feature flags are disabled (DOCS, DEVPORTAL return 404)
 * - CORS headers are present
 *
 * Usage:
 *   node scripts/verify/staging-preflight.mjs
 *   API_BASE_URL=https://chefcloud-staging-api.fly.dev node scripts/verify/staging-preflight.mjs
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

// Assertion definitions
const assertions = [
  {
    name: 'Health Check',
    description: 'API is running and healthy',
    test: async () => {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (response.status !== 200) {
        return { passed: false, message: `Expected 200, got ${response.status}` };
      }
      return { passed: true, message: `Status 200` };
    },
  },
  {
    name: 'Auth Guard Active',
    description: 'Protected endpoint returns 401 without token',
    test: async () => {
      const response = await fetch(`${API_BASE_URL}/inventory/items`, {
        headers: { 'Accept': 'application/json' },
      });
      if (response.status !== 401) {
        return {
          passed: false,
          message: `Expected 401, got ${response.status}. JWT_SECRET may not be set!`,
        };
      }
      return { passed: true, message: `Status 401 (auth working)` };
    },
  },
  {
    name: 'DOCS_ENABLED=0',
    description: '/docs returns 404 when disabled',
    test: async () => {
      const response = await fetch(`${API_BASE_URL}/docs`);
      // Accept 404, 302 (redirect), or 403 as "disabled"
      if (![404, 302, 403].includes(response.status)) {
        return {
          passed: false,
          message: `Expected 404/302/403, got ${response.status}. DOCS_ENABLED may be 1!`,
        };
      }
      return { passed: true, message: `Status ${response.status} (docs disabled)` };
    },
  },
  {
    name: 'DEVPORTAL_ENABLED=0',
    description: '/dev/api-keys returns 404 when disabled',
    test: async () => {
      const response = await fetch(`${API_BASE_URL}/dev/api-keys`, {
        headers: { 'Accept': 'application/json' },
      });
      if (response.status !== 404) {
        return {
          passed: false,
          message: `Expected 404, got ${response.status}. DEVPORTAL_ENABLED may be 1!`,
        };
      }
      return { passed: true, message: `Status 404 (devportal disabled)` };
    },
  },
  {
    name: 'CORS Headers',
    description: 'OPTIONS request returns CORS headers',
    test: async () => {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET',
        },
      });
      
      // Check for CORS headers
      const allowOrigin = response.headers.get('access-control-allow-origin');
      const allowMethods = response.headers.get('access-control-allow-methods');
      
      if (!allowOrigin) {
        return {
          passed: false,
          message: `No Access-Control-Allow-Origin header. CORS may not be configured.`,
        };
      }
      
      return {
        passed: true,
        message: `CORS origin: ${allowOrigin}`,
      };
    },
  },
  {
    name: 'Login Endpoint Exists',
    description: 'POST /auth/login returns 400/401/422 (not 404)',
    test: async () => {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      // Should return validation error or auth error, NOT 404
      if (response.status === 404) {
        return {
          passed: false,
          message: `Got 404. Auth routes may not be registered!`,
        };
      }
      if (![400, 401, 422].includes(response.status)) {
        return {
          passed: false,
          message: `Unexpected status ${response.status}`,
        };
      }
      return { passed: true, message: `Status ${response.status} (endpoint exists)` };
    },
  },
  {
    name: 'Health JSON Structure',
    description: 'Health endpoint returns valid JSON',
    test: async () => {
      const response = await fetch(`${API_BASE_URL}/health`);
      const contentType = response.headers.get('content-type') || '';
      
      if (!contentType.includes('application/json')) {
        return {
          passed: false,
          message: `Expected JSON, got ${contentType}`,
        };
      }
      
      try {
        const data = await response.json();
        if (typeof data !== 'object') {
          return { passed: false, message: 'Response is not an object' };
        }
        return { passed: true, message: `Valid JSON response` };
      } catch (e) {
        return { passed: false, message: `Invalid JSON: ${e.message}` };
      }
    },
  },
];

async function runAssertion(assertion) {
  try {
    const result = await assertion.test();
    return {
      name: assertion.name,
      description: assertion.description,
      ...result,
      error: null,
    };
  } catch (error) {
    return {
      name: assertion.name,
      description: assertion.description,
      passed: false,
      message: `Error: ${error.message}`,
      error: error.message,
    };
  }
}

async function main() {
  console.log(colors.bold('\n=== Staging Preflight Verification ==='));
  console.log(`API Base URL: ${colors.cyan(API_BASE_URL)}`);
  console.log(`Assertions: ${assertions.length}`);
  console.log('');

  const results = [];
  let passCount = 0;
  let failCount = 0;

  for (const assertion of assertions) {
    const result = await runAssertion(assertion);
    results.push(result);

    if (result.passed) {
      passCount++;
      console.log(
        colors.green('✓ PASS') +
          ` ${result.name}` +
          colors.dim(` — ${result.message}`)
      );
    } else {
      failCount++;
      console.log(
        colors.red('✗ FAIL') +
          ` ${result.name}` +
          colors.dim(` — ${result.message}`)
      );
    }
  }

  // Summary
  console.log('');
  console.log(colors.bold('=== Summary ==='));
  console.log(`${colors.green(`Passed: ${passCount}`)} | ${colors.red(`Failed: ${failCount}`)}`);

  if (failCount > 0) {
    console.log('');
    console.log(colors.yellow('⚠️  Some assertions failed. Check:'));
    console.log('   1. Is the API server running?');
    console.log('   2. Are environment variables set correctly?');
    console.log('   3. See docs/verification/STAGING_ENV_ASSERTIONS.md');
    console.log('');

    // Print failed assertions for quick reference
    console.log(colors.bold('Failed Assertions:'));
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`   • ${r.name}: ${r.message}`);
      });
    console.log('');

    process.exit(1);
  } else {
    console.log('');
    console.log(colors.green('✓ All preflight assertions passed!'));
    console.log(colors.dim('  Staging environment is correctly configured.'));
    console.log('');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
