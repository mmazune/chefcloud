#!/usr/bin/env node
/**
 * E2E Strict Runner
 * 
 * Runs E2E tests with strict timeout and open handle detection.
 * Part of the no-hang enforcement standard.
 * 
 * Usage:
 *   node scripts/e2e-strict-runner.mjs [test-file-pattern]
 * 
 * Example:
 *   node scripts/e2e-strict-runner.mjs workforce-m104
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

async function run() {
  const pattern = process.argv[2] || '';
  
  console.log('🔒 E2E Strict Runner');
  console.log(`   Timeout: ${TIMEOUT_MS / 60000} minutes`);
  console.log(`   Pattern: ${pattern || 'all recent milestone E2E files'}`);
  console.log('');

  // Build Jest args
  const jestArgs = [
    '--config', './test/jest-e2e.json',
    '--runInBand',
    '--forceExit',
    '--detectOpenHandles',
  ];

  // If pattern provided, use runTestsByPath
  if (pattern) {
    jestArgs.push('--runTestsByPath', `test/e2e/*${pattern}*.e2e-spec.ts`);
  } else {
    // Default: run M10.4 and M10.3 E2E files
    jestArgs.push(
      '--runTestsByPath',
      'test/e2e/workforce-m103-enterprise.e2e-spec.ts',
      'test/e2e/workforce-m104-enterprise-ui.e2e-spec.ts'
    );
  }

  console.log(`   Command: jest ${jestArgs.join(' ')}`);
  console.log('');

  const proc = spawn('npx', ['jest', ...jestArgs], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      JWT_SECRET: process.env.JWT_SECRET || 'test-e2e-secret',
    },
  });

  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    console.error(`\n❌ TIMEOUT: E2E tests exceeded ${TIMEOUT_MS / 60000} minute limit`);
    proc.kill('SIGTERM');
    setTimeout(() => proc.kill('SIGKILL'), 5000);
  }, TIMEOUT_MS);

  const exitCode = await new Promise((resolve) => {
    proc.on('exit', (code) => {
      clearTimeout(timeoutId);
      resolve(code ?? 1);
    });
    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      console.error('Process error:', err);
      resolve(1);
    });
  });

  if (timedOut) {
    process.exit(124); // Standard timeout exit code
  }

  if (exitCode !== 0) {
    console.error(`\n❌ E2E strict runner failed with exit code ${exitCode}`);
  } else {
    console.log('\n✅ E2E strict runner passed');
  }

  process.exit(exitCode);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
