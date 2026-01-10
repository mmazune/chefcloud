#!/usr/bin/env node
/**
 * Role Navigation Tree Generator
 * Phase I1: Generate exhaustive navigation trees for all 11 roles
 * 
 * Inputs:
 *   - apps/web/src/config/roleCapabilities.ts
 *   - reports/codebase/frontend-routes.json
 * 
 * Outputs:
 *   - reports/navigation/role-nav-trees.json
 *   - docs/navigation/ROLE_NAV_TREES.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

// All 11 roles from the system
const ALL_ROLES = [
  'OWNER',
  'MANAGER', 
  'ACCOUNTANT',
  'PROCUREMENT',
  'STOCK_MANAGER',
  'SUPERVISOR',
  'CASHIER',
  'CHEF',
  'WAITER',
  'BARTENDER',
  'EVENT_MANAGER'
];

// Route classification based on frontend-routes.json analysis
const ROUTE_STATUS = {
  // Core active routes (linked in nav)
  ACTIVE: new Set([
    '/analytics', '/dashboard', '/feedback', '/finance', '/finance/accounts',
    '/finance/ap-aging', '/finance/ar-aging', '/finance/balance-sheet',
    '/finance/journal', '/finance/periods', '/finance/pnl', '/finance/trial-balance',
    '/inventory', '/inventory/depletions', '/inventory/period-close',
    '/inventory/purchase-orders', '/inventory/receipts', '/inventory/recipes',
    '/inventory/transfers', '/inventory/waste', '/pos', '/reports', '/reservations',
    '/service-providers', '/settings', '/staff', '/workforce/approvals',
    '/workforce/auto-scheduler', '/workforce/labor', '/workforce/labor-targets',
    '/workforce/my-availability', '/workforce/my-swaps', '/workforce/open-shifts',
    '/workforce/schedule', '/workforce/staffing-alerts', '/workforce/staffing-planner',
    '/workforce/swaps', '/workforce/timeclock'
  ]),
  // Internal/system routes
  INTERNAL_ONLY: new Set([
    '/health', '/login', '/launch', '/', '/security'
  ]),
  // Planned/gated features
  PLANNED: new Set([
    '/billing', '/dev', '/documents', '/hr', '/waitlist'
  ]),
  // Legacy routes kept but hidden
  LEGACY_HIDDEN: new Set([])
};

/**
 * Parse roleCapabilities.ts to extract role configurations
 */
function parseRoleCapabilities() {
  const capabilitiesPath = path.join(ROOT, 'apps/web/src/config/roleCapabilities.ts');
  const content = fs.readFileSync(capabilitiesPath, 'utf-8');
  
  const roles = {};
  
  for (const role of ALL_ROLES) {
    const roleMatch = content.match(new RegExp(`${role}:\\s*{([\\s\\S]*?)(?=\\n\\s{2}[A-Z_]+:|\\n};)`, 'm'));
    
    if (roleMatch) {
      const roleContent = roleMatch[1];
      
      // Extract defaultRoute
      const defaultRouteMatch = roleContent.match(/defaultRoute:\s*['"]([^'"]+)['"]/);
      const defaultRoute = defaultRouteMatch ? defaultRouteMatch[1] : '/dashboard';
      
      // Extract workspaceTitle
      const titleMatch = roleContent.match(/workspaceTitle:\s*['"]([^'"]+)['"]/);
      const workspaceTitle = titleMatch ? titleMatch[1] : `${role} Dashboard`;
      
      // Extract nav groups and items
      const navGroups = [];
      const groupRegex = /\{\s*title:\s*['"]([^'"]+)['"],\s*items:\s*\[([\s\S]*?)\]/g;
      let groupMatch;
      
      while ((groupMatch = groupRegex.exec(roleContent)) !== null) {
        const groupTitle = groupMatch[1];
        const itemsContent = groupMatch[2];
        
        const items = [];
        const itemRegex = /\{\s*label:\s*['"]([^'"]+)['"],\s*href:\s*['"]([^'"]+)['"]/g;
        let itemMatch;
        
        while ((itemMatch = itemRegex.exec(itemsContent)) !== null) {
          const href = itemMatch[2];
          let status = 'ACTIVE';
          
          if (ROUTE_STATUS.INTERNAL_ONLY.has(href)) status = 'INTERNAL_ONLY';
          else if (ROUTE_STATUS.PLANNED.has(href)) status = 'PLANNED';
          else if (ROUTE_STATUS.LEGACY_HIDDEN.has(href)) status = 'LEGACY_HIDDEN';
          else if (!ROUTE_STATUS.ACTIVE.has(href)) status = 'GATED';
          
          items.push({
            label: itemMatch[1],
            href: href,
            status: status
          });
        }
        
        if (items.length > 0) {
          navGroups.push({
            title: groupTitle,
            items: items
          });
        }
      }
      
      roles[role] = {
        role: role,
        workspaceTitle: workspaceTitle,
        landingRoute: defaultRoute,
        navGroups: navGroups,
        totalRoutes: navGroups.reduce((sum, g) => sum + g.items.length, 0)
      };
    }
  }
  
  return roles;
}

/**
 * Generate role navigation tree JSON
 */
function generateRoleNavTreesJson(roles) {
  const output = {
    generated: new Date().toISOString().split('T')[0],
    generator: 'scripts/analysis/generate-role-nav-trees.mjs',
    roleCount: Object.keys(roles).length,
    roles: {}
  };
  
  // Sort roles alphabetically for deterministic output
  const sortedRoles = Object.keys(roles).sort();
  
  for (const role of sortedRoles) {
    output.roles[role] = roles[role];
  }
  
  return output;
}

/**
 * Generate role navigation tree Markdown documentation
 */
function generateRoleNavTreesMd(roles) {
  const lines = [
    '# Role Navigation Trees',
    '',
    '> Generated: ' + new Date().toISOString().split('T')[0] + ' | Phase I1',
    '',
    '---',
    '',
    '## Overview',
    '',
    '| Role | Landing Route | Nav Groups | Total Routes |',
    '|------|---------------|------------|--------------|'
  ];
  
  // Sort roles alphabetically
  const sortedRoles = Object.keys(roles).sort();
  
  for (const role of sortedRoles) {
    const r = roles[role];
    lines.push(`| ${role} | \`${r.landingRoute}\` | ${r.navGroups.length} | ${r.totalRoutes} |`);
  }
  
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Route Status Legend');
  lines.push('');
  lines.push('| Status | Meaning |');
  lines.push('|--------|---------|');
  lines.push('| ACTIVE | Route is linked and functional |');
  lines.push('| PLANNED | Feature is planned but not yet implemented |');
  lines.push('| GATED | Route exists but not linked in main navigation |');
  lines.push('| INTERNAL_ONLY | System/internal route (login, health, etc.) |');
  lines.push('| LEGACY_HIDDEN | Deprecated route kept for backward compatibility |');
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Detailed role sections
  for (const role of sortedRoles) {
    const r = roles[role];
    
    lines.push(`## ${role}`);
    lines.push('');
    lines.push(`**${r.workspaceTitle}**`);
    lines.push('');
    lines.push(`- **Landing Route**: \`${r.landingRoute}\``);
    lines.push(`- **Nav Groups**: ${r.navGroups.length}`);
    lines.push(`- **Total Routes**: ${r.totalRoutes}`);
    lines.push('');
    
    for (const group of r.navGroups) {
      lines.push(`### ${group.title}`);
      lines.push('');
      lines.push('| Label | Route | Status |');
      lines.push('|-------|-------|--------|');
      
      for (const item of group.items) {
        const statusBadge = item.status === 'ACTIVE' ? '✅ ACTIVE' :
                           item.status === 'PLANNED' ? '🔮 PLANNED' :
                           item.status === 'GATED' ? '🔒 GATED' :
                           item.status === 'INTERNAL_ONLY' ? '⚙️ INTERNAL' :
                           '👻 LEGACY';
        lines.push(`| ${item.label} | \`${item.href}\` | ${statusBadge} |`);
      }
      lines.push('');
    }
    
    lines.push('---');
    lines.push('');
  }
  
  lines.push('*Generated by `pnpm nav:generate`. See [AI_INDEX.json](../../AI_INDEX.json) for navigation.*');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('🧭 Generating Role Navigation Trees...\n');
  
  // Create output directories
  const navReportsDir = path.join(ROOT, 'reports/navigation');
  const navDocsDir = path.join(ROOT, 'docs/navigation');
  
  fs.mkdirSync(navReportsDir, { recursive: true });
  fs.mkdirSync(navDocsDir, { recursive: true });
  
  // Parse role capabilities
  console.log('📖 Parsing roleCapabilities.ts...');
  const roles = parseRoleCapabilities();
  
  const parsedCount = Object.keys(roles).length;
  console.log(`   Found ${parsedCount}/${ALL_ROLES.length} roles`);
  
  if (parsedCount !== ALL_ROLES.length) {
    const missing = ALL_ROLES.filter(r => !roles[r]);
    console.warn(`   ⚠️  Missing roles: ${missing.join(', ')}`);
  }
  
  // Generate JSON output
  console.log('\n📄 Generating role-nav-trees.json...');
  const jsonOutput = generateRoleNavTreesJson(roles);
  const jsonPath = path.join(navReportsDir, 'role-nav-trees.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`   ✅ ${jsonPath}`);
  
  // Generate Markdown output
  console.log('\n📝 Generating ROLE_NAV_TREES.md...');
  const mdOutput = generateRoleNavTreesMd(roles);
  const mdPath = path.join(navDocsDir, 'ROLE_NAV_TREES.md');
  fs.writeFileSync(mdPath, mdOutput);
  console.log(`   ✅ ${mdPath}`);
  
  // Summary
  console.log('\n✅ Role Navigation Trees Generated');
  console.log(`   Roles: ${parsedCount}`);
  console.log(`   Total nav groups: ${Object.values(roles).reduce((s, r) => s + r.navGroups.length, 0)}`);
  console.log(`   Total nav items: ${Object.values(roles).reduce((s, r) => s + r.totalRoutes, 0)}`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
