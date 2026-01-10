/**
 * Phase I3.1: WAITER Runtime Navigation Tests (v2)
 * 
 * Tests for:
 * 1. Runtime capture file exists and has valid schema
 * 2. Critical WAITER actions have data-testid
 * 3. WAITER sidebar completeness
 * 4. v2: Probe output schema and outcomes
 * 5. v2: API capture output
 * 6. v2: Checkout access (WAITER CAN access)
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
    probeOutcomes?: { ok: number; forbidden: number; redirected: number; error: number };
    apiCallsTotal?: number;
  };
}

interface ProbeOutput {
  role: string;
  probedAt: string;
  summary: { total: number; ok: number; forbidden: number; redirected: number; error: number };
  results: NavmapProbeResult[];
}

describe('WAITER Runtime Navigation (I3)', () => {
  describe('Runtime Capture Schema', () => {
    it('should have waiter.runtime.json file', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
      expect(fs.existsSync(jsonPath)).toBe(true);
    });

    it('should have valid capture schema', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(data.role).toBe('WAITER');
      expect(data.capturedAt).toBeTruthy();
      expect(Array.isArray(data.routesVisited)).toBe(true);
      expect(Array.isArray(data.sidebarLinks)).toBe(true);
      expect(Array.isArray(data.actions)).toBe(true);
    });

    it('should have /pos in routes visited', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(data.routesVisited).toContain('/pos');
    });

    it('should have /reservations in routes visited', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(data.routesVisited).toContain('/reservations');
    });

    it('should have POS sidebar link', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const posLink = data.sidebarLinks.find(l => l.href === '/pos');
      expect(posLink).toBeDefined();
      expect(posLink?.navGroup).toBe('Operations');
    });

    it('should have Reservations sidebar link', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const resLink = data.sidebarLinks.find(l => l.href === '/reservations');
      expect(resLink).toBeDefined();
      expect(resLink?.navGroup).toBe('Operations');
    });
  });

  describe('Critical WAITER Actions (POS)', () => {
    const WAITER_POS_ACTIONS = [
      { testId: 'pos-new-order', route: '/pos', label: 'New Order' },
      { testId: 'pos-send-kitchen', route: '/pos', label: 'Send to Kitchen' },
      { testId: 'pos-checkout', route: '/pos', label: 'Take Payment' },
      { testId: 'pos-split-bill', route: '/pos', label: 'Split Bill' },
    ];

    it.each(WAITER_POS_ACTIONS)(
      'should have POS action $testId',
      ({ testId, route }) => {
        const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
        const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        
        const action = data.actions.find(a => a.testId === testId && a.route === route);
        expect(action).toBeDefined();
      }
    );

    it('should NOT have pos-void-order (CASHIER-only)', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const voidAction = data.actions.find(a => a.testId === 'pos-void-order');
      expect(voidAction).toBeUndefined();
    });
  });

  // v2: WAITER CAN access checkout (corrected from I3)
  describe('WAITER Checkout Access (v2 Correction)', () => {
    it('should have /pos/checkout/[orderId] in routes visited', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(data.routesVisited).toContain('/pos/checkout/[orderId]');
    });

    const WAITER_CHECKOUT_ACTIONS = [
      { testId: 'checkout-back', route: '/pos/checkout/[orderId]' },
      { testId: 'checkout-pay-cash', route: '/pos/checkout/[orderId]' },
      { testId: 'checkout-pay-card', route: '/pos/checkout/[orderId]' },
      { testId: 'checkout-complete', route: '/pos/checkout/[orderId]' },
    ];

    it.each(WAITER_CHECKOUT_ACTIONS)(
      'should have checkout action $testId',
      ({ testId, route }) => {
        const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
        const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        
        const action = data.actions.find(a => a.testId === testId && a.route === route);
        expect(action).toBeDefined();
      }
    );
  });

  describe('Critical WAITER Actions (Reservations)', () => {
    const WAITER_RESERVATION_ACTIONS = [
      { testId: 'reservation-confirm', route: '/reservations', label: 'Confirm' },
      { testId: 'reservation-cancel', route: '/reservations', label: 'Cancel' },
      { testId: 'reservation-seat', route: '/reservations', label: 'Seat' },
      { testId: 'reservation-no-show', route: '/reservations', label: 'No-Show' },
      { testId: 'reservation-complete', route: '/reservations', label: 'Complete' },
    ];

    it.each(WAITER_RESERVATION_ACTIONS)(
      'should have reservation action $testId',
      ({ testId, route }) => {
        const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
        const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        
        const action = data.actions.find(a => a.testId === testId && a.route === route);
        expect(action).toBeDefined();
      }
    );

    it('should have at least 10 actions mapped', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(data.actions.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('WAITER Sidebar Completeness', () => {
    const EXPECTED_SIDEBAR_HREFS = [
      '/pos',
      '/reservations',
      '/workforce/my-availability',
      '/workforce/my-swaps',
      '/workforce/open-shifts',
      '/settings',
    ];

    it('should have all expected sidebar links', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const actualHrefs = data.sidebarLinks.map(l => l.href).sort();
      
      for (const expected of EXPECTED_SIDEBAR_HREFS) {
        expect(actualHrefs).toContain(expected);
      }
    });

    it('should have exactly 6 sidebar links', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(data.sidebarLinks.length).toBe(6);
    });

    it('should NOT have /dashboard (CASHIER has, WAITER does not)', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const dashLink = data.sidebarLinks.find(l => l.href === '/dashboard');
      expect(dashLink).toBeUndefined();
    });

    it('should NOT have /workforce/timeclock (not in WAITER sidebar)', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const timeclockLink = data.sidebarLinks.find(l => l.href === '/workforce/timeclock');
      expect(timeclockLink).toBeUndefined();
    });
  });

  describe('WAITER vs CASHIER Differentiation', () => {
    it('should have /reservations which CASHIER does not', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(data.routesVisited).toContain('/reservations');
      
      // Cross-check: CASHIER should not have reservations
      const cashierPath = path.join(RUNTIME_DIR, 'cashier.runtime.json');
      if (fs.existsSync(cashierPath)) {
        const cashierData: NavmapRoleCapture = JSON.parse(fs.readFileSync(cashierPath, 'utf-8'));
        expect(cashierData.routesVisited).not.toContain('/reservations');
      }
    });
  });

  // v2: Probe Output Tests
  describe('v2: Probe Output', () => {
    it('should have waiter.probe.json file', () => {
      const probePath = path.join(RUNTIME_DIR, 'waiter.probe.json');
      expect(fs.existsSync(probePath)).toBe(true);
    });

    it('should have valid probe schema', () => {
      const probePath = path.join(RUNTIME_DIR, 'waiter.probe.json');
      const data: ProbeOutput = JSON.parse(fs.readFileSync(probePath, 'utf-8'));
      
      expect(data.role).toBe('WAITER');
      expect(data.probedAt).toBeTruthy();
      expect(data.summary).toBeDefined();
      expect(Array.isArray(data.results)).toBe(true);
    });

    it('should have 0 forbidden probe outcomes', () => {
      const probePath = path.join(RUNTIME_DIR, 'waiter.probe.json');
      const data: ProbeOutput = JSON.parse(fs.readFileSync(probePath, 'utf-8'));
      
      expect(data.summary.forbidden).toBe(0);
    });

    it('should have 0 error probe outcomes', () => {
      const probePath = path.join(RUNTIME_DIR, 'waiter.probe.json');
      const data: ProbeOutput = JSON.parse(fs.readFileSync(probePath, 'utf-8'));
      
      expect(data.summary.error).toBe(0);
    });

    it('should have all probe outcomes as ok', () => {
      const probePath = path.join(RUNTIME_DIR, 'waiter.probe.json');
      const data: ProbeOutput = JSON.parse(fs.readFileSync(probePath, 'utf-8'));
      
      expect(data.summary.ok).toBe(data.summary.total);
    });
  });

  // v2: API Capture Tests
  describe('v2: API Capture', () => {
    it('should have apiCallsByRoute in runtime JSON', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(data.apiCallsByRoute).toBeDefined();
    });

    it('should have at least one route with API calls', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const routesWithCalls = Object.keys(data.apiCallsByRoute || {}).filter(
        route => (data.apiCallsByRoute?.[route]?.length || 0) > 0
      );
      expect(routesWithCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should have /pos route with API calls', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const posCalls = data.apiCallsByRoute?.['/pos'] || [];
      expect(posCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should have summary with apiCallsTotal', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'waiter.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(data.summary?.apiCallsTotal).toBeGreaterThanOrEqual(1);
    });
  });
});
