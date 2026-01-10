/**
 * Route Realization Test
 * 
 * CI-enforced test that fails if any sidebar link route is missing a page.
 * This ensures all navigation links in the app are valid.
 * 
 * @see docs/navmap/navmap.routes.index.json
 * @jest-environment node
 */

import * as fs from 'fs';
import * as path from 'path';

interface RouteIndex {
  routes: Array<{
    route: string;
    roles: string[];
    navGroups: string[];
    sidebarLabels: string[];
    isDynamic: boolean;
  }>;
  sidebarLinks: Array<{ 
    href: string; 
    label: string; 
    navGroup: string; 
    roles: string[] 
  }>;
}

const PAGES_DIR = path.resolve(__dirname, '../../../apps/web/src/pages');
const INDEX_PATH = path.resolve(__dirname, '../../../docs/navmap/navmap.routes.index.json');

/**
 * Convert route pattern to expected file paths
 */
function routeToFilePaths(route: string): string[] {
  const paths: string[] = [];
  
  if (route === '/') {
    paths.push(path.join(PAGES_DIR, 'index.tsx'));
    paths.push(path.join(PAGES_DIR, 'index.ts'));
    return paths;
  }
  
  const routePath = route.slice(1);
  paths.push(path.join(PAGES_DIR, `${routePath}.tsx`));
  paths.push(path.join(PAGES_DIR, `${routePath}.ts`));
  paths.push(path.join(PAGES_DIR, routePath, 'index.tsx'));
  paths.push(path.join(PAGES_DIR, routePath, 'index.ts'));
  
  return paths;
}

function pageExists(route: string): boolean {
  const possiblePaths = routeToFilePaths(route);
  return possiblePaths.some(p => fs.existsSync(p));
}

describe('Route Realization', () => {
  let index: RouteIndex;

  beforeAll(() => {
    if (!fs.existsSync(INDEX_PATH)) {
      throw new Error(
        'Route index not found. Run: npx tsx scripts/build-route-index.ts'
      );
    }
    index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  });

  describe('Sidebar Links', () => {
    it('all sidebar link routes have corresponding pages', () => {
      const missingRoutes: Array<{ href: string; label: string; roles: string[] }> = [];

      for (const link of index.sidebarLinks) {
        // Skip dynamic routes
        if (link.href.includes('[')) continue;

        if (!pageExists(link.href)) {
          missingRoutes.push({
            href: link.href,
            label: link.label,
            roles: link.roles,
          });
        }
      }

      if (missingRoutes.length > 0) {
        const details = missingRoutes
          .map(r => `  - ${r.href} (${r.label}) used by: ${r.roles.join(', ')}`)
          .join('\n');
        fail(`Missing pages for sidebar links:\n${details}`);
      }
    });

    it('sidebar links reference valid routes', () => {
      expect(index.sidebarLinks.length).toBeGreaterThan(0);
    });
  });

  describe('Static Routes', () => {
    it('all non-dynamic routes have corresponding pages', () => {
      const missingRoutes: Array<{ route: string; roles: string[] }> = [];

      for (const routeInfo of index.routes) {
        if (routeInfo.isDynamic) continue;

        if (!pageExists(routeInfo.route)) {
          missingRoutes.push({
            route: routeInfo.route,
            roles: routeInfo.roles,
          });
        }
      }

      if (missingRoutes.length > 0) {
        const details = missingRoutes
          .map(r => `  - ${r.route} used by: ${r.roles.join(', ')}`)
          .join('\n');
        fail(`Missing pages for routes:\n${details}`);
      }
    });
  });

  describe('Coverage', () => {
    it('has routes for all 11 roles', () => {
      const roles = new Set<string>();
      for (const route of index.routes) {
        route.roles.forEach(r => roles.add(r));
      }
      expect(roles.size).toBe(11);
    });

    it('has at least 30 unique routes', () => {
      expect(index.routes.length).toBeGreaterThanOrEqual(30);
    });

    it('has at least 20 sidebar links', () => {
      expect(index.sidebarLinks.length).toBeGreaterThanOrEqual(20);
    });
  });
});
