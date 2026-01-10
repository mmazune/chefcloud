/**
 * Role Landing Routes Tests
 * 
 * Tests for Prompt 5: Post-login routing by role
 * Ensures:
 * - All 11 roles have valid default routes
 * - Default routes are accessible for each role
 * - Fallback logic works when default is inaccessible
 * - getDefaultRouteForRole returns correct metadata
 */

import {
  getDefaultRoute,
  getDefaultRouteForRole,
  canAccessRoute,
  isRouteAccessible,
  getFirstAccessibleRoute,
  getAllNavItems,
  getRoleCapabilities,
  ROLE_CAPABILITIES,
  type JobRole,
} from '@/config/roleCapabilities';

/**
 * All 11 roles that must be tested
 */
const ALL_ROLES: JobRole[] = [
  'OWNER',
  'MANAGER',
  'ACCOUNTANT',
  'SUPERVISOR',
  'CASHIER',
  'WAITER',
  'CHEF',
  'BARTENDER',
  'PROCUREMENT',
  'STOCK_MANAGER',
  'EVENT_MANAGER',
];

describe('Role Landing Routes (Prompt 5)', () => {
  describe('All 11 Roles Exist', () => {
    it('should have exactly 11 roles configured', () => {
      const configuredRoles = Object.keys(ROLE_CAPABILITIES);
      expect(configuredRoles).toHaveLength(11);
    });

    it.each(ALL_ROLES)('should have %s role configured', (role) => {
      expect(ROLE_CAPABILITIES[role]).toBeDefined();
      expect(ROLE_CAPABILITIES[role].defaultRoute).toBeDefined();
      expect(ROLE_CAPABILITIES[role].navGroups).toBeInstanceOf(Array);
    });
  });

  describe('Default Route Accessibility', () => {
    it.each(ALL_ROLES)(
      '%s default route must be accessible',
      (role) => {
        const result = getDefaultRouteForRole(role);
        
        // Route should exist and be accessible
        expect(result.hasAccess).toBe(true);
        expect(result.route).toBeTruthy();
        expect(result.route).not.toBe('/no-access');
        
        // The returned route should be accessible for the role
        expect(canAccessRoute(role, result.route)).toBe(true);
      }
    );

    it.each(ALL_ROLES)(
      '%s should have at least one accessible nav item',
      (role) => {
        const navItems = getAllNavItems(role);
        expect(navItems.length).toBeGreaterThan(0);
      }
    );
  });

  describe('Default Route in Nav Items', () => {
    it.each(ALL_ROLES)(
      '%s default route should exist in runtime routes',
      (role) => {
        const result = getDefaultRouteForRole(role);
        const navItems = getAllNavItems(role);
        const allRoutes = navItems.map((item) => item.href);
        
        // The default route should be in the nav items OR be a valid prefix
        const isInNavItems = navItems.some(
          (item) =>
            result.route === item.href ||
            result.route.startsWith(item.href + '/')
        );
        
        expect(isInNavItems).toBe(true);
      }
    );
  });

  describe('getDefaultRouteForRole Metadata', () => {
    it.each(ALL_ROLES)(
      '%s should return correct source metadata',
      (role) => {
        const result = getDefaultRouteForRole(role);
        
        expect(result).toHaveProperty('route');
        expect(result).toHaveProperty('source');
        expect(result).toHaveProperty('hasAccess');
        
        expect(['default', 'fallback', 'no-access']).toContain(result.source);
      }
    );

    it('OWNER should get default or fallback source (workspace routes may fall back)', () => {
      const result = getDefaultRouteForRole('OWNER');
      // OWNER's default is /workspaces/owner which may not be in nav items
      // This results in fallback to first accessible nav item, which is still valid
      expect(['default', 'fallback']).toContain(result.source);
      expect(result.hasAccess).toBe(true);
    });
  });

  describe('canAccessRoute Function', () => {
    it('OWNER should access /dashboard', () => {
      expect(canAccessRoute('OWNER', '/dashboard')).toBe(true);
    });

    it('OWNER should access /settings', () => {
      // Owner has access to settings
      expect(canAccessRoute('OWNER', '/settings')).toBe(true);
    });

    it('WAITER should access /pos', () => {
      expect(canAccessRoute('WAITER', '/pos')).toBe(true);
    });

    it('WAITER should NOT access /billing', () => {
      expect(canAccessRoute('WAITER', '/billing')).toBe(false);
    });

    it('CHEF should access /kds', () => {
      expect(canAccessRoute('CHEF', '/kds')).toBe(true);
    });

    it('ACCOUNTANT should access /finance', () => {
      expect(canAccessRoute('ACCOUNTANT', '/finance')).toBe(true);
    });
  });

  describe('isRouteAccessible Alias', () => {
    it('should work the same as canAccessRoute', () => {
      for (const role of ALL_ROLES) {
        const defaultRoute = getDefaultRoute(role);
        expect(isRouteAccessible(role, defaultRoute)).toBe(
          canAccessRoute(role, defaultRoute)
        );
      }
    });
  });

  describe('getFirstAccessibleRoute Fallback', () => {
    it.each(ALL_ROLES)(
      '%s should have a first accessible route',
      (role) => {
        const firstRoute = getFirstAccessibleRoute(role);
        expect(firstRoute).toBeTruthy();
        expect(canAccessRoute(role, firstRoute!)).toBe(true);
      }
    );
  });

  describe('Role-specific Landing Routes', () => {
    const expectedLandingPatterns: Record<JobRole, string[]> = {
      OWNER: ['/workspaces/owner', '/dashboard'],
      MANAGER: ['/workspaces/manager', '/dashboard'],
      ACCOUNTANT: ['/workspaces/accountant', '/finance', '/dashboard'],
      SUPERVISOR: ['/workspaces/supervisor', '/pos', '/dashboard'],
      CASHIER: ['/workspaces/cashier', '/pos'],
      WAITER: ['/workspaces/waiter', '/pos'],
      CHEF: ['/workspaces/chef', '/kds'],
      BARTENDER: ['/workspaces/bartender', '/pos'],
      PROCUREMENT: ['/workspaces/procurement', '/inventory'],
      STOCK_MANAGER: ['/workspaces/stock-manager', '/inventory'],
      EVENT_MANAGER: ['/workspaces/event-manager', '/reservations'],
    };

    it.each(ALL_ROLES)(
      '%s should land on appropriate route',
      (role) => {
        const result = getDefaultRouteForRole(role);
        const expectedPatterns = expectedLandingPatterns[role];
        
        // Route should match one of the expected patterns (or start with one)
        const matchesPattern = expectedPatterns.some(
          (pattern) =>
            result.route === pattern ||
            result.route.startsWith(pattern + '/')
        );
        
        expect(matchesPattern).toBe(true);
      }
    );
  });

  describe('Edge Cases', () => {
    it('should handle null role gracefully', () => {
      const result = getDefaultRouteForRole(null);
      expect(result.hasAccess).toBe(true);
      expect(result.route).toBeTruthy();
    });

    it('should handle undefined role gracefully', () => {
      const result = getDefaultRouteForRole(undefined);
      expect(result.hasAccess).toBe(true);
      expect(result.route).toBeTruthy();
    });

    it('should handle invalid role string gracefully', () => {
      const result = getDefaultRouteForRole('INVALID_ROLE');
      expect(result.hasAccess).toBe(true);
      expect(result.route).toBeTruthy();
    });
  });

  describe('No Redirect Loops', () => {
    it.each(ALL_ROLES)(
      '%s default route should not be /login',
      (role) => {
        const result = getDefaultRouteForRole(role);
        expect(result.route).not.toBe('/login');
      }
    );

    it.each(ALL_ROLES)(
      '%s should not redirect to empty string',
      (role) => {
        const result = getDefaultRouteForRole(role);
        expect(result.route).not.toBe('');
      }
    );
  });
});
