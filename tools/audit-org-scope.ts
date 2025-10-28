#!/usr/bin/env ts-node
/**
 * Audit Org Scope - Static analysis tool for multi-tenant isolation
 * 
 * Checks:
 * 1. Controllers use @UseGuards(OrgScopeGuard) on authenticated endpoints
 * 2. Services include orgId in Prisma where clauses
 * 
 * Usage: pnpm ts-node tools/audit-org-scope.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface Violation {
  file: string;
  line: number;
  type: 'missing-guard' | 'unscoped-query';
  message: string;
}

const violations: Violation[] = [];

// Directories to scan
const CONTROLLERS_DIR = path.join(__dirname, '../services/api/src');
const EXCLUDE_PATTERNS = [
  '/auth/',
  '/health/',
  '.spec.ts',
  '.e2e-spec.ts',
  'test/',
];

function shouldExclude(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function scanFile(filePath: string, content: string) {
  const lines = content.split('\n');
  const fileName = path.relative(process.cwd(), filePath);

  // Check controller files
  if (filePath.endsWith('.controller.ts') && !shouldExclude(filePath)) {
    checkControllerGuards(fileName, lines);
  }

  // Check service files
  if (filePath.endsWith('.service.ts') && !shouldExclude(filePath)) {
    checkServiceQueries(fileName, lines);
  }
}

function checkControllerGuards(fileName: string, lines: string[]) {
  let inClass = false;
  let hasAuthGuard = false;
  let hasOrgScopeGuard = false;
  let methodStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for class definition
    if (line.includes('export class') && line.includes('Controller')) {
      inClass = true;
      continue;
    }

    if (!inClass) continue;

    // Check for decorators on class or method
    if (line.includes('@UseGuards') && line.includes('AuthGuard')) {
      hasAuthGuard = true;
    }

    if (line.includes('@UseGuards') && line.includes('OrgScopeGuard')) {
      hasOrgScopeGuard = true;
    }

    // Check for HTTP method decorators
    if (line.match(/@(Get|Post|Put|Patch|Delete)\(/)) {
      methodStart = i;
      continue;
    }

    // If we found a method, check for guards
    if (methodStart >= 0 && line.includes('async') && line.includes('(')) {
      // Look back for guards
      let hasMethodAuthGuard = false;
      let hasMethodOrgGuard = false;

      for (let j = methodStart; j < i; j++) {
        if (lines[j].includes('@UseGuards') && lines[j].includes('AuthGuard')) {
          hasMethodAuthGuard = true;
        }
        if (lines[j].includes('@UseGuards') && lines[j].includes('OrgScopeGuard')) {
          hasMethodOrgGuard = true;
        }
      }

      // Check if public endpoint (no auth required)
      const isPublic = lines.slice(methodStart, i).some(l => 
        l.includes('@Public()') || !l.includes('@UseGuards')
      );

      // If authenticated but missing org scope guard, flag it
      if ((hasAuthGuard || hasMethodAuthGuard) && !hasOrgScopeGuard && !hasMethodOrgGuard && !isPublic) {
        const methodLine = lines[i];
        const methodName = methodLine.match(/async\s+(\w+)/)?.[1] || 'unknown';
        
        violations.push({
          file: fileName,
          line: i + 1,
          type: 'missing-guard',
          message: `Method '${methodName}' uses AuthGuard but missing OrgScopeGuard`,
        });
      }

      methodStart = -1;
      hasMethodAuthGuard = false;
      hasMethodOrgGuard = false;
    }
  }
}

function checkServiceQueries(fileName: string, lines: string[]) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look for Prisma queries
    const prismaMatch = line.match(/this\.prisma\.(\w+)\.(findFirst|findMany|findUnique|create|update|delete|upsert)\(/);
    
    if (prismaMatch) {
      const model = prismaMatch[1];
      const operation = prismaMatch[2];

      // Check if this is a scoped query (look ahead for where clause with orgId)
      let hasOrgScope = false;
      let lookAheadLimit = 10;
      let bracketCount = 0;

      for (let j = i; j < Math.min(i + lookAheadLimit, lines.length); j++) {
        const checkLine = lines[j];
        
        // Track brackets to stay within this query
        bracketCount += (checkLine.match(/\{/g) || []).length;
        bracketCount -= (checkLine.match(/\}/g) || []).length;

        if (checkLine.includes('orgId') || checkLine.includes('branch: { orgId')) {
          hasOrgScope = true;
          break;
        }

        // If we've closed all brackets, stop looking
        if (bracketCount === 0 && j > i) {
          break;
        }
      }

      // Flag unscoped queries on multi-tenant models
      const multiTenantModels = [
        'menuItem', 'category', 'order', 'orderItem', 'payment', 
        'reservation', 'table', 'user', 'branch', 'spoutDevice',
        'spoutEvent', 'anomalyEvent', 'alertChannel', 'scheduledAlert',
        'ownerDigest', 'apiKey'
      ];

      if (multiTenantModels.includes(model) && !hasOrgScope) {
        violations.push({
          file: fileName,
          line: i + 1,
          type: 'unscoped-query',
          message: `Prisma ${operation} on '${model}' may lack orgId scoping`,
        });
      }
    }
  }
}

function walkDirectory(dir: string) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDirectory(filePath);
    } else if (stat.isFile() && (file.endsWith('.ts'))) {
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
  console.log(`❌ Found ${violations.length} potential violation(s):\n`);

  violations.forEach(v => {
    console.log(`${v.file}:${v.line}`);
    console.log(`  [${v.type}] ${v.message}\n`);
  });

  console.log('Please ensure:');
  console.log('1. Authenticated endpoints use @UseGuards(AuthGuard(\'jwt\'), OrgScopeGuard)');
  console.log('2. Prisma queries include orgId or branch.orgId in where clauses');
  console.log('3. Use BaseService.withOrg() helper for consistent scoping\n');

  process.exit(1);
}
