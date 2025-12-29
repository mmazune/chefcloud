#!/usr/bin/env node
/**
 * E2E Teardown Guardrail Script
 * 
 * Prevents regression of duplicate afterAll hooks in E2E tests.
 * 
 * RULES:
 * 1. Fails if any E2E test file contains BOTH "cleanup(" and "app.close("
 * 2. Warns if any file contains more than 1 "afterAll(" (may be legitimate for nested describes)
 * 3. Allows opt-out via comment: // E2E_TEARDOWN_ALLOW_DUPLICATE_AFTERALL
 * 
 * Usage:
 *   node scripts/check-e2e-teardown.mjs
 *   pnpm test:e2e:teardown-check
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const TEST_DIRS = ['test', 'test/e2e', 'test/smoke'];
const ALLOWLIST_COMMENT = 'E2E_TEARDOWN_ALLOW_DUPLICATE_AFTERALL';

let errors = 0;
let warnings = 0;

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const relativePath = relative(process.cwd(), filePath);
  
  // Check for opt-out comment
  if (content.includes(ALLOWLIST_COMMENT)) {
    console.log(`⏭️  SKIP: ${relativePath} (allowlist comment found)`);
    return;
  }

  // Rule 1: Check for BOTH cleanup() and app.close()
  const hasCleanup = content.includes('cleanup(');
  const hasAppClose = /app\??\s*\.\s*close\s*\(/.test(content);
  
  if (hasCleanup && hasAppClose) {
    console.error(`❌ ERROR: ${relativePath}`);
    console.error(`   Found BOTH cleanup() and app.close() - cleanup() already calls app.close()!`);
    console.error(`   Remove app.close() or add comment: // ${ALLOWLIST_COMMENT}`);
    errors++;
  }

  // Rule 2: Check for multiple afterAll hooks
  const afterAllMatches = content.match(/afterAll\s*\(/g);
  const afterAllCount = afterAllMatches ? afterAllMatches.length : 0;
  
  if (afterAllCount > 1) {
    // Check if they're in nested describe blocks (legitimate use)
    const describeCount = (content.match(/describe\s*\(/g) || []).length;
    
    if (describeCount > 1) {
      console.log(`⚠️  WARN: ${relativePath}`);
      console.log(`   Found ${afterAllCount} afterAll hooks in ${describeCount} describe blocks`);
      console.log(`   This may be legitimate for nested test suites - please verify each has matching beforeAll`);
      warnings++;
    } else {
      console.error(`❌ ERROR: ${relativePath}`);
      console.error(`   Found ${afterAllCount} afterAll hooks but only ${describeCount} describe block(s)`);
      console.error(`   Likely duplicate teardown - merge into single afterAll`);
      errors++;
    }
  }
}

function walkDir(dir) {
  try {
    const items = readdirSync(dir);
    
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (item.endsWith('.e2e-spec.ts')) {
        checkFile(fullPath);
      }
    }
  } catch (err) {
    // Directory doesn't exist - skip silently
  }
}

console.log('🔍 Checking E2E test teardown patterns...\n');

for (const dir of TEST_DIRS) {
  walkDir(dir);
}

console.log('\n📊 Summary:');
console.log(`   Errors: ${errors}`);
console.log(`   Warnings: ${warnings}`);

if (errors > 0) {
  console.error('\n❌ Teardown check FAILED - fix errors above');
  process.exit(1);
}

if (warnings > 0) {
  console.log('\n⚠️  Teardown check PASSED with warnings - review above');
  process.exit(0);
}

console.log('\n✅ Teardown check PASSED');
process.exit(0);
