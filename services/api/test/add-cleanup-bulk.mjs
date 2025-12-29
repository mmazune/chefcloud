#!/usr/bin/env node
/**
 * add-cleanup-bulk.mjs
 * 
 * Systematically adds cleanup() import and afterAll hook to E2E test files.
 * 
 * Strategy:
 * 1. Find all .e2e-spec.ts files without cleanup import
 * 2. Add import after last existing import
 * 3. Add afterAll after beforeAll (if exists) or at end of describe block
 * 4. Preserve existing code structure
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

// Find files without cleanup
const filesOutput = execSync(
  `find . -name "*.e2e-spec.ts" -o -name "*.slice.e2e-spec.ts" | xargs grep -L "cleanup" || true`,
  { encoding: 'utf-8', cwd: '/workspaces/chefcloud/services/api/test' }
);

const files = filesOutput.trim().split('\n').filter(f => f && !f.includes('node_modules'));

console.log(`\n=== Found ${files.length} files without cleanup ===\n`);

let successCount = 0;
let skipCount = 0;

for (const file of files) {
  const fullPath = `/workspaces/chefcloud/services/api/test/${file.replace('./', '')}`;
  
  console.log(`Processing: ${file}`);
  
  let content = readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  
  // Determine import path based on directory structure
  let importPath = '../helpers/cleanup';
  if (file.includes('/devportal/') || file.includes('/franchise/') || file.includes('/auth/') || file.includes('/prisma/')) {
    importPath = '../../helpers/cleanup';
  } else if (file.startsWith('./msr-card') || file.startsWith('./auth.e2e')) {
    importPath = './helpers/cleanup';
  }
  
  // Step 1: Add import after last import statement
  const lastImportIndex = lines.reduce((last, line, idx) => {
    return line.trim().startsWith('import ') ? idx : last;
  }, -1);
  
  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, `import { cleanup } from '${importPath}';`);
  } else {
    // No imports, add at top
    lines.unshift(`import { cleanup } from '${importPath}';`);
  }
  
  // Step 2: Find describe block and add afterAll
  // Look for beforeAll and add afterAll after it
  let beforeAllEndIndex = -1;
  let braceDepth = 0;
  let inBeforeAll = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('beforeAll')) {
      inBeforeAll = true;
      braceDepth = 0;
    }
    
    if (inBeforeAll) {
      // Count braces to find end of beforeAll
      for (const char of line) {
        if (char === '{') braceDepth++;
        if (char === '}') braceDepth--;
      }
      
      // Found the closing of beforeAll
      if (braceDepth === 0 && line.includes('});')) {
        beforeAllEndIndex = i;
        break;
      }
    }
  }
  
  if (beforeAllEndIndex > 0) {
    // Add afterAll right after beforeAll
    const indent = lines[beforeAllEndIndex].match(/^(\s*)/)[1];
    const afterAllBlock = [
      '',
      `${indent}afterAll(async () => {`,
      `${indent}  await cleanup(app);`,
      `${indent}});`,
    ];
    
    lines.splice(beforeAllEndIndex + 1, 0, ...afterAllBlock);
    
    writeFileSync(fullPath, lines.join('\n'), 'utf-8');
    console.log(`  ✓ Added cleanup import and afterAll\n`);
    successCount++;
  } else {
    // Just add the import, skip afterAll (manual review needed)
    writeFileSync(fullPath, lines.join('\n'), 'utf-8');
    console.log(`  ⚠ Added import only (no beforeAll found, manual afterAll needed)\n`);
    skipCount++;
  }
}

console.log(`\n=== Summary ===`);
console.log(`✓ Successfully updated: ${successCount}`);
console.log(`⚠ Import only (manual review): ${skipCount}`);
console.log(`Total: ${files.length}\n`);
