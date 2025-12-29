#!/usr/bin/env node
/**
 * T1.6 Failure Taxonomy Parser
 * Parses Jest JSON output to categorize failures and identify top issues
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Parse CLI args: node parse-e2e-results.mjs <input.json> --outMd <path> --outJson <path>
const args = process.argv.slice(2);
const RESULTS_FILE = args[0] || '.e2e-results-full.json';

let OUTPUT_MD = join(process.cwd(), '../../instructions/T1.6_FAILURE_TAXONOMY.md');
let OUTPUT_JSON = join(process.cwd(), '../../instructions/T1.6_TOP_FAILURES.json');

// Check for custom output paths
const mdIdx = args.indexOf('--outMd');
const jsonIdx = args.indexOf('--outJson');
if (mdIdx >= 0 && args[mdIdx + 1]) {
  OUTPUT_MD = args[mdIdx + 1].startsWith('/') ? args[mdIdx + 1] : join(process.cwd(), args[mdIdx + 1]);
}
if (jsonIdx >= 0 && args[jsonIdx + 1]) {
  OUTPUT_JSON = args[jsonIdx + 1].startsWith('/') ? args[jsonIdx + 1] : join(process.cwd(), args[jsonIdx + 1]);
}

// Category patterns (order matters - first match wins)
const CATEGORIES = [
  {
    name: 'Module Import Errors',
    pattern: /Cannot find module|Module not found/i,
    color: '🔴'
  },
  {
    name: 'DI/Module Resolution Errors',
    pattern: /can't resolve dependencies|Nest can't resolve|is not available in.*context|Please make sure that the argument/i,
    color: '🟤'
  },
  {
    name: 'Prisma Validation Errors',
    pattern: /PrismaClientValidationError|Argument .* is missing|Invalid value for argument|Can not use `undefined` value/i,
    color: '🟠'
  },
  {
    name: 'Auth/Login Failures',
    pattern: /Login failed|expected 200.*got 401|Unauthorized.*login|Invalid credentials/i,
    color: '🟡'
  },
  {
    name: 'Missing Routes/Endpoints',
    pattern: /expected 200.*got 404|404.*Not Found|Cannot GET|Cannot POST/i,
    color: '🟣'
  },
  {
    name: 'Response Shape Mismatches',
    pattern: /expect.*toEqual|expect.*toHaveProperty|expect.*toBe|Received.*Expected/i,
    color: '🔵'
  },
  {
    name: 'Timeouts/Race Conditions',
    pattern: /timeout|Timeout|exceeded.*ms|async operation/i,
    color: '⚫'
  }
];

function categorizeError(message) {
  for (const cat of CATEGORIES) {
    if (cat.pattern.test(message)) {
      return cat.name;
    }
  }
  return 'Other';
}

function normalizeError(message) {
  // Extract first meaningful error line, removing file paths and stack traces
  const lines = message.split('\n');
  for (const line of lines) {
    if (line.includes('●') || line.includes('Error:') || line.includes('Invalid') || line.includes('Cannot')) {
      return line.trim().substring(0, 150);
    }
  }
  return message.substring(0, 150);
}

try {
  const data = JSON.parse(readFileSync(RESULTS_FILE, 'utf8'));
  
  const stats = {
    totalSuites: data.numTotalTestSuites,
    passedSuites: data.numPassedTestSuites,
    failedSuites: data.numFailedTestSuites,
    totalTests: data.numTotalTests,
    passedTests: data.numPassedTests,
    failedTests: data.numFailedTests
  };

  const categories = {};
  const failedFiles = [];
  const errorMessages = new Map();

  for (const suite of data.testResults) {
    if (suite.status === 'failed') {
      const errorMsg = suite.message || '';
      const category = categorizeError(errorMsg);
      
      categories[category] = (categories[category] || 0) + 1;
      
      failedFiles.push({
        file: suite.name.replace(/^.*\/test\//, 'test/'),
        category,
        failedTests: suite.assertionResults.filter(t => t.status === 'failed').length
      });

      // Count normalized error messages
      const normalized = normalizeError(errorMsg);
      errorMessages.set(normalized, (errorMessages.get(normalized) || 0) + 1);
    }
  }

  // Sort and get top 15 files
  const topFailingFiles = failedFiles
    .sort((a, b) => b.failedTests - a.failedTests)
    .slice(0, 15);

  // Sort and get top 10 errors
  const topErrors = Array.from(errorMessages.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Generate Markdown report
  let md = `# T1.6 E2E Failure Taxonomy\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += `## Summary Statistics\n\n`;
  md += `| Metric | Count |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Suites | ${stats.totalSuites} |\n`;
  md += `| Passed Suites | ${stats.passedSuites} |\n`;
  md += `| **Failed Suites** | **${stats.failedSuites}** |\n`;
  md += `| Total Tests | ${stats.totalTests} |\n`;
  md += `| Passed Tests | ${stats.passedTests} |\n`;
  md += `| **Failed Tests** | **${stats.failedTests}** |\n\n`;

  md += `## Failure Categories\n\n`;
  const sortedCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  md += `| Category | Count | % of Failures |\n`;
  md += `|----------|-------|---------------|\n`;
  for (const [cat, count] of sortedCategories) {
    const pct = ((count / stats.failedSuites) * 100).toFixed(1);
    const catObj = CATEGORIES.find(c => c.name === cat);
    const color = catObj ? catObj.color : '⚪';
    md += `| ${color} ${cat} | ${count} | ${pct}% |\n`;
  }
  md += `\n`;

  md += `## Top 15 Failing Test Files\n\n`;
  md += `| # | File | Category | Failed Tests |\n`;
  md += `|---|------|----------|-------------|\n`;
  topFailingFiles.forEach((file, idx) => {
    const catObj = CATEGORIES.find(c => c.name === file.category);
    const color = catObj ? catObj.color : '⚪';
    md += `| ${idx + 1} | ${file.file} | ${color} ${file.category} | ${file.failedTests} |\n`;
  });
  md += `\n`;

  md += `## Top 10 Recurring Error Messages\n\n`;
  topErrors.forEach(([msg, count], idx) => {
    md += `### ${idx + 1}. (${count}x)\n\n`;
    md += `\`\`\`\n${msg}\n\`\`\`\n\n`;
  });

  md += `## Next Steps\n\n`;
  md += `**Top Category:** ${sortedCategories[0][0]} (${sortedCategories[0][1]} failures)\n\n`;
  md += `Proceed to STEP 2: Form hypotheses for fixing this category systemically.\n`;

  writeFileSync(OUTPUT_MD, md);
  console.log(`✅ Taxonomy written to: ${OUTPUT_MD}`);

  // Write JSON for machine-readable data
  const jsonOutput = {
    stats,
    categories: Object.fromEntries(sortedCategories),
    topCategory: sortedCategories[0][0],
    topFailingFiles,
    topErrors: topErrors.map(([msg, count]) => ({ message: msg, count }))
  };
  writeFileSync(OUTPUT_JSON, JSON.stringify(jsonOutput, null, 2));
  console.log(`✅ JSON data written to: ${OUTPUT_JSON}`);

  console.log(`\n📊 FAILURE TAXONOMY SUMMARY:\n`);
  console.log(`Total: ${stats.failedSuites} failed suites, ${stats.failedTests} failed tests\n`);
  console.log(`Categories:`);
  for (const [cat, count] of sortedCategories.slice(0, 5)) {
    const pct = ((count / stats.failedSuites) * 100).toFixed(1);
    const catObj = CATEGORIES.find(c => c.name === cat);
    const color = catObj ? catObj.color : '⚪';
    console.log(`  ${color} ${cat}: ${count} (${pct}%)`);
  }
  console.log(`\n🎯 Top category to fix: ${sortedCategories[0][0]}`);

} catch (err) {
  console.error('❌ Failed to parse results:', err.message);
  process.exit(1);
}
