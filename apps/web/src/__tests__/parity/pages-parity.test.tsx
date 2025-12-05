// M34-FE-PARITY-S3: Page-level parity smoke tests
// Verifies that critical backend feature pages exist as files
// This is a lightweight check that pages are properly created and available as routes

import * as fs from 'fs';
import * as path from 'path';

describe('Backend ↔ Frontend parity – page existence tests', () => {
  const pagesDir = path.join(__dirname, '../../pages');

  it('has analytics overview page', () => {
    const filePath = path.join(pagesDir, 'analytics/index.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('has reports hub page', () => {
    const filePath = path.join(pagesDir, 'reports/index.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('has budgets & variance page', () => {
    const filePath = path.join(pagesDir, 'reports/budgets.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('has staff insights page', () => {
    const filePath = path.join(pagesDir, 'staff/insights.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('has feedback & NPS page', () => {
    const filePath = path.join(pagesDir, 'feedback/index.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('has inventory page', () => {
    const filePath = path.join(pagesDir, 'inventory/index.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('has dev portal page', () => {
    const filePath = path.join(pagesDir, 'dev/index.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('has billing page', () => {
    const filePath = path.join(pagesDir, 'billing/index.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('has POS page', () => {
    const filePath = path.join(pagesDir, 'pos/index.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('has KDS page', () => {
    const filePath = path.join(pagesDir, 'kds/index.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('has staff listing page', () => {
    const filePath = path.join(pagesDir, 'staff/index.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('has finance page', () => {
    const filePath = path.join(pagesDir, 'finance/index.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('has reservations page', () => {
    const filePath = path.join(pagesDir, 'reservations/index.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('has documents page', () => {
    const filePath = path.join(pagesDir, 'documents/index.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('has settings page', () => {
    const filePath = path.join(pagesDir, 'settings/index.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
