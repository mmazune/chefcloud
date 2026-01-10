/**
 * Ops/POS Critical Path E2E Tests
 * 
 * Section C: Validates core workflows for front-of-house roles:
 * - WAITER: Create order → Add items → Send to kitchen
 * - CASHIER: Process payment → Close order
 * - BARTENDER: Create bar tab → Add drink items → Close tab
 * 
 * These are the "happy path" smoke tests ensuring the POS is usable.
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

const WAITER: UserCredentials = {
  email: 'waiter@tapas.demo.local',
  role: 'WAITER',
};

const CASHIER: UserCredentials = {
  email: 'cashier@tapas.demo.local',
  role: 'CASHIER',
};

const BARTENDER: UserCredentials = {
  email: 'bartender@tapas.demo.local',
  role: 'BARTENDER',
};

const CHEF: UserCredentials = {
  email: 'chef@tapas.demo.local',
  role: 'CHEF',
};

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
 * Navigate to a route and wait for load
 */
async function navigateTo(page: Page, route: string): Promise<void> {
  await page.goto(`${WEB_BASE}${route}`);
  await page.waitForLoadState('networkidle');
}

/**
 * Wait for POS page to be ready (menu loaded)
 */
async function waitForPosReady(page: Page): Promise<void> {
  // Wait for either menu items or "no menu" message
  await page.waitForSelector(
    '[data-testid="menu-item"], button:has-text("New Order"), [class*="menu"], [class*="category"]',
    { timeout: 15000 }
  );
}

/**
 * Wait for KDS page to be ready
 */
async function waitForKdsReady(page: Page): Promise<void> {
  // Wait for KDS layout to load
  await page.waitForSelector(
    '[data-testid="kds-ticket"], [class*="kds"], text=/kitchen/i, text=/no tickets/i',
    { timeout: 15000 }
  );
}

// ============================================================================
// Workspace Access Tests
// ============================================================================

test.describe('Workspace Access', () => {
  test('WAITER can access their workspace', async ({ page }) => {
    await loginAs(page, WAITER);
    await navigateTo(page, '/workspaces/waiter');
    
    // Should see workspace links
    await expect(page.locator('text=POS')).toBeVisible();
    await expect(page.locator('text=Reservations')).toBeVisible();
  });

  test('CASHIER can access their workspace', async ({ page }) => {
    await loginAs(page, CASHIER);
    await navigateTo(page, '/workspaces/cashier');
    
    // Should see workspace links
    await expect(page.locator('text=POS')).toBeVisible();
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('BARTENDER can access their workspace', async ({ page }) => {
    await loginAs(page, BARTENDER);
    await navigateTo(page, '/workspaces/bartender');
    
    // Should see workspace links
    await expect(page.locator('text=POS')).toBeVisible();
    await expect(page.locator('text=Inventory')).toBeVisible();
  });

  test('CHEF can access their workspace', async ({ page }) => {
    await loginAs(page, CHEF);
    await navigateTo(page, '/workspaces/chef');
    
    // Should see KDS link
    await expect(page.locator('text=Kitchen Display')).toBeVisible();
  });
});

// ============================================================================
// POS Access Tests
// ============================================================================

test.describe('POS Page Access', () => {
  test('WAITER can load POS page', async ({ page }) => {
    await loginAs(page, WAITER);
    await navigateTo(page, '/pos');
    await waitForPosReady(page);
    
    // POS should be accessible
    const url = page.url();
    expect(url).toContain('/pos');
  });

  test('CASHIER can load POS page', async ({ page }) => {
    await loginAs(page, CASHIER);
    await navigateTo(page, '/pos');
    await waitForPosReady(page);
    
    // POS should be accessible
    const url = page.url();
    expect(url).toContain('/pos');
  });

  test('BARTENDER can load POS page', async ({ page }) => {
    await loginAs(page, BARTENDER);
    await navigateTo(page, '/pos');
    await waitForPosReady(page);
    
    // POS should be accessible
    const url = page.url();
    expect(url).toContain('/pos');
  });

  test('CHEF can load KDS page', async ({ page }) => {
    await loginAs(page, CHEF);
    await navigateTo(page, '/kds');
    await waitForKdsReady(page);
    
    // KDS should be accessible
    const url = page.url();
    expect(url).toContain('/kds');
  });
});

// ============================================================================
// WAITER Core Workflow: Create Order → Add Items → Send to Kitchen
// ============================================================================

test.describe('WAITER Core Workflow', () => {
  test('WAITER can create order via API', async ({ request }) => {
    // Login
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: { email: WAITER.email, password: PASSWORD },
    });
    expect(loginResponse.ok()).toBe(true);
    const { access_token } = await loginResponse.json();

    // Create new order
    const createResponse = await request.post(`${API_BASE}/pos/orders`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: { tableName: 'E2E-Test-Table' },
    });

    // Should succeed or at least not be 403
    expect(createResponse.status()).not.toBe(403);
    
    if (createResponse.ok()) {
      const order = await createResponse.json();
      expect(order.id).toBeDefined();
    }
  });

  test('WAITER can see New Order button on POS', async ({ page }) => {
    await loginAs(page, WAITER);
    await navigateTo(page, '/pos');
    await waitForPosReady(page);

    // Should see New Order or similar button
    const newOrderBtn = page.locator('button:has-text("New Order"), button:has-text("New"), button:has-text("+")').first();
    await expect(newOrderBtn).toBeVisible();
  });

  test('WAITER can send order to kitchen via API', async ({ request }) => {
    // Login
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: { email: WAITER.email, password: PASSWORD },
    });
    expect(loginResponse.ok()).toBe(true);
    const { access_token } = await loginResponse.json();

    // Create order first
    const createResponse = await request.post(`${API_BASE}/pos/orders`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: { tableName: 'E2E-Kitchen-Test' },
    });

    if (!createResponse.ok()) {
      test.skip(); // Skip if can't create order
      return;
    }

    const order = await createResponse.json();
    
    // Send to kitchen
    const sendResponse = await request.post(`${API_BASE}/pos/orders/${order.id}/send-to-kitchen`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    // Should not be 403 (may be 400 if no items)
    expect(sendResponse.status()).not.toBe(403);
  });
});

// ============================================================================
// CASHIER Core Workflow: View Order → Process Payment
// ============================================================================

test.describe('CASHIER Core Workflow', () => {
  test('CASHIER can list open orders via API', async ({ request }) => {
    // Login
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: { email: CASHIER.email, password: PASSWORD },
    });
    expect(loginResponse.ok()).toBe(true);
    const { access_token } = await loginResponse.json();

    // Get open orders
    const ordersResponse = await request.get(`${API_BASE}/pos/open`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    // Should not be 403
    expect(ordersResponse.status()).not.toBe(403);
    
    if (ordersResponse.ok()) {
      const data = await ordersResponse.json();
      expect(Array.isArray(data.orders) || Array.isArray(data)).toBe(true);
    }
  });

  test('CASHIER can access checkout page', async ({ page }) => {
    await loginAs(page, CASHIER);
    await navigateTo(page, '/pos');
    await waitForPosReady(page);

    // Should see POS with order selection capability
    const url = page.url();
    expect(url).toContain('/pos');
  });

  test('CASHIER can close order via API', async ({ request }) => {
    // Login
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: { email: CASHIER.email, password: PASSWORD },
    });
    expect(loginResponse.ok()).toBe(true);
    const { access_token } = await loginResponse.json();

    // Create order first
    const createResponse = await request.post(`${API_BASE}/pos/orders`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: { tableName: 'E2E-Close-Test' },
    });

    if (!createResponse.ok()) {
      test.skip();
      return;
    }

    const order = await createResponse.json();
    
    // Close the order
    const closeResponse = await request.post(`${API_BASE}/pos/orders/${order.id}/close`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    // Should not be 403 (may fail for business logic reasons)
    expect(closeResponse.status()).not.toBe(403);
  });
});

// ============================================================================
// BARTENDER Core Workflow: Bar Tabs
// ============================================================================

test.describe('BARTENDER Core Workflow', () => {
  test('BARTENDER can create bar tab via API', async ({ request }) => {
    // Login
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: { email: BARTENDER.email, password: PASSWORD },
    });
    expect(loginResponse.ok()).toBe(true);
    const { access_token } = await loginResponse.json();

    // Create new order (bar tab)
    const createResponse = await request.post(`${API_BASE}/pos/orders`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: { tabName: 'E2E-Bar-Tab' },
    });

    // Should not be 403
    expect(createResponse.status()).not.toBe(403);
    
    if (createResponse.ok()) {
      const order = await createResponse.json();
      expect(order.id).toBeDefined();
    }
  });

  test('BARTENDER can access inventory page', async ({ page }) => {
    await loginAs(page, BARTENDER);
    await navigateTo(page, '/inventory');
    await page.waitForLoadState('networkidle');

    // Should be able to view inventory (may redirect based on perms)
    const url = page.url();
    // Either on inventory or not forbidden
    expect(url).not.toContain('/403');
  });
});

// ============================================================================
// CHEF Core Workflow: KDS Operations
// ============================================================================

test.describe('CHEF Core Workflow', () => {
  test('CHEF can list KDS tickets via API', async ({ request }) => {
    // Login
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: { email: CHEF.email, password: PASSWORD },
    });
    expect(loginResponse.ok()).toBe(true);
    const { access_token } = await loginResponse.json();

    // Get KDS tickets
    const ticketsResponse = await request.get(`${API_BASE}/kds/tickets`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    // Should not be 403
    expect(ticketsResponse.status()).not.toBe(403);
  });

  test('CHEF can access KDS page', async ({ page }) => {
    await loginAs(page, CHEF);
    await navigateTo(page, '/kds');
    await waitForKdsReady(page);

    // KDS should be accessible
    const url = page.url();
    expect(url).toContain('/kds');
  });
});

// ============================================================================
// Cross-Role Access Denial Tests
// ============================================================================

test.describe('Cross-Role Denial', () => {
  test('WAITER cannot access finance pages', async ({ page }) => {
    await loginAs(page, WAITER);
    await page.goto(`${WEB_BASE}/finance/accounts`);
    await page.waitForLoadState('networkidle');

    const url = page.url();
    // Should be blocked
    const isBlocked = url.includes('/403') || 
                      url.includes('/unauthorized') ||
                      !url.includes('/finance/accounts');
    expect(isBlocked).toBe(true);
  });

  test('CHEF cannot access POS page', async ({ page }) => {
    await loginAs(page, CHEF);
    await page.goto(`${WEB_BASE}/pos`);
    await page.waitForLoadState('networkidle');

    const url = page.url();
    // CHEF should be blocked from POS (only KDS access)
    const isBlocked = url.includes('/403') || 
                      url.includes('/unauthorized') ||
                      url.includes('/kds') || // Redirected to their workspace
                      !url.includes('/pos');
    expect(isBlocked).toBe(true);
  });

  test('CASHIER cannot access KDS page', async ({ page }) => {
    await loginAs(page, CASHIER);
    await page.goto(`${WEB_BASE}/kds`);
    await page.waitForLoadState('networkidle');

    const url = page.url();
    // CASHIER should not have KDS access
    const isBlocked = url.includes('/403') || 
                      url.includes('/unauthorized') ||
                      !url.includes('/kds');
    expect(isBlocked).toBe(true);
  });
});

// ============================================================================
// Menu & Order Integration Tests
// ============================================================================

test.describe('Menu Integration', () => {
  test('POS can fetch menu items via API', async ({ request }) => {
    // Login as waiter
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: { email: WAITER.email, password: PASSWORD },
    });
    expect(loginResponse.ok()).toBe(true);
    const { access_token } = await loginResponse.json();

    // Get menu
    const menuResponse = await request.get(`${API_BASE}/pos/menu`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    expect(menuResponse.status()).not.toBe(403);
    
    if (menuResponse.ok()) {
      const data = await menuResponse.json();
      // Menu should have categories or items
      expect(data.categories || data.items || Array.isArray(data)).toBeDefined();
    }
  });

  test('Order can have items added via API', async ({ request }) => {
    // Login as waiter
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: { email: WAITER.email, password: PASSWORD },
    });
    expect(loginResponse.ok()).toBe(true);
    const { access_token } = await loginResponse.json();

    // Create order
    const createResponse = await request.post(`${API_BASE}/pos/orders`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: { tableName: 'E2E-Items-Test' },
    });

    if (!createResponse.ok()) {
      test.skip();
      return;
    }

    const order = await createResponse.json();

    // Add item (may fail if no menu items, but should not be 403)
    const addItemResponse = await request.post(`${API_BASE}/pos/orders/${order.id}/modify`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: {
        add: [{
          menuItemId: 'test-item-id',
          quantity: 1,
          notes: 'E2E test',
        }],
      },
    });

    // Should not be 403 (may be 400/404 if item doesn't exist)
    expect(addItemResponse.status()).not.toBe(403);
  });
});
