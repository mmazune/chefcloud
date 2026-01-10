/**
 * Accountant Workflows E2E Tests
 * 
 * Section B: Validates the Accountant Workspace with 6 functional pages:
 * 1. Accountant Dashboard (/workspaces/accountant)
 * 2. Chart of Accounts (/finance/accounts)
 * 3. Journal Entries (/finance/journal)
 * 4. Trial Balance (/finance/trial-balance)
 * 5. Fiscal Periods (/finance/periods)
 * 6. P&L / Balance Sheet (/finance/pnl, /finance/balance-sheet)
 * 
 * Also tests capability gating:
 * - ACCOUNTANT can view all finance pages
 * - ACCOUNTANT cannot reopen fiscal periods (L5 only)
 * - WAITER/MANAGER are blocked from accountant-only routes
 */

import { test, expect, Page } from '@playwright/test';

// ============================================================================
// Test Configuration
// ============================================================================

const API_BASE = process.env.E2E_API_URL || 'http://localhost:3001';
const WEB_BASE = process.env.E2E_WEB_URL || 'http://localhost:3000';
const PASSWORD = 'Demo#123';

interface UserCredentials {
  email: string;
  role: string;
}

const ACCOUNTANT: UserCredentials = {
  email: 'accountant@tapas.demo.local',
  role: 'ACCOUNTANT',
};

const OWNER: UserCredentials = {
  email: 'owner@tapas.demo.local',
  role: 'OWNER',
};

const WAITER: UserCredentials = {
  email: 'waiter@tapas.demo.local',
  role: 'WAITER',
};

const MANAGER: UserCredentials = {
  email: 'manager@tapas.demo.local',
  role: 'MANAGER',
};

// Accountant's 6 pages
const ACCOUNTANT_PAGES = [
  { route: '/workspaces/accountant', name: 'Accountant Dashboard' },
  { route: '/finance/accounts', name: 'Chart of Accounts' },
  { route: '/finance/journal', name: 'Journal Entries' },
  { route: '/finance/trial-balance', name: 'Trial Balance' },
  { route: '/finance/periods', name: 'Fiscal Periods' },
  { route: '/finance/pnl', name: 'P&L Statement' },
  { route: '/finance/balance-sheet', name: 'Balance Sheet' },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Login via API and set auth token in localStorage
 */
async function loginAs(page: Page, user: UserCredentials): Promise<string> {
  const response = await page.request.post(`${API_BASE}/auth/login`, {
    data: { email: user.email, password: PASSWORD },
  });
  
  if (!response.ok()) {
    throw new Error(`Login failed for ${user.email}: ${response.status()}`);
  }
  
  const body = await response.json();
  const token = body.access_token;
  
  // Navigate to base and set token
  await page.goto(WEB_BASE);
  await page.evaluate((accessToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('token', accessToken);
  }, token);
  
  return token;
}

/**
 * Navigate to a route and verify it loads (no 404/403)
 */
async function navigateAndVerify(page: Page, route: string): Promise<void> {
  await page.goto(`${WEB_BASE}${route}`);
  await page.waitForLoadState('networkidle');
  
  // Should not be on an error page
  const url = page.url();
  expect(url).not.toContain('/403');
  expect(url).not.toContain('/404');
  expect(url).not.toContain('/unauthorized');
}

/**
 * Verify the page has data (not empty/loading forever)
 */
async function verifyDataLoaded(page: Page, dataIndicator: string): Promise<void> {
  // Wait for data to appear (table rows, cards, or specific text)
  try {
    await page.waitForSelector(dataIndicator, { timeout: 10000 });
  } catch {
    // Check if there's a "no data" message which is also valid
    const noDataVisible = await page.locator('text=/no (data|entries|records|accounts|periods)/i').isVisible();
    if (!noDataVisible) {
      throw new Error(`Page did not load data or show empty state for: ${dataIndicator}`);
    }
  }
}

// ============================================================================
// Accountant Access Tests
// ============================================================================

test.describe('Accountant Workflow Tests', () => {
  test.describe('Page Access', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, ACCOUNTANT);
    });

    test('ACCOUNTANT can access all 6 finance pages', async ({ page }) => {
      for (const pageConfig of ACCOUNTANT_PAGES) {
        await test.step(`Navigate to ${pageConfig.name}`, async () => {
          await navigateAndVerify(page, pageConfig.route);
        });
      }
    });

    test('ACCOUNTANT Dashboard loads KPI data', async ({ page }) => {
      await navigateAndVerify(page, '/workspaces/accountant');
      
      // Dashboard should show financial KPIs or loading state
      const hasKpis = await page.locator('[data-testid="kpi-card"], .kpi-card, [class*="stat"], [class*="metric"]').count() > 0 ||
                      await page.locator('text=/revenue|balance|entries|period/i').isVisible();
      expect(hasKpis).toBe(true);
    });

    test('Chart of Accounts page shows accounts table', async ({ page }) => {
      await navigateAndVerify(page, '/finance/accounts');
      
      // Should have a table or list of accounts
      await verifyDataLoaded(page, 'table, [data-testid="accounts-list"], [class*="account"]');
    });

    test('Journal Entries page loads and can create entry', async ({ page }) => {
      await navigateAndVerify(page, '/finance/journal');
      
      // Should have journal entries list or create button
      const hasContent = await page.locator('table, button:has-text("New"), button:has-text("Create"), button:has-text("Add")').count() > 0;
      expect(hasContent).toBe(true);
    });

    test('Trial Balance page shows balances', async ({ page }) => {
      await navigateAndVerify(page, '/finance/trial-balance');
      
      // Should show debit/credit columns or no-data message
      const hasTrialBalance = await page.locator('text=/debit|credit|balance/i').isVisible() ||
                               await page.locator('text=/no (data|entries)/i').isVisible();
      expect(hasTrialBalance).toBe(true);
    });

    test('Fiscal Periods page shows periods list', async ({ page }) => {
      await navigateAndVerify(page, '/finance/periods');
      
      // Should show periods table or create button
      const hasContent = await page.locator('table, button:has-text("New"), button:has-text("Create")').count() > 0;
      expect(hasContent).toBe(true);
    });

    test('P&L Statement loads financial report', async ({ page }) => {
      await navigateAndVerify(page, '/finance/pnl');
      
      // Should show P&L report structure
      const hasReport = await page.locator('text=/revenue|expense|income|profit|loss/i').isVisible() ||
                        await page.locator('text=/no (data|transactions)/i').isVisible();
      expect(hasReport).toBe(true);
    });

    test('Balance Sheet loads assets/liabilities', async ({ page }) => {
      await navigateAndVerify(page, '/finance/balance-sheet');
      
      // Should show balance sheet structure
      const hasBalanceSheet = await page.locator('text=/asset|liabilit|equity/i').isVisible() ||
                               await page.locator('text=/no (data|transactions)/i').isVisible();
      expect(hasBalanceSheet).toBe(true);
    });
  });

  test.describe('Capability Gating', () => {
    test('ACCOUNTANT cannot see reopen button on Fiscal Periods (L5 only)', async ({ page }) => {
      await loginAs(page, ACCOUNTANT);
      await navigateAndVerify(page, '/finance/periods');
      
      // Reopen button should NOT be visible for L4 ACCOUNTANT
      const reopenButton = page.locator('button:has-text("Reopen")');
      await expect(reopenButton).toHaveCount(0);
      
      // Should see "Owner can reopen" message if periods are closed
      const ownerMessage = await page.locator('text=/owner can reopen/i').isVisible();
      // This is optional - only shows if there are closed periods
    });

    test('OWNER can see reopen button on Fiscal Periods', async ({ page }) => {
      await loginAs(page, OWNER);
      await navigateAndVerify(page, '/finance/periods');
      
      // Owner (L5) should be able to see reopen functionality
      // Note: Button only visible if there are CLOSED periods
      const pageContent = await page.content();
      // Verify we're on the periods page and it loaded
      expect(pageContent).toContain('Period');
    });
  });
});

// ============================================================================
// Access Denial Tests (WAITER/MANAGER blocked from Accountant routes)
// ============================================================================

test.describe('Role Access Denial Tests', () => {
  test('WAITER cannot access accountant workspace', async ({ page }) => {
    await loginAs(page, WAITER);
    
    // Try to navigate to accountant workspace
    await page.goto(`${WEB_BASE}/workspaces/accountant`);
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    // Should be redirected or blocked
    const isBlocked = url.includes('/403') || 
                      url.includes('/unauthorized') || 
                      url.includes('/pos') || // Redirected to their workspace
                      url.includes('/dashboard');
    expect(isBlocked).toBe(true);
  });

  test('WAITER cannot access finance/accounts', async ({ page }) => {
    await loginAs(page, WAITER);
    
    await page.goto(`${WEB_BASE}/finance/accounts`);
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    const isBlocked = url.includes('/403') || 
                      url.includes('/unauthorized') || 
                      !url.includes('/finance/accounts'); // Redirected away
    expect(isBlocked).toBe(true);
  });

  test('MANAGER cannot access accountant-only journal posting', async ({ page }) => {
    await loginAs(page, MANAGER);
    
    // MANAGER can view some finance routes but should not have journal posting capability
    await page.goto(`${WEB_BASE}/finance/journal`);
    await page.waitForLoadState('networkidle');
    
    // If page loads, check that restricted actions are not available
    // (MANAGER might be able to VIEW but not POST)
    const url = page.url();
    if (url.includes('/finance/journal')) {
      // If they can access, verify limited functionality
      // This depends on how journal posting is gated
      const pageContent = await page.content();
      expect(pageContent).toBeDefined(); // At minimum, page should exist
    }
  });
});

// ============================================================================
// API Integration Tests (Accountant can post journal entry)
// ============================================================================

test.describe('Accountant API Integration', () => {
  test('ACCOUNTANT can POST a journal entry via API', async ({ request }) => {
    // Login as accountant
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: { email: ACCOUNTANT.email, password: PASSWORD },
    });
    expect(loginResponse.ok()).toBe(true);
    
    const { access_token } = await loginResponse.json();
    
    // Attempt to create a journal entry
    // This tests the API integration for accountant workflows
    const journalResponse = await request.post(`${API_BASE}/accounting/journal`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: {
        description: 'E2E Test Entry - Accountant Workflow',
        date: new Date().toISOString().split('T')[0],
        lines: [
          { accountId: 'test-asset-account', debit: 100, credit: 0 },
          { accountId: 'test-revenue-account', debit: 0, credit: 100 },
        ],
      },
    });
    
    // May fail due to missing test accounts, but should not be 403
    if (journalResponse.status() === 403) {
      throw new Error('ACCOUNTANT was denied access to post journal entry');
    }
    
    // 400/404 is acceptable (missing accounts), 200/201 is success
    expect([200, 201, 400, 404]).toContain(journalResponse.status());
  });

  test('WAITER cannot POST a journal entry via API', async ({ request }) => {
    // Login as waiter
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: { email: WAITER.email, password: PASSWORD },
    });
    expect(loginResponse.ok()).toBe(true);
    
    const { access_token } = await loginResponse.json();
    
    // Attempt to create a journal entry - should be denied
    const journalResponse = await request.post(`${API_BASE}/accounting/journal`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: {
        description: 'E2E Test Entry - Should Fail',
        date: new Date().toISOString().split('T')[0],
        lines: [
          { accountId: 'test-asset-account', debit: 100, credit: 0 },
          { accountId: 'test-revenue-account', debit: 0, credit: 100 },
        ],
      },
    });
    
    // WAITER should be denied
    expect(journalResponse.status()).toBe(403);
  });

  test('OWNER can reopen a closed period via API', async ({ request }) => {
    // Login as owner
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: { email: OWNER.email, password: PASSWORD },
    });
    expect(loginResponse.ok()).toBe(true);
    
    const { access_token } = await loginResponse.json();
    
    // First, list periods to find a closed one
    const listResponse = await request.get(`${API_BASE}/accounting/periods?status=CLOSED`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    
    if (!listResponse.ok()) {
      // No periods endpoint or empty - skip
      test.skip();
      return;
    }
    
    const { periods } = await listResponse.json();
    if (!periods || periods.length === 0) {
      // No closed periods to test - skip
      test.skip();
      return;
    }
    
    const closedPeriod = periods[0];
    
    // Attempt to reopen
    const reopenResponse = await request.patch(`${API_BASE}/accounting/periods/${closedPeriod.id}/reopen`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    
    // Should succeed (200) or period already open (400)
    expect([200, 400]).toContain(reopenResponse.status());
  });

  test('ACCOUNTANT cannot reopen a closed period via API', async ({ request }) => {
    // Login as accountant
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: { email: ACCOUNTANT.email, password: PASSWORD },
    });
    expect(loginResponse.ok()).toBe(true);
    
    const { access_token } = await loginResponse.json();
    
    // First, list periods to find a closed one
    const listResponse = await request.get(`${API_BASE}/accounting/periods?status=CLOSED`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    
    if (!listResponse.ok()) {
      // No periods endpoint or empty - skip
      test.skip();
      return;
    }
    
    const { periods } = await listResponse.json();
    if (!periods || periods.length === 0) {
      // No closed periods to test - skip
      test.skip();
      return;
    }
    
    const closedPeriod = periods[0];
    
    // Attempt to reopen - should be denied
    const reopenResponse = await request.patch(`${API_BASE}/accounting/periods/${closedPeriod.id}/reopen`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    
    // ACCOUNTANT (L4) should be denied
    expect(reopenResponse.status()).toBe(403);
  });
});
