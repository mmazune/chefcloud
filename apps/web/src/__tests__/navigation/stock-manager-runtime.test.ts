import * as fs from 'fs';
import * as path from 'path';

describe('STOCK_MANAGER Runtime Navigation', () => {
  const runtimePath = path.join(__dirname, '../../../../../reports/navigation/runtime/stock_manager.runtime.json');
  const probePath = path.join(__dirname, '../../../../../reports/navigation/runtime/stock_manager.probe.json');
  
  let runtime: {
    role: string;
    routesVisited: string[];
    sidebarLinks: Array<{ label: string; href: string; probeOutcome: string }>;
    actions: Array<{ route: string; testId: string; label: string; attributes?: { risk: string } }>;
    apiCalls: Array<{ route: string; method: string; path: string }>;
  };
  
  let probe: {
    totalLinks: number;
    passedLinks: number;
    failedLinks: number;
    results: Array<{ label: string; href: string; outcome: string; httpStatus: number }>;
  };

  beforeAll(() => {
    const runtimeContent = fs.readFileSync(runtimePath, 'utf-8');
    runtime = JSON.parse(runtimeContent);
    
    const probeContent = fs.readFileSync(probePath, 'utf-8');
    probe = JSON.parse(probeContent);
  });

  describe('Runtime Schema', () => {
    it('should have role set to STOCK_MANAGER', () => {
      expect(runtime.role).toBe('STOCK_MANAGER');
    });

    it('should have routesVisited array', () => {
      expect(Array.isArray(runtime.routesVisited)).toBe(true);
      expect(runtime.routesVisited.length).toBeGreaterThan(0);
    });

    it('should have sidebarLinks array', () => {
      expect(Array.isArray(runtime.sidebarLinks)).toBe(true);
      expect(runtime.sidebarLinks.length).toBeGreaterThan(0);
    });

    it('should have actions array', () => {
      expect(Array.isArray(runtime.actions)).toBe(true);
      expect(runtime.actions.length).toBeGreaterThan(0);
    });

    it('should have apiCalls array', () => {
      expect(Array.isArray(runtime.apiCalls)).toBe(true);
      expect(runtime.apiCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Required Routes', () => {
    const requiredRoutes = [
      '/workspaces/stock-manager',
      '/dashboard',
      '/inventory',
      '/inventory/transfers',
      '/inventory/waste',
      '/inventory/stocktakes',
      '/inventory/lots',
      '/reports',
      '/settings'
    ];

    requiredRoutes.forEach((route) => {
      it(`should include route: ${route}`, () => {
        expect(runtime.routesVisited).toContain(route);
      });
    });
  });

  describe('Sidebar Links', () => {
    it('should have at least 14 sidebar links', () => {
      expect(runtime.sidebarLinks.length).toBeGreaterThanOrEqual(14);
    });

    it('should have all links with OK probe outcome', () => {
      runtime.sidebarLinks.forEach((link) => {
        expect(link.probeOutcome).toBe('ok');
      });
    });
  });

  describe('Stock Manager Actions', () => {
    const stockManagerActions = [
      { testId: 'create-stocktake-btn', label: 'New Stocktake' },
      { testId: 'submit-stocktake-btn', label: 'Submit Count' },
      { testId: 'approve-stocktake-btn', label: 'Approve Stocktake' },
      { testId: 'create-transfer-btn', label: 'Create Transfer' },
      { testId: 'record-waste-btn', label: 'Record Waste' },
      { testId: 'quarantine-lot-btn', label: 'Quarantine Lot' },
      { testId: 'recall-lot-btn', label: 'Recall Lot' }
    ];

    stockManagerActions.forEach(({ testId, label }) => {
      it(`should have action: ${label} (${testId})`, () => {
        const action = runtime.actions.find((a) => a.testId === testId);
        expect(action).toBeDefined();
        expect(action?.label).toBe(label);
      });
    });
  });

  describe('HIGH Risk Actions', () => {
    const highRiskActions = [
      'adjust-stock-btn',
      'create-adjustment-btn',
      'create-transfer-btn',
      'complete-transfer-btn',
      'record-waste-btn',
      'approve-waste-btn',
      'create-stocktake-btn',
      'submit-stocktake-btn',
      'approve-stocktake-btn',
      'quarantine-lot-btn',
      'recall-lot-btn',
      'initiate-close-btn',
      'approve-close-btn'
    ];

    it('should have exactly 13 HIGH risk actions', () => {
      const highRiskCount = runtime.actions.filter(
        (a) => a.attributes?.risk === 'HIGH'
      ).length;
      expect(highRiskCount).toBe(13);
    });

    highRiskActions.forEach((testId) => {
      it(`should tag ${testId} as HIGH risk`, () => {
        const action = runtime.actions.find((a) => a.testId === testId);
        expect(action).toBeDefined();
        expect(action?.attributes?.risk).toBe('HIGH');
      });
    });
  });

  describe('API Calls', () => {
    it('should have at least 40 API calls', () => {
      expect(runtime.apiCalls.length).toBeGreaterThanOrEqual(40);
    });

    const criticalApiCalls = [
      { method: 'POST', path: '/inventory/stocktakes' },
      { method: 'POST', path: '/inventory/stocktakes/:id/approve' },
      { method: 'POST', path: '/inventory/transfers' },
      { method: 'POST', path: '/inventory/waste' },
      { method: 'POST', path: '/inventory/lots/:id/quarantine' },
      { method: 'POST', path: '/inventory/lots/:id/recall' }
    ];

    criticalApiCalls.forEach(({ method, path: apiPath }) => {
      it(`should capture API call: ${method} ${apiPath}`, () => {
        const call = runtime.apiCalls.find(
          (c) => c.method === method && c.path === apiPath
        );
        expect(call).toBeDefined();
      });
    });
  });

  describe('Probe Results', () => {
    it('should have 100% pass rate', () => {
      expect(probe.failedLinks).toBe(0);
      expect(probe.passedLinks).toBe(probe.totalLinks);
    });

    it('should have all results with OK outcome', () => {
      probe.results.forEach((result) => {
        expect(result.outcome).toBe('ok');
        expect(result.httpStatus).toBe(200);
      });
    });
  });

  describe('Difference from PROCUREMENT', () => {
    it('should NOT have /service-providers route', () => {
      expect(runtime.routesVisited).not.toContain('/service-providers');
    });

    it('should have stocktake approval actions (PROCUREMENT does not)', () => {
      const approveStocktake = runtime.actions.find(
        (a) => a.testId === 'approve-stocktake-btn'
      );
      expect(approveStocktake).toBeDefined();
    });

    it('should have lot management actions (PROCUREMENT does not)', () => {
      const quarantineLot = runtime.actions.find(
        (a) => a.testId === 'quarantine-lot-btn'
      );
      const recallLot = runtime.actions.find(
        (a) => a.testId === 'recall-lot-btn'
      );
      expect(quarantineLot).toBeDefined();
      expect(recallLot).toBeDefined();
    });
  });
});
