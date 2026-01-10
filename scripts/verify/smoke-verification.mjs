#!/usr/bin/env node
/**
 * Smoke Verification Script
 * Phase D1 - Not Dormant Verification
 *
 * Verifies key API endpoints are responsive and return expected status codes.
 * Safe read-only checks only.
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

// Test definitions
const tests = [
  // Auth endpoints
  { name: 'Health Check', method: 'GET', path: '/health', expected: 200 },

  // Menu (public or auth-optional for demo)
  { name: 'POS Menu Categories', method: 'GET', path: '/pos/menu/categories', expected: [200, 401] },

  // Auth - MSR endpoint existence check (will 400 without body, but proves wiring)
  { name: 'MSR Swipe Endpoint', method: 'POST', path: '/auth/msr-swipe', expected: [400, 401, 422], body: {} },

  // Auth - Login endpoint
  { name: 'Login Endpoint', method: 'POST', path: '/auth/login', expected: [400, 401, 422], body: {} },

  // Inventory endpoints (require auth, expect 401)
  { name: 'Inventory Items', method: 'GET', path: '/inventory/items', expected: [200, 401] },
  { name: 'Inventory Categories', method: 'GET', path: '/inventory/categories', expected: [200, 401] },

  // POS endpoints (require auth)
  { name: 'POS Orders', method: 'GET', path: '/pos/orders', expected: [200, 401] },

  // Workforce endpoints (require auth)
  { name: 'Workforce Employees', method: 'GET', path: '/workforce/employees', expected: [200, 401] },
  { name: 'Workforce Payroll Runs', method: 'GET', path: '/workforce/payroll-runs', expected: [200, 401] },

  // Finance endpoints (require auth)
  { name: 'Finance Journal Entries', method: 'GET', path: '/finance/journal-entries', expected: [200, 401] },
];

// Color helpers for terminal
const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

async function runTest(test) {
  const url = `${BASE_URL}${test.path}`;
  const options = {
    method: test.method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  if (test.body) {
    options.body = JSON.stringify(test.body);
  }

  try {
    const response = await fetch(url, options);
    const status = response.status;

    // Check if status is expected
    const expectedArray = Array.isArray(test.expected) ? test.expected : [test.expected];
    const passed = expectedArray.includes(status);

    return {
      name: test.name,
      path: test.path,
      method: test.method,
      status,
      expected: expectedArray,
      passed,
      error: null,
    };
  } catch (error) {
    return {
      name: test.name,
      path: test.path,
      method: test.method,
      status: null,
      expected: Array.isArray(test.expected) ? test.expected : [test.expected],
      passed: false,
      error: error.message,
    };
  }
}

async function main() {
  console.log(colors.bold('\n=== Smoke Verification Script ==='));
  console.log(`Base URL: ${colors.cyan(BASE_URL)}`);
  console.log(`Tests: ${tests.length}\n`);

  const results = [];
  let passCount = 0;
  let failCount = 0;

  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);

    if (result.passed) {
      passCount++;
      console.log(
        colors.green('✓ PASS') +
          ` ${result.name} - ${result.method} ${result.path} → ${result.status}`
      );
    } else {
      failCount++;
      if (result.error) {
        console.log(
          colors.red('✗ FAIL') +
            ` ${result.name} - ${result.method} ${result.path} → ERROR: ${result.error}`
        );
      } else {
        console.log(
          colors.red('✗ FAIL') +
            ` ${result.name} - ${result.method} ${result.path} → ${result.status} (expected: ${result.expected.join('|')})`
        );
      }
    }
  }

  // Summary
  console.log(colors.bold('\n=== Summary ==='));
  console.log(`${colors.green(`Passed: ${passCount}`)} | ${colors.red(`Failed: ${failCount}`)}`);

  if (failCount > 0) {
    console.log(colors.yellow('\n⚠️  Some tests failed. Check if the API server is running.'));
    console.log('   Start the API: pnpm -C services/api dev\n');
    process.exit(1);
  } else {
    console.log(colors.green('\n✓ All smoke tests passed!\n'));
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
