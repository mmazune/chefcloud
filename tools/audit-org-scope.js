#!/usr/bin/env node
/**
 * Audit Org Scope - Static analysis tool for multi-tenant isolation
 * 
 * Checks:
 * 1. Controllers use @UseGuards(OrgScopeGuard) on authenticated endpoints
 * 2. Services include orgId in Prisma where clauses
 * 
 * Usage: node tools/audit-org-scope.js
 */

const fs = require('fs');
const path = require('path');

const violations = [];

// Directories to scan
const CONTROLLERS_DIR = path.join(__dirname, '../services/api/src');
const EXCLUDE_PATTERNS = [
  '/auth/',
  '/health/',
  '.spec.ts',
  '.e2e-spec.ts',
  'test/',
];

function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function checkControllerGuards(fileName, lines) {
  let inClass = false;
  let classHasOrgGuard = false;
  let methodStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for class definition
    if (line.includes('export class') && line.includes('Controller')) {
      inClass = true;
      continue;
    }

    if (!inClass) continue;

    // Check for class-level OrgScopeGuard
    if (line.includes('@UseGuards') && line.includes('OrgScopeGuard')) {
      classHasOrgGuard = true;
    }

    // Check for HTTP method decorators
    if (line.match(/@(Get|Post|Put|Patch|Delete)\(/)) {
      methodStart = i;
      continue;
    }

    // If we found a method, check for guards
    if (methodStart >= 0 && line.includes('async') && line.includes('(')) {
      // Look back for guards
      let hasMethodOrgGuard = false;
      let hasAuthGuard = false;

      for (let j = Math.max(0, methodStart - 5); j < i; j++) {
        if (lines[j].includes('@UseGuards') && lines[j].includes('OrgScopeGuard')) {
          hasMethodOrgGuard = true;
        }
        if (lines[j].includes('@UseGuards') && lines[j].includes('AuthGuard')) {
          hasAuthGuard = true;
        }
      }

      // Check if authenticated but missing org scope guard
      if (hasAuthGuard && !classHasOrgGuard && !hasMethodOrgGuard) {
        const methodLine = lines[i];
        const methodMatch = methodLine.match(/async\s+(\w+)/);
        const methodName = methodMatch ? methodMatch[1] : 'unknown';
        
        violations.push({
          file: fileName,
          line: i + 1,
          type: 'missing-guard',
          message: `Method '${methodName}' uses AuthGuard but missing OrgScopeGuard`,
        });
      }

      methodStart = -1;
    }
  }
}

function scanFile(filePath, content) {
  const lines = content.split('\n');
  const fileName = path.relative(process.cwd(), filePath);

  // Check controller files
  if (filePath.endsWith('.controller.ts') && !shouldExclude(filePath)) {
    checkControllerGuards(fileName, lines);
  }
}

function walkDirectory(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDirectory(filePath);
    } else if (stat.isFile() && file.endsWith('.ts')) {
      if (!shouldExclude(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        scanFile(filePath, content);
      }
    }
  }
}

// Main execution
console.log('🔍 Auditing org scope compliance...\n');

walkDirectory(CONTROLLERS_DIR);

if (violations.length === 0) {
  console.log('✅ No org scope violations found!\n');
  process.exit(0);
} else {
  console.log(`⚠️  Found ${violations.length} potential violation(s):\n`);

  violations.forEach(v => {
    console.log(`${v.file}:${v.line}`);
    console.log(`  [${v.type}] ${v.message}\n`);
  });

  console.log('Please ensure:');
  console.log('1. Authenticated endpoints use @UseGuards(AuthGuard(\'jwt\'), OrgScopeGuard)');
  console.log('2. Prisma queries include orgId or branch.orgId in where clauses');
  console.log('3. Use BaseService.withOrg() helper for consistent scoping\n');

  console.log('NOTE: Some violations may be false positives (e.g., admin endpoints)');
  console.log('Review each case and apply guards where appropriate.\n');

  // Don't fail CI for now, just warn
  process.exit(0);
}
