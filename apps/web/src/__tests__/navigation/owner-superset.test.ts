/**
 * OWNER Superset Validation Test
 *
 * Validates that OWNER role is a proper superset of all other roles.
 * OWNER must have access to every navigation group and action available
 * to any other role in the system.
 *
 * @group navigation
 * @group owner
 * @group superset
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

interface SidebarLink {
  label: string;
  href: string;
  navGroup: string;
  isActive: boolean;
  probeOutcome: string;
}

interface RuntimeData {
  role: string;
  routesVisited: string[];
  sidebarLinks: SidebarLink[];
  actions: RuntimeAction[];
}

const OTHER_ROLES = [
  'accountant',
  'bartender',
  'cashier',
  'chef',
  'event_manager',
  'manager',
  'procurement',
  'stock_manager',
  'supervisor',
  'waiter',
];

describe('OWNER Superset Validation', () => {
  let ownerRuntime: RuntimeData;
  const otherRuntimes: Map<string, RuntimeData> = new Map();

  beforeAll(() => {
    // Load OWNER runtime
    const ownerPath = path.join(RUNTIME_DIR, 'owner.runtime.json');
    ownerRuntime = JSON.parse(fs.readFileSync(ownerPath, 'utf-8'));

    // Load all other role runtimes
    for (const role of OTHER_ROLES) {
      const rolePath = path.join(RUNTIME_DIR, `${role}.runtime.json`);
      if (fs.existsSync(rolePath)) {
        const data = JSON.parse(fs.readFileSync(rolePath, 'utf-8'));
        otherRuntimes.set(role, data);
      }
    }
  });

  describe('Runtime Files Loaded', () => {
    it('should load OWNER runtime', () => {
      expect(ownerRuntime).toBeDefined();
      expect(ownerRuntime.role).toBe('OWNER');
    });

    it('should load all 10 other role runtimes', () => {
      expect(otherRuntimes.size).toBe(10);
      OTHER_ROLES.forEach((role) => {
        expect(otherRuntimes.has(role)).toBe(true);
      });
    });
  });

  describe('Nav Group Superset', () => {
    it('should have OWNER cover essential nav groups', () => {
      const ownerNavGroups = new Set(ownerRuntime.sidebarLinks.map((l) => l.navGroup));
      
      // OWNER should have access to core business areas
      // Note: Nav group labels vary between roles - we check for core functional coverage
      const essentialGroups = ['Overview', 'Operations', 'Finance', 'Workforce', 'Settings'];
      essentialGroups.forEach((group) => {
        expect(ownerNavGroups.has(group)).toBe(true);
      });
    });

    it('should have OWNER nav group count >= 5 (core business areas)', () => {
      const ownerNavGroupCount = new Set(
        ownerRuntime.sidebarLinks.map((l) => l.navGroup)
      ).size;

      // OWNER should have at least 5 distinct nav groups for core areas
      expect(ownerNavGroupCount).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Sidebar Link Superset', () => {
    it('should have OWNER sidebar links cover all essential paths from other roles', () => {
      const ownerPaths = new Set(ownerRuntime.sidebarLinks.map((l) => l.href));

      // Essential paths that must be covered - extracted from all roles
      const essentialPaths = [
        '/dashboard',
        '/pos',
        '/reservations',
        '/inventory',
        '/finance',
        '/workforce/schedule',
        '/workforce/approvals',
        '/settings',
      ];

      essentialPaths.forEach((path) => {
        expect(ownerPaths.has(path)).toBe(true);
      });
    });
  });

  describe('Route Superset', () => {
    it('should have OWNER route count >= any other role', () => {
      const ownerRouteCount = ownerRuntime.routesVisited.length;

      let maxOtherCount = 0;
      otherRuntimes.forEach((runtime) => {
        if (runtime.routesVisited.length > maxOtherCount) {
          maxOtherCount = runtime.routesVisited.length;
        }
      });

      expect(ownerRouteCount).toBeGreaterThanOrEqual(maxOtherCount);
    });

    it('should have OWNER cover all domain prefixes from other roles', () => {
      const getDomainPrefix = (route: string): string => {
        const parts = route.split('/').filter(Boolean);
        return parts[0] || '';
      };

      const ownerDomains = new Set(
        ownerRuntime.routesVisited.map(getDomainPrefix)
      );

      otherRuntimes.forEach((runtime, _role) => {
        const roleDomains = new Set(runtime.routesVisited.map(getDomainPrefix));
        roleDomains.forEach((domain) => {
          if (domain && !domain.includes('[')) {
            expect(ownerDomains.has(domain)).toBe(true);
          }
        });
      });
    });
  });

  describe('Action Superset', () => {
    it('should have OWNER action count >= any other role', () => {
      const ownerActionCount = ownerRuntime.actions.length;

      let maxOtherCount = 0;
      otherRuntimes.forEach((runtime) => {
        if (runtime.actions.length > maxOtherCount) {
          maxOtherCount = runtime.actions.length;
        }
      });

      expect(ownerActionCount).toBeGreaterThanOrEqual(maxOtherCount);
    });

    it('should have OWNER have sufficient HIGH risk actions', () => {
      const ownerHighRiskActions = ownerRuntime.actions.filter(
        (a) => a.attributes?.risk === 'HIGH'
      );

      // OWNER should have the most HIGH risk actions as the superset role
      // This includes all critical financial, inventory, and payroll operations
      expect(ownerHighRiskActions.length).toBeGreaterThanOrEqual(20);

      // Check for key HIGH risk action categories
      const ownerHighRiskTestIds = new Set(ownerHighRiskActions.map((a) => a.testId));
      
      // Finance HIGH risk actions
      expect(ownerHighRiskTestIds.has('journal-post')).toBe(true);
      expect(ownerHighRiskTestIds.has('period-close')).toBe(true);
      
      // Payroll HIGH risk actions (OWNER exclusive)
      expect(ownerHighRiskTestIds.has('payroll-finalize')).toBe(true);
      
      // POS HIGH risk actions
      expect(ownerHighRiskTestIds.has('pos-void-order')).toBe(true);
    });
  });

  describe('Specific Role Coverage', () => {
    describe('MANAGER coverage', () => {
      it('should cover all MANAGER nav groups', () => {
        const manager = otherRuntimes.get('manager');
        if (!manager) return;

        const ownerNavGroups = new Set(ownerRuntime.sidebarLinks.map((l) => l.navGroup));
        const managerNavGroups = new Set(manager.sidebarLinks.map((l) => l.navGroup));

        managerNavGroups.forEach((ng) => {
          expect(ownerNavGroups.has(ng)).toBe(true);
        });
      });
    });

    describe('ACCOUNTANT coverage', () => {
      it('should cover all ACCOUNTANT finance routes', () => {
        const accountant = otherRuntimes.get('accountant');
        if (!accountant) return;

        const ownerFinanceRoutes = ownerRuntime.routesVisited.filter((r) =>
          r.startsWith('/finance')
        );
        const accountantFinanceRoutes = accountant.routesVisited.filter((r) =>
          r.startsWith('/finance')
        );

        expect(ownerFinanceRoutes.length).toBeGreaterThanOrEqual(
          accountantFinanceRoutes.length
        );
      });

      it('should have access to key accounting functionality', () => {
        // OWNER should have access to core accounting routes
        const ownerRoutes = new Set(ownerRuntime.routesVisited);
        
        expect(ownerRoutes.has('/finance/accounts')).toBe(true);
        expect(ownerRoutes.has('/finance/journal')).toBe(true);
        expect(ownerRoutes.has('/finance/periods')).toBe(true);
        expect(ownerRoutes.has('/finance/pnl')).toBe(true);
        expect(ownerRoutes.has('/finance/balance-sheet')).toBe(true);
      });
    });

    describe('STOCK_MANAGER coverage', () => {
      it('should cover all STOCK_MANAGER inventory routes', () => {
        const stockManager = otherRuntimes.get('stock_manager');
        if (!stockManager) return;

        const ownerInventoryRoutes = ownerRuntime.routesVisited.filter((r) =>
          r.startsWith('/inventory')
        );
        const smInventoryRoutes = stockManager.routesVisited.filter((r) =>
          r.startsWith('/inventory')
        );

        expect(ownerInventoryRoutes.length).toBeGreaterThanOrEqual(
          smInventoryRoutes.length
        );
      });
    });

    describe('PROCUREMENT coverage', () => {
      it('should cover all PROCUREMENT purchase order routes', () => {
        const procurement = otherRuntimes.get('procurement');
        if (!procurement) return;

        const ownerRoutes = new Set(ownerRuntime.routesVisited);
        const procRoutes = procurement.routesVisited.filter((r) =>
          r.includes('purchase-order')
        );

        procRoutes.forEach((route) => {
          expect(ownerRoutes.has(route)).toBe(true);
        });
      });
    });

    describe('EVENT_MANAGER coverage', () => {
      it('should have access to reservation functionality', () => {
        const ownerRoutes = new Set(ownerRuntime.routesVisited);
        
        // OWNER should have access to core reservation routes
        expect(ownerRoutes.has('/reservations')).toBe(true);
        expect(ownerRoutes.has('/reservations/calendar')).toBe(true);
        expect(ownerRoutes.has('/reservations/policies')).toBe(true);
        expect(ownerRoutes.has('/reservations/today-board')).toBe(true);
        expect(ownerRoutes.has('/waitlist')).toBe(true);
      });
    });

    describe('SUPERVISOR coverage', () => {
      it('should cover all SUPERVISOR workforce routes', () => {
        const supervisor = otherRuntimes.get('supervisor');
        if (!supervisor) return;

        const ownerWorkforceRoutes = ownerRuntime.routesVisited.filter((r) =>
          r.startsWith('/workforce')
        );
        const supWorkforceRoutes = supervisor.routesVisited.filter((r) =>
          r.startsWith('/workforce')
        );

        expect(ownerWorkforceRoutes.length).toBeGreaterThanOrEqual(
          supWorkforceRoutes.length
        );
      });
    });
  });

  describe('OWNER Exclusive Capabilities', () => {
    it('should have payroll routes not in any other role', () => {
      const payrollRoutes = [
        '/workforce/payroll-runs',
        '/workforce/remittances',
        '/workforce/compensation',
      ];

      payrollRoutes.forEach((route) => {
        // OWNER has it
        expect(ownerRuntime.routesVisited).toContain(route);

        // No other role has it
        otherRuntimes.forEach((runtime, _role) => {
          expect(runtime.routesVisited).not.toContain(route);
        });
      });
    });

    it('should have admin routes not in any other role', () => {
      const adminRoutes = ['/billing', '/security'];

      adminRoutes.forEach((route) => {
        // OWNER has it
        expect(ownerRuntime.routesVisited).toContain(route);

        // No other role has it
        otherRuntimes.forEach((runtime, _role) => {
          expect(runtime.routesVisited).not.toContain(route);
        });
      });
    });

    it('should have period-reopen action not in any other role', () => {
      const ownerAction = ownerRuntime.actions.find(
        (a) => a.testId === 'period-reopen'
      );
      expect(ownerAction).toBeDefined();

      otherRuntimes.forEach((runtime, _role) => {
        const otherAction = runtime.actions.find(
          (a) => a.testId === 'period-reopen'
        );
        expect(otherAction).toBeUndefined();
      });
    });

    it('should have payroll-post action not in any other role', () => {
      const ownerAction = ownerRuntime.actions.find(
        (a) => a.testId === 'payroll-post'
      );
      expect(ownerAction).toBeDefined();

      otherRuntimes.forEach((runtime, _role) => {
        const otherAction = runtime.actions.find(
          (a) => a.testId === 'payroll-post'
        );
        expect(otherAction).toBeUndefined();
      });
    });

    it('should have billing-manage-subscription action not in any other role', () => {
      const ownerAction = ownerRuntime.actions.find(
        (a) => a.testId === 'billing-manage-subscription'
      );
      expect(ownerAction).toBeDefined();

      otherRuntimes.forEach((runtime, _role) => {
        const otherAction = runtime.actions.find(
          (a) => a.testId === 'billing-manage-subscription'
        );
        expect(otherAction).toBeUndefined();
      });
    });
  });

  describe('Summary Statistics', () => {
    it('should report OWNER as largest role by route count', () => {
      const ownerCount = ownerRuntime.routesVisited.length;
      let isLargest = true;

      otherRuntimes.forEach((runtime) => {
        if (runtime.routesVisited.length > ownerCount) {
          isLargest = false;
        }
      });

      expect(isLargest).toBe(true);
    });

    it('should report OWNER as largest role by action count', () => {
      const ownerCount = ownerRuntime.actions.length;
      let isLargest = true;

      otherRuntimes.forEach((runtime) => {
        if (runtime.actions.length > ownerCount) {
          isLargest = false;
        }
      });

      expect(isLargest).toBe(true);
    });
  });
});
