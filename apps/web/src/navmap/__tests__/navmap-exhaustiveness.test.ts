/**
 * NavMap v3 - Exhaustiveness Gate Test
 * 
 * This test validates that the OWNER role discovery map has:
 * 1. Zero unresolved controls
 * 2. All controls have data-testid
 * 3. All controls have actionId
 * 
 * The test fails if any control lacks proper mapping.
 * 
 * @usage pnpm -C apps/web test navmap-exhaustiveness
 */

import * as fs from 'fs';
import * as path from 'path';
import type { RoleDiscovery } from '../discovery-types';

describe('NavMap v3 Exhaustiveness Gate', () => {
  let ownerDiscovery: RoleDiscovery | null = null;

  beforeAll(() => {
    const discoveryPath = path.resolve(__dirname, '../role-discovery/owner.discovery.json');
    
    if (fs.existsSync(discoveryPath)) {
      const content = fs.readFileSync(discoveryPath, 'utf-8');
      ownerDiscovery = JSON.parse(content) as RoleDiscovery;
    }
  });

  test('OWNER discovery file exists', () => {
    expect(ownerDiscovery).not.toBeNull();
    expect(ownerDiscovery?.role).toBe('OWNER');
  });

  test('OWNER discovery has zero unresolved controls', () => {
    if (!ownerDiscovery) {
      throw new Error('Discovery file not loaded');
    }

    const unresolved = ownerDiscovery.unresolved;
    
    if (unresolved.length > 0) {
      const unresolvedList = unresolved
        .map(u => `  - ${u.route}: ${u.id} (${u.reason})`)
        .join('\n');
      
      throw new Error(
        `OWNER role has ${unresolved.length} unresolved controls:\n${unresolvedList}`
      );
    }

    expect(unresolved.length).toBe(0);
    expect(ownerDiscovery.summary.unresolvedCount).toBe(0);
  });

  test('all OWNER controls have data-testid', () => {
    if (!ownerDiscovery) {
      throw new Error('Discovery file not loaded');
    }

    const controlsWithoutTestId: string[] = [];

    for (const route of ownerDiscovery.routes) {
      const allControls = [
        ...route.regions.topbar,
        ...route.regions.sidebar,
        ...route.regions.content,
      ];

      for (const control of allControls) {
        if (!control.hasTestId) {
          controlsWithoutTestId.push(`${route.route}: ${control.id} (${control.label})`);
        }
      }
    }

    if (controlsWithoutTestId.length > 0) {
      throw new Error(
        `${controlsWithoutTestId.length} controls missing data-testid:\n  - ${controlsWithoutTestId.join('\n  - ')}`
      );
    }

    expect(controlsWithoutTestId.length).toBe(0);
  });

  test('all OWNER controls have actionId', () => {
    if (!ownerDiscovery) {
      throw new Error('Discovery file not loaded');
    }

    const controlsWithoutActionId: string[] = [];

    for (const route of ownerDiscovery.routes) {
      const allControls = [
        ...route.regions.topbar,
        ...route.regions.sidebar,
        ...route.regions.content,
      ];

      for (const control of allControls) {
        if (!control.actionId) {
          controlsWithoutActionId.push(`${route.route}: ${control.id} (${control.label})`);
        }
      }
    }

    if (controlsWithoutActionId.length > 0) {
      throw new Error(
        `${controlsWithoutActionId.length} controls missing actionId:\n  - ${controlsWithoutActionId.join('\n  - ')}`
      );
    }

    expect(controlsWithoutActionId.length).toBe(0);
  });

  test('all OWNER controls are mapped', () => {
    if (!ownerDiscovery) {
      throw new Error('Discovery file not loaded');
    }

    const unmappedControls: string[] = [];

    for (const route of ownerDiscovery.routes) {
      const allControls = [
        ...route.regions.topbar,
        ...route.regions.sidebar,
        ...route.regions.content,
      ];

      for (const control of allControls) {
        if (!control.isMapped) {
          unmappedControls.push(`${route.route}: ${control.id} (${control.label})`);
        }
      }
    }

    if (unmappedControls.length > 0) {
      throw new Error(
        `${unmappedControls.length} controls not mapped:\n  - ${unmappedControls.join('\n  - ')}`
      );
    }

    expect(unmappedControls.length).toBe(0);
  });

  test('OWNER summary metrics are consistent', () => {
    if (!ownerDiscovery) {
      throw new Error('Discovery file not loaded');
    }

    const { summary } = ownerDiscovery;

    // Total controls should equal mapped + unmapped
    expect(summary.controlsTotal).toBeGreaterThan(0);
    expect(summary.controlsMapped).toBeLessThanOrEqual(summary.controlsTotal);
    expect(summary.controlsWithTestId).toBeLessThanOrEqual(summary.controlsTotal);

    // For complete mapping, mapped should equal total
    expect(summary.controlsMapped).toBe(summary.controlsTotal);
  });

  test('all navigation controls have targetRoute', () => {
    if (!ownerDiscovery) {
      throw new Error('Discovery file not loaded');
    }

    const navControlsWithoutTarget: string[] = [];

    for (const route of ownerDiscovery.routes) {
      const allControls = [
        ...route.regions.topbar,
        ...route.regions.sidebar,
        ...route.regions.content,
      ];

      for (const control of allControls) {
        if (control.classification === 'navigate' && !control.targetRoute) {
          navControlsWithoutTarget.push(`${route.route}: ${control.id} (${control.label})`);
        }
      }
    }

    if (navControlsWithoutTarget.length > 0) {
      throw new Error(
        `${navControlsWithoutTarget.length} navigation controls missing targetRoute:\n  - ${navControlsWithoutTarget.join('\n  - ')}`
      );
    }

    expect(navControlsWithoutTarget.length).toBe(0);
  });
});

describe('NavMap v3 Structural Validation', () => {
  let ownerDiscovery: RoleDiscovery | null = null;

  beforeAll(() => {
    const discoveryPath = path.resolve(__dirname, '../role-discovery/owner.discovery.json');
    
    if (fs.existsSync(discoveryPath)) {
      const content = fs.readFileSync(discoveryPath, 'utf-8');
      ownerDiscovery = JSON.parse(content) as RoleDiscovery;
    }
  });

  test('discovery has valid structure', () => {
    expect(ownerDiscovery).toHaveProperty('role');
    expect(ownerDiscovery).toHaveProperty('generatedAt');
    expect(ownerDiscovery).toHaveProperty('baseUrl');
    expect(ownerDiscovery).toHaveProperty('routes');
    expect(ownerDiscovery).toHaveProperty('summary');
    expect(ownerDiscovery).toHaveProperty('unresolved');
  });

  test('dashboard route is fully mapped', () => {
    if (!ownerDiscovery) {
      throw new Error('Discovery file not loaded');
    }

    const dashboardRoute = ownerDiscovery.routes.find(r => r.route === '/dashboard');
    
    expect(dashboardRoute).toBeDefined();
    expect(dashboardRoute?.controlCount).toBeGreaterThan(0);
    expect(dashboardRoute?.unresolvedCount).toBe(0);
  });

  test('all routes have required properties', () => {
    if (!ownerDiscovery) {
      throw new Error('Discovery file not loaded');
    }

    for (const route of ownerDiscovery.routes) {
      expect(route).toHaveProperty('route');
      expect(route).toHaveProperty('title');
      expect(route).toHaveProperty('regions');
      expect(route.regions).toHaveProperty('topbar');
      expect(route.regions).toHaveProperty('sidebar');
      expect(route.regions).toHaveProperty('content');
      expect(route.regions).toHaveProperty('modals');
    }
  });

  test('control IDs are unique within routes', () => {
    if (!ownerDiscovery) {
      throw new Error('Discovery file not loaded');
    }

    for (const route of ownerDiscovery.routes) {
      const allControls = [
        ...route.regions.topbar,
        ...route.regions.sidebar,
        ...route.regions.content,
      ];

      const ids = allControls.map(c => c.id);
      const uniqueIds = new Set(ids);

      expect(ids.length).toBe(uniqueIds.size);
    }
  });
});
