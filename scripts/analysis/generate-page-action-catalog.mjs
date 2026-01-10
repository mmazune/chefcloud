#!/usr/bin/env node
/**
 * Page Action Catalog Generator
 * Phase I2: Scan pages for pageMeta exports and generate catalog
 * 
 * Inputs: apps/web/src/pages (files exporting pageMeta)
 * Outputs: reports/navigation/page-actions.json, docs/navigation/PAGE_ACTION_CATALOG.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const PAGES_DIR = path.join(ROOT, 'apps/web/src/pages');

/**
 * Recursively find all .tsx files in pages directory
 */
function findPageFiles(dir, files = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    if (item.isDirectory()) {
      // Skip special Next.js directories
      if (!item.name.startsWith('_') && item.name !== 'api') {
        findPageFiles(fullPath, files);
      }
    } else if (item.name.endsWith('.tsx') && !item.name.startsWith('_')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Extract pageMeta from a page file
 */
function extractPageMeta(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Check if file exports pageMeta
  if (!content.includes('export const pageMeta')) {
    return null;
  }
  
  try {
    // Extract the pageMeta object using regex
    const metaMatch = content.match(/export const pageMeta\s*=\s*definePageMeta\(\s*({[\s\S]*?})\s*\);/);
    
    if (!metaMatch) {
      return null;
    }
    
    const metaStr = metaMatch[1];
    
    // Extract id
    const idMatch = metaStr.match(/id:\s*['"]([^'"]+)['"]/);
    const id = idMatch ? idMatch[1] : null;
    
    // Extract title
    const titleMatch = metaStr.match(/title:\s*['"]([^'"]+)['"]/);
    const title = titleMatch ? titleMatch[1] : null;
    
    // Extract risk
    const riskMatch = metaStr.match(/risk:\s*['"]([^'"]+)['"]/);
    const risk = riskMatch ? riskMatch[1] : 'MEDIUM';
    
    // Extract primaryActions
    const actions = [];
    const actionsMatch = metaStr.match(/primaryActions:\s*\[([\s\S]*?)\]/);
    if (actionsMatch) {
      const actionRegex = /\{\s*label:\s*['"]([^'"]+)['"],\s*testId:\s*['"]([^'"]+)['"],\s*intent:\s*['"]([^'"]+)['"]/g;
      let actionMatch;
      while ((actionMatch = actionRegex.exec(actionsMatch[1])) !== null) {
        actions.push({
          label: actionMatch[1],
          testId: actionMatch[2],
          intent: actionMatch[3]
        });
      }
    }
    
    // Extract apiCalls
    const apiCalls = [];
    const apiMatch = metaStr.match(/apiCalls:\s*\[([\s\S]*?)\]/);
    if (apiMatch) {
      const apiRegex = /\{\s*method:\s*['"]([^'"]+)['"],\s*path:\s*['"]([^'"]+)['"]/g;
      let callMatch;
      while ((callMatch = apiRegex.exec(apiMatch[1])) !== null) {
        apiCalls.push({
          method: callMatch[1],
          path: callMatch[2]
        });
      }
    }
    
    // Extract allowedRoles
    const rolesMatch = metaStr.match(/allowedRoles:\s*\[([\s\S]*?)\]/);
    let allowedRoles = [];
    if (rolesMatch) {
      const roleRegex = /['"]([^'"]+)['"]/g;
      let roleMatch;
      while ((roleMatch = roleRegex.exec(rolesMatch[1])) !== null) {
        allowedRoles.push(roleMatch[1]);
      }
    }
    
    if (id && title) {
      return {
        id,
        title,
        risk,
        primaryActions: actions,
        apiCalls,
        allowedRoles,
        sourceFile: path.relative(ROOT, filePath)
      };
    }
  } catch (err) {
    console.warn(`   ⚠️  Failed to parse pageMeta from ${filePath}: ${err.message}`);
  }
  
  return null;
}

/**
 * Generate page actions JSON
 */
function generatePageActionsJson(pages) {
  const output = {
    generated: new Date().toISOString().split('T')[0],
    generator: 'scripts/analysis/generate-page-action-catalog.mjs',
    pageCount: pages.length,
    totalActions: pages.reduce((sum, p) => sum + p.primaryActions.length, 0),
    totalApiCalls: pages.reduce((sum, p) => sum + p.apiCalls.length, 0),
    pages: {}
  };
  
  // Sort pages by id for deterministic output
  const sortedPages = [...pages].sort((a, b) => a.id.localeCompare(b.id));
  
  for (const page of sortedPages) {
    output.pages[page.id] = page;
  }
  
  return output;
}

/**
 * Generate page actions Markdown documentation
 */
function generatePageActionsMd(pages) {
  const lines = [
    '# Page Action Catalog',
    '',
    '> Generated: ' + new Date().toISOString().split('T')[0] + ' | Phase I2',
    '',
    '---',
    '',
    '## Overview',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Annotated Pages | ${pages.length} |`,
    `| Total Actions | ${pages.reduce((s, p) => s + p.primaryActions.length, 0)} |`,
    `| Total API Calls | ${pages.reduce((s, p) => s + p.apiCalls.length, 0)} |`,
    `| HIGH Risk Pages | ${pages.filter(p => p.risk === 'HIGH').length} |`,
    `| MEDIUM Risk Pages | ${pages.filter(p => p.risk === 'MEDIUM').length} |`,
    `| LOW Risk Pages | ${pages.filter(p => p.risk === 'LOW').length} |`,
    '',
    '---',
    '',
    '## Risk Legend',
    '',
    '| Risk | Meaning |',
    '|------|---------|',
    '| 🔴 HIGH | Money/stock/audit sensitive operations |',
    '| 🟡 MEDIUM | Creates/modifies data, limited financial impact |',
    '| 🟢 LOW | Read-only, no financial impact |',
    '',
    '---',
    '',
    '## Pages by Risk Level',
    '',
    '### 🔴 HIGH Risk Pages',
    ''
  ];
  
  // Group by risk
  const highRisk = pages.filter(p => p.risk === 'HIGH').sort((a, b) => a.id.localeCompare(b.id));
  const mediumRisk = pages.filter(p => p.risk === 'MEDIUM').sort((a, b) => a.id.localeCompare(b.id));
  const lowRisk = pages.filter(p => p.risk === 'LOW').sort((a, b) => a.id.localeCompare(b.id));
  
  if (highRisk.length === 0) {
    lines.push('_No HIGH risk pages annotated yet._');
    lines.push('');
  } else {
    for (const page of highRisk) {
      lines.push(`- [\`${page.id}\`](#${page.id.replace(/\//g, '').replace(/\[/g, '').replace(/\]/g, '')}) — ${page.title}`);
    }
    lines.push('');
  }
  
  lines.push('### 🟡 MEDIUM Risk Pages');
  lines.push('');
  
  if (mediumRisk.length === 0) {
    lines.push('_No MEDIUM risk pages annotated yet._');
    lines.push('');
  } else {
    for (const page of mediumRisk) {
      lines.push(`- [\`${page.id}\`](#${page.id.replace(/\//g, '').replace(/\[/g, '').replace(/\]/g, '')}) — ${page.title}`);
    }
    lines.push('');
  }
  
  lines.push('### 🟢 LOW Risk Pages');
  lines.push('');
  
  if (lowRisk.length === 0) {
    lines.push('_No LOW risk pages annotated yet._');
    lines.push('');
  } else {
    for (const page of lowRisk) {
      lines.push(`- [\`${page.id}\`](#${page.id.replace(/\//g, '').replace(/\[/g, '').replace(/\]/g, '')}) — ${page.title}`);
    }
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  lines.push('## Page Details');
  lines.push('');
  
  // Detailed page sections
  const sortedPages = [...pages].sort((a, b) => a.id.localeCompare(b.id));
  
  for (const page of sortedPages) {
    const riskBadge = page.risk === 'HIGH' ? '🔴 HIGH' :
                      page.risk === 'MEDIUM' ? '🟡 MEDIUM' : '🟢 LOW';
    
    lines.push(`### ${page.title}`);
    lines.push('');
    lines.push(`- **Route**: \`${page.id}\``);
    lines.push(`- **Risk**: ${riskBadge}`);
    lines.push(`- **Roles**: ${page.allowedRoles.length > 0 ? page.allowedRoles.join(', ') : '_All_'}`);
    lines.push(`- **Source**: \`${page.sourceFile}\``);
    lines.push('');
    
    if (page.primaryActions.length > 0) {
      lines.push('**Actions**:');
      lines.push('');
      lines.push('| Label | Test ID | Intent |');
      lines.push('|-------|---------|--------|');
      for (const action of page.primaryActions) {
        lines.push(`| ${action.label} | \`${action.testId}\` | ${action.intent} |`);
      }
      lines.push('');
    }
    
    if (page.apiCalls.length > 0) {
      lines.push('**API Calls**:');
      lines.push('');
      lines.push('| Method | Path |');
      lines.push('|--------|------|');
      for (const call of page.apiCalls) {
        lines.push(`| ${call.method} | \`${call.path}\` |`);
      }
      lines.push('');
    }
    
    lines.push('---');
    lines.push('');
  }
  
  lines.push('*Generated by `pnpm actions:generate`. See [AI_INDEX.json](../../AI_INDEX.json) for navigation.*');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('📋 Generating Page Action Catalog...\n');
  
  // Create output directories
  const navReportsDir = path.join(ROOT, 'reports/navigation');
  const navDocsDir = path.join(ROOT, 'docs/navigation');
  
  fs.mkdirSync(navReportsDir, { recursive: true });
  fs.mkdirSync(navDocsDir, { recursive: true });
  
  // Find all page files
  console.log('📂 Scanning pages directory...');
  const pageFiles = findPageFiles(PAGES_DIR);
  console.log(`   Found ${pageFiles.length} page files`);
  
  // Extract pageMeta from each file
  console.log('\n📖 Extracting pageMeta from pages...');
  const pages = [];
  
  for (const file of pageFiles) {
    const meta = extractPageMeta(file);
    if (meta) {
      pages.push(meta);
      console.log(`   ✓ ${meta.id} — ${meta.primaryActions.length} actions`);
    }
  }
  
  console.log(`\n   Found ${pages.length} annotated pages`);
  
  // Generate JSON output
  console.log('\n📄 Generating page-actions.json...');
  const jsonOutput = generatePageActionsJson(pages);
  const jsonPath = path.join(navReportsDir, 'page-actions.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`   ✅ ${jsonPath}`);
  
  // Generate Markdown output
  console.log('\n📝 Generating PAGE_ACTION_CATALOG.md...');
  const mdOutput = generatePageActionsMd(pages);
  const mdPath = path.join(navDocsDir, 'PAGE_ACTION_CATALOG.md');
  fs.writeFileSync(mdPath, mdOutput);
  console.log(`   ✅ ${mdPath}`);
  
  // Summary
  console.log('\n✅ Page Action Catalog Generated');
  console.log(`   Pages: ${pages.length}`);
  console.log(`   Actions: ${pages.reduce((s, p) => s + p.primaryActions.length, 0)}`);
  console.log(`   API Calls: ${pages.reduce((s, p) => s + p.apiCalls.length, 0)}`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
