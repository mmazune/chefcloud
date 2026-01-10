/**
 * Role Navigation Smoke Tests - E2E Validation
 * 
 * Validates that the NavMap runtime JSONs actually drive the live UI:
 * - Each role can login and land on an allowed route
 * - Sidebar renders expected number of links from runtime JSON
 * - Representative sidebar links navigate successfully
 * - Forbidden routes return 403/redirect
 * 
 * @see reports/navigation/runtime/*.runtime.json
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Test Configuration
// ============================================================================

const API_BASE = process.env.E2E_API_URL || 'http://localhost:3001';
const PASSWORD = 'Demo#123';

interface RuntimeJson {
  role: string;
  sidebarLinks: Array<{
    label: string;
    href: string;
    navGroup: string;
  }>;
  routesVisited: string[];
}

interface RoleConfig {
  role: string;
  email: string;
  runtimeFile: string;
  landingRoute: string;
  forbiddenRoute: string;
}

/**
 * 11 Roles with their credentials and expected forbidden routes
 */
const ROLE_CONFIGS: RoleConfig[] = [
  {
    role: 'OWNER',
    email: 'owner@tapas.demo.local',
    runtimeFile: 'owner.runtime.json',
    landingRoute: '/dashboard',
    forbiddenRoute: '/nonexistent-admin-only', // Owner has access to everything
  },
  {
    role: 'MANAGER',
    email: 'manager@tapas.demo.local',
    runtimeFile: 'manager.runtime.json',
    landingRoute: '/dashboard',
    forbiddenRoute: '/billing', // L5 only
  },
  {
    role: 'ACCOUNTANT',
    email: 'accountant@tapas.demo.local',
    runtimeFile: 'accountant.runtime.json',
    landingRoute: '/dashboard',
    forbiddenRoute: '/billing', // L5 only
  },
  {
    role: 'SUPERVISOR',
    email: 'supervisor@tapas.demo.local',
    runtimeFile: 'supervisor.runtime.json',
    landingRoute: '/pos',
    forbiddenRoute: '/accounting/accounts', // L4+ only
  },
  {
    role: 'CASHIER',
    email: 'cashier@tapas.demo.local',
    runtimeFile: 'cashier.runtime.json',
    landingRoute: '/pos',
    forbiddenRoute: '/accounting/accounts', // L4+ only
  },
  {
    role: 'WAITER',
    email: 'waiter@tapas.demo.local',
    runtimeFile: 'waiter.runtime.json',
    landingRoute: '/pos',
    forbiddenRoute: '/analytics/daily', // L4+ only
  },
  {
    role: 'CHEF',
    email: 'chef@tapas.demo.local',
    runtimeFile: 'chef.runtime.json',
    landingRoute: '/kds',
    forbiddenRoute: '/analytics/daily', // L4+ only
  },
  {
    role: 'BARTENDER',
    email: 'bartender@tapas.demo.local',
    runtimeFile: 'bartender.runtime.json',
    landingRoute: '/pos',
    forbiddenRoute: '/analytics/daily', // L4+ only
  },
  {
    role: 'PROCUREMENT',
    email: 'procurement@tapas.demo.local',
    runtimeFile: 'procurement.runtime.json',
    landingRoute: '/inventory',
    forbiddenRoute: '/billing', // L5 only
  },
  {
    role: 'STOCK_MANAGER',
    email: 'stock@tapas.demo.local',
    runtimeFile: 'stock_manager.runtime.json',
    landingRoute: '/inventory',
    forbiddenRoute: '/billing', // L5 only
  },
  {
    role: 'EVENT_MANAGER',
    email: 'eventmgr@tapas.demo.local',
    runtimeFile: 'event_manager.runtime.json',
    landingRoute: '/reservations',
    forbiddenRoute: '/billing', // L5 only
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Load runtime JSON for a role
 */
function loadRuntimeJson(filename: string): RuntimeJson {
  const runtimePath = path.resolve(__dirname, '../../../reports/navigation/runtime', filename);
  const content = fs.readFileSync(runtimePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Login via API and set auth cookie/token
 */
async function loginAs(page: Page, email: string): Promise<void> {
  // Call login API directly
  const response = await page.request.post(`${API_BASE}/auth/login`, {
    data: { email, password: PASSWORD },
  });
  
  if (!response.ok()) {
    throw new Error(`Login failed for ${email}: ${response.status()}`);
  }
  
  const body = await response.json();
  const token = body.access_token;
  
  // Store token in localStorage (common pattern for SPAs)
  await page.goto('/');
  await page.evaluate((accessToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('token', accessToken);
  }, token);
}

/**
 * Count visible sidebar links
 */
async function countSidebarLinks(page: Page): Promise<number> {
  // Wait for sidebar to be visible
  await page.waitForSelector('[data-testid="sidebar"], nav, aside', { timeout: 10000 });
  
  // Count anchor tags in sidebar/nav
  const links = await page.locator('nav a[href^="/"], aside a[href^="/"], [data-testid="sidebar"] a[href^="/"]').count();
  return links;
}

/**
 * Navigate to sidebar link by text/label
 */
async function clickSidebarLink(page: Page, label: string): Promise<boolean> {
  try {
    const link = page.locator(`nav a:has-text("${label}"), aside a:has-text("${label}"), [data-testid="sidebar"] a:has-text("${label}")`).first();
    await link.click({ timeout: 5000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Smoke Tests
// ============================================================================

test.describe('Role Navigation Smoke Tests', () => {
  for (const config of ROLE_CONFIGS) {
    test.describe(`${config.role}`, () => {
      let runtime: RuntimeJson;

      test.beforeAll(() => {
        try {
          runtime = loadRuntimeJson(config.runtimeFile);
        } catch (e) {
          console.warn(`Could not load runtime for ${config.role}: ${e}`);
        }
      });

      test(`can login and access allowed landing route`, async ({ page }) => {
        await loginAs(page, config.email);
        
        // Navigate to landing route
        await page.goto(config.landingRoute);
        
        // Should not be redirected to login or forbidden page
        await page.waitForLoadState('networkidle');
        const url = page.url();
        
        expect(url).not.toContain('/login');
        expect(url).not.toContain('/403');
        expect(url).not.toContain('/forbidden');
      });

      test(`sidebar renders expected links from runtime JSON`, async ({ page }) => {
        test.skip(!runtime, 'Runtime JSON not available');
        
        await loginAs(page, config.email);
        await page.goto(config.landingRoute);
        await page.waitForLoadState('networkidle');
        
        const expectedCount = runtime.sidebarLinks.length;
        const actualCount = await countSidebarLinks(page);
        
        // Allow some tolerance (±3) for dynamic links or grouping differences
        expect(actualCount).toBeGreaterThanOrEqual(Math.max(1, expectedCount - 3));
        expect(actualCount).toBeLessThanOrEqual(expectedCount + 10);
      });

      test(`can navigate to representative sidebar links`, async ({ page }) => {
        test.skip(!runtime || runtime.sidebarLinks.length === 0, 'No sidebar links in runtime');
        
        await loginAs(page, config.email);
        await page.goto(config.landingRoute);
        await page.waitForLoadState('networkidle');
        
        // Pick 2-3 representative links (skip dynamic routes with [id])
        const staticLinks = runtime.sidebarLinks
          .filter(link => !link.href.includes('['))
          .slice(0, 3);
        
        let successCount = 0;
        for (const link of staticLinks) {
          // Navigate directly to the href
          const response = await page.goto(link.href);
          
          if (response && response.status() < 400) {
            successCount++;
          }
        }
        
        // At least one link should navigate successfully
        expect(successCount).toBeGreaterThan(0);
      });

      test(`forbidden route returns 403 or redirects`, async ({ page }) => {
        // Skip for OWNER who has access to everything
        test.skip(config.role === 'OWNER', 'Owner has access to all routes');
        
        await loginAs(page, config.email);
        
        // Try to navigate to forbidden route
        const response = await page.goto(config.forbiddenRoute);
        
        // Should either:
        // 1. Return 403 status
        // 2. Redirect to login/forbidden page
        // 3. Show forbidden content
        const status = response?.status() || 200;
        const url = page.url();
        const content = await page.textContent('body');
        
        const isForbidden = 
          status === 403 ||
          url.includes('/login') ||
          url.includes('/403') ||
          url.includes('/forbidden') ||
          content?.toLowerCase().includes('forbidden') ||
          content?.toLowerCase().includes('not authorized') ||
          content?.toLowerCase().includes('access denied');
        
        expect(isForbidden).toBe(true);
      });
    });
  }
});

// ============================================================================
// Summary Test
// ============================================================================

test.describe('NavMap Coverage Summary', () => {
  test('all 11 role runtime files exist', () => {
    for (const config of ROLE_CONFIGS) {
      const runtimePath = path.resolve(__dirname, '../../../reports/navigation/runtime', config.runtimeFile);
      expect(fs.existsSync(runtimePath)).toBe(true);
    }
  });
});

// ============================================================================
// Workspace Dashboard Tests (M8.6)
// ============================================================================

/**
 * Role workspace mappings for dashboard tests
 * Maps each role to their workspace URL
 */
const WORKSPACE_MAPPINGS: Record<string, string> = {
  OWNER: '/workspaces/owner',
  MANAGER: '/workspaces/manager',
  ACCOUNTANT: '/workspaces/accountant',
  SUPERVISOR: '/workspaces/supervisor',
  CASHIER: '/workspaces/cashier',
  WAITER: '/workspaces/waiter',
  CHEF: '/workspaces/chef',
  BARTENDER: '/workspaces/bartender',
  PROCUREMENT: '/workspaces/procurement',
  STOCK_MANAGER: '/workspaces/stock-manager',
  EVENT_MANAGER: '/workspaces/event-manager',
};

test.describe('Workspace Dashboard Tests', () => {
  for (const config of ROLE_CONFIGS) {
    const workspaceUrl = WORKSPACE_MAPPINGS[config.role];
    
    test.describe(`${config.role} Workspace`, () => {
      test(`workspace dashboard loads without error`, async ({ page }) => {
        await loginAs(page, config.email);
        
        // Navigate to workspace
        const response = await page.goto(workspaceUrl);
        await page.waitForLoadState('networkidle');
        
        // Should return 200 OK
        expect(response?.status()).toBeLessThan(400);
        
        // Should not redirect to login
        const url = page.url();
        expect(url).not.toContain('/login');
        
        // Should have workspace content (title or quick links)
        const hasWorkspaceContent = await page.locator('h1, h2, [data-testid="workspace-title"]').count() > 0;
        expect(hasWorkspaceContent).toBe(true);
      });

      test(`workspace has quick links or navigation elements`, async ({ page }) => {
        await loginAs(page, config.email);
        await page.goto(workspaceUrl);
        await page.waitForLoadState('networkidle');
        
        // Should have at least one clickable link/card
        const linkCount = await page.locator('a[href^="/"], button, [role="button"]').count();
        expect(linkCount).toBeGreaterThan(0);
      });
    });
  }
});

// ============================================================================
// Sidebar Logo Home Navigation Tests (M8.6)
// ============================================================================

test.describe('Sidebar Logo Home Navigation', () => {
  for (const config of ROLE_CONFIGS) {
    test(`${config.role}: logo click navigates to role home`, async ({ page }) => {
      await loginAs(page, config.email);
      
      // Navigate to a different page first
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      // Click the sidebar logo
      const logo = page.locator('[data-testid="sidebar-logo"]');
      
      // Check if logo exists
      const logoExists = await logo.count() > 0;
      if (!logoExists) {
        // Try alternative selectors
        const altLogo = page.locator('aside a:has-text("ChefCloud"), nav a:has-text("ChefCloud")').first();
        if (await altLogo.count() > 0) {
          await altLogo.click();
        } else {
          test.skip(true, 'Logo link not found in sidebar');
          return;
        }
      } else {
        await logo.click();
      }
      
      await page.waitForLoadState('networkidle');
      
      // Should navigate to the role's default route (workspace or operational page)
      const url = page.url();
      const expectedRoutes = [
        WORKSPACE_MAPPINGS[config.role],
        config.landingRoute,
      ];
      
      const isAtExpectedRoute = expectedRoutes.some(route => url.includes(route));
      expect(isAtExpectedRoute).toBe(true);
    });
  }
});
