/**
 * OWNER Runtime Navigation Test
 *
 * Validates OWNER role navigation map following NavMap v2 schema.
 * OWNER is the superset role with access to all platform capabilities.
 *
 * @group navigation
 * @group owner
 */

import * as fs from 'fs';
import * as path from 'path';

// Navigate from apps/web/src/__tests__/navigation to project root
const ROOT = path.resolve(__dirname, '../../../../..');
const RUNTIME_DIR = path.join(ROOT, 'reports/navigation/runtime');

interface RuntimeAction {
  route: string;
  elementType: string;
  testId: string;
  label: string;
  attributes?: { risk?: string; note?: string };
}

interface RuntimeApiCall {
  route: string;
  method: string;
  path: string;
}

interface SidebarLink {
  label: string;
  href: string;
  navGroup: string;
  isActive: boolean;
  probeOutcome: string;
}

interface RuntimeData {
  role: string;
  capturedAt: string;
  captureMethod: string;
  routesVisited: string[];
  sidebarLinks: SidebarLink[];
  actions: RuntimeAction[];
  apiCalls: RuntimeApiCall[];
  summary: {
    totalRoutes: number;
    totalSidebarLinks: number;
    totalActions: number;
    probeOutcomes: { ok: number; forbidden: number; redirected: number; error: number };
    apiCallsTotal: number;
  };
}

describe('OWNER Runtime Navigation', () => {
  let runtime: RuntimeData;

  beforeAll(() => {
    const runtimePath = path.join(RUNTIME_DIR, 'owner.runtime.json');
    const raw = fs.readFileSync(runtimePath, 'utf-8');
    runtime = JSON.parse(raw);
  });

  describe('Schema Validation', () => {
    it('should have correct role identifier', () => {
      expect(runtime.role).toBe('OWNER');
    });

    it('should have capturedAt timestamp', () => {
      expect(runtime.capturedAt).toBeDefined();
      expect(new Date(runtime.capturedAt).getTime()).not.toBeNaN();
    });

    it('should have valid captureMethod', () => {
      expect(runtime.captureMethod).toBe('static-analysis-v2');
    });

    it('should have routesVisited array', () => {
      expect(Array.isArray(runtime.routesVisited)).toBe(true);
      expect(runtime.routesVisited.length).toBeGreaterThan(0);
    });

    it('should have sidebarLinks array', () => {
      expect(Array.isArray(runtime.sidebarLinks)).toBe(true);
      expect(runtime.sidebarLinks.length).toBeGreaterThan(0);
    });

    it('should have actions array', () => {
      expect(Array.isArray(runtime.actions)).toBe(true);
      expect(runtime.actions.length).toBeGreaterThan(0);
    });

    it('should have apiCalls array', () => {
      expect(Array.isArray(runtime.apiCalls)).toBe(true);
      expect(runtime.apiCalls.length).toBeGreaterThan(0);
    });

    it('should have summary object', () => {
      expect(runtime.summary).toBeDefined();
      expect(typeof runtime.summary.totalRoutes).toBe('number');
      expect(typeof runtime.summary.totalSidebarLinks).toBe('number');
      expect(typeof runtime.summary.totalActions).toBe('number');
      expect(typeof runtime.summary.apiCallsTotal).toBe('number');
    });
  });

  describe('Route Coverage', () => {
    it('should have extensive route coverage (superset role)', () => {
      expect(runtime.routesVisited.length).toBeGreaterThanOrEqual(80);
    });

    it('should include dashboard routes', () => {
      expect(runtime.routesVisited).toContain('/dashboard');
    });

    it('should include analytics routes', () => {
      expect(runtime.routesVisited).toContain('/analytics');
    });

    it('should include POS routes', () => {
      expect(runtime.routesVisited).toContain('/pos');
      expect(runtime.routesVisited).toContain('/pos/cash-sessions');
    });

    it('should include reservation routes', () => {
      expect(runtime.routesVisited).toContain('/reservations');
      expect(runtime.routesVisited).toContain('/waitlist');
    });

    it('should include inventory routes', () => {
      expect(runtime.routesVisited).toContain('/inventory');
      expect(runtime.routesVisited).toContain('/inventory/items');
      expect(runtime.routesVisited).toContain('/inventory/purchase-orders');
      expect(runtime.routesVisited).toContain('/inventory/stocktakes');
    });

    it('should include finance routes', () => {
      expect(runtime.routesVisited).toContain('/finance');
      expect(runtime.routesVisited).toContain('/finance/accounts');
      expect(runtime.routesVisited).toContain('/finance/journal');
      expect(runtime.routesVisited).toContain('/finance/periods');
    });

    it('should include payroll routes (OWNER exclusive)', () => {
      expect(runtime.routesVisited).toContain('/workforce/payroll-runs');
      expect(runtime.routesVisited).toContain('/workforce/remittances');
    });

    it('should include workforce routes', () => {
      expect(runtime.routesVisited).toContain('/workforce/schedule');
      expect(runtime.routesVisited).toContain('/workforce/approvals');
    });

    it('should include admin routes (OWNER exclusive)', () => {
      expect(runtime.routesVisited).toContain('/billing');
      expect(runtime.routesVisited).toContain('/security');
    });
  });

  describe('Sidebar Links', () => {
    it('should have all 7 nav groups', () => {
      const navGroups = new Set(runtime.sidebarLinks.map((l) => l.navGroup));
      expect(navGroups.size).toBe(7);
      expect(navGroups.has('Overview')).toBe(true);
      expect(navGroups.has('Operations')).toBe(true);
      expect(navGroups.has('Finance')).toBe(true);
      expect(navGroups.has('Team')).toBe(true);
      expect(navGroups.has('Workforce')).toBe(true);
      expect(navGroups.has('My Schedule')).toBe(true);
      expect(navGroups.has('Settings')).toBe(true);
    });

    it('should have all sidebar links probe-ok', () => {
      const allOk = runtime.sidebarLinks.every((l) => l.probeOutcome === 'ok');
      expect(allOk).toBe(true);
    });

    it('should have valid href for all sidebar links', () => {
      runtime.sidebarLinks.forEach((link) => {
        expect(link.href).toMatch(/^\//);
      });
    });
  });

  describe('Actions', () => {
    it('should have substantial action count (superset role)', () => {
      expect(runtime.actions.length).toBeGreaterThanOrEqual(50);
    });

    describe('POS Actions', () => {
      it('should have pos-new-order action', () => {
        const action = runtime.actions.find((a) => a.testId === 'pos-new-order');
        expect(action).toBeDefined();
      });

      it('should have pos-void-order action with HIGH risk', () => {
        const action = runtime.actions.find((a) => a.testId === 'pos-void-order');
        expect(action).toBeDefined();
        expect(action?.attributes?.risk).toBe('HIGH');
      });

      it('should have cash-session-close action with HIGH risk', () => {
        const action = runtime.actions.find((a) => a.testId === 'cash-session-close');
        expect(action).toBeDefined();
        expect(action?.attributes?.risk).toBe('HIGH');
      });
    });

    describe('Inventory Actions', () => {
      it('should have create-po-btn action with HIGH risk', () => {
        const action = runtime.actions.find((a) => a.testId === 'create-po-btn');
        expect(action).toBeDefined();
        expect(action?.attributes?.risk).toBe('HIGH');
      });

      it('should have approve-stocktake-btn action with HIGH risk', () => {
        const action = runtime.actions.find((a) => a.testId === 'approve-stocktake-btn');
        expect(action).toBeDefined();
        expect(action?.attributes?.risk).toBe('HIGH');
      });

      it('should have inventory-period-close-btn action with HIGH risk', () => {
        const action = runtime.actions.find((a) => a.testId === 'inventory-period-close-btn');
        expect(action).toBeDefined();
        expect(action?.attributes?.risk).toBe('HIGH');
      });
    });

    describe('Finance Actions', () => {
      it('should have journal-post action with HIGH risk', () => {
        const action = runtime.actions.find((a) => a.testId === 'journal-post');
        expect(action).toBeDefined();
        expect(action?.attributes?.risk).toBe('HIGH');
      });

      it('should have journal-reverse action with HIGH risk', () => {
        const action = runtime.actions.find((a) => a.testId === 'journal-reverse');
        expect(action).toBeDefined();
        expect(action?.attributes?.risk).toBe('HIGH');
      });

      it('should have period-close action with HIGH risk', () => {
        const action = runtime.actions.find((a) => a.testId === 'period-close');
        expect(action).toBeDefined();
        expect(action?.attributes?.risk).toBe('HIGH');
      });

      it('should have period-reopen action (OWNER exclusive)', () => {
        const action = runtime.actions.find((a) => a.testId === 'period-reopen');
        expect(action).toBeDefined();
        expect(action?.attributes?.risk).toBe('HIGH');
      });
    });

    describe('Payroll Actions (OWNER Exclusive)', () => {
      it('should have payroll-create-run action with HIGH risk', () => {
        const action = runtime.actions.find((a) => a.testId === 'payroll-create-run');
        expect(action).toBeDefined();
        expect(action?.attributes?.risk).toBe('HIGH');
      });

      it('should have payroll-finalize action with HIGH risk', () => {
        const action = runtime.actions.find((a) => a.testId === 'payroll-finalize');
        expect(action).toBeDefined();
        expect(action?.attributes?.risk).toBe('HIGH');
      });

      it('should have payroll-post action with HIGH risk', () => {
        const action = runtime.actions.find((a) => a.testId === 'payroll-post');
        expect(action).toBeDefined();
        expect(action?.attributes?.risk).toBe('HIGH');
      });

      it('should have remittance-create action with HIGH risk', () => {
        const action = runtime.actions.find((a) => a.testId === 'remittance-create');
        expect(action).toBeDefined();
        expect(action?.attributes?.risk).toBe('HIGH');
      });

      it('should have remittance-submit action with HIGH risk', () => {
        const action = runtime.actions.find((a) => a.testId === 'remittance-submit');
        expect(action).toBeDefined();
        expect(action?.attributes?.risk).toBe('HIGH');
      });
    });

    describe('Admin Actions (OWNER Exclusive)', () => {
      it('should have billing-manage-subscription action with HIGH risk', () => {
        const action = runtime.actions.find((a) => a.testId === 'billing-manage-subscription');
        expect(action).toBeDefined();
        expect(action?.attributes?.risk).toBe('HIGH');
      });

      it('should have security-manage-api-keys action with HIGH risk', () => {
        const action = runtime.actions.find((a) => a.testId === 'security-manage-api-keys');
        expect(action).toBeDefined();
        expect(action?.attributes?.risk).toBe('HIGH');
      });
    });
  });

  describe('API Calls', () => {
    it('should have substantial API call count', () => {
      expect(runtime.apiCalls.length).toBeGreaterThanOrEqual(80);
    });

    it('should include dashboard API calls', () => {
      const dashboardCalls = runtime.apiCalls.filter((c) => c.path.includes('/dashboard'));
      expect(dashboardCalls.length).toBeGreaterThan(0);
    });

    it('should include POS API calls', () => {
      const posCalls = runtime.apiCalls.filter((c) => c.path.includes('/pos'));
      expect(posCalls.length).toBeGreaterThan(0);
    });

    it('should include inventory API calls', () => {
      const invCalls = runtime.apiCalls.filter((c) => c.path.includes('/inventory'));
      expect(invCalls.length).toBeGreaterThan(0);
    });

    it('should include accounting API calls', () => {
      const accCalls = runtime.apiCalls.filter((c) => c.path.includes('/accounting'));
      expect(accCalls.length).toBeGreaterThan(0);
    });

    it('should include payroll API calls', () => {
      const payrollCalls = runtime.apiCalls.filter((c) => c.path.includes('/payroll'));
      expect(payrollCalls.length).toBeGreaterThan(0);
    });

    it('should include remittance API calls', () => {
      const remitCalls = runtime.apiCalls.filter((c) => c.path.includes('/remittance'));
      expect(remitCalls.length).toBeGreaterThan(0);
    });

    it('should include billing API calls', () => {
      const billCalls = runtime.apiCalls.filter((c) => c.path.includes('/billing'));
      expect(billCalls.length).toBeGreaterThan(0);
    });

    it('should include security API calls', () => {
      const secCalls = runtime.apiCalls.filter((c) => c.path.includes('/security'));
      expect(secCalls.length).toBeGreaterThan(0);
    });

    it('should have valid HTTP methods', () => {
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      runtime.apiCalls.forEach((call) => {
        expect(validMethods).toContain(call.method);
      });
    });
  });

  describe('HIGH Risk Actions Count', () => {
    it('should have at least 25 HIGH risk actions', () => {
      const highRiskActions = runtime.actions.filter(
        (a) => a.attributes?.risk === 'HIGH'
      );
      expect(highRiskActions.length).toBeGreaterThanOrEqual(25);
    });
  });

  describe('Summary Consistency', () => {
    it('should have consistent route count', () => {
      expect(runtime.summary.totalRoutes).toBe(runtime.routesVisited.length);
    });

    it('should have consistent sidebar link count', () => {
      expect(runtime.summary.totalSidebarLinks).toBe(runtime.sidebarLinks.length);
    });

    it('should have consistent action count', () => {
      expect(runtime.summary.totalActions).toBe(runtime.actions.length);
    });

    it('should have consistent API call count', () => {
      expect(runtime.summary.apiCallsTotal).toBe(runtime.apiCalls.length);
    });

    it('should have zero forbidden/error probes', () => {
      expect(runtime.summary.probeOutcomes.forbidden).toBe(0);
      expect(runtime.summary.probeOutcomes.error).toBe(0);
    });
  });
});
