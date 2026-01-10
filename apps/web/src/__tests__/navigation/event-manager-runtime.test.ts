import * as fs from 'fs';
import * as path from 'path';

describe('EVENT_MANAGER Runtime Navigation', () => {
  const runtimePath = path.join(__dirname, '../../../../../reports/navigation/runtime/event_manager.runtime.json');
  const probePath = path.join(__dirname, '../../../../../reports/navigation/runtime/event_manager.probe.json');
  
  let runtime: {
    role: string;
    routesVisited: string[];
    sidebarLinks: Array<{ label: string; href: string; probeOutcome: string }>;
    actions: Array<{ route: string; testId: string; label: string; attributes?: { risk: string } }>;
    apiCalls: Array<{ route: string; method: string; path: string }>;
    summary: { totalRoutes: number; totalSidebarLinks: number; totalActions: number; apiCallsTotal: number };
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
    it('should have role set to EVENT_MANAGER', () => {
      expect(runtime.role).toBe('EVENT_MANAGER');
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

    it('should have summary object', () => {
      expect(runtime.summary).toBeDefined();
      expect(runtime.summary.totalRoutes).toBeGreaterThan(0);
      expect(runtime.summary.apiCallsTotal).toBeGreaterThan(0);
    });
  });

  describe('Required Routes', () => {
    const requiredRoutes = [
      '/workspaces/event-manager',
      '/dashboard',
      '/reservations',
      '/pos',
      '/staff',
      '/settings'
    ];

    requiredRoutes.forEach((route) => {
      it(`should include route: ${route}`, () => {
        expect(runtime.routesVisited).toContain(route);
      });
    });
  });

  describe('Reservation Sub-routes', () => {
    const reservationSubRoutes = [
      '/reservations/calendar',
      '/reservations/policies',
      '/reservations/today-board',
      '/reservations/blackouts'
    ];

    reservationSubRoutes.forEach((route) => {
      it(`should include reservation sub-route: ${route}`, () => {
        expect(runtime.routesVisited).toContain(route);
      });
    });
  });

  describe('Sidebar Links', () => {
    it('should have at least 8 sidebar links', () => {
      expect(runtime.sidebarLinks.length).toBeGreaterThanOrEqual(8);
    });

    it('should have all links with OK probe outcome', () => {
      runtime.sidebarLinks.forEach((link) => {
        expect(link.probeOutcome).toBe('ok');
      });
    });

    it('should include Reservations link', () => {
      const reservationsLink = runtime.sidebarLinks.find((l) => l.href === '/reservations');
      expect(reservationsLink).toBeDefined();
      expect(reservationsLink?.label).toBe('Reservations');
    });
  });

  describe('Reservation Actions', () => {
    const reservationActions = [
      { testId: 'reservation-confirm', label: 'Confirm' },
      { testId: 'reservation-cancel', label: 'Cancel' },
      { testId: 'reservation-seat', label: 'Seat' },
      { testId: 'reservation-no-show', label: 'No-Show' },
      { testId: 'reservation-complete', label: 'Complete' },
      { testId: 'reservation-cancel-confirmed', label: 'Cancel (Confirmed)' }
    ];

    reservationActions.forEach(({ testId, label }) => {
      it(`should have reservation action: ${label} (${testId})`, () => {
        const action = runtime.actions.find((a) => a.testId === testId);
        expect(action).toBeDefined();
        expect(action?.label).toBe(label);
        expect(action?.route).toBe('/reservations');
      });
    });
  });

  describe('Waitlist Actions', () => {
    const waitlistActions = [
      { testId: 'waitlist-add-party', label: 'Add Party' },
      { testId: 'waitlist-seat-party', label: 'Seat Party' },
      { testId: 'waitlist-remove', label: 'Remove' }
    ];

    waitlistActions.forEach(({ testId, label }) => {
      it(`should have waitlist action: ${label} (${testId})`, () => {
        const action = runtime.actions.find((a) => a.testId === testId);
        expect(action).toBeDefined();
        expect(action?.label).toBe(label);
        expect(action?.route).toBe('/waitlist');
      });
    });
  });

  describe('Navigation Actions', () => {
    it('should have nav-to-policies action', () => {
      const action = runtime.actions.find((a) => a.testId === 'reservation-nav-policies');
      expect(action).toBeDefined();
    });

    it('should have nav-to-calendar action', () => {
      const action = runtime.actions.find((a) => a.testId === 'reservation-nav-calendar');
      expect(action).toBeDefined();
    });
  });

  describe('API Calls', () => {
    it('should have at least 30 API calls', () => {
      expect(runtime.apiCalls.length).toBeGreaterThanOrEqual(30);
    });

    it('should have /reservations route with at least 1 API call', () => {
      const reservationCalls = runtime.apiCalls.filter((c) => c.route === '/reservations');
      expect(reservationCalls.length).toBeGreaterThanOrEqual(1);
    });

    const criticalApiCalls = [
      { method: 'GET', path: '/reservations' },
      { method: 'POST', path: '/reservations/:id/confirm' },
      { method: 'POST', path: '/reservations/:id/cancel' },
      { method: 'POST', path: '/reservations/:id/seat' },
      { method: 'POST', path: '/reservations/:id/no-show' },
      { method: 'POST', path: '/reservations/:id/complete' }
    ];

    criticalApiCalls.forEach(({ method, path: apiPath }) => {
      it(`should capture API call: ${method} ${apiPath}`, () => {
        const call = runtime.apiCalls.find(
          (c) => c.method === method && c.path === apiPath
        );
        expect(call).toBeDefined();
      });
    });

    it('should have waitlist API calls', () => {
      const waitlistCalls = runtime.apiCalls.filter((c) => c.route === '/waitlist');
      expect(waitlistCalls.length).toBeGreaterThanOrEqual(1);
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

    it('should have reservations link probed', () => {
      const reservationsProbe = probe.results.find((r) => r.href === '/reservations');
      expect(reservationsProbe).toBeDefined();
      expect(reservationsProbe?.outcome).toBe('ok');
    });
  });

  describe('Role-specific Characteristics', () => {
    it('should have Events nav group with Dashboard and Reservations', () => {
      const eventsLinks = runtime.sidebarLinks.filter((l) => l.navGroup === 'Events');
      expect(eventsLinks.length).toBeGreaterThanOrEqual(2);
    });

    it('should have Operations nav group with POS and Staff', () => {
      const opsLinks = runtime.sidebarLinks.filter((l) => l.navGroup === 'Operations');
      expect(opsLinks.length).toBeGreaterThanOrEqual(2);
    });

    it('should NOT have Workforce configuration routes (Manager-only)', () => {
      expect(runtime.routesVisited).not.toContain('/workforce/schedule');
      expect(runtime.routesVisited).not.toContain('/workforce/approvals');
    });

    it('should NOT have Finance routes (Accountant/Owner-only)', () => {
      expect(runtime.routesVisited).not.toContain('/finance/journal');
      expect(runtime.routesVisited).not.toContain('/finance/accounts');
    });
  });
});
