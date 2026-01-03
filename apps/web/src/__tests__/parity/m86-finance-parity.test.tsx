/**
 * M8.6: Finance UI Parity Tests
 * 
 * Verifies that all M8.6 finance pages exist and are properly structured.
 * This is a lightweight check that pages are properly created and available as routes.
 */

import * as fs from 'fs';
import * as path from 'path';

describe('M8.6 Finance UI – page existence parity tests', () => {
  const pagesDir = path.join(__dirname, '../../pages');
  const componentsDir = path.join(__dirname, '../../components');

  describe('Finance Pages', () => {
    it('has vendor bills list page', () => {
      const filePath = path.join(pagesDir, 'finance/vendor-bills/index.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('has vendor bill detail page', () => {
      const filePath = path.join(pagesDir, 'finance/vendor-bills/[id].tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('has customer invoices list page', () => {
      const filePath = path.join(pagesDir, 'finance/customer-invoices/index.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('has customer invoice detail page', () => {
      const filePath = path.join(pagesDir, 'finance/customer-invoices/[id].tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('has credit notes page', () => {
      const filePath = path.join(pagesDir, 'finance/credit-notes/index.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('has vendors list page', () => {
      const filePath = path.join(pagesDir, 'finance/vendors/index.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('has vendor detail page', () => {
      const filePath = path.join(pagesDir, 'finance/vendors/[id].tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('has customers list page', () => {
      const filePath = path.join(pagesDir, 'finance/customers/index.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('has customer detail page', () => {
      const filePath = path.join(pagesDir, 'finance/customers/[id].tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('has payment methods page', () => {
      const filePath = path.join(pagesDir, 'finance/payment-methods/index.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Finance Shared Components', () => {
    it('has StatusBadge component', () => {
      const filePath = path.join(componentsDir, 'finance/StatusBadge.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('has BranchFilter component', () => {
      const filePath = path.join(componentsDir, 'finance/BranchFilter.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('has ExportButton component', () => {
      const filePath = path.join(componentsDir, 'finance/ExportButton.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('has ConfirmDialog component', () => {
      const filePath = path.join(componentsDir, 'finance/ConfirmDialog.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('has finance components index', () => {
      const filePath = path.join(componentsDir, 'finance/index.ts');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Page Content Verification', () => {
    it('vendor bills page imports RequireRole with L4 access', () => {
      const filePath = path.join(pagesDir, 'finance/vendor-bills/index.tsx');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('RequireRole');
      expect(content).toContain('RoleLevel.L4');
    });

    it('customer invoices page imports RequireRole with L4 access', () => {
      const filePath = path.join(pagesDir, 'finance/customer-invoices/index.tsx');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('RequireRole');
      expect(content).toContain('RoleLevel.L4');
    });

    it('credit notes page has both customer and vendor tabs', () => {
      const filePath = path.join(pagesDir, 'finance/credit-notes/index.tsx');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('Customer Credit Notes');
      expect(content).toContain('Vendor Credit Notes');
    });

    it('payment methods page includes GL account mapping', () => {
      const filePath = path.join(pagesDir, 'finance/payment-methods/index.tsx');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('GL Account');
      expect(content).toContain('glAccountId');
    });
  });
});
