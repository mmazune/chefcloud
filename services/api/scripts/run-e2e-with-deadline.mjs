#!/usr/bin/env node
/**
 * T1.10: Hard-Deadline E2E Test Runner
 *
 * Spawns Jest E2E tests with a hard deadline, ensuring:
 * - Deterministic completion or timeout
 * - Clean JSON output
 * - Status file with unambiguous outcome
 * - Progress heartbeat during long runs
 * - M10.16: Cross-platform support (Windows + Linux)
 *
 * Usage:
 *   node scripts/run-e2e-with-deadline.mjs --minutes=25
 *   node scripts/run-e2e-with-deadline.mjs --minutes=10 --pattern=billing
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';

// M10.16: Cross-platform command resolution
const IS_WINDOWS = platform() === 'win32';
const PNPM = IS_WINDOWS ? 'pnpm.cmd' : 'pnpm';

// Parse CLI args
const args = process.argv.slice(2);
const minutesArg = args.find((a) => a.startsWith('--minutes='));
const patternArg = args.find((a) => a.startsWith('--pattern='));

const DEADLINE_MINUTES = minutesArg ? parseInt(minutesArg.split('=')[1]) : 25;
const DEADLINE_MS = DEADLINE_MINUTES * 60 * 1000;
const PATTERN = patternArg ? patternArg.split('=')[1] : null;

const STATUS_FILE = '.e2e-run-status.json';
const OUTPUT_FILE = '.e2e-results-latest.json';

// Dataset defaulting per DEMO_TENANTS_AND_DATASETS.md
// Default to DEMO_TAPAS unless explicitly overridden
if (!process.env.E2E_DEMO_DATASET) {
  process.env.E2E_DEMO_DATASET = 'DEMO_TAPAS';
}

// Run setup first, then start tests
(async () => {
  console.log(`🚀 Starting E2E test runner with ${DEADLINE_MINUTES}m deadline`);
  console.log(`📍 Platform: ${platform()} | PNPM: ${PNPM}`);
  if (PATTERN) {
    console.log(`📁 Pattern: ${PATTERN}`);
  }
  console.log(`🗂️  Dataset: ${process.env.E2E_DEMO_DATASET}`);
  console.log(`📊 JSON output: ${OUTPUT_FILE}`);
  console.log(`📋 Status file: ${STATUS_FILE}`);
  console.log('');

  // Run E2E setup first
  console.log('🔧 Running E2E database setup...');
  const setupStart = Date.now();
  const setupChild = spawn(PNPM, ['test:e2e:setup'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
  });

  await new Promise((resolve, reject) => {
    setupChild.on('close', (code) => {
      if (code !== 0) {
        console.error(`❌ E2E setup failed with code ${code}`);
        process.exit(1);
      }
      resolve();
    });
    setupChild.on('error', (err) => {
      console.error('❌ Failed to spawn setup:', err);
      process.exit(1);
    });
  });

  const setupDuration = Date.now() - setupStart;
  console.log(`✅ Setup complete (${Math.floor(setupDuration / 1000)}s)\n`);

  // Build Jest command args
  const jestArgs = [
    '--config',
    './test/jest-e2e.json',
    '--runInBand',
    '--testLocationInResults',
    '--json',
  ];

  if (PATTERN) {
    jestArgs.push('--testPathPattern', PATTERN);
  }

  console.log(`🎯 Jest args: ${jestArgs.join(' ')}`);
  console.log('');

  // Status tracking
  const status = {
    status: 'RUNNING',
    exitCode: null,
    durationMs: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    deadlineMinutes: DEADLINE_MINUTES,
    dataset: process.env.E2E_DEMO_DATASET || 'DEMO_TAPAS',
    pattern: PATTERN || 'all',
  };

  const startTime = Date.now();

  // Spawn jest directly (not through pnpm) to avoid wrapper noise
  const child = spawn('npx', ['jest', ...jestArgs], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout/stderr separately
    shell: false,
    detached: process.platform !== 'win32', // Create process group on Unix for clean termination
  });

  let stdout = '';
  let stderr = '';

  // Capture stdout (JSON output)
  child.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  // Capture stderr (logs, warnings) - don't mix with stdout
  child.stderr.on('data', (data) => {
    const text = data.toString();
    stderr += text;
    // Echo important stderr to console in real-time
    if (text.includes('FAIL') || text.includes('ERROR')) {
      process.stderr.write(text);
    }
  });

  // Heartbeat timer - print progress every 30s
  const heartbeatInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const elapsedMin = Math.floor(elapsed / 60000);
    const elapsedSec = Math.floor((elapsed % 60000) / 1000);
    console.log(`⏱️  Still running... ${elapsedMin}m ${elapsedSec}s elapsed`);
  }, 30000);

  // Hard deadline timer
  const deadlineTimer = setTimeout(() => {
    console.log(`\n⏰ DEADLINE REACHED (${DEADLINE_MINUTES}m) - Terminating Jest`);

    // Try to kill entire process tree (best effort)
    try {
      // On Unix-like systems, send SIGTERM to the process group
      // Negative PID kills the process group
      if (process.platform !== 'win32') {
        process.kill(-child.pid, 'SIGTERM');
      } else {
        child.kill('SIGTERM');
      }
    } catch (err) {
      // Fallback to killing just the child process
      console.warn(`⚠️  Could not kill process tree: ${err.message}`);
      child.kill('SIGTERM');
    }

    // If not dead in 10s, send SIGKILL
    const killTimer = setTimeout(() => {
      console.log('🔪 Process did not terminate gracefully - sending SIGKILL');
      try {
        if (process.platform !== 'win32') {
          process.kill(-child.pid, 'SIGKILL');
        } else {
          child.kill('SIGKILL');
        }
      } catch (err) {
        child.kill('SIGKILL');
      }
    }, 10000);

    // Clear kill timer if process exits
    child.on('exit', () => clearTimeout(killTimer));
  }, DEADLINE_MS);

  // Handle child process exit
  child.on('exit', (code, signal) => {
    clearInterval(heartbeatInterval);
    clearTimeout(deadlineTimer);

    const elapsed = Date.now() - startTime;
    const elapsedMin = Math.floor(elapsed / 60000);
    const elapsedSec = Math.floor((elapsed % 60000) / 1000);

    status.durationMs = elapsed;
    status.finishedAt = new Date().toISOString();

    // Determine outcome
    if (signal === 'SIGTERM' || signal === 'SIGKILL') {
      status.status = 'TIMED_OUT';
      status.exitCode = 124; // Standard timeout exit code
      console.log(`\n⏱️  TIMED OUT after ${elapsedMin}m ${elapsedSec}s`);
    } else if (code === 0) {
      status.status = 'COMPLETED';
      status.exitCode = 0;
      console.log(`\n✅ COMPLETED successfully in ${elapsedMin}m ${elapsedSec}s`);
    } else {
      status.status = 'COMPLETED';
      status.exitCode = code;
      console.log(
        `\n⚠️  COMPLETED with failures (exit code ${code}) in ${elapsedMin}m ${elapsedSec}s`,
      );
    }

    // Write status file
    writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
    console.log(`📋 Status written to ${STATUS_FILE}`);

    // Write JSON output file (extract JSON from stdout)
    try {
      // Find the last complete JSON object in stdout
      // Strategy: Find opening { and matching closing } for the main object
      let jsonStart = -1;
      let jsonEnd = -1;
      let braceCount = 0;

      for (let i = 0; i < stdout.length; i++) {
        if (stdout[i] === '{') {
          if (braceCount === 0) jsonStart = i;
          braceCount++;
        } else if (stdout[i] === '}') {
          braceCount--;
          if (braceCount === 0 && jsonStart !== -1) {
            jsonEnd = i;
            // Found a complete JSON object, use the last one
          }
        }
      }

      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonOutput = stdout.substring(jsonStart, jsonEnd + 1);
        // Validate it's parseable
        JSON.parse(jsonOutput);
        writeFileSync(OUTPUT_FILE, jsonOutput);
        console.log(`📊 JSON results written to ${OUTPUT_FILE}`);
      } else {
        console.warn(`⚠️  No valid JSON found in output`);
        // Write what we have for debugging
        writeFileSync(OUTPUT_FILE + '.raw', stdout);
        console.warn(`📝 Raw stdout saved to ${OUTPUT_FILE}.raw`);
      }
    } catch (err) {
      console.error(`❌ Failed to parse JSON output: ${err.message}`);
      writeFileSync(OUTPUT_FILE + '.raw', stdout);
      console.warn(`📝 Raw stdout saved to ${OUTPUT_FILE}.raw for debugging`);
    }

    // Print summary
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log(`Status: ${status.status}`);
    console.log(`Exit Code: ${status.exitCode}`);
    console.log(`Duration: ${elapsedMin}m ${elapsedSec}s`);
    console.log('═══════════════════════════════════════');

    // Exit with appropriate code
    process.exit(status.exitCode);
  });

  // Handle errors
  child.on('error', (err) => {
    clearInterval(heartbeatInterval);
    clearTimeout(deadlineTimer);

    console.error(`❌ Failed to spawn Jest: ${err.message}`);
    status.status = 'FAILED';
    status.exitCode = 1;
    status.finishedAt = new Date().toISOString();
    status.durationMs = Date.now() - startTime;

    writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
    process.exit(1);
  });
})(); // End of async IIFE
