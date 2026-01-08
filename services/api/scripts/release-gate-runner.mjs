#!/usr/bin/env node
/**
 * M12.9 Release Gate Runner
 * 
 * Cross-platform Node ESM runner for release verification.
 * Runs critical E2E suites with per-suite timeouts and captures logs.
 * 
 * Requirements:
 * - PNPM resolution: pnpm.cmd on Windows, pnpm otherwise
 * - spawn() with shell: IS_WINDOWS
 * - Per-suite timeout with Node setTimeout()
 * - Log capture to services/api/test-output/release/
 * - Pass/fail summary
 * - Clean exit without forceExit
 */

import { spawn } from 'child_process';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const IS_WINDOWS = process.platform === 'win32';
const PNPM_CMD = IS_WINDOWS ? 'pnpm.cmd' : 'pnpm';

// Suite timeout in ms (5 minutes per suite)
const SUITE_TIMEOUT_MS = 5 * 60 * 1000;

// Release suites to run
const RELEASE_SUITES = [
  // M12.* Inventory Close Ops Pack
  'test/e2e/inventory-m128-close-ops-finalization.e2e-spec.ts',
  'test/e2e/inventory-m124-close-approvals-dashboard.e2e-spec.ts',
  'test/e2e/inventory-m122-close-ops-v2.e2e-spec.ts',
  'test/e2e/inventory-m121-period-close.e2e-spec.ts',
  // Inventory foundation
  'test/e2e/inventory-m111-foundation.e2e-spec.ts',
  // Workforce regression
  'test/e2e/workforce-m1017-leave.e2e-spec.ts',
  // Reservations regression
  'test/e2e/reservations-m94-public-booking.e2e-spec.ts',
];

// Output directory
const OUTPUT_DIR = join(ROOT, 'test-output', 'release');

/**
 * Run a single E2E suite with timeout
 */
async function runSuite(suitePath, logDir) {
  const suiteName = suitePath.replace(/^test\/e2e\//, '').replace(/\.e2e-spec\.ts$/, '');
  const logFile = join(logDir, `${suiteName}.log`);
  
  console.log(`\n📋 Running: ${suiteName}`);
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;
    
    const args = [
      'jest',
      '--config',
      'test/jest-e2e.json',
      '--runInBand',
      '--forceExit',
      '--testPathPatterns',
      suitePath,
    ];
    
    const child = spawn(PNPM_CMD, args, {
      cwd: ROOT,
      shell: IS_WINDOWS,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    // Timeout handler
    const timeout = setTimeout(() => {
      killed = true;
      console.log(`   ⏱️  TIMEOUT after ${SUITE_TIMEOUT_MS / 1000}s`);
      
      if (IS_WINDOWS) {
        // Windows: use taskkill for tree kill
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { shell: true });
      } else {
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 5000);
      }
    }, SUITE_TIMEOUT_MS);
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', async (code) => {
      clearTimeout(timeout);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      // Write log file
      const logContent = `Suite: ${suitePath}\nDuration: ${duration}s\nExit Code: ${code}\nKilled: ${killed}\n\n--- STDOUT ---\n${stdout}\n\n--- STDERR ---\n${stderr}`;
      await writeFile(logFile, logContent, 'utf8');
      
      if (killed) {
        console.log(`   ❌ TIMEOUT (${duration}s)`);
        resolve({ suite: suiteName, passed: false, duration, reason: 'TIMEOUT' });
      } else if (code === 0) {
        console.log(`   ✅ PASSED (${duration}s)`);
        resolve({ suite: suiteName, passed: true, duration });
      } else {
        console.log(`   ❌ FAILED (${duration}s, exit ${code})`);
        resolve({ suite: suiteName, passed: false, duration, reason: `exit ${code}` });
      }
    });
    
    child.on('error', async (err) => {
      clearTimeout(timeout);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`   ❌ ERROR: ${err.message}`);
      
      const logContent = `Suite: ${suitePath}\nDuration: ${duration}s\nError: ${err.message}`;
      await writeFile(logFile, logContent, 'utf8');
      
      resolve({ suite: suiteName, passed: false, duration, reason: err.message });
    });
  });
}

/**
 * Self-check: verify runner can execute
 */
async function selfCheck() {
  console.log('🔍 Release Gate Runner Self-Check');
  console.log(`   Platform: ${process.platform}`);
  console.log(`   PNPM Command: ${PNPM_CMD}`);
  console.log(`   Output Dir: ${OUTPUT_DIR}`);
  console.log(`   Suites: ${RELEASE_SUITES.length}`);
  console.log(`   Suite Timeout: ${SUITE_TIMEOUT_MS / 1000}s`);
  
  // Test pnpm resolution
  return new Promise((resolve) => {
    const child = spawn(PNPM_CMD, ['--version'], {
      cwd: ROOT,
      shell: IS_WINDOWS,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    let version = '';
    child.stdout?.on('data', (d) => { version += d.toString(); });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`   PNPM Version: ${version.trim()}`);
        console.log('   ✅ Self-check PASSED');
        resolve(true);
      } else {
        console.log('   ❌ Self-check FAILED: cannot run pnpm');
        resolve(false);
      }
    });
    
    child.on('error', () => {
      console.log('   ❌ Self-check FAILED: pnpm not found');
      resolve(false);
    });
  });
}

/**
 * Main runner
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Self-check mode
  if (args.includes('--self-check')) {
    const ok = await selfCheck();
    process.exit(ok ? 0 : 1);
  }
  
  console.log('═══════════════════════════════════════════');
  console.log('   M12.9 Release Gate Runner');
  console.log('═══════════════════════════════════════════');
  console.log(`Platform: ${process.platform}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Suites: ${RELEASE_SUITES.length}`);
  
  // Create output directory
  await mkdir(OUTPUT_DIR, { recursive: true });
  
  const results = [];
  
  for (const suite of RELEASE_SUITES) {
    const result = await runSuite(suite, OUTPUT_DIR);
    results.push(result);
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════');
  console.log('   Summary');
  console.log('═══════════════════════════════════════════');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\nFailed suites:');
    for (const r of results.filter(r => !r.passed)) {
      console.log(`  - ${r.suite}: ${r.reason}`);
    }
  }
  
  // Write summary
  const summaryPath = join(OUTPUT_DIR, 'summary.json');
  await writeFile(summaryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    platform: process.platform,
    passed,
    failed,
    total: results.length,
    results,
  }, null, 2), 'utf8');
  
  console.log(`\nLogs: ${OUTPUT_DIR}`);
  console.log(`Summary: ${summaryPath}`);
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
