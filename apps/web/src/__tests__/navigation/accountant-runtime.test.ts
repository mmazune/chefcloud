/**
 * Phase I3: ACCOUNTANT Runtime Navigation Tests
 * 
 * Tests for:
 * 1. Runtime capture file exists and has valid schema
 * 2. Critical ACCOUNTANT actions have data-testid
 * 3. ACCOUNTANT sidebar completeness (15 links)
 * 4. v2: Probe output schema and outcomes
 * 5. Journal Entries access and HIGH risk actions
 * 6. Financial statements access
 * 7. Period management actions
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
}

interface ProbeFile {
  role: string;
  capturedAt: string;
  totalLinks: number;
  results: NavmapProbeResult[];
  summary: {
    ok: number;
    redirect: number;
    forbidden: number;
    error: number;
  };
}

describe('ACCOUNTANT Runtime Navigation (I3)', () => {
  let runtimeData: NavmapRoleCapture;
  let probeData: ProbeFile;

  beforeAll(() => {
    const runtimePath = path.join(RUNTIME_DIR, 'accountant.runtime.json');
    const probePath = path.join(RUNTIME_DIR, 'accountant.probe.json');
    
    expect(fs.existsSync(runtimePath)).toBe(true);
    expect(fs.existsSync(probePath)).toBe(true);
    
    runtimeData = JSON.parse(fs.readFileSync(runtimePath, 'utf-8'));
    probeData = JSON.parse(fs.readFileSync(probePath, 'utf-8'));
  });

  describe('Runtime Capture Schema', () => {
    it('should have accountant.runtime.json file', () => {
      const filePath = path.join(RUNTIME_DIR, 'accountant.runtime.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have valid capture schema', () => {
      expect(runtimeData.role).toBe('ACCOUNTANT');
      expect(runtimeData.capturedAt).toBeDefined();
      expect(Array.isArray(runtimeData.routesVisited)).toBe(true);
      expect(Array.isArray(runtimeData.sidebarLinks)).toBe(true);
      expect(Array.isArray(runtimeData.actions)).toBe(true);
    });

    it('should have /workspaces/accountant in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/workspaces/accountant');
    });

    it('should have /finance/journal in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/finance/journal');
    });

    it('should have /finance/trial-balance in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/finance/trial-balance');
    });

    it('should have /finance/periods in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/finance/periods');
    });
  });

  describe('ACCOUNTANT Sidebar Completeness', () => {
    it('should have exactly 15 sidebar links', () => {
      expect(runtimeData.sidebarLinks.length).toBe(15);
    });

    it('should have General Ledger group with 3 links', () => {
      const glLinks = runtimeData.sidebarLinks.filter(l => l.navGroup === 'General Ledger');
      expect(glLinks.length).toBe(3);
    });

    it('should have Financial Statements group with 3 links', () => {
      const fsLinks = runtimeData.sidebarLinks.filter(l => l.navGroup === 'Financial Statements');
      expect(fsLinks.length).toBe(3);
    });

    it('should have Payables & Receivables group with 3 links', () => {
      const prLinks = runtimeData.sidebarLinks.filter(l => l.navGroup === 'Payables & Receivables');
      expect(prLinks.length).toBe(3);
    });

    it('should have Budgets & Reports group with 3 links', () => {
      const brLinks = runtimeData.sidebarLinks.filter(l => l.navGroup === 'Budgets & Reports');
      expect(brLinks.length).toBe(3);
    });

    it('should have My Schedule group with 3 links', () => {
      const msLinks = runtimeData.sidebarLinks.filter(l => l.navGroup === 'My Schedule');
      expect(msLinks.length).toBe(3);
    });
  });

  describe('Critical ACCOUNTANT Journal Actions', () => {
    it('should have journal-create action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'journal-create');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/finance/journal');
      expect(action?.attributes?.risk).toBe('HIGH');
    });

    it('should have journal-submit action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'journal-submit');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/finance/journal');
      expect(action?.attributes?.risk).toBe('HIGH');
    });

    it('should have journal-post action (HIGH risk)', () => {
      const action = runtimeData.actions.find(a => a.testId === 'journal-post');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/finance/journal');
      expect(action?.attributes?.risk).toBe('HIGH');
    });

    it('should have journal-reverse action (HIGH risk)', () => {
      const action = runtimeData.actions.find(a => a.testId === 'journal-reverse');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/finance/journal');
      expect(action?.attributes?.risk).toBe('HIGH');
    });
  });

  describe('ACCOUNTANT Period Management Actions', () => {
    it('should have period-close action (HIGH risk)', () => {
      const action = runtimeData.actions.find(a => a.testId === 'period-close');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/finance/periods');
      expect(action?.attributes?.risk).toBe('HIGH');
    });
  });

  describe('ACCOUNTANT Financial Statement Actions', () => {
    it('should have trial balance generate action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'tb-generate');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/finance/trial-balance');
    });

    it('should have trial balance export action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'tb-export');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/finance/trial-balance');
    });

    it('should have P&L generate action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'pnl-generate');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/finance/pnl');
    });

    it('should have P&L export action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'pnl-export');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/finance/pnl');
    });

    it('should have balance sheet generate action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'bs-generate');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/finance/balance-sheet');
    });

    it('should have balance sheet export action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'bs-export');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/finance/balance-sheet');
    });
  });

  describe('ACCOUNTANT Chart of Accounts Actions', () => {
    it('should have clear filters action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'coa-clear-filters');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/finance/accounts');
    });
  });

  describe('ACCOUNTANT Action Count', () => {
    it('should have at least 12 actions mapped', () => {
      expect(runtimeData.actions.length).toBeGreaterThanOrEqual(12);
    });

    it('should have exactly 5 HIGH risk actions', () => {
      const highRiskActions = runtimeData.actions.filter(a => a.attributes?.risk === 'HIGH');
      expect(highRiskActions.length).toBe(5);
    });
  });

  describe('Probe Output (v2)', () => {
    it('should have accountant.probe.json file', () => {
      const filePath = path.join(RUNTIME_DIR, 'accountant.probe.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have valid probe schema', () => {
      expect(probeData.role).toBe('ACCOUNTANT');
      expect(probeData.totalLinks).toBe(15);
      expect(Array.isArray(probeData.results)).toBe(true);
      expect(probeData.summary).toBeDefined();
    });

    it('should have 100% OK probe results', () => {
      expect(probeData.summary.ok).toBe(15);
      expect(probeData.summary.error).toBe(0);
      expect(probeData.summary.forbidden).toBe(0);
    });

    it('all probe results should have outcome ok', () => {
      const allOk = probeData.results.every(r => r.outcome === 'ok');
      expect(allOk).toBe(true);
    });
  });

  describe('General Ledger Routes Probe', () => {
    it('/finance/accounts should probe as ok', () => {
      const result = probeData.results.find(r => r.href === '/finance/accounts');
      expect(result?.outcome).toBe('ok');
    });

    it('/finance/journal should probe as ok', () => {
      const result = probeData.results.find(r => r.href === '/finance/journal');
      expect(result?.outcome).toBe('ok');
    });

    it('/finance/periods should probe as ok', () => {
      const result = probeData.results.find(r => r.href === '/finance/periods');
      expect(result?.outcome).toBe('ok');
    });
  });

  describe('Financial Statements Routes Probe', () => {
    it('/finance/trial-balance should probe as ok', () => {
      const result = probeData.results.find(r => r.href === '/finance/trial-balance');
      expect(result?.outcome).toBe('ok');
    });

    it('/finance/pnl should probe as ok', () => {
      const result = probeData.results.find(r => r.href === '/finance/pnl');
      expect(result?.outcome).toBe('ok');
    });

    it('/finance/balance-sheet should probe as ok', () => {
      const result = probeData.results.find(r => r.href === '/finance/balance-sheet');
      expect(result?.outcome).toBe('ok');
    });
  });

  describe('My Schedule Routes Probe', () => {
    it('/workforce/my-availability should probe as ok', () => {
      const result = probeData.results.find(r => r.href === '/workforce/my-availability');
      expect(result?.outcome).toBe('ok');
    });

    it('/workforce/my-swaps should probe as ok', () => {
      const result = probeData.results.find(r => r.href === '/workforce/my-swaps');
      expect(result?.outcome).toBe('ok');
    });

    it('/workforce/open-shifts should probe as ok', () => {
      const result = probeData.results.find(r => r.href === '/workforce/open-shifts');
      expect(result?.outcome).toBe('ok');
    });
  });
});
