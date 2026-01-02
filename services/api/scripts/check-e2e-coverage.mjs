#!/usr/bin/env node
/**
 * E2E Coverage Check Script
 *
 * Lightweight linter that ensures source code changes have corresponding test changes.
 * Part of M0.5 E2E expansion operationalization.
 *
 * RULES:
 * 1. If src files are modified, at least one test file must be modified
 * 2. Skip check for docs-only, config-only, or test-only changes
 *
 * EXEMPTIONS (via commit message or file path patterns):
 * - Commit message contains: [skip-e2e-check] or [docs] or [chore]
 * - Only files matching: *.md, *.json, *.yml, *.yaml, *.lock
 * - Only files in: docs/, instructions/, .github/
 *
 * Usage:
 *   node scripts/check-e2e-coverage.mjs [--base=main] [--verbose] [--help]
 *
 * Exit codes:
 *   0 - Pass (test coverage present or exempt)
 *   1 - Fail (source changes without test changes)
 *   2 - Error (git command failed)
 */

import { execSync } from 'child_process';

// === Configuration ===
const SOURCE_PATTERNS = [
  /^services\/api\/src\//,
  /^apps\/web\/src\//,
  /^packages\/.*\/src\//,
];

const TEST_PATTERNS = [
  /^services\/api\/test\//,
  /^apps\/web\/.*\.(test|spec)\.(ts|tsx)$/,
  /^packages\/.*\/__tests__\//,
  /^packages\/.*\.(test|spec)\.ts$/,
];

const EXEMPT_PATH_PATTERNS = [
  /\.md$/i,
  /\.json$/,
  /\.ya?ml$/,
  /\.lock$/,
  /^docs\//,
  /^instructions\//,
  /^\.github\//,
  /^\.vscode\//,
  /^\.devcontainer\//,
  /eslint/i,
  /prettier/i,
  /tsconfig/i,
  /jest\.config/,
  /vitest\.config/,
];

const EXEMPT_COMMIT_MESSAGES = [
  /\[skip-e2e-check\]/i,
  /\[skip e2e\]/i,
  /\[docs\]/i,
  /\[chore\]/i,
  /\[ci\]/i,
  /\[config\]/i,
];

// === CLI Parsing ===
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    base: 'main',
    verbose: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg.startsWith('--base=')) {
      options.base = arg.split('=')[1];
    }
  }

  return options;
}

function showHelp() {
  console.log(`
E2E Coverage Check Script

Usage:
  node scripts/check-e2e-coverage.mjs [options]

Options:
  --base=<ref>   Git ref to compare against (default: main)
  --verbose, -v  Show detailed output
  --help, -h     Show this help message

Description:
  Ensures that source code changes include corresponding test changes.
  This is a lightweight linter that runs in CI to prevent test coverage gaps.

Rules:
  - Changes to src/**/*.ts require changes to test/**/*.ts
  - Changes to apps/web/** require changes to *.test.tsx or *.spec.tsx

Exemptions:
  - Commit message contains [skip-e2e-check], [docs], [chore], [ci], [config]
  - Only changes to: *.md, *.json, *.yml, docs/, instructions/, .github/

Exit Codes:
  0  Pass (test coverage present or change is exempt)
  1  Fail (source changes without test changes)
  2  Error (git command failed)

Examples:
  node scripts/check-e2e-coverage.mjs
  node scripts/check-e2e-coverage.mjs --base=develop
  node scripts/check-e2e-coverage.mjs --verbose
`);
}

// === Git Operations ===
function getChangedFiles(base) {
  try {
    // Try to get diff from base branch
    const cmd = `git diff --name-only ${base}...HEAD 2>/dev/null || git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached`;
    const result = execSync(cmd, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.trim().split('\n').filter(Boolean);
  } catch (error) {
    // Fallback: check staged files
    try {
      const staged = execSync('git diff --name-only --cached', { encoding: 'utf-8' });
      if (staged.trim()) {
        return staged.trim().split('\n').filter(Boolean);
      }
    } catch (e) {
      // Ignore
    }

    // Last resort: check unstaged files
    try {
      const unstaged = execSync('git diff --name-only', { encoding: 'utf-8' });
      return unstaged.trim().split('\n').filter(Boolean);
    } catch (e) {
      console.error('Could not determine changed files');
      process.exit(2);
    }
  }
}

function getCommitMessage() {
  try {
    return execSync('git log -1 --pretty=%B 2>/dev/null || echo ""', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

// === Classification ===
function isSourceFile(path) {
  return SOURCE_PATTERNS.some(pattern => pattern.test(path)) && path.endsWith('.ts');
}

function isTestFile(path) {
  return TEST_PATTERNS.some(pattern => pattern.test(path));
}

function isExemptPath(path) {
  return EXEMPT_PATH_PATTERNS.some(pattern => pattern.test(path));
}

function isExemptCommitMessage(message) {
  return EXEMPT_COMMIT_MESSAGES.some(pattern => pattern.test(message));
}

// === Main ===
function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  const startTime = Date.now();

  // Get changed files
  const changedFiles = getChangedFiles(options.base);

  if (changedFiles.length === 0) {
    console.log('No changed files detected');
    process.exit(0);
  }

  if (options.verbose) {
    console.log(`Changed files (${changedFiles.length}):`);
    changedFiles.forEach(f => console.log(`   ${f}`));
    console.log('');
  }

  // Check commit message exemption
  const commitMessage = getCommitMessage();
  if (isExemptCommitMessage(commitMessage)) {
    console.log('SKIP: Commit message contains exemption marker');
    if (options.verbose) {
      console.log(`   Message: ${commitMessage.split('\n')[0]}`);
    }
    process.exit(0);
  }

  // Classify files
  const sourceFiles = changedFiles.filter(f => isSourceFile(f) && !isExemptPath(f));
  const testFiles = changedFiles.filter(f => isTestFile(f));
  const exemptFiles = changedFiles.filter(f => isExemptPath(f));
  const otherFiles = changedFiles.filter(f => !isSourceFile(f) && !isTestFile(f) && !isExemptPath(f));

  if (options.verbose) {
    console.log('Classification:');
    console.log(`   Source files: ${sourceFiles.length}`);
    console.log(`   Test files: ${testFiles.length}`);
    console.log(`   Exempt files: ${exemptFiles.length}`);
    console.log(`   Other files: ${otherFiles.length}`);
    console.log('');
  }

  // If no source files changed, pass
  if (sourceFiles.length === 0) {
    console.log('No source files changed (test-only, docs-only, or config-only change)');
    process.exit(0);
  }

  // If source files changed, require test files
  if (testFiles.length === 0) {
    console.log('');
    console.log('E2E COVERAGE CHECK FAILED');
    console.log('');
    console.log('Source files changed but no test files modified:');
    sourceFiles.slice(0, 10).forEach(f => console.log(`   ${f}`));
    if (sourceFiles.length > 10) {
      console.log(`   ... and ${sourceFiles.length - 10} more`);
    }
    console.log('');
    console.log('To fix, either:');
    console.log('  1. Add/update tests in test/ or *.spec.ts files');
    console.log('  2. Add [skip-e2e-check] to commit message if truly no tests needed');
    console.log('');
    console.log('See: instructions/E2E_EXPANSION_CONTRACT.md');
    console.log('     instructions/MILESTONE_DEFINITION_OF_DONE.md');
    console.log('');
    process.exit(1);
  }

  // Calculate ratio for reporting
  const ratio = (testFiles.length / sourceFiles.length).toFixed(2);
  const elapsed = Date.now() - startTime;

  console.log('');
  console.log('E2E COVERAGE CHECK PASSED');
  console.log('');
  console.log(`   Source files changed: ${sourceFiles.length}`);
  console.log(`   Test files changed:   ${testFiles.length}`);
  console.log(`   Test/Source ratio:    ${ratio}`);
  console.log(`   Elapsed:              ${elapsed}ms`);
  console.log('');

  if (options.verbose) {
    console.log('Test files:');
    testFiles.forEach(f => console.log(`   ${f}`));
    console.log('');
  }

  process.exit(0);
}

main();
