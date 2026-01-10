/**
 * Phase I3: PROCUREMENT Runtime Navigation Tests
 * 
 * Tests for:
 * 1. Runtime capture file exists and has valid schema
 * 2. Critical PROCUREMENT actions have data-testid
 * 3. PROCUREMENT sidebar completeness (15 links)
 * 4. v2: Probe output schema and outcomes
 * 5. Purchase order access and actions
 * 6. Receipts/receiving access
 * 7. Supplier management actions
 * 8. API calls captured for key routes
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

interface ApiCall {
  route: string;
  method: string;
  path: string;
}

interface NavmapRoleCapture {
  role: string;
  capturedAt: string;
  captureMethod?: string;
  routesVisited: string[];
  sidebarLinks: NavmapSidebarLink[];
  actions: NavmapAction[];
  apiCalls?: ApiCall[];
}

interface ProbeResult {
  href: string;
  outcome: string;
  status?: number;
  loadTimeMs?: number;
}

interface ProbeFile {
  role: string;
  capturedAt: string;
  results: ProbeResult[];
  summary: {
    total: number;
    ok: number;
    forbidden: number;
    redirect: number;
    error: number;
  };
}

describe('PROCUREMENT Runtime Navigation (I3)', () => {
  let runtimeData: NavmapRoleCapture;
  let probeData: ProbeFile;

  beforeAll(() => {
    const runtimePath = path.join(RUNTIME_DIR, 'procurement.runtime.json');
    const probePath = path.join(RUNTIME_DIR, 'procurement.probe.json');
    
    expect(fs.existsSync(runtimePath)).toBe(true);
    expect(fs.existsSync(probePath)).toBe(true);
    
    runtimeData = JSON.parse(fs.readFileSync(runtimePath, 'utf-8'));
    probeData = JSON.parse(fs.readFileSync(probePath, 'utf-8'));
  });

  describe('Runtime Capture Schema', () => {
    it('should have procurement.runtime.json file', () => {
      const filePath = path.join(RUNTIME_DIR, 'procurement.runtime.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have valid capture schema', () => {
      expect(runtimeData.role).toBe('PROCUREMENT');
      expect(runtimeData.capturedAt).toBeDefined();
      expect(Array.isArray(runtimeData.routesVisited)).toBe(true);
      expect(Array.isArray(runtimeData.sidebarLinks)).toBe(true);
      expect(Array.isArray(runtimeData.actions)).toBe(true);
    });

    it('should have /workspaces/procurement in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/workspaces/procurement');
    });

    it('should have /inventory/purchase-orders in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/inventory/purchase-orders');
    });

    it('should have /inventory/receipts in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/inventory/receipts');
    });

    it('should have /service-providers in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/service-providers');
    });
  });

  describe('Probe Schema', () => {
    it('should have procurement.probe.json file', () => {
      const filePath = path.join(RUNTIME_DIR, 'procurement.probe.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have valid probe schema', () => {
      expect(probeData.role).toBe('PROCUREMENT');
      expect(Array.isArray(probeData.results)).toBe(true);
      expect(probeData.summary).toBeDefined();
    });

    it('should have all probes return ok', () => {
      expect(probeData.summary.ok).toBe(probeData.summary.total);
      expect(probeData.summary.forbidden).toBe(0);
      expect(probeData.summary.error).toBe(0);
    });
  });

  describe('Sidebar Completeness', () => {
    it('should have at least 15 sidebar links', () => {
      expect(runtimeData.sidebarLinks.length).toBeGreaterThanOrEqual(15);
    });

    it('should have Purchase Orders in sidebar', () => {
      const link = runtimeData.sidebarLinks.find(l => l.href === '/inventory/purchase-orders');
      expect(link).toBeDefined();
      expect(link?.navGroup).toBe('Procurement');
    });

    it('should have Receipts in sidebar', () => {
      const link = runtimeData.sidebarLinks.find(l => l.href === '/inventory/receipts');
      expect(link).toBeDefined();
    });

    it('should have Service Providers in sidebar', () => {
      const link = runtimeData.sidebarLinks.find(l => l.href === '/service-providers');
      expect(link).toBeDefined();
    });
  });

  describe('Critical Purchase Order Actions', () => {
    it('should have create-po-btn action with HIGH risk', () => {
      const action = runtimeData.actions.find(a => a.testId === 'create-po-btn');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/inventory/purchase-orders');
      expect(action?.attributes?.risk).toBe('HIGH');
    });

    it('should have submit-po-btn action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'submit-po-btn');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/inventory/purchase-orders/[id]');
    });

    it('should have approve-po-btn action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'approve-po-btn');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/inventory/purchase-orders/[id]');
    });

    it('should have at least 19 actions mapped', () => {
      expect(runtimeData.actions.length).toBeGreaterThanOrEqual(19);
    });
  });

  describe('Receipts/Receiving Actions', () => {
    it('should have create-receipt-btn action with HIGH risk', () => {
      const action = runtimeData.actions.find(a => a.testId === 'create-receipt-btn');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/inventory/receipts');
      expect(action?.attributes?.risk).toBe('HIGH');
    });

    it('should have finalize-receipt-btn action with HIGH risk', () => {
      const action = runtimeData.actions.find(a => a.testId === 'finalize-receipt-btn');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/inventory/receipts/[id]');
      expect(action?.attributes?.risk).toBe('HIGH');
    });
  });

  describe('Supplier Management Actions', () => {
    it('should have create-supplier-btn action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'create-supplier-btn');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/service-providers');
    });

    it('should have edit-supplier-btn action', () => {
      const action = runtimeData.actions.find(a => a.testId === 'edit-supplier-btn');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/service-providers/[id]');
    });
  });

  describe('Inventory Movement Actions', () => {
    it('should have create-transfer-btn action with HIGH risk', () => {
      const action = runtimeData.actions.find(a => a.testId === 'create-transfer-btn');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/inventory/transfers');
      expect(action?.attributes?.risk).toBe('HIGH');
    });

    it('should have record-waste-btn action with HIGH risk', () => {
      const action = runtimeData.actions.find(a => a.testId === 'record-waste-btn');
      expect(action).toBeDefined();
      expect(action?.route).toBe('/inventory/waste');
      expect(action?.attributes?.risk).toBe('HIGH');
    });
  });

  describe('API Calls Captured', () => {
    it('should have apiCalls array', () => {
      expect(Array.isArray(runtimeData.apiCalls)).toBe(true);
    });

    it('should have at least 30 API calls captured', () => {
      expect(runtimeData.apiCalls?.length).toBeGreaterThanOrEqual(30);
    });

    it('should have purchase order API calls', () => {
      const poCalls = runtimeData.apiCalls?.filter(c => c.path.includes('/inventory/purchase-orders'));
      expect(poCalls?.length).toBeGreaterThanOrEqual(1);
    });

    it('should have receipts API calls', () => {
      const receiptCalls = runtimeData.apiCalls?.filter(c => c.path.includes('/inventory/receipts'));
      expect(receiptCalls?.length).toBeGreaterThanOrEqual(1);
    });

    it('should have service-providers API calls', () => {
      const supplierCalls = runtimeData.apiCalls?.filter(c => c.path.includes('/service-providers'));
      expect(supplierCalls?.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('My Schedule Access', () => {
    it('should have /workforce/my-availability in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/workforce/my-availability');
    });

    it('should have /workforce/my-swaps in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/workforce/my-swaps');
    });

    it('should have /workforce/open-shifts in routes visited', () => {
      expect(runtimeData.routesVisited).toContain('/workforce/open-shifts');
    });
  });
});
