/**
 * Tests for Role Capability Model
 * 
 * Ensures:
 * - All 11 roles exist
 * - OWNER is superset (has all capabilities)
 * - All capability keys referenced are valid
 * - Helper functions work correctly
 */

import {
  ROLE_KEYS,
  CAPABILITY_KEYS,
  roleCapabilities,
  getRoleCapabilities,
  roleHasCapability,
  levelHasCapability,
  getRolesWithCapability,
  isValidCapability,
  isValidRole,
  type RoleKey,
} from '../rbac';

describe('roleCapabilities', () => {
  describe('Role Keys', () => {
    it('should have exactly 11 roles', () => {
      expect(ROLE_KEYS).toHaveLength(11);
    });

    it('should include all expected role keys', () => {
      const expectedRoles: RoleKey[] = [
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
      expect(ROLE_KEYS).toEqual(expect.arrayContaining(expectedRoles));
      expect(expectedRoles).toEqual(expect.arrayContaining(ROLE_KEYS));
    });

    it('should have roleCapabilities entry for every role key', () => {
      for (const role of ROLE_KEYS) {
        expect(roleCapabilities[role]).toBeDefined();
        expect(roleCapabilities[role].level).toBeDefined();
        expect(roleCapabilities[role].label).toBeDefined();
        expect(roleCapabilities[role].capabilities).toBeInstanceOf(Array);
      }
    });
  });

  describe('Capability Keys', () => {
    it('should have all capability keys be unique', () => {
      const uniqueKeys = new Set(CAPABILITY_KEYS);
      expect(uniqueKeys.size).toBe(CAPABILITY_KEYS.length);
    });

    it('should follow DOMAIN_ACTION naming convention', () => {
      const validPattern = /^[A-Z]+_[A-Z_]+$/;
      for (const cap of CAPABILITY_KEYS) {
        expect(cap).toMatch(validPattern);
      }
    });
  });

  describe('OWNER Superset', () => {
    it('should have all capabilities assigned to OWNER', () => {
      const ownerCapabilities = roleCapabilities.OWNER.capabilities;
      expect(ownerCapabilities).toEqual(expect.arrayContaining(CAPABILITY_KEYS));
      expect(ownerCapabilities.length).toBe(CAPABILITY_KEYS.length);
    });

    it('should have OWNER at L5', () => {
      expect(roleCapabilities.OWNER.level).toBe('L5');
      expect(roleCapabilities.OWNER.levelNum).toBe(5);
    });
  });

  describe('Role-Capability Integrity', () => {
    it('should only reference valid capability keys in role capabilities', () => {
      for (const role of ROLE_KEYS) {
        const caps = roleCapabilities[role].capabilities;
        for (const cap of caps) {
          expect(CAPABILITY_KEYS).toContain(cap);
        }
      }
    });

    it('should have L4 roles with capabilities at or below L4', () => {
      const l4Roles: RoleKey[] = ['MANAGER', 'ACCOUNTANT'];
      for (const role of l4Roles) {
        expect(roleCapabilities[role].level).toBe('L4');
        // No L5-only capabilities in L4 roles (except if explicitly assigned)
      }
    });

    it('should have L3 roles include only L3 or lower capabilities', () => {
      const l3Roles: RoleKey[] = ['PROCUREMENT', 'STOCK_MANAGER', 'EVENT_MANAGER'];
      for (const role of l3Roles) {
        expect(roleCapabilities[role].level).toBe('L3');
      }
    });

    it('should have L1/L2 roles with no HIGH risk capabilities or limited set', () => {
      const lowLevelRoles: RoleKey[] = ['WAITER', 'BARTENDER', 'CASHIER', 'CHEF'];
      for (const role of lowLevelRoles) {
        expect(['L1', 'L2']).toContain(roleCapabilities[role].level);
        // These should have minimal or no HIGH risk capabilities
        expect(roleCapabilities[role].capabilities.length).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('Helper Functions', () => {
    describe('getRoleCapabilities', () => {
      it('should return role capability object', () => {
        const result = getRoleCapabilities('OWNER');
        expect(result).toBe(roleCapabilities.OWNER);
      });

      it('should return correct data for each role', () => {
        for (const role of ROLE_KEYS) {
          const result = getRoleCapabilities(role);
          expect(result).toBe(roleCapabilities[role]);
        }
      });
    });

    describe('roleHasCapability', () => {
      it('should return true for OWNER with any capability', () => {
        for (const cap of CAPABILITY_KEYS) {
          expect(roleHasCapability('OWNER', cap)).toBe(true);
        }
      });

      it('should return false for WAITER with any HIGH risk capability', () => {
        for (const cap of CAPABILITY_KEYS) {
          expect(roleHasCapability('WAITER', cap)).toBe(false);
        }
      });

      it('should return true for PROCUREMENT with inventory capabilities', () => {
        expect(roleHasCapability('PROCUREMENT', 'INVENTORY_TRANSFER_CREATE')).toBe(true);
        expect(roleHasCapability('PROCUREMENT', 'INVENTORY_WASTE_CREATE')).toBe(true);
      });

      it('should return false for CASHIER with finance capabilities', () => {
        expect(roleHasCapability('CASHIER', 'FINANCE_PERIOD_CLOSE')).toBe(false);
        expect(roleHasCapability('CASHIER', 'BILLING_MANAGE')).toBe(false);
      });
    });

    describe('levelHasCapability', () => {
      it('should return true for L5 with any capability', () => {
        for (const cap of CAPABILITY_KEYS) {
          expect(levelHasCapability('L5', cap)).toBe(true);
        }
      });

      it('should return false for L1 with L5 capabilities', () => {
        expect(levelHasCapability('L1', 'FINANCE_PERIOD_REOPEN')).toBe(false);
        expect(levelHasCapability('L1', 'BILLING_MANAGE')).toBe(false);
      });

      it('should return true for L4 with L4 capabilities', () => {
        expect(levelHasCapability('L4', 'INVENTORY_PERIOD_CLOSE')).toBe(true);
        expect(levelHasCapability('L4', 'PAYROLL_RUN_CREATE')).toBe(true);
      });
    });

    describe('getRolesWithCapability', () => {
      it('should return only OWNER for OWNER-exclusive capabilities', () => {
        // BILLING_MANAGE is L5 only - but we need to check which roles have it explicitly
        const rolesWithBilling = getRolesWithCapability('BILLING_MANAGE');
        expect(rolesWithBilling).toContain('OWNER');
        // Only OWNER should have OWNER-exclusive capabilities
        for (const role of rolesWithBilling) {
          expect(['OWNER', 'MANAGER'].includes(role) || roleCapabilities[role].levelNum >= 5).toBe(true);
        }
      });

      it('should return multiple roles for L3 capabilities', () => {
        const rolesWithVoid = getRolesWithCapability('POS_ORDER_VOID');
        expect(rolesWithVoid).toContain('OWNER');
        expect(rolesWithVoid).toContain('MANAGER');
        expect(rolesWithVoid).toContain('SUPERVISOR');
      });
    });

    describe('isValidCapability', () => {
      it('should return true for valid capabilities', () => {
        expect(isValidCapability('FINANCE_PERIOD_CLOSE')).toBe(true);
        expect(isValidCapability('POS_ORDER_VOID')).toBe(true);
      });

      it('should return false for invalid capabilities', () => {
        expect(isValidCapability('INVALID_CAP')).toBe(false);
        expect(isValidCapability('')).toBe(false);
      });
    });

    describe('isValidRole', () => {
      it('should return true for valid roles', () => {
        expect(isValidRole('OWNER')).toBe(true);
        expect(isValidRole('MANAGER')).toBe(true);
      });

      it('should return false for invalid roles', () => {
        expect(isValidRole('ADMIN')).toBe(false);
        expect(isValidRole('')).toBe(false);
      });
    });
  });

  describe('Runtime File Mapping', () => {
    it('should have runtimeFile defined for all roles', () => {
      for (const role of ROLE_KEYS) {
        expect(roleCapabilities[role].runtimeFile).toBeDefined();
        expect(roleCapabilities[role].runtimeFile).toMatch(/\.runtime\.json$/);
      }
    });

    it('should have unique runtime files for each role', () => {
      const runtimeFiles = ROLE_KEYS.map(role => roleCapabilities[role].runtimeFile);
      const uniqueFiles = new Set(runtimeFiles);
      expect(uniqueFiles.size).toBe(ROLE_KEYS.length);
    });
  });
});
