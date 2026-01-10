/**
 * Phase I3: CHEF Runtime Navigation Tests
 * 
 * Tests for:
 * 1. Runtime capture file exists and has valid schema
 * 2. Critical CHEF KDS actions have data-testid
 * 3. CHEF sidebar completeness
 * 4. v2: Probe output schema and outcomes
 * 5. v2: API capture output
 * 6. KDS route is accessible to CHEF
 */
import fs from 'fs';
import path from 'path';

// Navigate from apps/web/src/__tests__/navigation to project root
const ROOT = path.resolve(__dirname, '../../../../..');
const RUNTIME_DIR = path.join(ROOT, 'reports/navigation/runtime');

interface NavmapApiCall {
  method: string;
  path: string;
  phase: 'page-load' | 'action';
}

interface NavmapAction {
  route: string;
  elementType: string;
  testId: string;
  label: string;
  attributes?: Record<string, string>;
}

interface NavmapSidebarLink {
  label: string;
  href: string;
  navGroup: string;
  isActive: boolean;
  probeOutcome?: string;
}

interface NavmapProbeResult {
  href: string;
  label: string;
  navGroup: string;
  outcome: string;
  redirectedTo?: string;
  error?: string;
}

interface NavmapRoleCapture {
  role: string;
  capturedAt: string;
  captureMethod?: string;
  routesVisited: string[];
  sidebarLinks: NavmapSidebarLink[];
  actions: NavmapAction[];
  apiCallsByRoute?: Record<string, NavmapApiCall[]>;
  probeResults?: NavmapProbeResult[];
  summary?: {
    totalRoutes: number;
    totalSidebarLinks: number;
    totalActions: number;
    apiCallsTotal: number;
    probeOk: number;
    probeForbidden: number;
    probeError: number;
  };
}

interface ProbeFile {
  role: string;
  capturedAt: string;
  totalLinks: number;
  results: NavmapProbeResult[];
  summary: {
    ok: number;
    redirected: number;
    forbidden: number;
    error: number;
  };
}

describe('CHEF Runtime Navigation (I3)', () => {
  let runtimeData: NavmapRoleCapture;
  let probeData: ProbeFile;

  beforeAll(() => {
    const runtimePath = path.join(RUNTIME_DIR, 'chef.runtime.json');
    const probePath = path.join(RUNTIME_DIR, 'chef.probe.json');
    
    expect(fs.existsSync(runtimePath)).toBe(true);
    expect(fs.existsSync(probePath)).toBe(true);
    
    runtimeData = JSON.parse(fs.readFileSync(runtimePath, 'utf-8'));
    probeData = JSON.parse(fs.readFileSync(probePath, 'utf-8'));
  });

  describe('Runtime Capture Schema', () => {
    it('should have chef.runtime.json file', () => {
      const filePath = path.join(RUNTIME_DIR, 'chef.runtime.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have valid capture schema', () => {
      expect(runtimeData.role).toBe('CHEF');
      expect(runtimeData.capturedAt).toBeDefined();
      expect(Array.isArray(runtimeData.routesVisited)).toBe(true);
      expect(Array.isArray(runtimeData.sidebarLinks)).toBe(true);
      expect(Array.isArray(runtimeData.actions)).toBe(true);
    });

    it('should have /kds in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/kds');
    });

    it('should have /dashboard in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/dashboard');
    });

    it('should have KDS sidebar link', () => {
      const kdsLink = runtimeData.sidebarLinks.find(l => l.href === '/kds');
      expect(kdsLink).toBeDefined();
      expect(kdsLink?.label).toBe('KDS');
    });

    it('should have Inventory sidebar link', () => {
      const inventoryLink = runtimeData.sidebarLinks.find(l => l.href === '/inventory');
      expect(inventoryLink).toBeDefined();
    });
  });

  describe('Critical CHEF KDS Actions', () => {
    it('should have KDS action kds-in-progress', () => {
      const action = runtimeData.actions.find(a => a.testId === 'kds-in-progress');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/kds');
    });

    it('should have KDS action kds-ready', () => {
      const action = runtimeData.actions.find(a => a.testId === 'kds-ready');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/kds');
    });

    it('should have KDS action kds-recall', () => {
      const action = runtimeData.actions.find(a => a.testId === 'kds-recall');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/kds');
    });

    it('should have KDS action kds-served', () => {
      const action = runtimeData.actions.find(a => a.testId === 'kds-served');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/kds');
    });

    it('should have KDS action kds-filter', () => {
      const action = runtimeData.actions.find(a => a.testId === 'kds-filter');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/kds');
    });

    it('should have KDS action kds-refresh', () => {
      const action = runtimeData.actions.find(a => a.testId === 'kds-refresh');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/kds');
    });

    it('should have KDS action kds-settings', () => {
      const action = runtimeData.actions.find(a => a.testId === 'kds-settings');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/kds');
    });

    it('should have at least 7 actions mapped', () => {
      expect(runtimeData.actions.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe('CHEF Sidebar Completeness', () => {
    it('should have all expected sidebar links', () => {
      const expectedLinks = [
        '/kds',
        '/dashboard',
        '/inventory',
        '/workforce/timeclock',
        '/workforce/my-availability',
        '/workforce/my-swaps',
        '/workforce/open-shifts',
        '/settings',
      ];
      
      for (const href of expectedLinks) {
        const link = runtimeData.sidebarLinks.find(l => l.href === href);
        expect(link).toBeDefined();
      }
    });

    it('should have exactly 8 sidebar links', () => {
      expect(runtimeData.sidebarLinks.length).toBe(8);
    });

    it('should NOT have /pos (WAITER/CASHIER has, CHEF does not)', () => {
      const posLink = runtimeData.sidebarLinks.find(l => l.href === '/pos');
      expect(posLink).toBeUndefined();
    });

    it('should NOT have /reservations (WAITER has, CHEF does not)', () => {
      const reservationsLink = runtimeData.sidebarLinks.find(l => l.href === '/reservations');
      expect(reservationsLink).toBeUndefined();
    });
  });

  describe('CHEF KDS Access (Primary Workspace)', () => {
    it('should have /kds in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/kds');
    });

    it('should have KDS link in Kitchen nav group', () => {
      const kdsLink = runtimeData.sidebarLinks.find(l => l.href === '/kds');
      expect(kdsLink).toBeDefined();
      expect(kdsLink?.navGroup).toBe('Kitchen');
    });
  });

  describe('v2: Probe Output', () => {
    it('should have chef.probe.json file', () => {
      const filePath = path.join(RUNTIME_DIR, 'chef.probe.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have valid probe schema', () => {
      expect(probeData.role).toBe('CHEF');
      expect(probeData.totalLinks).toBeGreaterThan(0);
      expect(Array.isArray(probeData.results)).toBe(true);
      expect(probeData.summary).toBeDefined();
    });

    it('should have 0 forbidden probe outcomes', () => {
      expect(probeData.summary.forbidden).toBe(0);
    });

    it('should have 0 error probe outcomes', () => {
      expect(probeData.summary.error).toBe(0);
    });

    it('should have all probe outcomes as ok', () => {
      const nonOk = probeData.results.filter(r => r.outcome !== 'ok');
      expect(nonOk.length).toBe(0);
    });
  });

  describe('v2: API Capture', () => {
    it('should have apiCallsByRoute in runtime JSON', () => {
      expect(runtimeData.apiCallsByRoute).toBeDefined();
    });

    it('should have at least one route with API calls', () => {
      const routes = Object.keys(runtimeData.apiCallsByRoute || {});
      expect(routes.length).toBeGreaterThanOrEqual(1);
    });

    it('should have /kds route with API calls', () => {
      const kdsApiCalls = runtimeData.apiCallsByRoute?.['/kds'];
      expect(kdsApiCalls).toBeDefined();
      expect(kdsApiCalls?.length).toBeGreaterThanOrEqual(1);
    });

    it('should have summary with apiCallsTotal', () => {
      expect(runtimeData.summary?.apiCallsTotal).toBeGreaterThanOrEqual(1);
    });
  });
});
