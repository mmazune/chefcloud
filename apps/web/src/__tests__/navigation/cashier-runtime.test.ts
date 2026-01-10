/**
 * Phase I3: CASHIER Runtime Navigation Tests
 * 
 * Tests for:
 * 1. Runtime capture file exists and has valid schema
 * 2. Critical CASHIER actions have data-testid
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
}

interface NavmapSidebarLink {
  label: string;
  href: string;
  navGroup: string;
  isActive: boolean;
}

interface NavmapRoleCapture {
  role: string;
  capturedAt: string;
  captureMethod?: string;
  routesVisited: string[];
  sidebarLinks: NavmapSidebarLink[];
  actions: NavmapAction[];
}

describe('CASHIER Runtime Navigation (I3)', () => {
  describe('Runtime Capture Schema', () => {
    it('should have cashier.runtime.json file', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'cashier.runtime.json');
      expect(fs.existsSync(jsonPath)).toBe(true);
    });

    it('should have valid capture schema', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'cashier.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(data.role).toBe('CASHIER');
      expect(data.capturedAt).toBeTruthy();
      expect(Array.isArray(data.routesVisited)).toBe(true);
      expect(Array.isArray(data.sidebarLinks)).toBe(true);
      expect(Array.isArray(data.actions)).toBe(true);
    });

    it('should have /pos in routes visited', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'cashier.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(data.routesVisited).toContain('/pos');
    });

    it('should have /pos/cash-sessions in routes visited', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'cashier.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(data.routesVisited).toContain('/pos/cash-sessions');
    });

    it('should have POS sidebar link', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'cashier.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const posLink = data.sidebarLinks.find(l => l.href === '/pos');
      expect(posLink).toBeDefined();
      expect(posLink?.navGroup).toBe('Operations');
    });
  });

  describe('Critical CASHIER Actions', () => {
    const CASHIER_CRITICAL_ACTIONS = [
      { testId: 'pos-new-order', route: '/pos', label: 'New Order' },
      { testId: 'cash-open-session', route: '/pos/cash-sessions', label: 'Open Session' },
      { testId: 'cash-close-session', route: '/pos/cash-sessions', label: 'Close Session' },
      { testId: 'checkout-pay-cash', route: '/pos/checkout/[orderId]', label: 'Pay Cash' },
      { testId: 'checkout-pay-card', route: '/pos/checkout/[orderId]', label: 'Pay Card' },
    ];

    it.each(CASHIER_CRITICAL_ACTIONS)(
      'should have action $testId mapped on $route',
      ({ testId, route }) => {
        const jsonPath = path.join(RUNTIME_DIR, 'cashier.runtime.json');
        const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        
        const action = data.actions.find(a => a.testId === testId && a.route === route);
        expect(action).toBeDefined();
      }
    );

    it('should have at least 10 actions mapped', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'cashier.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(data.actions.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('CASHIER Sidebar Completeness', () => {
    const EXPECTED_SIDEBAR_HREFS = [
      '/pos',
      '/dashboard',
      '/workforce/timeclock',
      '/workforce/my-availability',
      '/workforce/my-swaps',
      '/workforce/open-shifts',
      '/settings',
    ];

    it('should have all expected sidebar links', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'cashier.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const actualHrefs = data.sidebarLinks.map(l => l.href).sort();
      
      for (const expected of EXPECTED_SIDEBAR_HREFS) {
        expect(actualHrefs).toContain(expected);
      }
    });

    it('should have exactly 7 sidebar links', () => {
      const jsonPath = path.join(RUNTIME_DIR, 'cashier.runtime.json');
      const data: NavmapRoleCapture = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(data.sidebarLinks.length).toBe(7);
    });
  });
});
