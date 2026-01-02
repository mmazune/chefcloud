#!/usr/bin/env node
/**
 * T1.11: E2E Runtime Matrix Generator
 * 
 * Runs each E2E test file individually to identify bottlenecks and timeouts.
 * 
 * Features:
 * - Per-file timeout enforcement (default 120s)
 * - Total budget enforcement (default 25m)
 * - Captures pass/fail/timeout status for each file
 * - Generates ranked list of slowest files
 * - Produces partial report if budget is reached
 * 
 * Usage:
 *   node scripts/e2e-runtime-matrix.mjs
 *   node scripts/e2e-runtime-matrix.mjs --perFileSeconds=180 --totalMinutes=30
 */

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// Parse CLI args
const args = process.argv.slice(2);
const perFileSecondsArg = args.find(a => a.startsWith('--perFileSeconds='));
const totalMinutesArg = args.find(a => a.startsWith('--totalMinutes='));
const skipSetupArg = args.find(a => a === '--skipSetup');

const PER_FILE_TIMEOUT_SECONDS = perFileSecondsArg ? parseInt(perFileSecondsArg.split('=')[1]) : 120;
const PER_FILE_TIMEOUT_MS = PER_FILE_TIMEOUT_SECONDS * 1000;
const TOTAL_BUDGET_MINUTES = totalMinutesArg ? parseInt(totalMinutesArg.split('=')[1]) : 25;
const TOTAL_BUDGET_MS = TOTAL_BUDGET_MINUTES * 60 * 1000;
const SKIP_SETUP = skipSetupArg || false;

const TEST_FILES_LIST = '.e2e-test-files.txt';
const MATRIX_JSON = '.e2e-matrix.json';
const MATRIX_MD = join(process.cwd(), '../../instructions/T1.11_E2E_RUNTIME_MATRIX.md');
const SETUP_LOG = '.e2e-matrix-setup.log';

// Dataset defaulting per DEMO_TENANTS_AND_DATASETS.md
// E2E_DATASET takes precedence over E2E_DEMO_DATASET for consistency
if (!process.env.E2E_DATASET) {
  process.env.E2E_DATASET = process.env.E2E_DEMO_DATASET || 'ALL';
}
if (!process.env.E2E_DEMO_DATASET) {
  process.env.E2E_DEMO_DATASET = process.env.E2E_DATASET;
}

console.log('🔬 E2E Runtime Matrix Generator');
console.log(`⏱️  Per-file timeout: ${PER_FILE_TIMEOUT_SECONDS}s`);
console.log(`💰 Total budget: ${TOTAL_BUDGET_MINUTES}m`);
console.log(`🗂️  Dataset: ${process.env.E2E_DATASET}`);
console.log(`🚫 Skip setup: ${SKIP_SETUP}`);
console.log('');

// Read test files
if (!existsSync(TEST_FILES_LIST)) {
  console.error(`❌ Test files list not found: ${TEST_FILES_LIST}`);
  console.error(`   Run: find test -name "*.e2e-spec.ts" | sort > ${TEST_FILES_LIST}`);
  process.exit(1);
}

const testFiles = readFileSync(TEST_FILES_LIST, 'utf8')
  .split('\n')
  .filter(line => line.trim().length > 0)
  .map(line => line.trim());

console.log(`📁 Found ${testFiles.length} test files\n`);

const results = [];
const startTime = Date.now();

/**
 * Run a single test file with timeout enforcement
 */
async function runTestFile(filePath, index, total) {
  const fileStartTime = Date.now();
  const outputFile = `.e2e-matrix-${index}.json`;
  
  const elapsedTotal = Date.now() - startTime;
  const remainingBudget = TOTAL_BUDGET_MS - elapsedTotal;
  const remainingMinutes = Math.floor(remainingBudget / 60000);
  const remainingSeconds = Math.floor((remainingBudget % 60000) / 1000);
  
  console.log(`MATRIX: running ${index}/${total} ${filePath}`);
  console.log(`         Elapsed: ${Math.floor(elapsedTotal / 60000)}m ${Math.floor((elapsedTotal % 60000) / 1000)}s | Remaining: ${remainingMinutes}m ${remainingSeconds}s`);
  
  return new Promise((resolve) => {
    const child = spawn('pnpm', [
      'test:e2e',
      '--',
      '--runTestsByPath',
      filePath,
      '--runInBand',
      '--json',
      '--outputFile',
      outputFile
    ], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      detached: process.platform !== 'win32',
    });

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
      console.log(`         ⏰ TIMEOUT (${PER_FILE_TIMEOUT_SECONDS}s) - killing process`);
      
      try {
        if (process.platform !== 'win32') {
          process.kill(-child.pid, 'SIGTERM');
        } else {
          child.kill('SIGTERM');
        }
      } catch (err) {
        child.kill('SIGTERM');
      }
      
      // Hard kill after 5s
      setTimeout(() => {
        try {
          if (process.platform !== 'win32') {
            process.kill(-child.pid, 'SIGKILL');
          } else {
            child.kill('SIGKILL');
          }
        } catch (err) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }, PER_FILE_TIMEOUT_MS);

    child.on('exit', (code, signal) => {
      clearTimeout(timeoutTimer);
      const duration = Date.now() - fileStartTime;
      
      // Determine status
      let status;
      if (timedOut || signal === 'SIGTERM' || signal === 'SIGKILL') {
        status = 'TIMED_OUT';
      } else if (code === 0) {
        status = 'PASS';
      } else {
        status = 'FAIL';
      }
      
      // Parse JSON output if it exists
      let failingTests = 0;
      let errorSnippet = '';
      
      if (existsSync(outputFile)) {
        try {
          const jsonData = JSON.parse(readFileSync(outputFile, 'utf8'));
          failingTests = jsonData.numFailedTests || 0;
          
          // Extract first error message
          if (jsonData.testResults && jsonData.testResults.length > 0) {
            const firstResult = jsonData.testResults[0];
            if (firstResult.assertionResults) {
              const firstFailure = firstResult.assertionResults.find(r => r.status === 'failed');
              if (firstFailure && firstFailure.failureMessages && firstFailure.failureMessages.length > 0) {
                errorSnippet = normalizeError(firstFailure.failureMessages[0]);
              }
            }
          }
        } catch (err) {
          // JSON parsing failed - file likely incomplete
        }
      }
      
      const result = {
        file: filePath,
        status,
        durationMs: duration,
        durationSeconds: Math.round(duration / 1000),
        failingTests,
        errorSnippet,
        exitCode: code
      };
      
      results.push(result);
      
      const durationMin = Math.floor(duration / 60000);
      const durationSec = Math.floor((duration % 60000) / 1000);
      const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏰';
      
      console.log(`         ${statusIcon} ${status} in ${durationMin}m ${durationSec}s`);
      if (failingTests > 0) {
        console.log(`         Failed tests: ${failingTests}`);
      }
      console.log('');
      
      resolve(result);
    });

    child.on('error', (err) => {
      clearTimeout(timeoutTimer);
      console.error(`         ❌ Failed to spawn: ${err.message}`);
      
      results.push({
        file: filePath,
        status: 'ERROR',
        durationMs: Date.now() - fileStartTime,
        durationSeconds: 0,
        failingTests: 0,
        errorSnippet: err.message,
        exitCode: -1
      });
      
      resolve();
    });
  });
}

/**
 * Normalize error message for display
 */
function normalizeError(message) {
  const lines = message.split('\n');
  for (const line of lines) {
    if (line.includes('Error:') || line.includes('Invalid') || line.includes('Cannot') || line.includes('expect')) {
      return line.trim().substring(0, 120);
    }
  }
  return message.substring(0, 120);
}

/**
 * Main execution
 */
async function main() {
  // Run setup once before all tests
  if (SKIP_SETUP) {
    console.log('⏩ Skipping E2E database setup (--skipSetup flag)\n');
  } else {
    console.log('MATRIX: setup start');
    const setupStart = Date.now();
    
    // Create write stream for setup log
    const { createWriteStream } = await import('fs');
    const setupLogStream = createWriteStream(SETUP_LOG, { flags: 'w' });
    
    const setupResult = await new Promise((resolve) => {
      const child = spawn('pnpm', ['test:e2e:setup'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        env: {
          ...process.env,
          E2E_DATASET: process.env.E2E_DATASET || 'ALL'
        }
      });
      
      // Stream output to both console and log file
      child.stdout.on('data', (data) => {
        process.stdout.write(data);
        setupLogStream.write(data);
      });
      
      child.stderr.on('data', (data) => {
        process.stderr.write(data);
        setupLogStream.write(data);
      });
      
      child.on('close', (code) => {
        setupLogStream.end();
        resolve(code);
      });
    });

    if (setupResult !== 0) {
      console.error('\n❌ E2E setup failed - cannot proceed with tests');
      console.error('📋 Last 200 lines of setup log:\n');
      
      // Print last 200 lines of setup log for debugging
      try {
        const logContent = readFileSync(SETUP_LOG, 'utf8');
        const lines = logContent.split('\n');
        const lastLines = lines.slice(-200).join('\n');
        console.error(lastLines);
      } catch (err) {
        console.error('   (Unable to read setup log)');
      }
      
      process.exit(1);
    }

    const setupDuration = Date.now() - setupStart;
    const setupMin = Math.floor(setupDuration / 60000);
    const setupSec = Math.floor((setupDuration % 60000) / 1000);
    console.log(`MATRIX: setup complete in ${setupMin}m ${setupSec}s\n`);
  }
  
  for (let i = 0; i < testFiles.length; i++) {
    const elapsedTotal = Date.now() - startTime;
    
    // Check if we've exceeded total budget
    if (elapsedTotal >= TOTAL_BUDGET_MS) {
      console.log(`\n💰 BUDGET EXHAUSTED (${TOTAL_BUDGET_MINUTES}m)`);
      console.log(`   Ran ${i} of ${testFiles.length} files`);
      console.log(`   Generating partial report...\n`);
      break;
    }
    
    await runTestFile(testFiles[i], i + 1, testFiles.length);
  }
  
  const totalDuration = Date.now() - startTime;
  const totalMin = Math.floor(totalDuration / 60000);
  const totalSec = Math.floor((totalDuration % 60000) / 1000);
  
  console.log('═══════════════════════════════════════');
  console.log(`Completed ${results.length} of ${testFiles.length} files`);
  console.log(`Total duration: ${totalMin}m ${totalSec}s`);
  console.log('═══════════════════════════════════════\n');
  
  // Generate reports
  generateReports();
  
  // GUARDRAIL: Fail CI if any files TIMED_OUT or KILLED
  const timedOutFiles = results.filter(r => r.status === 'TIMED_OUT');
  const killedFiles = results.filter(r => r.status === 'KILLED');
  
  if (timedOutFiles.length > 0 || killedFiles.length > 0) {
    console.log('');
    console.log('════════════════════════════════════════════════════════');
    console.log('🚨 CI GUARDRAIL FAILURE: TIMED_OUT/KILLED files detected');
    console.log('════════════════════════════════════════════════════════');
    
    if (timedOutFiles.length > 0) {
      console.log(`\n⏰ TIMED_OUT (${timedOutFiles.length}):`);
      timedOutFiles.forEach(f => console.log(`   - ${f.file}`));
    }
    
    if (killedFiles.length > 0) {
      console.log(`\n💀 KILLED (${killedFiles.length}):`);
      killedFiles.forEach(f => console.log(`   - ${f.file}`));
    }
    
    console.log('\n📋 Action: Fix open handles/infinite waits in these files.');
    console.log('   Run with --detectOpenHandles to diagnose.\n');
    
    process.exit(1);
  }
}

/**
 * Generate JSON and Markdown reports
 */
function generateReports() {
  // Sort by duration (slowest first)
  const sortedResults = [...results].sort((a, b) => b.durationMs - a.durationMs);
  
  // Write JSON
  writeFileSync(MATRIX_JSON, JSON.stringify({
    metadata: {
      generatedAt: new Date().toISOString(),
      perFileTimeoutSeconds: PER_FILE_TIMEOUT_SECONDS,
      totalBudgetMinutes: TOTAL_BUDGET_MINUTES,
      dataset: process.env.E2E_DEMO_DATASET,
      totalFiles: testFiles.length,
      filesRun: results.length,
      totalDurationMs: Date.now() - startTime
    },
    results: sortedResults
  }, null, 2));
  
  console.log(`📊 Matrix JSON: ${MATRIX_JSON}`);
  
  // Generate Markdown report
  const md = generateMarkdownReport(sortedResults);
  writeFileSync(MATRIX_MD, md);
  
  console.log(`📝 Matrix report: ${MATRIX_MD}`);
  console.log('');
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(sortedResults) {
  const totalMin = Math.floor((Date.now() - startTime) / 60000);
  const totalSec = Math.floor(((Date.now() - startTime) % 60000) / 1000);
  
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const timeoutCount = results.filter(r => r.status === 'TIMED_OUT').length;
  const errorCount = results.filter(r => r.status === 'ERROR').length;
  
  let md = `# E2E Runtime Matrix Report (T1.11)

**Generated:** ${new Date().toISOString()}  
**Dataset:** ${process.env.E2E_DEMO_DATASET}  
**Total Duration:** ${totalMin}m ${totalSec}s

---

## Summary

| Metric | Count |
|--------|-------|
| Total files | ${testFiles.length} |
| Files run | ${results.length} |
| ✅ Passed | ${passCount} |
| ❌ Failed | ${failCount} |
| ⏰ Timed out | ${timeoutCount} |
| 🔥 Errors | ${errorCount} |

**Per-file timeout:** ${PER_FILE_TIMEOUT_SECONDS}s  
**Total budget:** ${TOTAL_BUDGET_MINUTES}m  

---

## Top 20 Slowest Files

| Rank | Duration | Status | File | Failing Tests | Error Snippet |
|------|----------|--------|------|---------------|---------------|
`;

  sortedResults.slice(0, 20).forEach((result, index) => {
    const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : result.status === 'TIMED_OUT' ? '⏰' : '🔥';
    const durationMin = Math.floor(result.durationMs / 60000);
    const durationSec = Math.floor((result.durationMs % 60000) / 1000);
    const duration = durationMin > 0 ? `${durationMin}m ${durationSec}s` : `${durationSec}s`;
    const errorDisplay = result.errorSnippet ? result.errorSnippet.substring(0, 80) + '...' : '-';
    
    md += `| ${index + 1} | ${duration} | ${statusIcon} ${result.status} | \`${result.file}\` | ${result.failingTests || 0} | ${errorDisplay} |\n`;
  });
  
  // Timed out files section
  const timedOutFiles = results.filter(r => r.status === 'TIMED_OUT');
  if (timedOutFiles.length > 0) {
    md += `\n---

## ⏰ Timed Out Files (Exceeded ${PER_FILE_TIMEOUT_SECONDS}s)

${timedOutFiles.length} file(s) exceeded the per-file timeout and were forcibly terminated:

`;
    timedOutFiles.forEach((result, index) => {
      md += `${index + 1}. **${result.file}** (killed at ${PER_FILE_TIMEOUT_SECONDS}s)\n`;
    });
  }
  
  // Failed files summary
  const failedFiles = results.filter(r => r.status === 'FAIL');
  if (failedFiles.length > 0) {
    md += `\n---

## ❌ Failed Files

${failedFiles.length} file(s) completed but had test failures:

| File | Duration | Failing Tests | Error Snippet |
|------|----------|---------------|---------------|
`;
    failedFiles.slice(0, 10).forEach((result) => {
      const durationSec = Math.floor(result.durationMs / 1000);
      const errorDisplay = result.errorSnippet ? result.errorSnippet.substring(0, 100) : '-';
      md += `| \`${result.file}\` | ${durationSec}s | ${result.failingTests} | ${errorDisplay} |\n`;
    });
  }
  
  md += `\n---

## Distribution Histogram

\`\`\`
0-10s:   ${results.filter(r => r.durationMs < 10000).length} files
10-30s:  ${results.filter(r => r.durationMs >= 10000 && r.durationMs < 30000).length} files
30-60s:  ${results.filter(r => r.durationMs >= 30000 && r.durationMs < 60000).length} files
60-120s: ${results.filter(r => r.durationMs >= 60000 && r.durationMs < 120000).length} files
120s+:   ${results.filter(r => r.durationMs >= 120000).length} files
\`\`\`

---

## Actionable Insights

### 🔥 Critical Issues (Immediate Action Required)

`;

  if (timeoutCount > 0) {
    md += `- **${timeoutCount} file(s) timed out** - These files likely have open handles or infinite waits\n`;
    md += `  - Action: Run with \`--detectOpenHandles\` to diagnose\n`;
    md += `  - Check for unclosed Prisma/Redis connections in \`afterAll()\`\n\n`;
  }
  
  const verySlowFiles = results.filter(r => r.durationMs > 60000 && r.status !== 'TIMED_OUT');
  if (verySlowFiles.length > 0) {
    md += `- **${verySlowFiles.length} file(s) exceeded 60s** - These are bottlenecks\n`;
    md += `  - Action: Profile individual tests in these files\n`;
    md += `  - Consider splitting into smaller test files\n\n`;
  }
  
  md += `### 📊 Performance Optimization Opportunities

`;

  const slowFiles = results.filter(r => r.durationMs > 30000 && r.durationMs <= 60000);
  if (slowFiles.length > 0) {
    md += `- **${slowFiles.length} file(s) between 30-60s** - Moderate optimization targets\n`;
    md += `  - Review module imports (use slice modules instead of full AppModule)\n`;
    md += `  - Check for unnecessary DB resets in \`beforeAll()\`\n\n`;
  }
  
  md += `### ✅ Good Performers

`;
  
  const fastFiles = results.filter(r => r.durationMs < 10000 && r.status === 'PASS');
  if (fastFiles.length > 0) {
    md += `- **${fastFiles.length} file(s) under 10s** - Use these as templates for best practices\n\n`;
  }
  
  md += `---

**Next Steps:**
1. Fix timed-out files first (open handles/infinite waits)
2. Optimize files >60s (likely heavy setup or slow tests)
3. Consider parallelizing test execution once files are stable
4. Run individual slow files with \`--verbose --detectOpenHandles\` for diagnosis

**Full results:** See \`.e2e-matrix.json\`
`;

  return md;
}

// Run main
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
