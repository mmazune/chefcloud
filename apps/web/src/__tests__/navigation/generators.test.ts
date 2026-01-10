/**
 * Navigation Generator Tests
 * Phase I1-I2: Verify role nav trees and page action catalog outputs
 * 
 * Note: Generators should be run before tests via pnpm nav:generate and pnpm actions:generate
 */
import fs from 'fs';
import path from 'path';

// Navigate from apps/web/src/__tests__/navigation to project root
const ROOT = path.resolve(__dirname, '../../../../..');
const NAV_REPORTS_DIR = path.join(ROOT, 'reports/navigation');
const NAV_DOCS_DIR = path.join(ROOT, 'docs/navigation');

// All 11 roles that must be present
const EXPECTED_ROLES = [
  'ACCOUNTANT',
  'BARTENDER',
  'CASHIER',
  'CHEF',
  'EVENT_MANAGER',
  'MANAGER',
  'OWNER',
  'PROCUREMENT',
  'STOCK_MANAGER',
  'SUPERVISOR',
  'WAITER',
];

// Minimum annotated pages expected
const MIN_ANNOTATED_PAGES = 8;

describe('Navigation Generators', () => {
  describe('Role Navigation Trees (I1)', () => {
    it('should generate role-nav-trees.json', () => {
      const jsonPath = path.join(NAV_REPORTS_DIR, 'role-nav-trees.json');
      expect(fs.existsSync(jsonPath)).toBe(true);
    });

    it('should generate ROLE_NAV_TREES.md', () => {
      const mdPath = path.join(NAV_DOCS_DIR, 'ROLE_NAV_TREES.md');
      expect(fs.existsSync(mdPath)).toBe(true);
    });

    it('should include all 11 roles', () => {
      const jsonPath = path.join(NAV_REPORTS_DIR, 'role-nav-trees.json');
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(data.roleCount).toBe(11);
      
      const roles = Object.keys(data.roles).sort();
      expect(roles).toEqual(EXPECTED_ROLES);
    });

    it('should have at least 1 route per role', () => {
      const jsonPath = path.join(NAV_REPORTS_DIR, 'role-nav-trees.json');
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      for (const role of EXPECTED_ROLES) {
        const roleData = data.roles[role];
        expect(roleData).toBeDefined();
        expect(roleData.totalRoutes).toBeGreaterThanOrEqual(1);
        expect(roleData.landingRoute).toBeTruthy();
      }
    });

    it('should have deterministic ordering (sorted by role name)', () => {
      const jsonPath = path.join(NAV_REPORTS_DIR, 'role-nav-trees.json');
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const roles = Object.keys(data.roles);
      const sortedRoles = [...roles].sort();
      expect(roles).toEqual(sortedRoles);
    });
  });

  describe('Page Action Catalog (I2)', () => {
    it('should generate page-actions.json', () => {
      const jsonPath = path.join(NAV_REPORTS_DIR, 'page-actions.json');
      expect(fs.existsSync(jsonPath)).toBe(true);
    });

    it('should generate PAGE_ACTION_CATALOG.md', () => {
      const mdPath = path.join(NAV_DOCS_DIR, 'PAGE_ACTION_CATALOG.md');
      expect(fs.existsSync(mdPath)).toBe(true);
    });

    it(`should have at least ${MIN_ANNOTATED_PAGES} annotated pages`, () => {
      const jsonPath = path.join(NAV_REPORTS_DIR, 'page-actions.json');
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      expect(data.pageCount).toBeGreaterThanOrEqual(MIN_ANNOTATED_PAGES);
    });

    it('should have valid page structure for each page', () => {
      const jsonPath = path.join(NAV_REPORTS_DIR, 'page-actions.json');
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      for (const [pageId, page] of Object.entries(data.pages)) {
        const p = page as any;
        expect(p.id).toBe(pageId);
        expect(p.title).toBeTruthy();
        expect(['LOW', 'MEDIUM', 'HIGH']).toContain(p.risk);
        expect(Array.isArray(p.primaryActions)).toBe(true);
        expect(Array.isArray(p.apiCalls)).toBe(true);
      }
    });

    it('should have deterministic ordering (sorted by page id)', () => {
      const jsonPath = path.join(NAV_REPORTS_DIR, 'page-actions.json');
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      const pageIds = Object.keys(data.pages);
      const sortedIds = [...pageIds].sort();
      expect(pageIds).toEqual(sortedIds);
    });
  });
});
