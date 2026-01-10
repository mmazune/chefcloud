/**
 * Phase I3: SUPERVISOR Runtime Navigation Tests
 * 
 * Tests for:
 * 1. Runtime capture file exists and has valid schema
 * 2. Critical SUPERVISOR actions have data-testid
 * 3. SUPERVISOR sidebar completeness (10 links)
 * 4. v2: Probe output schema and outcomes
 * 5. Swap approvals access and actions
 * 6. Cash session access (SUPERVISOR has)
 */
import fs from 'fs';
import path from 'path';

// Navigate from apps/web/src/__tests__/navigation to project root
const ROOT = path.resolve(__dirname, '../../../../..');
const RUNTIME_DIR = path.join(ROOT, 'reports/navigation/runtime');

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

describe('SUPERVISOR Runtime Navigation (I3)', () => {
  let runtimeData: NavmapRoleCapture;
  let probeData: ProbeFile;

  beforeAll(() => {
    const runtimePath = path.join(RUNTIME_DIR, 'supervisor.runtime.json');
    const probePath = path.join(RUNTIME_DIR, 'supervisor.probe.json');
    
    expect(fs.existsSync(runtimePath)).toBe(true);
    expect(fs.existsSync(probePath)).toBe(true);
    
    runtimeData = JSON.parse(fs.readFileSync(runtimePath, 'utf-8'));
    probeData = JSON.parse(fs.readFileSync(probePath, 'utf-8'));
  });

  describe('Runtime Capture Schema', () => {
    it('should have supervisor.runtime.json file', () => {
      const filePath = path.join(RUNTIME_DIR, 'supervisor.runtime.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have valid capture schema', () => {
      expect(runtimeData.role).toBe('SUPERVISOR');
      expect(runtimeData.capturedAt).toBeDefined();
      expect(Array.isArray(runtimeData.routesVisited)).toBe(true);
      expect(Array.isArray(runtimeData.sidebarLinks)).toBe(true);
      expect(Array.isArray(runtimeData.actions)).toBe(true);
    });

    it('should have /workspaces/supervisor in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/workspaces/supervisor');
    });

    it('should have /pos in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/pos');
    });

    it('should have /workforce/swaps in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/workforce/swaps');
    });
  });

  describe('Critical SUPERVISOR POS Actions', () => {
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

    it('should have POS action pos-void-order (SUPERVISOR has void access)', () => {
      const action = runtimeData.actions.find(a => a.testId === 'pos-void-order');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/pos');
    });

    it('should have at least 14 actions mapped', () => {
      expect(runtimeData.actions.length).toBeGreaterThanOrEqual(14);
    });
  });

  describe('SUPERVISOR Swap Approvals Actions', () => {
    it('should have swap-approve action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'swap-approve');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/workforce/swaps');
      expect(action?.label).toBe('Approve Swap');
    });

    it('should have swap-reject action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'swap-reject');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/workforce/swaps');
      expect(action?.label).toBe('Reject Swap');
    });
  });

  describe('SUPERVISOR Cash Session Access', () => {
    it('should have /pos/cash-sessions in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/pos/cash-sessions');
    });

    it('should have cash-session-open action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'cash-session-open');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/pos/cash-sessions');
    });

    it('should have cash-session-close action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'cash-session-close');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/pos/cash-sessions');
    });
  });

  describe('SUPERVISOR Checkout Access', () => {
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

  describe('SUPERVISOR Sidebar Completeness', () => {
    it('should have all expected sidebar links', () => {
      const expectedLinks = [
        '/pos',
        '/reservations',
        '/staff',
        '/workforce/timeclock',
        '/workforce/swaps',
        '/dashboard',
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

    it('should have exactly 10 sidebar links', () => {
      expect(runtimeData.sidebarLinks.length).toBe(10);
    });

    it('should have Swap Approvals in Workforce nav group', () => {
      const swapLink = runtimeData.sidebarLinks.find(l => l.href === '/workforce/swaps');
      expect(swapLink).toBeDefined();
      expect(swapLink?.navGroup).toBe('Workforce');
      expect(swapLink?.label).toBe('Swap Approvals');
    });

    it('should have Dashboard in Overview nav group', () => {
      const dashboardLink = runtimeData.sidebarLinks.find(l => l.href === '/dashboard');
      expect(dashboardLink).toBeDefined();
      expect(dashboardLink?.navGroup).toBe('Overview');
    });
  });

  describe('SUPERVISOR vs Floor Staff Differentiation', () => {
    it('should have /workforce/swaps which WAITER/BARTENDER/CASHIER do not', () => {
      const swapLink = runtimeData.sidebarLinks.find(l => l.href === '/workforce/swaps');
      expect(swapLink).toBeDefined();
    });

    it('should have /staff which floor staff do not', () => {
      const staffLink = runtimeData.sidebarLinks.find(l => l.href === '/staff');
      expect(staffLink).toBeDefined();
    });

    it('should have pos-void-order which WAITER/BARTENDER do not', () => {
      const action = runtimeData.actions.find(a => a.testId === 'pos-void-order');
      expect(action).toBeDefined();
    });
  });

  describe('v2: Probe Output', () => {
    it('should have supervisor.probe.json file', () => {
      const filePath = path.join(RUNTIME_DIR, 'supervisor.probe.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have valid probe schema', () => {
      expect(probeData.role).toBe('SUPERVISOR');
      expect(probeData.totalLinks).toBe(10);
      expect(Array.isArray(probeData.results)).toBe(true);
      expect(probeData.summary).toBeDefined();
    });

    it('should have 0 forbidden probe outcomes', () => {
      expect(probeData.summary.forbidden).toBe(0);
    });

    it('should have 0 error probe outcomes', () => {
      expect(probeData.summary.error).toBe(0);
    });

    it('should have all 10 probe outcomes as ok', () => {
      expect(probeData.summary.ok).toBe(10);
      const nonOk = probeData.results.filter(r => r.outcome !== 'ok');
      expect(nonOk.length).toBe(0);
    });

    it('should have swap approvals probe result', () => {
      const swapProbe = probeData.results.find(r => r.href === '/workforce/swaps');
      expect(swapProbe).toBeDefined();
      expect(swapProbe?.outcome).toBe('ok');
    });
  });
});
