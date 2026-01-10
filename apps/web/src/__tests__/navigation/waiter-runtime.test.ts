/**
 * Phase I3: WAITER Runtime Navigation Tests
 * 
 * Tests for:
 * 1. Runtime capture file exists and has valid schema
 * 2. Critical WAITER actions have data-testid
 * 3. WAITER sidebar completeness
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
      { testId: 'pos-checkout', route: '/pos', label: 'Request Payment' },
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
});
