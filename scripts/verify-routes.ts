/**
 * Route Verification Script
 * 
 * Checks all routes from navmap.routes.index.json against actual pages in apps/web/src/pages
 * Outputs missing routes that need stubs.
 * 
 * Usage: npx tsx scripts/verify-routes.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

interface RouteInfo {
  route: string;
  roles: string[];
  navGroups: string[];
  sidebarLabels: string[];
  isDynamic: boolean;
}

interface RouteIndex {
  routes: RouteInfo[];
  sidebarLinks: Array<{ href: string; label: string; navGroup: string; roles: string[] }>;
}

const PAGES_DIR = path.resolve(__dirname, '../apps/web/src/pages');
const INDEX_PATH = path.resolve(__dirname, '../docs/navmap/navmap.routes.index.json');

/**
 * Convert Next.js page file path to route pattern
 */
function filePathToRoute(filePath: string): string {
  let route = filePath
    .replace(PAGES_DIR, '')
    .replace(/\\/g, '/')
    .replace(/\.tsx?$/, '')
    .replace(/\/index$/, '')
    .replace(/\/_app$/, '')
    .replace(/\/_document$/, '');
  
  if (!route) route = '/';
  return route;
}

/**
 * Convert route pattern to expected file paths
 */
function routeToFilePaths(route: string): string[] {
  const paths: string[] = [];
  
  // Handle root
  if (route === '/') {
    paths.push(path.join(PAGES_DIR, 'index.tsx'));
    paths.push(path.join(PAGES_DIR, 'index.ts'));
    return paths;
  }
  
  // Standard route
  const routePath = route.slice(1); // Remove leading /
  paths.push(path.join(PAGES_DIR, `${routePath}.tsx`));
  paths.push(path.join(PAGES_DIR, `${routePath}.ts`));
  paths.push(path.join(PAGES_DIR, routePath, 'index.tsx'));
  paths.push(path.join(PAGES_DIR, routePath, 'index.ts'));
  
  return paths;
}

/**
 * Check if a page file exists for a route
 */
function pageExists(route: string): boolean {
  const possiblePaths = routeToFilePaths(route);
  return possiblePaths.some(p => fs.existsSync(p));
}

/**
 * Get all existing page routes
 */
function getAllExistingRoutes(): string[] {
  const files = glob.sync('**/*.tsx', { cwd: PAGES_DIR });
  const routes: string[] = [];
  
  for (const file of files) {
    const filePath = path.join(PAGES_DIR, file);
    const route = filePathToRoute(filePath);
    
    // Skip special Next.js files
    if (route.includes('/_')) continue;
    
    routes.push(route);
  }
  
  return routes.sort();
}

interface VerificationResult {
  totalRoutes: number;
  totalSidebarLinks: number;
  existingRoutes: number;
  missingRoutes: RouteInfo[];
  missingSidebarRoutes: Array<{ href: string; label: string; navGroup: string; roles: string[] }>;
}

function verifyRoutes(): VerificationResult {
  const index: RouteIndex = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  const existingRoutes = getAllExistingRoutes();
  
  const missingRoutes: RouteInfo[] = [];
  const missingSidebarRoutes: Array<{ href: string; label: string; navGroup: string; roles: string[] }> = [];
  
  // Check all routes
  for (const routeInfo of index.routes) {
    // Skip dynamic routes (they typically work with their static counterpart)
    if (routeInfo.isDynamic) continue;
    
    if (!pageExists(routeInfo.route)) {
      missingRoutes.push(routeInfo);
    }
  }
  
  // Check sidebar links specifically (these are most critical)
  for (const link of index.sidebarLinks) {
    // Skip dynamic routes
    if (link.href.includes('[')) continue;
    
    if (!pageExists(link.href)) {
      missingSidebarRoutes.push(link);
    }
  }
  
  return {
    totalRoutes: index.routes.length,
    totalSidebarLinks: index.sidebarLinks.length,
    existingRoutes: existingRoutes.length,
    missingRoutes,
    missingSidebarRoutes,
  };
}

function main() {
  console.log('Verifying routes...\n');
  
  const result = verifyRoutes();
  
  console.log('Summary:');
  console.log(`- Total routes in index: ${result.totalRoutes}`);
  console.log(`- Total sidebar links: ${result.totalSidebarLinks}`);
  console.log(`- Existing page files: ${result.existingRoutes}`);
  console.log(`- Missing static routes: ${result.missingRoutes.length}`);
  console.log(`- Missing sidebar routes: ${result.missingSidebarRoutes.length}`);
  
  if (result.missingRoutes.length > 0) {
    console.log('\n--- Missing Routes ---');
    for (const route of result.missingRoutes) {
      console.log(`\n${route.route}`);
      console.log(`  Roles: ${route.roles.join(', ')}`);
      if (route.navGroups.length > 0) {
        console.log(`  Nav Groups: ${route.navGroups.join(', ')}`);
      }
      if (route.sidebarLabels.length > 0) {
        console.log(`  Sidebar Labels: ${route.sidebarLabels.join(', ')}`);
      }
    }
  }
  
  if (result.missingSidebarRoutes.length > 0) {
    console.log('\n--- Missing Sidebar Link Routes (CRITICAL) ---');
    for (const link of result.missingSidebarRoutes) {
      console.log(`\n${link.href}`);
      console.log(`  Label: ${link.label}`);
      console.log(`  Nav Group: ${link.navGroup}`);
      console.log(`  Roles: ${link.roles.join(', ')}`);
    }
  }
  
  // Exit with error if any sidebar routes are missing
  if (result.missingSidebarRoutes.length > 0) {
    console.log('\n❌ FAIL: Some sidebar link routes are missing pages');
    process.exit(1);
  } else {
    console.log('\n✓ PASS: All sidebar link routes have pages');
    process.exit(0);
  }
}

main();
