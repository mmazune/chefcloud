#!/usr/bin/env node
/**
 * perf/smoke-assert.js
 * Parses k6 JSON output and asserts performance thresholds.
 * Used by CI perf-gate job.
 * 
 * Usage: node perf/smoke-assert.js <k6-json-file>
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node perf/smoke-assert.js <k6-json-file>');
  process.exit(1);
}

const jsonFile = args[0];
if (!fs.existsSync(jsonFile)) {
  console.error(`Error: File not found: ${jsonFile}`);
  process.exit(1);
}

console.log(`📊 Parsing k6 results from: ${jsonFile}`);

// Read and parse k6 JSON output
const lines = fs.readFileSync(jsonFile, 'utf-8').split('\n').filter(Boolean);
const metrics = {};

lines.forEach((line) => {
  try {
    const data = JSON.parse(line);
    if (data.type === 'Point' && data.metric) {
      if (!metrics[data.metric]) {
        metrics[data.metric] = [];
      }
      metrics[data.metric].push(data.data.value);
    }
  } catch (err) {
    // Skip invalid lines
  }
});

// Calculate percentiles
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// Calculate error rate
function errorRate(metrics) {
  const failed = metrics.http_req_failed || [];
  if (failed.length === 0) return 0;
  const errors = failed.filter((v) => v === 1).length;
  return (errors / failed.length) * 100;
}

// Performance budgets
const budgets = {
  'http_req_duration_p95': 350,  // p95 < 350ms
  'error_rate': 5,                // < 5%
};

const durations = metrics.http_req_duration || [];
const p95 = percentile(durations, 95);
const errRate = errorRate(metrics);

console.log('\n📈 Performance Metrics:');
console.log(`  p(95) duration: ${p95.toFixed(2)}ms`);
console.log(`  Error rate: ${errRate.toFixed(2)}%`);

// Check thresholds
let violations = 0;

if (p95 > budgets.http_req_duration_p95) {
  console.error(`❌ p(95) duration exceeds budget: ${p95.toFixed(2)}ms > ${budgets.http_req_duration_p95}ms`);
  violations++;
} else {
  console.log(`✅ p(95) duration within budget: ${p95.toFixed(2)}ms <= ${budgets.http_req_duration_p95}ms`);
}

if (errRate > budgets.error_rate) {
  console.error(`❌ Error rate exceeds budget: ${errRate.toFixed(2)}% > ${budgets.error_rate}%`);
  violations++;
} else {
  console.log(`✅ Error rate within budget: ${errRate.toFixed(2)}% <= ${budgets.error_rate}%`);
}

if (violations > 0) {
  console.error(`\n❌ ${violations} performance budget violation(s) detected`);
  process.exit(1);
}

console.log('\n✅ All performance budgets met');
process.exit(0);
