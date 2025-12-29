#!/usr/bin/env node
/**
 * E2E Test Converter - Systematically converts all E2E tests to use shared bootstrap
 * 
 * This script:
 * 1. Finds all test files using raw Test.createTestingModule
 * 2. Adds import for createE2ETestingModule / createE2ETestingModuleBuilder
 * 3. Replaces Test.createTestingModule with shared helpers
 * 4. Ensures CacheModule is not imported per-file
 * 5. Adds cleanup() imports where missing
 * 
 * Usage:
 *   node scripts/convert-e2e-tests.mjs [--dry-run]
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const E2E_DIR = path.resolve(__dirname, '../test/e2e');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

let dryRun = process.argv.includes('--dry-run');

async function convertTest(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  
  // Skip if already using shared bootstrap
  if (content.includes('from ../helpers/e2e-bootstrap') || content.includes('from \'../helpers/e2e-bootstrap\'')) {
    return { converted: false, reason: 'already using bootstrap' };
  }
  
  // Skip if doesn't use Test.createTestingModule
  if (!content.includes('Test.createTestingModule')) {
    return { converted: false, reason: 'no Test.createTestingModule found' };
  }
  
  let newContent = content;
  
  // Add bootstrap import after existing test/nestjs imports
  const hasTestImport = content.includes('from \'@nestjs/testing\'');
  if (hasTestImport && !content.includes('createE2ETestingModule')) {
    // Find the line with @nestjs/testing import
    const lines = content.split('\n');
    const testingImportIndex = lines.findIndex(line => line.includes('from \'@nestjs/testing\''));
    
    if (testingImportIndex !== -1) {
      // Insert bootstrap import after @nestjs/testing
      lines.splice(testingImportIndex + 1, 0, 'import { createE2ETestingModule, createE2ETestingModuleBuilder } from \'../helpers/e2e-bootstrap\';');
      newContent = lines.join('\n');
    }
  }
  
  // Replace Test.createTestingModule({ with createE2ETestingModule({
  // But preserve .overrideProvider patterns by using Builder
  const hasOverride = content.includes('.overrideProvider') || content.includes('.overrideGuard');
  
  if (hasOverride) {
    // Use Builder variant
    newContent = newContent.replace(
      /Test\.createTestingModule\(/g,
      'createE2ETestingModuleBuilder('
    );
    // Remove .compile() since Builder pattern requires it separately
  } else {
    // Use simple variant (auto-compiles)
    newContent = newContent.replace(
      /Test\.createTestingModule\(([^)]+)\)\.compile\(\)/gs,
      'createE2ETestingModule($1)'
    );
  }
  
  // Remove CacheModule from imports list (now global)
  newContent = newContent.replace(
    /,?\s*CacheModule,?\s*/g,
    ''
  );
  
  // Clean up double commas from removed imports
  newContent = newContent.replace(/,\s*,/g, ',');
  
  if (newContent === content) {
    return { converted: false, reason: 'no changes needed' };
  }
  
  if (!dryRun) {
    await fs.writeFile(filePath, newContent, 'utf-8');
  }
  
  return { converted: true, changes: 'added bootstrap helper' };
}

async function main() {
  console.log(`${colors.cyan}🔄 E2E Test Converter${colors.reset}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY CHANGES'}`);
  console.log('');
  
  const files = await fs.readdir(E2E_DIR);
  const testFiles = files.filter(f => f.endsWith('.e2e-spec.ts'));
  
  console.log(`Found ${testFiles.length} E2E test files\n`);
  
  let converted = 0;
  let skipped = 0;
  
  for (const file of testFiles) {
    const filePath = path.join(E2E_DIR, file);
    const result = await convertTest(filePath);
    
    if (result.converted) {
      console.log(`${colors.green}✓${colors.reset} ${file} - ${result.changes}`);
      converted++;
    } else {
      console.log(`${colors.yellow}○${colors.reset} ${file} - ${result.reason}`);
      skipped++;
    }
  }
  
  console.log('');
  console.log(`${colors.green}Converted: ${converted}${colors.reset}`);
  console.log(`${colors.yellow}Skipped: ${skipped}${colors.reset}`);
  
  if (dryRun) {
    console.log('');
    console.log('Run without --dry-run to apply changes');
  }
}

main().catch(console.error);
