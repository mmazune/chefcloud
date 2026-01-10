/**
 * Phase I3: BARTENDER Runtime Navigation Tests
 * 
 * Tests for:
 * 1. Runtime capture file exists and has valid schema
 * 2. Critical BARTENDER POS actions have data-testid
 * 3. BARTENDER sidebar completeness
 * 4. v2: Probe output schema and outcomes
 * 5. v2: API capture output
 * 6. Checkout access (BARTENDER CAN access)
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

describe('BARTENDER Runtime Navigation (I3)', () => {
  let runtimeData: NavmapRoleCapture;
  let probeData: ProbeFile;

  beforeAll(() => {
    const runtimePath = path.join(RUNTIME_DIR, 'bartender.runtime.json');
    const probePath = path.join(RUNTIME_DIR, 'bartender.probe.json');
    
    expect(fs.existsSync(runtimePath)).toBe(true);
    expect(fs.existsSync(probePath)).toBe(true);
    
    runtimeData = JSON.parse(fs.readFileSync(runtimePath, 'utf-8'));
    probeData = JSON.parse(fs.readFileSync(probePath, 'utf-8'));
  });

  describe('Runtime Capture Schema', () => {
    it('should have bartender.runtime.json file', () => {
      const filePath = path.join(RUNTIME_DIR, 'bartender.runtime.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have valid capture schema', () => {
      expect(runtimeData.role).toBe('BARTENDER');
      expect(runtimeData.capturedAt).toBeDefined();
      expect(Array.isArray(runtimeData.routesVisited)).toBe(true);
      expect(Array.isArray(runtimeData.sidebarLinks)).toBe(true);
      expect(Array.isArray(runtimeData.actions)).toBe(true);
    });

    it('should have /pos in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/pos');
    });

    it('should have /inventory in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/inventory');
    });

    it('should have POS sidebar link', () => {
      const posLink = runtimeData.sidebarLinks.find(l => l.href === '/pos');
      expect(posLink).toBeDefined();
      expect(posLink?.label).toBe('POS');
    });

    it('should have Inventory sidebar link', () => {
      const inventoryLink = runtimeData.sidebarLinks.find(l => l.href === '/inventory');
      expect(inventoryLink).toBeDefined();
    });
  });

  describe('Critical BARTENDER POS Actions', () => {
    it('should have POS action pos-new-order', () => {
      const action = runtimeData.actions.find(a => a.testId === 'pos-new-order');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/pos');
    });

    it('should have POS action pos-send-kitchen', () => {
      const action = runtimeData.actions.find(a => a.testId === 'pos-send-kitchen');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/pos');
    });

    it('should have POS action pos-checkout', () => {
      const action = runtimeData.actions.find(a => a.testId === 'pos-checkout');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/pos');
    });

    it('should have POS action pos-split-bill', () => {
      const action = runtimeData.actions.find(a => a.testId === 'pos-split-bill');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/pos');
    });

    it('should NOT have pos-void-order (CASHIER-only)', () => {
      const action = runtimeData.actions.find(a => a.testId === 'pos-void-order');
      expect(action).toBeUndefined();
    });

    it('should have at least 8 actions mapped', () => {
      expect(runtimeData.actions.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('BARTENDER Checkout Access', () => {
    it('should have /pos/checkout/[orderId] in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/pos/checkout/[orderId]');
    });

    it('should have checkout action checkout-back', () => {
      const action = runtimeData.actions.find(a => a.testId === 'checkout-back');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/pos/checkout/[orderId]');
    });

    it('should have checkout action checkout-pay-cash', () => {
      const action = runtimeData.actions.find(a => a.testId === 'checkout-pay-cash');
      expect(action).toBeDefined();
    });

    it('should have checkout action checkout-pay-card', () => {
      const action = runtimeData.actions.find(a => a.testId === 'checkout-pay-card');
      expect(action).toBeDefined();
    });

    it('should have checkout action checkout-complete', () => {
      const action = runtimeData.actions.find(a => a.testId === 'checkout-complete');
      expect(action).toBeDefined();
    });
  });

  describe('BARTENDER Sidebar Completeness', () => {
    it('should have all expected sidebar links', () => {
      const expectedLinks = [
        '/pos',
        '/inventory',
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

    it('should have exactly 6 sidebar links', () => {
      expect(runtimeData.sidebarLinks.length).toBe(6);
    });

    it('should NOT have /reservations (WAITER has, BARTENDER does not)', () => {
      const reservationsLink = runtimeData.sidebarLinks.find(l => l.href === '/reservations');
      expect(reservationsLink).toBeUndefined();
    });

    it('should NOT have /kds (CHEF has, BARTENDER does not)', () => {
      const kdsLink = runtimeData.sidebarLinks.find(l => l.href === '/kds');
      expect(kdsLink).toBeUndefined();
    });
  });

  describe('BARTENDER vs WAITER Differentiation', () => {
    it('should have /inventory which WAITER does not', () => {
      const inventoryLink = runtimeData.sidebarLinks.find(l => l.href === '/inventory');
      expect(inventoryLink).toBeDefined();
    });
  });

  describe('v2: Probe Output', () => {
    it('should have bartender.probe.json file', () => {
      const filePath = path.join(RUNTIME_DIR, 'bartender.probe.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have valid probe schema', () => {
      expect(probeData.role).toBe('BARTENDER');
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

    it('should have /pos route with API calls', () => {
      const posApiCalls = runtimeData.apiCallsByRoute?.['/pos'];
      expect(posApiCalls).toBeDefined();
      expect(posApiCalls?.length).toBeGreaterThanOrEqual(1);
    });

    it('should have summary with apiCallsTotal', () => {
      expect(runtimeData.summary?.apiCallsTotal).toBeGreaterThanOrEqual(1);
    });
  });
});
