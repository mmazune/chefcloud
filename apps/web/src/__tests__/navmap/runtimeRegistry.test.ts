/**
 * NavMap Runtime Registry Tests
 * 
 * Tests that verify:
 * - All 11 roles are loaded
 * - Sidebar counts match runtime JSON
 * - Route access checks work correctly
 * - Action permission checks work correctly
 */

import path from 'path';
import fs from 'fs';

// Project root from apps/web/src/__tests__/navmap
const ROOT = path.resolve(__dirname, '../../../../..');
const RUNTIME_DIR = path.join(ROOT, 'reports/navigation/runtime');

// Import the registry functions
import {
  ALL_ROLES,
  getRuntimeForRole,
  getSidebarForRole,
  canAccessRoute,
  canPerformAction,
  getActionsForRole,
  getLoadedRoleCount,
  getLoadedRoles,
  isRoleLoaded,
} from '@/navmap';

describe('NavMap Runtime Registry', () => {
  describe('Role Loading', () => {
    it('includes all 11 roles in ALL_ROLES constant', () => {
      expect(ALL_ROLES).toHaveLength(11);
      expect(ALL_ROLES).toContain('OWNER');
      expect(ALL_ROLES).toContain('MANAGER');
      expect(ALL_ROLES).toContain('ACCOUNTANT');
      expect(ALL_ROLES).toContain('PROCUREMENT');
      expect(ALL_ROLES).toContain('STOCK_MANAGER');
      expect(ALL_ROLES).toContain('SUPERVISOR');
      expect(ALL_ROLES).toContain('CASHIER');
      expect(ALL_ROLES).toContain('CHEF');
      expect(ALL_ROLES).toContain('WAITER');
      expect(ALL_ROLES).toContain('BARTENDER');
      expect(ALL_ROLES).toContain('EVENT_MANAGER');
    });

    it('loads runtime data for all 11 roles', () => {
      expect(getLoadedRoleCount()).toBe(11);
    });

    it('getLoadedRoles returns all role names', () => {
      const roles = getLoadedRoles();
      expect(roles).toHaveLength(11);
      for (const role of ALL_ROLES) {
        expect(roles).toContain(role);
      }
    });

    it('isRoleLoaded returns true for all roles', () => {
      for (const role of ALL_ROLES) {
        expect(isRoleLoaded(role)).toBe(true);
      }
    });

    it('handles case-insensitive role lookup', () => {
      expect(getRuntimeForRole('owner')).not.toBeNull();
      expect(getRuntimeForRole('OWNER')).not.toBeNull();
      expect(getRuntimeForRole('Owner')).not.toBeNull();
    });

    it('returns null for invalid role', () => {
      expect(getRuntimeForRole('INVALID_ROLE')).toBeNull();
      expect(getRuntimeForRole(null)).toBeNull();
      expect(getRuntimeForRole(undefined)).toBeNull();
    });
  });

  describe('Sidebar Data', () => {
    it.each(ALL_ROLES)('%s: sidebar link count matches runtime JSON', (role) => {
      const runtime = getRuntimeForRole(role);
      const sidebar = getSidebarForRole(role);
      
      expect(runtime).not.toBeNull();
      expect(runtime!.sidebarLinks.length).toBeGreaterThan(0);
      
      // Count total links from sidebar groups
      const sidebarLinkCount = sidebar.reduce((sum, group) => sum + group.links.length, 0);
      expect(sidebarLinkCount).toBe(runtime!.sidebarLinks.length);
    });

    it.each(ALL_ROLES)('%s: sidebar groups preserve order from runtime', (role) => {
      const runtime = getRuntimeForRole(role);
      const sidebar = getSidebarForRole(role);
      
      // Extract unique nav groups in order from runtime
      const runtimeGroups: string[] = [];
      for (const link of runtime!.sidebarLinks) {
        if (!runtimeGroups.includes(link.navGroup)) {
          runtimeGroups.push(link.navGroup);
        }
      }
      
      // Sidebar group titles should match
      const sidebarGroupTitles = sidebar.map(g => g.title);
      expect(sidebarGroupTitles).toEqual(runtimeGroups);
    });

    it('returns empty array for invalid role', () => {
      expect(getSidebarForRole('INVALID')).toEqual([]);
      expect(getSidebarForRole(null)).toEqual([]);
    });
  });

  describe('Route Access (canAccessRoute)', () => {
    it('OWNER can access all routes', () => {
      const ownerRuntime = getRuntimeForRole('OWNER');
      
      // Check all owner routes
      for (const route of ownerRuntime!.routesVisited) {
        expect(canAccessRoute('OWNER', route)).toBe(true);
      }
    });

    it('WAITER cannot access /finance routes', () => {
      expect(canAccessRoute('WAITER', '/finance')).toBe(false);
      expect(canAccessRoute('WAITER', '/finance/vendor-bills')).toBe(false);
    });

    it('WAITER can access /pos', () => {
      expect(canAccessRoute('WAITER', '/pos')).toBe(true);
    });

    it('handles dynamic route segments', () => {
      // OWNER has /pos/checkout/[orderId] in routesVisited
      expect(canAccessRoute('OWNER', '/pos/checkout/123')).toBe(true);
      expect(canAccessRoute('OWNER', '/pos/checkout/abc-def')).toBe(true);
    });

    it('handles routes from sidebar links', () => {
      // Settings should be accessible via sidebar link
      expect(canAccessRoute('WAITER', '/settings')).toBe(true);
    });

    it('returns false for null/undefined role', () => {
      expect(canAccessRoute(null, '/dashboard')).toBe(false);
      expect(canAccessRoute(undefined, '/dashboard')).toBe(false);
    });
  });

  describe('Action Permissions (canPerformAction)', () => {
    it('OWNER can perform all owner actions', () => {
      const ownerActions = getActionsForRole('OWNER');
      expect(ownerActions.length).toBeGreaterThan(0);
      
      for (const action of ownerActions) {
        expect(canPerformAction('OWNER', action.testId)).toBe(true);
      }
    });

    it('WAITER can perform POS actions', () => {
      expect(canPerformAction('WAITER', 'pos-new-order')).toBe(true);
      expect(canPerformAction('WAITER', 'pos-checkout')).toBe(true);
    });

    it('WAITER cannot perform inventory delete actions', () => {
      // WAITER should not have inventory delete permissions
      expect(canPerformAction('WAITER', 'inventory-delete-item')).toBe(false);
    });

    it('returns false for unknown action', () => {
      expect(canPerformAction('OWNER', 'non-existent-action')).toBe(false);
    });

    it('respects route scoping when provided', () => {
      // pos-new-order is scoped to /pos route
      expect(canPerformAction('WAITER', 'pos-new-order', '/pos')).toBe(true);
      expect(canPerformAction('WAITER', 'pos-new-order', '/inventory')).toBe(false);
    });

    it('returns false for null/undefined role', () => {
      expect(canPerformAction(null, 'pos-new-order')).toBe(false);
      expect(canPerformAction(undefined, 'pos-new-order')).toBe(false);
    });
  });

  describe('Consistency with JSON files', () => {
    it.each(ALL_ROLES)('%s: runtime matches file on disk', (role) => {
      const filePath = path.join(RUNTIME_DIR, `${role.toLowerCase()}.runtime.json`);
      expect(fs.existsSync(filePath)).toBe(true);
      
      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const registryData = getRuntimeForRole(role);
      
      expect(registryData).not.toBeNull();
      expect(registryData!.role).toBe(fileData.role);
      expect(registryData!.routesVisited).toEqual(fileData.routesVisited);
      expect(registryData!.sidebarLinks.length).toBe(fileData.sidebarLinks.length);
      expect(registryData!.actions.length).toBe(fileData.actions.length);
    });

    it('every sidebar route is in routesVisited', () => {
      for (const role of ALL_ROLES) {
        const runtime = getRuntimeForRole(role);
        for (const link of runtime!.sidebarLinks) {
          const found = runtime!.routesVisited.some(r => 
            r === link.href || link.href.startsWith(r + '/')
          );
          expect(found).toBe(true);
        }
      }
    });
  });
});
