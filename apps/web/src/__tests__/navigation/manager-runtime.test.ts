/**
 * Phase I3: MANAGER Runtime Navigation Tests
 * 
 * Tests for:
 * 1. Runtime capture file exists and has valid schema
 * 2. Critical MANAGER actions have data-testid
 * 3. MANAGER sidebar completeness (21 links)
 * 4. v2: Probe output schema and outcomes
 * 5. Shift approvals access and actions
 * 6. Analytics access (MANAGER has)
 * 7. Workforce management actions
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

describe('MANAGER Runtime Navigation (I3)', () => {
  let runtimeData: NavmapRoleCapture;
  let probeData: ProbeFile;

  beforeAll(() => {
    const runtimePath = path.join(RUNTIME_DIR, 'manager.runtime.json');
    const probePath = path.join(RUNTIME_DIR, 'manager.probe.json');
    
    expect(fs.existsSync(runtimePath)).toBe(true);
    expect(fs.existsSync(probePath)).toBe(true);
    
    runtimeData = JSON.parse(fs.readFileSync(runtimePath, 'utf-8'));
    probeData = JSON.parse(fs.readFileSync(probePath, 'utf-8'));
  });

  describe('Runtime Capture Schema', () => {
    it('should have manager.runtime.json file', () => {
      const filePath = path.join(RUNTIME_DIR, 'manager.runtime.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have valid capture schema', () => {
      expect(runtimeData.role).toBe('MANAGER');
      expect(runtimeData.capturedAt).toBeDefined();
      expect(Array.isArray(runtimeData.routesVisited)).toBe(true);
      expect(Array.isArray(runtimeData.sidebarLinks)).toBe(true);
      expect(Array.isArray(runtimeData.actions)).toBe(true);
    });

    it('should have /workspaces/manager in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/workspaces/manager');
    });

    it('should have /pos in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/pos');
    });

    it('should have /analytics in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/analytics');
    });

    it('should have /workforce/approvals in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/workforce/approvals');
    });
  });

  describe('Critical MANAGER POS Actions', () => {
    it('should have POS action pos-new-order', () => {
      const action = runtimeData.actions.find(a => a.testId === 'pos-new-order');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/pos');
    });

    it('should have POS action pos-void-order (MANAGER has void access)', () => {
      const action = runtimeData.actions.find(a => a.testId === 'pos-void-order');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/pos');
    });

    it('should have at least 21 actions mapped', () => {
      expect(runtimeData.actions.length).toBeGreaterThanOrEqual(21);
    });
  });

  describe('MANAGER Shift Approvals Actions', () => {
    it('should have shift-approve action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'shift-approve');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/workforce/approvals');
      expect(action?.label).toBe('Approve Shift');
    });
  });

  describe('MANAGER Swap Approvals Actions', () => {
    it('should have swap-approve action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'swap-approve');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/workforce/swaps');
    });

    it('should have swap-reject action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'swap-reject');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/workforce/swaps');
    });
  });

  describe('MANAGER Inventory Actions', () => {
    it('should have /inventory/items in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/inventory/items');
    });

    it('should have create-item-btn action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'create-item-btn');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/inventory/items');
    });

    it('should have edit-item-btn action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'edit-item-btn');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/inventory/items');
    });
  });

  describe('MANAGER Analytics Access', () => {
    it('should have analytics-export-csv action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'analytics-export-csv');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/analytics');
    });

    it('should have analytics-date-filter action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'analytics-date-filter');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/analytics');
    });
  });

  describe('MANAGER Cash Session Access', () => {
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

  describe('MANAGER Checkout Access', () => {
    it('should have /pos/checkout/[orderId] in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/pos/checkout/[orderId]');
    });

    it('should have checkout action checkout-back', () => {
      const action = runtimeData.actions.find(a => a.testId === 'checkout-back');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/pos/checkout/[orderId]');
    });

    it('should have checkout action checkout-complete', () => {
      const action = runtimeData.actions.find(a => a.testId === 'checkout-complete');
      expect(action).toBeDefined();
    });
  });

  describe('MANAGER Sidebar Completeness', () => {
    it('should have all expected sidebar links', () => {
      const expectedLinks = [
        '/dashboard',
        '/analytics',
        '/reports',
        '/pos',
        '/reservations',
        '/inventory',
        '/staff',
        '/feedback',
        '/workforce/schedule',
        '/workforce/timeclock',
        '/workforce/approvals',
        '/workforce/swaps',
        '/workforce/labor',
        '/workforce/labor-targets',
        '/workforce/staffing-planner',
        '/workforce/staffing-alerts',
        '/workforce/auto-scheduler',
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

    it('should have exactly 21 sidebar links', () => {
      expect(runtimeData.sidebarLinks.length).toBe(21);
    });

    it('should have Approvals in Workforce nav group', () => {
      const approvalsLink = runtimeData.sidebarLinks.find(l => l.href === '/workforce/approvals');
      expect(approvalsLink).toBeDefined();
      expect(approvalsLink?.navGroup).toBe('Workforce');
      expect(approvalsLink?.label).toBe('Approvals');
    });

    it('should have Analytics in Overview nav group', () => {
      const analyticsLink = runtimeData.sidebarLinks.find(l => l.href === '/analytics');
      expect(analyticsLink).toBeDefined();
      expect(analyticsLink?.navGroup).toBe('Overview');
    });

    it('should have 9 Workforce nav group items', () => {
      const workforceLinks = runtimeData.sidebarLinks.filter(l => l.navGroup === 'Workforce');
      expect(workforceLinks.length).toBe(9);
    });
  });

  describe('MANAGER vs SUPERVISOR Differentiation', () => {
    it('should have /workforce/approvals which SUPERVISOR does not', () => {
      const approvalsLink = runtimeData.sidebarLinks.find(l => l.href === '/workforce/approvals');
      expect(approvalsLink).toBeDefined();
    });

    it('should have /analytics which SUPERVISOR does not', () => {
      const analyticsLink = runtimeData.sidebarLinks.find(l => l.href === '/analytics');
      expect(analyticsLink).toBeDefined();
    });

    it('should have /workforce/labor-targets which SUPERVISOR does not', () => {
      const laborTargetsLink = runtimeData.sidebarLinks.find(l => l.href === '/workforce/labor-targets');
      expect(laborTargetsLink).toBeDefined();
    });

    it('should have shift-approve action which SUPERVISOR does not', () => {
      const action = runtimeData.actions.find(a => a.testId === 'shift-approve');
      expect(action).toBeDefined();
    });
  });

  describe('v2: Probe Output', () => {
    it('should have manager.probe.json file', () => {
      const filePath = path.join(RUNTIME_DIR, 'manager.probe.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have valid probe schema', () => {
      expect(probeData.role).toBe('MANAGER');
      expect(probeData.totalLinks).toBe(21);
      expect(Array.isArray(probeData.results)).toBe(true);
      expect(probeData.summary).toBeDefined();
    });

    it('should have 0 forbidden probe outcomes', () => {
      expect(probeData.summary.forbidden).toBe(0);
    });

    it('should have 0 error probe outcomes', () => {
      expect(probeData.summary.error).toBe(0);
    });

    it('should have all 21 probe outcomes as ok', () => {
      expect(probeData.summary.ok).toBe(21);
      const nonOk = probeData.results.filter(r => r.outcome !== 'ok');
      expect(nonOk.length).toBe(0);
    });

    it('should have shift approvals probe result', () => {
      const approvalsProbe = probeData.results.find(r => r.href === '/workforce/approvals');
      expect(approvalsProbe).toBeDefined();
      expect(approvalsProbe?.outcome).toBe('ok');
    });

    it('should have analytics probe result', () => {
      const analyticsProbe = probeData.results.find(r => r.href === '/analytics');
      expect(analyticsProbe).toBeDefined();
      expect(analyticsProbe?.outcome).toBe('ok');
    });
  });
});
