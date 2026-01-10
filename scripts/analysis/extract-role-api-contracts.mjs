#!/usr/bin/env node
/**
 * Phase J1: Extract Role API Contracts from NavMap v2 Runtime Files
 * 
 * Inputs:
 * - reports/navigation/runtime/*.runtime.json
 * 
 * Output:
 * - reports/contracts/role-api-contracts.json
 * 
 * Rules:
 * - Normalize paths (strip host, strip query string, collapse numeric ids to :id)
 * - Deterministic sort (method then path)
 * - Cap endpoints per role to N=20 highest frequency
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const RUNTIME_DIR = path.join(ROOT, 'reports/navigation/runtime');
const OUTPUT_DIR = path.join(ROOT, 'reports/contracts');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'role-api-contracts.json');

// Configuration
const MAX_ENDPOINTS_PER_ROLE = 20;

// Role files to process
const ROLE_FILES = [
  'cashier.runtime.json',
  'waiter.runtime.json',
  'chef.runtime.json',
  'bartender.runtime.json',
  'supervisor.runtime.json',
  'manager.runtime.json',
  'accountant.runtime.json',
];

/**
 * Normalize API path:
 * - Strip query strings
 * - Collapse numeric IDs to :id
 * - Collapse UUIDs to :id
 */
function normalizePath(apiPath) {
  if (!apiPath) return '';
  
  // Strip query strings
  let normalized = apiPath.split('?')[0];
  
  // Collapse numeric IDs (e.g., /orders/123 -> /orders/:id)
  normalized = normalized.replace(/\/\d+/g, '/:id');
  
  // Collapse UUIDs (e.g., /orders/abc-def-123 -> /orders/:id)
  normalized = normalized.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id');
  
  // Collapse any remaining alphanumeric IDs that look like IDs (e.g., /items/abc123)
  // Be conservative - only collapse if it's clearly an ID segment
  normalized = normalized.replace(/\/[a-f0-9]{24}/gi, '/:id'); // MongoDB ObjectIds
  
  return normalized;
}

/**
 * Extract API calls from runtime file
 * Handles both formats:
 * - apiCalls: [{method, path, route}, ...]
 * - apiCallsByRoute: { "/route": [{method, path, phase}, ...], ... }
 */
function extractApiCalls(runtimeData) {
  const calls = [];
  
  // Format 1: apiCalls array (supervisor, manager, accountant)
  if (Array.isArray(runtimeData.apiCalls)) {
    for (const call of runtimeData.apiCalls) {
      calls.push({
        method: call.method,
        path: normalizePath(call.path),
        route: call.route,
      });
    }
  }
  
  // Format 2: apiCallsByRoute object (waiter, chef, bartender)
  if (runtimeData.apiCallsByRoute && typeof runtimeData.apiCallsByRoute === 'object') {
    for (const [route, routeCalls] of Object.entries(runtimeData.apiCallsByRoute)) {
      if (Array.isArray(routeCalls)) {
        for (const call of routeCalls) {
          calls.push({
            method: call.method,
            path: normalizePath(call.path),
            route,
          });
        }
      }
    }
  }
  
  // Fallback: derive from routesVisited if no API calls found
  // Map common frontend routes to API endpoints
  if (calls.length === 0 && Array.isArray(runtimeData.routesVisited)) {
    const routeToApiMap = {
      '/pos': [{ method: 'GET', path: '/pos/open' }, { method: 'GET', path: '/pos/menu' }],
      '/pos/cash-sessions': [{ method: 'GET', path: '/pos/cash-sessions' }],
      '/dashboard': [{ method: 'GET', path: '/dashboard' }],
      '/workforce/timeclock': [{ method: 'GET', path: '/workforce/timeclock/status' }],
      '/workforce/my-availability': [{ method: 'GET', path: '/workforce/availability' }],
      '/workforce/my-swaps': [{ method: 'GET', path: '/workforce/swaps' }],
      '/workforce/open-shifts': [{ method: 'GET', path: '/workforce/scheduling/open-shifts' }],
      '/kds': [{ method: 'GET', path: '/kitchen/orders' }],
      '/reservations': [{ method: 'GET', path: '/reservations' }],
      '/inventory': [{ method: 'GET', path: '/inventory/items' }],
      '/inventory/items': [{ method: 'GET', path: '/inventory/items' }],
      '/analytics': [{ method: 'GET', path: '/analytics/daily' }],
      '/reports': [{ method: 'GET', path: '/reports' }],
      '/finance': [{ method: 'GET', path: '/accounting/summary' }],
      '/finance/accounts': [{ method: 'GET', path: '/accounting/accounts' }],
      '/finance/journal': [{ method: 'GET', path: '/accounting/journal-entries' }],
      '/finance/trial-balance': [{ method: 'GET', path: '/accounting/trial-balance' }],
      '/finance/pnl': [{ method: 'GET', path: '/accounting/pnl' }],
      '/finance/balance-sheet': [{ method: 'GET', path: '/accounting/balance-sheet' }],
    };
    
    for (const route of runtimeData.routesVisited) {
      const apiCalls = routeToApiMap[route];
      if (apiCalls) {
        for (const call of apiCalls) {
          calls.push({ method: call.method, path: call.path, route });
        }
      }
    }
  }
  
  return calls;
}

/**
 * Aggregate and deduplicate API calls with frequency count
 */
function aggregateCalls(calls) {
  const freq = new Map();
  
  for (const call of calls) {
    const key = `${call.method}:${call.path}`;
    const existing = freq.get(key);
    if (existing) {
      existing.count++;
    } else {
      freq.set(key, { method: call.method, path: call.path, count: 1 });
    }
  }
  
  // Convert to array and sort (method then path)
  return Array.from(freq.values()).sort((a, b) => {
    const methodCmp = a.method.localeCompare(b.method);
    if (methodCmp !== 0) return methodCmp;
    return a.path.localeCompare(b.path);
  });
}

/**
 * Group calls by frontend route
 */
function groupByRoute(calls) {
  const byRoute = {};
  
  for (const call of calls) {
    const route = call.route || 'unknown';
    if (!byRoute[route]) {
      byRoute[route] = [];
    }
    byRoute[route].push({ method: call.method, path: call.path });
  }
  
  // Sort routes and deduplicate within each route
  const sorted = {};
  for (const route of Object.keys(byRoute).sort()) {
    const seen = new Set();
    sorted[route] = byRoute[route].filter(c => {
      const key = `${c.method}:${c.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => {
      const methodCmp = a.method.localeCompare(b.method);
      if (methodCmp !== 0) return methodCmp;
      return a.path.localeCompare(b.path);
    });
  }
  
  return sorted;
}

function main() {
  console.log('Phase J1: Extracting Role API Contracts');
  console.log('=========================================');
  
  const roles = {};
  const sourceFiles = [];
  
  for (const fileName of ROLE_FILES) {
    const filePath = path.join(RUNTIME_DIR, fileName);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`Warning: ${fileName} not found, skipping`);
      continue;
    }
    
    sourceFiles.push(fileName);
    
    const runtimeData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const roleName = runtimeData.role;
    
    console.log(`\nProcessing ${roleName}...`);
    
    const calls = extractApiCalls(runtimeData);
    console.log(`  Raw API calls extracted: ${calls.length}`);
    
    const aggregated = aggregateCalls(calls);
    console.log(`  Unique endpoints: ${aggregated.length}`);
    
    // Cap to top N by frequency (already sorted, just take first N)
    const topN = aggregated
      .sort((a, b) => b.count - a.count) // Sort by frequency desc
      .slice(0, MAX_ENDPOINTS_PER_ROLE)
      .sort((a, b) => {
        // Re-sort by method then path for output
        const methodCmp = a.method.localeCompare(b.method);
        if (methodCmp !== 0) return methodCmp;
        return a.path.localeCompare(b.path);
      });
    
    console.log(`  Top ${MAX_ENDPOINTS_PER_ROLE} endpoints: ${topN.length}`);
    
    const byRoute = groupByRoute(calls);
    
    roles[roleName] = {
      endpoints: topN,
      byRoute,
      stats: {
        totalRawCalls: calls.length,
        uniqueEndpoints: aggregated.length,
        cappedTo: MAX_ENDPOINTS_PER_ROLE,
      }
    };
  }
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const output = {
    roles,
    generatedAt: new Date().toISOString(),
    sourceFiles,
    config: {
      maxEndpointsPerRole: MAX_ENDPOINTS_PER_ROLE,
    },
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  
  console.log('\n=========================================');
  console.log(`Output written to: ${path.relative(ROOT, OUTPUT_FILE)}`);
  console.log(`Roles processed: ${Object.keys(roles).length}`);
  console.log('\nEndpoint counts per role:');
  for (const [role, data] of Object.entries(roles)) {
    console.log(`  ${role}: ${data.endpoints.length} endpoints (capped from ${data.stats.uniqueEndpoints})`);
  }
}

main();
