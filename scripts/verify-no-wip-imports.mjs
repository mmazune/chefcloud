#!/usr/bin/env node
/**
 * verify-no-wip-imports.mjs
 * 
 * Import firewall: Ensures no production code imports from quarantine paths.
 * 
 * Blocked patterns:
 * - wip/
 * - _quarantine/
 * 
 * Usage:
 *   node scripts/verify-no-wip-imports.mjs
 * 
 * Exit codes:
 *   0 = No forbidden imports found
 *   1 = Forbidden imports detected (lists offending files)
 * 
 * Part of Phase C3.2 — Deep Cleanup
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// Extensions to scan
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

// Directories to skip entirely
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
  'reports',
  '.turbo',
  '.git',
  'wip', // Don't scan quarantine itself
  '_quarantine',
]);

// Patterns that indicate forbidden imports
// Matches: from 'wip/...', from "wip/...", from '../wip/...', require('wip/...')
const FORBIDDEN_PATTERNS = [
  // Import statements with wip/ or _quarantine/
  /from\s+['"][^'"]*\/wip\//,
  /from\s+['"][^'"]*\/_quarantine\//,
  /from\s+['"]wip\//,
  /from\s+['"]_quarantine\//,
  // Require statements
  /require\s*\(\s*['"][^'"]*\/wip\//,
  /require\s*\(\s*['"][^'"]*\/_quarantine\//,
  /require\s*\(\s*['"]wip\//,
  /require\s*\(\s*['"]_quarantine\//,
  // Dynamic imports
  /import\s*\(\s*['"][^'"]*\/wip\//,
  /import\s*\(\s*['"][^'"]*\/_quarantine\//,
];

/**
 * Recursively collect files with matching extensions
 */
function collectFiles(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    
    // Skip directories in the skip list
    if (SKIP_DIRS.has(entry)) {
      continue;
    }

    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      collectFiles(fullPath, files);
    } else if (stat.isFile() && SCAN_EXTENSIONS.has(extname(entry))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check a file for forbidden imports
 */
function checkFile(filePath) {
  const violations = [];
  
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return violations;
  }

  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({
          file: relative(ROOT, filePath),
          line: lineNum,
          content: line.trim(),
        });
        break; // Only report once per line
      }
    }
  }

  return violations;
}

/**
 * Main entry point
 */
function main() {
  console.log('🔍 Scanning for forbidden imports from wip/ and _quarantine/...\n');

  const files = collectFiles(ROOT);
  console.log(`   Scanning ${files.length} files...\n`);

  const allViolations = [];

  for (const file of files) {
    const violations = checkFile(file);
    allViolations.push(...violations);
  }

  if (allViolations.length === 0) {
    console.log('✅ No forbidden imports found.\n');
    console.log('   Production code is clean — no imports from wip/ or _quarantine/.');
    process.exit(0);
  } else {
    console.log(`❌ Found ${allViolations.length} forbidden import(s):\n`);
    
    for (const v of allViolations) {
      console.log(`   ${v.file}:${v.line}`);
      console.log(`      ${v.content}\n`);
    }

    console.log('──────────────────────────────────────────────────────────');
    console.log('Fix: Remove imports from wip/ and _quarantine/ paths.');
    console.log('     Use test stubs or mock implementations instead.');
    console.log('──────────────────────────────────────────────────────────');
    
    process.exit(1);
  }
}

main();
