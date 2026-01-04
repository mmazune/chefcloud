#!/usr/bin/env node
/**
 * M10.16: Cross-Platform E2E Gate Runner
 *
 * Runs E2E tests as a CI gate with cross-platform compatibility.
 * Works on both Linux (Codespaces) and Windows (PowerShell).
 *
 * Features:
 * - Cross-platform command resolution (pnpm vs pnpm.cmd)
 * - Node-based deadlines (no OS timeout dependency)
 * - Per-file and total budget timeouts
 * - Clean exit with no open handles
 * - TIMED_OUT/KILLED guardrail enforcement
 *
 * Usage:
 *   node scripts/e2e-gate-runner.mjs
 *   node scripts/e2e-gate-runner.mjs --perFileSeconds=180 --totalMinutes=30
 *   node scripts/e2e-gate-runner.mjs --skipSetup
 *
 * Self-check:
 *   node scripts/e2e-gate-runner.mjs --self-check
 */

import { spawn, spawnSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { join, resolve } from 'path';
import { platform } from 'os';

// ============================================================================
// CROSS-PLATFORM COMMAND RESOLUTION (M10.16)
// ============================================================================

/**
 * Resolve pnpm command for current platform
 * Windows: requires .cmd extension for spawn without shell
 * Unix: just 'pnpm'
 */
const IS_WINDOWS = platform() === 'win32';
const PNPM = IS_WINDOWS ? 'pnpm.cmd' : 'pnpm';
const NPX = IS_WINDOWS ? 'npx.cmd' : 'npx';

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

const args = process.argv.slice(2);
const selfCheckArg = args.includes('--self-check');
const perFileSecondsArg = args.find((a) => a.startsWith('--perFileSeconds='));
const totalMinutesArg = args.find((a) => a.startsWith('--totalMinutes='));
const skipSetupArg = args.includes('--skipSetup');

const PER_FILE_TIMEOUT_SECONDS = perFileSecondsArg
  ? parseInt(perFileSecondsArg.split('=')[1])
  : 120;
const PER_FILE_TIMEOUT_MS = PER_FILE_TIMEOUT_SECONDS * 1000;
const TOTAL_BUDGET_MINUTES = totalMinutesArg ? parseInt(totalMinutesArg.split('=')[1]) : 25;
const TOTAL_BUDGET_MS = TOTAL_BUDGET_MINUTES * 60 * 1000;
const SKIP_SETUP = skipSetupArg;

// ============================================================================
// FILE PATHS
// ============================================================================

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const API_ROOT = resolve(__dirname, '..');
const TEST_FILES_LIST = join(API_ROOT, '.e2e-test-files.txt');
const MATRIX_JSON = join(API_ROOT, '.e2e-matrix.json');
const GATE_LOG = join(API_ROOT, '.e2e-gate.log');
const SETUP_LOG = join(API_ROOT, '.e2e-gate-setup.log');

// ============================================================================
// SELF-CHECK MODE (M10.16)
// ============================================================================

if (selfCheckArg) {
  console.log('🔍 E2E Gate Runner Self-Check (M10.16)\n');
  console.log(`Platform: ${platform()}`);
  console.log(`PNPM command: ${PNPM}`);
  console.log(`NPX command: ${NPX}`);
  console.log(`API root: ${API_ROOT}`);
  console.log(`CWD: ${process.cwd()}`);
  console.log('');

  // Test pnpm spawn
  console.log('Testing pnpm spawn...');
  try {
    const result = spawnSync(PNPM, ['--version'], {
      cwd: API_ROOT,
      encoding: 'utf8',
      timeout: 10000,
      shell: IS_WINDOWS,
    });

    if (result.error) {
      console.error(`❌ PNPM spawn failed: ${result.error.message}`);
      process.exit(1);
    }

    if (result.status !== 0) {
      console.error(`❌ PNPM returned non-zero: ${result.status}`);
      console.error(result.stderr);
      process.exit(1);
    }

    console.log(`✅ PNPM version: ${result.stdout.trim()}`);
  } catch (err) {
    console.error(`❌ PNPM check failed: ${err.message}`);
    process.exit(1);
  }

  // Test npx spawn
  console.log('Testing npx spawn...');
  try {
    const result = spawnSync(NPX, ['--version'], {
      cwd: API_ROOT,
      encoding: 'utf8',
      timeout: 10000,
      shell: IS_WINDOWS,
    });

    if (result.error) {
      console.error(`❌ NPX spawn failed: ${result.error.message}`);
      process.exit(1);
    }

    console.log(`✅ NPX version: ${result.stdout.trim()}`);
  } catch (err) {
    console.error(`❌ NPX check failed: ${err.message}`);
    process.exit(1);
  }

  // Check test files list
  console.log(`\nChecking test files list: ${TEST_FILES_LIST}`);
  if (existsSync(TEST_FILES_LIST)) {
    const files = readFileSync(TEST_FILES_LIST, 'utf8')
      .split('\n')
      .filter((l) => l.trim());
    console.log(`✅ Found ${files.length} test files`);
  } else {
    console.log('⚠️  Test files list not found (will be generated)');
  }

  console.log('\n✅ Self-check passed - gate runner is cross-platform ready');
  process.exit(0);
}

// ============================================================================
// MAIN GATE RUNNER
// ============================================================================

// Dataset defaulting
if (!process.env.E2E_DATASET) {
  process.env.E2E_DATASET = process.env.E2E_DEMO_DATASET || 'ALL';
}
if (!process.env.E2E_DEMO_DATASET) {
  process.env.E2E_DEMO_DATASET = process.env.E2E_DATASET;
}

console.log('🚀 E2E Gate Runner (M10.16 Cross-Platform)');
console.log(`📍 Platform: ${platform()} | PNPM: ${PNPM}`);
console.log(`⏱️  Per-file timeout: ${PER_FILE_TIMEOUT_SECONDS}s`);
console.log(`💰 Total budget: ${TOTAL_BUDGET_MINUTES}m`);
console.log(`🗂️  Dataset: ${process.env.E2E_DATASET}`);
console.log(`🚫 Skip setup: ${SKIP_SETUP}`);
console.log(`📝 Gate log: ${GATE_LOG}`);
console.log('');

// Initialize gate log
writeFileSync(GATE_LOG, `E2E Gate Run - ${new Date().toISOString()}\n`);
writeFileSync(GATE_LOG, `Platform: ${platform()} | PNPM: ${PNPM}\n\n`, { flag: 'a' });

/**
 * Append to gate log
 */
function log(message) {
  console.log(message);
  appendFileSync(GATE_LOG, message + '\n');
}

/**
 * Kill child process (cross-platform)
 */
function killChild(child, signal = 'SIGTERM') {
  try {
    if (!IS_WINDOWS && child.pid) {
      // Unix: kill process group
      try {
        process.kill(-child.pid, signal);
      } catch {
        child.kill(signal);
      }
    } else {
      // Windows: direct kill
      child.kill(signal);
    }
  } catch (err) {
    // Process may already be dead
  }
}

/**
 * Spawn a command with cross-platform support
 */
function spawnCommand(command, args, options = {}) {
  const cmd = command === 'pnpm' ? PNPM : command === 'npx' ? NPX : command;

  return spawn(cmd, args, {
    cwd: API_ROOT,
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...options.env },
    // On Windows, use shell for reliable command resolution
    shell: IS_WINDOWS,
    // On Unix, use detached for process group kill capability
    detached: !IS_WINDOWS,
  });
}

/**
 * Run E2E setup
 */
async function runSetup() {
  log('GATE: setup start');
  const setupStart = Date.now();

  return new Promise((resolve) => {
    const child = spawnCommand('pnpm', ['test:e2e:setup'], {
      env: { E2E_DATASET: process.env.E2E_DATASET || 'ALL' },
    });

    let output = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      process.stdout.write(text);
      output += text;
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      process.stderr.write(text);
      output += text;
    });

    child.on('close', (code) => {
      writeFileSync(SETUP_LOG, output);
      const duration = Date.now() - setupStart;
      const min = Math.floor(duration / 60000);
      const sec = Math.floor((duration % 60000) / 1000);
      log(`GATE: setup complete in ${min}m ${sec}s (exit: ${code})`);
      resolve(code);
    });

    child.on('error', (err) => {
      log(`GATE: setup spawn error: ${err.message}`);
      resolve(1);
    });
  });
}

/**
 * Run a single test file with timeout
 */
async function runTestFile(filePath, index, total, startTime) {
  const fileStartTime = Date.now();
  const outputFile = join(API_ROOT, `.e2e-gate-${index}.json`);

  const elapsedTotal = Date.now() - startTime;
  const remainingBudget = TOTAL_BUDGET_MS - elapsedTotal;
  const remainingMin = Math.floor(remainingBudget / 60000);
  const remainingSec = Math.floor((remainingBudget % 60000) / 1000);

  log(`GATE: [${index}/${total}] ${filePath}`);
  log(`      Remaining: ${remainingMin}m ${remainingSec}s`);

  return new Promise((resolve) => {
    const child = spawnCommand('pnpm', [
      'test:e2e',
      '--',
      '--runTestsByPath',
      filePath,
      '--runInBand',
      '--json',
      '--outputFile',
      outputFile,
    ]);

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Per-file timeout
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      log(`      ⏰ TIMEOUT (${PER_FILE_TIMEOUT_SECONDS}s) - killing process`);
      killChild(child, 'SIGTERM');

      // Hard kill after 5s
      setTimeout(() => {
        killChild(child, 'SIGKILL');
      }, 5000);
    }, PER_FILE_TIMEOUT_MS);

    child.on('exit', (code, signal) => {
      clearTimeout(timeoutTimer);
      const duration = Date.now() - fileStartTime;

      let status;
      if (timedOut || signal === 'SIGTERM' || signal === 'SIGKILL') {
        status = 'TIMED_OUT';
      } else if (code === 0) {
        status = 'PASS';
      } else {
        status = 'FAIL';
      }

      // Parse JSON output
      let failingTests = 0;
      let errorSnippet = '';

      if (existsSync(outputFile)) {
        try {
          const jsonData = JSON.parse(readFileSync(outputFile, 'utf8'));
          failingTests = jsonData.numFailedTests || 0;

          if (jsonData.testResults?.[0]?.assertionResults) {
            const failure = jsonData.testResults[0].assertionResults.find(
              (r) => r.status === 'failed'
            );
            if (failure?.failureMessages?.[0]) {
              errorSnippet = failure.failureMessages[0].substring(0, 120);
            }
          }
        } catch {
          // JSON parse failed
        }
      }

      const result = {
        file: filePath,
        status,
        durationMs: duration,
        durationSeconds: Math.round(duration / 1000),
        failingTests,
        errorSnippet,
        exitCode: code,
      };

      const durationMin = Math.floor(duration / 60000);
      const durationSec = Math.floor((duration % 60000) / 1000);
      const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏰';
      log(`      ${icon} ${status} in ${durationMin}m ${durationSec}s`);

      resolve(result);
    });

    child.on('error', (err) => {
      clearTimeout(timeoutTimer);
      log(`      ❌ Spawn error: ${err.message}`);

      resolve({
        file: filePath,
        status: 'ERROR',
        durationMs: Date.now() - fileStartTime,
        durationSeconds: 0,
        failingTests: 0,
        errorSnippet: err.message,
        exitCode: -1,
      });
    });
  });
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();
  const results = [];

  // Run setup unless skipped
  if (!SKIP_SETUP) {
    const setupCode = await runSetup();
    if (setupCode !== 0) {
      log('\n❌ Setup failed - cannot proceed');
      process.exit(1);
    }
    log('');
  } else {
    log('⏩ Skipping setup (--skipSetup)\n');
  }

  // Read test files
  if (!existsSync(TEST_FILES_LIST)) {
    log(`❌ Test files list not found: ${TEST_FILES_LIST}`);
    log(`   Run: find test -name "*.e2e-spec.ts" | sort > ${TEST_FILES_LIST}`);
    process.exit(1);
  }

  const testFiles = readFileSync(TEST_FILES_LIST, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => line.trim());

  log(`📁 Found ${testFiles.length} test files\n`);

  // Run tests
  for (let i = 0; i < testFiles.length; i++) {
    const elapsed = Date.now() - startTime;

    if (elapsed >= TOTAL_BUDGET_MS) {
      log(`\n💰 BUDGET EXHAUSTED (${TOTAL_BUDGET_MINUTES}m)`);
      log(`   Ran ${i} of ${testFiles.length} files`);
      break;
    }

    const result = await runTestFile(testFiles[i], i + 1, testFiles.length, startTime);
    results.push(result);
  }

  // Summary
  const totalDuration = Date.now() - startTime;
  const totalMin = Math.floor(totalDuration / 60000);
  const totalSec = Math.floor((totalDuration % 60000) / 1000);

  log('\n═══════════════════════════════════════');
  log(`Completed ${results.length} of ${testFiles.length} files`);
  log(`Total duration: ${totalMin}m ${totalSec}s`);
  log('═══════════════════════════════════════\n');

  // Write JSON report
  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      platform: platform(),
      pnpmCommand: PNPM,
      perFileTimeoutSeconds: PER_FILE_TIMEOUT_SECONDS,
      totalBudgetMinutes: TOTAL_BUDGET_MINUTES,
      dataset: process.env.E2E_DATASET,
      totalFiles: testFiles.length,
      filesRun: results.length,
      totalDurationMs: totalDuration,
    },
    results: [...results].sort((a, b) => b.durationMs - a.durationMs),
  };

  writeFileSync(MATRIX_JSON, JSON.stringify(report, null, 2));
  log(`📊 Results: ${MATRIX_JSON}`);

  // GUARDRAIL: Fail if any TIMED_OUT or KILLED
  const timedOut = results.filter((r) => r.status === 'TIMED_OUT');
  const killed = results.filter((r) => r.status === 'KILLED');

  if (timedOut.length > 0 || killed.length > 0) {
    log('\n════════════════════════════════════════════════════════');
    log('🚨 CI GUARDRAIL FAILURE: TIMED_OUT/KILLED files detected');
    log('════════════════════════════════════════════════════════');

    if (timedOut.length > 0) {
      log(`\n⏰ TIMED_OUT (${timedOut.length}):`);
      timedOut.forEach((f) => log(`   - ${f.file}`));
    }

    if (killed.length > 0) {
      log(`\n💀 KILLED (${killed.length}):`);
      killed.forEach((f) => log(`   - ${f.file}`));
    }

    log('\n📋 Action: Fix open handles in these files.');
    process.exit(1);
  }

  // Check for failures
  const failures = results.filter((r) => r.status === 'FAIL' || r.status === 'ERROR');
  if (failures.length > 0) {
    log(`\n❌ ${failures.length} test file(s) failed`);
    process.exit(1);
  }

  log('\n✅ E2E Gate passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
