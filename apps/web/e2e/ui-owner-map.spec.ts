/**
 * OWNER UI Map Crawler - Playwright Spec
 *
 * Exhaustive frontend interaction map for OWNER role:
 * - Every reachable screen
 * - Every interactive control
 * - What happens when interacted
 * - Which backend API requests are triggered
 *
 * Safe Mode: Does NOT execute destructive actions.
 *
 * @run pnpm --filter @chefcloud/web test:e2e -- ui-owner-map.spec.ts
 */

import { test, expect, Page, Request, Response } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {
  RoleMap,
  ScreenMap,
  Control,
  ControlType,
  Outcome,
  EndpointCall,
  ModalMap,
  isUnsafeLabel,
  generateControlId,
  routeToFilename,
  createEmptyScreenMap,
  createEmptyRoleMap,
  calculateCoverage,
} from './ui-map/types';

// =============================================================================
// Configuration
// =============================================================================

const API_BASE = process.env.E2E_API_URL || 'http://localhost:3001';
const WEB_BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const PASSWORD = 'Demo#123';
const OWNER_EMAIL = 'owner@tapas.demo.local';

const OUTPUT_DIR = path.resolve(__dirname, '../../../reports/ui-map/OWNER');
const SCREENS_DIR = path.join(OUTPUT_DIR, 'screens');

// Action window for correlating clicks to API calls
const ACTION_WINDOW_MS = 3000;

// Routes to prioritize (sidebar links first, then remaining)
const PRIORITY_ROUTES = [
  '/workspaces/owner',
  '/dashboard',
  '/analytics',
  '/reports',
  '/pos',
  '/reservations',
  '/inventory',
  '/finance',
];

// =============================================================================
// Helper Types
// =============================================================================

interface ApiCapture {
  method: string;
  path: string;
  status: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Login as OWNER via API and set auth token
 */
async function loginAsOwner(page: Page): Promise<boolean> {
  try {
    const response = await page.request.post(`${API_BASE}/auth/login`, {
      data: { email: OWNER_EMAIL, password: PASSWORD },
    });

    if (!response.ok()) {
      console.error(`Login failed: ${response.status()}`);
      return false;
    }

    const body = await response.json();
    const token = body.access_token;

    // Navigate to base URL first
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Store token in localStorage
    await page.evaluate((accessToken) => {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('token', accessToken);
    }, token);

    // Verify login by navigating to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    const url = page.url();
    return !url.includes('/login');
  } catch (error) {
    console.error('Login error:', error);
    return false;
  }
}

/**
 * Load OWNER runtime routes from navigation registry
 */
function loadOwnerRoutes(): string[] {
  try {
    const runtimePath = path.resolve(
      __dirname,
      '../../../reports/navigation/runtime/owner.runtime.json'
    );
    const content = fs.readFileSync(runtimePath, 'utf-8');
    const runtime = JSON.parse(content);

    // Combine sidebar links and all routes, prioritizing sidebar
    const sidebarRoutes = (runtime.sidebarLinks || []).map((l: { href: string }) => l.href);
    const allRoutes = runtime.routesVisited || [];

    // Dedupe: sidebar first, then remaining
    const seen = new Set<string>();
    const ordered: string[] = [];

    // Priority routes first
    for (const route of PRIORITY_ROUTES) {
      if (!seen.has(route)) {
        seen.add(route);
        ordered.push(route);
      }
    }

    // Sidebar routes
    for (const route of sidebarRoutes) {
      if (!seen.has(route) && !route.includes('[')) {
        seen.add(route);
        ordered.push(route);
      }
    }

    // Remaining static routes
    for (const route of allRoutes) {
      if (!seen.has(route) && !route.includes('[')) {
        seen.add(route);
        ordered.push(route);
      }
    }

    return ordered;
  } catch (error) {
    console.error('Failed to load owner routes:', error);
    return PRIORITY_ROUTES;
  }
}

/**
 * Ensure output directories exist
 */
function ensureOutputDirs(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  if (!fs.existsSync(SCREENS_DIR)) {
    fs.mkdirSync(SCREENS_DIR, { recursive: true });
  }
}

/**
 * Extract label from element
 */
async function extractLabel(page: Page, selector: string): Promise<string> {
  try {
    const element = page.locator(selector).first();
    // Try innerText first
    let label = await element.innerText({ timeout: 1000 }).catch(() => '');
    if (label.trim()) return label.trim().slice(0, 100);

    // Try aria-label
    label = await element.getAttribute('aria-label', { timeout: 1000 }).catch(() => '') || '';
    if (label.trim()) return label.trim();

    // Try title
    label = await element.getAttribute('title', { timeout: 1000 }).catch(() => '') || '';
    if (label.trim()) return label.trim();

    // Try value for inputs
    label = await element.getAttribute('value', { timeout: 1000 }).catch(() => '') || '';
    if (label.trim()) return label.trim();

    // Try placeholder for inputs
    label = await element.getAttribute('placeholder', { timeout: 1000 }).catch(() => '') || '';
    if (label.trim()) return label.trim();

    return '[no-label]';
  } catch {
    return '[extraction-error]';
  }
}

/**
 * Get selector for element (prefer data-testid)
 */
async function getSelector(page: Page, element: any): Promise<{ selector: string; hasTestId: boolean }> {
  try {
    const testId = await element.getAttribute('data-testid');
    if (testId) {
      return { selector: `[data-testid="${testId}"]`, hasTestId: true };
    }

    // Try aria-label
    const ariaLabel = await element.getAttribute('aria-label');
    if (ariaLabel) {
      const tagName = await element.evaluate((el: Element) => el.tagName.toLowerCase());
      return {
        selector: `${tagName}[aria-label="${ariaLabel}"]`,
        hasTestId: false,
      };
    }

    // Try href for links
    const href = await element.getAttribute('href');
    if (href && href.startsWith('/')) {
      return { selector: `a[href="${href}"]`, hasTestId: false };
    }

    // Try id
    const id = await element.getAttribute('id');
    if (id) {
      return { selector: `#${id}`, hasTestId: false };
    }

    // Fallback to role-based
    const role = await element.getAttribute('role');
    const innerText = await element.innerText().catch(() => '');
    if (role && innerText) {
      return {
        selector: `getByRole('${role}', { name: '${innerText.slice(0, 50)}' })`,
        hasTestId: false,
      };
    }

    return { selector: '[unknown]', hasTestId: false };
  } catch {
    return { selector: '[error]', hasTestId: false };
  }
}

/**
 * Detect control type from element
 */
async function detectControlType(element: any): Promise<ControlType> {
  try {
    const tagName = await element.evaluate((el: Element) => el.tagName.toLowerCase());
    const role = await element.getAttribute('role');
    const type = await element.getAttribute('type');
    const ariaLabel = (await element.getAttribute('aria-label')) || '';
    const innerText = await element.innerText().catch(() => '');

    if (tagName === 'a') return 'link';
    if (tagName === 'select') return 'select';
    if (tagName === 'input') {
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'date' || type === 'datetime-local') return 'date-picker';
      return 'input';
    }
    if (tagName === 'textarea') return 'input';

    if (role === 'tab') return 'tab';
    if (role === 'menuitem') return 'menu';
    if (role === 'switch') return 'toggle';

    if (tagName === 'button') {
      // Icon button if no text but has aria-label
      if (!innerText.trim() && ariaLabel) return 'icon-button';
      return 'button';
    }

    // Card detection
    if (await element.evaluate((el: Element) => el.classList.contains('card'))) {
      return 'card';
    }

    return 'button'; // Default
  } catch {
    return 'button';
  }
}

/**
 * Start capturing API calls
 */
function startApiCapture(page: Page, captured: ApiCapture[]): void {
  page.on('response', async (response: Response) => {
    const url = response.url();
    if (url.includes('localhost:3001') || url.includes('/api/')) {
      const request = response.request();
      const method = request.method();
      const path = new URL(url).pathname;
      captured.push({
        method,
        path,
        status: response.status(),
      });
    }
  });
}

/**
 * Aggregate API captures to endpoint calls
 */
function aggregateApiCalls(captured: ApiCapture[]): EndpointCall[] {
  const map = new Map<string, EndpointCall>();

  for (const call of captured) {
    const key = `${call.method}:${call.path}:${call.status}`;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
    } else {
      map.set(key, {
        method: call.method as EndpointCall['method'],
        path: call.path,
        status: call.status,
        count: 1,
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Enumerate controls in a container
 */
async function enumerateControls(
  page: Page,
  containerSelector: string,
  route: string,
  region: string
): Promise<Control[]> {
  const controls: Control[] = [];

  // Selectors for interactive elements
  const selectors = [
    `${containerSelector} button`,
    `${containerSelector} [role="button"]`,
    `${containerSelector} a[href]`,
    `${containerSelector} [role="menuitem"]`,
    `${containerSelector} [role="tab"]`,
    `${containerSelector} input`,
    `${containerSelector} select`,
    `${containerSelector} textarea`,
    `${containerSelector} [role="switch"]`,
  ];

  for (const selector of selectors) {
    try {
      const elements = page.locator(selector);
      const count = await elements.count();

      for (let i = 0; i < count && i < 50; i++) {
        // Limit per selector
        const element = elements.nth(i);

        // Skip hidden elements
        const isVisible = await element.isVisible().catch(() => false);
        if (!isVisible) continue;

        const label = await extractLabel(page, `${selector}:nth-child(${i + 1})`).catch(
          () => '[no-label]'
        );
        const { selector: controlSelector, hasTestId } = await getSelector(page, element);
        const type = await detectControlType(element);
        const safeToClick = !isUnsafeLabel(label);

        // Determine if needs testid
        const ariaLabel = await element.getAttribute('aria-label').catch(() => null);
        const needsTestId = !hasTestId && !ariaLabel;

        const control: Control = {
          id: generateControlId(route, type, label, controls.length),
          label,
          type,
          selector: controlSelector,
          hasTestId,
          safeToClick,
          outcome: [],
          needsTestId,
        };

        controls.push(control);
      }
    } catch {
      // Skip selector errors
    }
  }

  return controls;
}

/**
 * Check if element is in a specific region
 */
async function isInRegion(page: Page, element: any, region: string): Promise<boolean> {
  try {
    const inSidebar = await element.evaluate(
      (el: Element) =>
        el.closest('nav') !== null ||
        el.closest('aside') !== null ||
        el.closest('[data-testid="sidebar"]') !== null
    );
    const inHeader = await element.evaluate(
      (el: Element) =>
        el.closest('header') !== null || el.closest('[data-testid="topbar"]') !== null
    );

    if (region === 'sidebar') return inSidebar;
    if (region === 'topbar') return inHeader;
    if (region === 'content') return !inSidebar && !inHeader;

    return false;
  } catch {
    return false;
  }
}

/**
 * Visit a route and enumerate all controls
 */
async function visitRoute(page: Page, route: string): Promise<ScreenMap> {
  const screenMap = createEmptyScreenMap(route);

  try {
    // Capture API calls on page load
    const loadCalls: ApiCapture[] = [];
    const responseHandler = async (response: Response) => {
      const url = response.url();
      if (url.includes('localhost:3001') || url.includes('/api/')) {
        loadCalls.push({
          method: response.request().method(),
          path: new URL(url).pathname,
          status: response.status(),
        });
      }
    };
    page.on('response', responseHandler);

    // Navigate to route
    await page.goto(route);
    await page.waitForLoadState('networkidle', { timeout: 20000 });

    // Check for redirects
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname !== route) {
      if (currentUrl.pathname.includes('/login')) {
        screenMap.visitError = 'Redirected to /login';
        return screenMap;
      }
      if (currentUrl.pathname.includes('/403') || currentUrl.pathname.includes('/forbidden')) {
        screenMap.visitError = 'Access denied';
        return screenMap;
      }
    }

    screenMap.visited = true;

    // Capture title
    const h1 = page.locator('h1').first();
    screenMap.title = (await h1.innerText().catch(() => '')) || (await page.title());

    // Screenshot
    const screenshotName = `${routeToFilename(route)}.png`;
    const screenshotPath = path.join(SCREENS_DIR, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    screenMap.screenshot = `screens/${screenshotName}`;

    // Stop capturing load calls
    page.off('response', responseHandler);
    screenMap.apiSummary.onLoad = aggregateApiCalls(loadCalls);
    screenMap.apiSummary.uniqueEndpoints = [...screenMap.apiSummary.onLoad];

    // Enumerate controls by region
    // Sidebar
    const sidebarSelectors = ['nav', 'aside', '[data-testid="sidebar"]'];
    for (const sel of sidebarSelectors) {
      const sidebarControls = await enumerateControls(page, sel, route, 'sidebar');
      screenMap.regions.sidebar.push(...sidebarControls);
    }

    // Topbar
    const topbarSelectors = ['header', '[data-testid="topbar"]', '[data-testid="header"]'];
    for (const sel of topbarSelectors) {
      const topbarControls = await enumerateControls(page, sel, route, 'topbar');
      screenMap.regions.topbar.push(...topbarControls);
    }

    // Content (main area)
    const contentSelectors = ['main', '[data-testid="main-content"]', '#main-content', '[role="main"]'];
    for (const sel of contentSelectors) {
      const contentControls = await enumerateControls(page, sel, route, 'content');
      screenMap.regions.content.push(...contentControls);
    }

    // If no content found, try body
    if (screenMap.regions.content.length === 0) {
      const bodyControls = await enumerateControls(page, 'body', route, 'content');
      // Filter out sidebar and topbar controls
      for (const control of bodyControls) {
        const isDuplicate =
          screenMap.regions.sidebar.some((c) => c.selector === control.selector) ||
          screenMap.regions.topbar.some((c) => c.selector === control.selector);
        if (!isDuplicate) {
          screenMap.regions.content.push(control);
        }
      }
    }

    // Deduplicate controls
    const dedupeControls = (controls: Control[]): Control[] => {
      const seen = new Set<string>();
      return controls.filter((c) => {
        if (seen.has(c.selector)) return false;
        seen.add(c.selector);
        return true;
      });
    };

    screenMap.regions.sidebar = dedupeControls(screenMap.regions.sidebar);
    screenMap.regions.topbar = dedupeControls(screenMap.regions.topbar);
    screenMap.regions.content = dedupeControls(screenMap.regions.content);

  } catch (error: any) {
    screenMap.visitError = error.message?.slice(0, 200) || 'Unknown error';
  }

  return screenMap;
}

/**
 * Interact with safe controls and record outcomes
 */
async function interactWithControls(page: Page, screenMap: ScreenMap): Promise<void> {
  const route = screenMap.route;

  for (const region of ['topbar', 'sidebar', 'content'] as const) {
    for (const control of screenMap.regions[region]) {
      if (!control.safeToClick) {
        control.outcome.push({
          kind: 'blocked',
          notes: 'Unsafe action - skipped',
        });
        continue;
      }

      // Skip controls that are just text or inputs without buttons
      if (control.type === 'input' || control.type === 'select') {
        control.outcome.push({
          kind: 'no-op',
          notes: 'Form input - no click action',
        });
        continue;
      }

      try {
        // Ensure we're on the right page
        const currentPath = new URL(page.url()).pathname;
        if (currentPath !== route) {
          await page.goto(route);
          await page.waitForLoadState('networkidle', { timeout: 10000 });
        }

        // Start capturing API calls
        const actionCalls: ApiCapture[] = [];
        const responseHandler = async (response: Response) => {
          const url = response.url();
          if (url.includes('localhost:3001') || url.includes('/api/')) {
            actionCalls.push({
              method: response.request().method(),
              path: new URL(url).pathname,
              status: response.status(),
            });
          }
        };
        page.on('response', responseHandler);

        // Get the element
        let element;
        if (control.selector.startsWith('getByRole')) {
          // Parse getByRole selector
          const match = control.selector.match(/getByRole\('([^']+)',\s*\{\s*name:\s*'([^']+)'\s*\}\)/);
          if (match) {
            element = page.getByRole(match[1] as any, { name: match[2] }).first();
          }
        } else {
          element = page.locator(control.selector).first();
        }

        if (!element) {
          control.outcome.push({ kind: 'error', notes: 'Element not found' });
          page.off('response', responseHandler);
          continue;
        }

        // Check if visible
        const isVisible = await element.isVisible().catch(() => false);
        if (!isVisible) {
          control.outcome.push({ kind: 'no-op', notes: 'Element not visible' });
          page.off('response', responseHandler);
          continue;
        }

        // Record pre-click state
        const preClickUrl = page.url();

        // Click with timeout
        await element.click({ timeout: 5000 });

        // Wait briefly for effects
        await page.waitForTimeout(ACTION_WINDOW_MS);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

        // Stop capturing
        page.off('response', responseHandler);

        // Determine outcome
        const postClickUrl = page.url();

        // Navigation check
        if (postClickUrl !== preClickUrl) {
          const newPath = new URL(postClickUrl).pathname;
          control.outcome.push({
            kind: 'navigate',
            toRoute: newPath,
            apiCalls: aggregateApiCalls(actionCalls),
          });

          // Add API calls to screen summary
          for (const call of aggregateApiCalls(actionCalls)) {
            const exists = screenMap.apiSummary.uniqueEndpoints.some(
              (e) => e.method === call.method && e.path === call.path
            );
            if (!exists) {
              screenMap.apiSummary.uniqueEndpoints.push(call);
            }
          }

          // Go back
          await page.goBack();
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          continue;
        }

        // Modal check
        const dialog = page.locator('[role="dialog"], [data-state="open"]').first();
        const hasDialog = await dialog.isVisible().catch(() => false);
        if (hasDialog) {
          const modalTitle = await dialog.locator('h2, [role="heading"]').first().innerText().catch(() => 'Untitled Modal');
          control.outcome.push({
            kind: 'open-modal',
            modalTitle,
            apiCalls: aggregateApiCalls(actionCalls),
          });

          // Try to close modal
          const closeBtn = dialog.locator('button:has-text("Close"), button:has-text("Cancel"), button[aria-label="Close"]').first();
          if (await closeBtn.isVisible().catch(() => false)) {
            await closeBtn.click().catch(() => {});
            await page.waitForTimeout(500);
          } else {
            // Press Escape
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
          }
          continue;
        }

        // Menu check
        const menu = page.locator('[role="menu"], [role="listbox"]').first();
        const hasMenu = await menu.isVisible().catch(() => false);
        if (hasMenu) {
          // Get menu items
          const menuItems = await menu.locator('[role="menuitem"], [role="option"]').allInnerTexts();
          control.outcome.push({
            kind: 'open-menu',
            menuItems: menuItems.slice(0, 10),
            apiCalls: aggregateApiCalls(actionCalls),
          });

          // Close menu by clicking elsewhere
          await page.mouse.click(10, 10);
          await page.waitForTimeout(500);
          continue;
        }

        // Toast check
        const toast = page.locator('[data-sonner-toast], [role="alert"], .toast, [data-testid*="toast"]').first();
        const hasToast = await toast.isVisible().catch(() => false);
        if (hasToast) {
          const toastMessage = await toast.innerText().catch(() => '');
          control.outcome.push({
            kind: 'toast',
            toastMessage,
            apiCalls: aggregateApiCalls(actionCalls),
          });
          continue;
        }

        // API-only or state change
        if (actionCalls.length > 0) {
          control.outcome.push({
            kind: 'api-only',
            apiCalls: aggregateApiCalls(actionCalls),
          });
        } else {
          control.outcome.push({
            kind: 'no-op',
            notes: 'No observable effect',
          });
        }
      } catch (error: any) {
        control.outcome.push({
          kind: 'error',
          notes: error.message?.slice(0, 100) || 'Click failed',
        });
      }
    }
  }
}

/**
 * Generate markdown report from role map
 */
function generateMarkdownReport(roleMap: RoleMap): string {
  const lines: string[] = [];

  lines.push(`# OWNER UI Interaction Map`);
  lines.push('');
  lines.push(`Generated: ${roleMap.generatedAt}`);
  lines.push(`Base URL: ${roleMap.baseUrl}`);
  lines.push('');
  lines.push(`## Coverage Summary`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Routes Total | ${roleMap.coverage.routesTotal} |`);
  lines.push(`| Routes Visited | ${roleMap.coverage.routesVisited} |`);
  lines.push(`| Route Coverage | ${roleMap.coverage.routesCoverage.toFixed(1)}% |`);
  lines.push(`| Controls Total | ${roleMap.coverage.controlsTotal} |`);
  lines.push(`| Controls Mapped | ${roleMap.coverage.controlsMapped} |`);
  lines.push(`| Controls Needing TestId | ${roleMap.coverage.controlsNeedingTestId} |`);
  lines.push(`| Unsafe Controls | ${roleMap.coverage.controlsUnsafe} |`);
  lines.push('');

  lines.push(`## Routes`);
  lines.push('');

  for (const screen of roleMap.routes) {
    const status = screen.visited ? '✅' : '❌';
    lines.push(`### ${status} ${screen.route}`);
    lines.push('');

    if (screen.visitError) {
      lines.push(`> ⚠️ ${screen.visitError}`);
      lines.push('');
      continue;
    }

    lines.push(`**Title:** ${screen.title || 'N/A'}`);
    lines.push(`**Screenshot:** ${screen.screenshot || 'N/A'}`);
    lines.push('');

    // API on load
    if (screen.apiSummary.onLoad && screen.apiSummary.onLoad.length > 0) {
      lines.push(`#### API Calls on Load`);
      lines.push('');
      lines.push(`| Method | Path | Status |`);
      lines.push(`|--------|------|--------|`);
      for (const call of screen.apiSummary.onLoad.slice(0, 20)) {
        lines.push(`| ${call.method} | ${call.path} | ${call.status} |`);
      }
      lines.push('');
    }

    // Controls by region
    for (const region of ['topbar', 'sidebar', 'content'] as const) {
      const controls = screen.regions[region];
      if (controls.length === 0) continue;

      lines.push(`#### ${region.charAt(0).toUpperCase() + region.slice(1)} Controls (${controls.length})`);
      lines.push('');

      for (const control of controls.slice(0, 30)) {
        const safe = control.safeToClick ? '🟢' : '🔴';
        const testId = control.hasTestId ? '✅' : '❌';
        lines.push(`- ${safe} **${control.label}** (${control.type})`);
        lines.push(`  - Selector: \`${control.selector}\``);
        lines.push(`  - TestId: ${testId}${control.needsTestId ? ' ⚠️ needs-testid' : ''}`);

        if (control.outcome.length > 0) {
          for (const outcome of control.outcome) {
            lines.push(`  - Outcome: **${outcome.kind}**${outcome.toRoute ? ` → ${outcome.toRoute}` : ''}${outcome.modalTitle ? ` (${outcome.modalTitle})` : ''}`);
          }
        }
      }
      lines.push('');
    }
  }

  // Unmapped items
  if (roleMap.unmapped.routesMissing.length > 0) {
    lines.push(`## Unmapped Routes`);
    lines.push('');
    for (const route of roleMap.unmapped.routesMissing) {
      lines.push(`- ${route}`);
    }
    lines.push('');
  }

  // Controls needing testid
  const needsTestId: { route: string; control: Control }[] = [];
  for (const screen of roleMap.routes) {
    for (const region of ['topbar', 'sidebar', 'content'] as const) {
      for (const control of screen.regions[region]) {
        if (control.needsTestId) {
          needsTestId.push({ route: screen.route, control });
        }
      }
    }
  }

  if (needsTestId.length > 0) {
    lines.push(`## Controls Needing TestId (Top 30)`);
    lines.push('');
    lines.push(`| Route | Label | Type | Selector |`);
    lines.push(`|-------|-------|------|----------|`);
    for (const { route, control } of needsTestId.slice(0, 30)) {
      lines.push(`| ${route} | ${control.label} | ${control.type} | \`${control.selector}\` |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Write output files
 */
function writeOutputFiles(roleMap: RoleMap): void {
  ensureOutputDirs();

  // Update coverage
  roleMap.coverage = calculateCoverage(roleMap);

  // JSON map
  const jsonPath = path.join(OUTPUT_DIR, 'ui-map.owner.json');
  fs.writeFileSync(jsonPath, JSON.stringify(roleMap, null, 2));

  // Coverage JSON
  const coveragePath = path.join(OUTPUT_DIR, 'ui-coverage.owner.json');
  fs.writeFileSync(coveragePath, JSON.stringify(roleMap.coverage, null, 2));

  // Markdown report
  const mdPath = path.join(OUTPUT_DIR, 'ui-map.owner.md');
  fs.writeFileSync(mdPath, generateMarkdownReport(roleMap));

  console.log(`✅ Output written to ${OUTPUT_DIR}`);
  console.log(`   - ui-map.owner.json`);
  console.log(`   - ui-coverage.owner.json`);
  console.log(`   - ui-map.owner.md`);
  console.log(`   - screens/ (${roleMap.coverage.routesVisited} screenshots)`);
}

// =============================================================================
// Test Suite
// =============================================================================

test.describe('OWNER UI Map Crawler', () => {
  let roleMap: RoleMap;

  test.beforeAll(async ({ browser }) => {
    ensureOutputDirs();
    roleMap = createEmptyRoleMap('OWNER', WEB_BASE);

    // Load routes
    const routes = loadOwnerRoutes();
    for (const route of routes) {
      roleMap.routes.push(createEmptyScreenMap(route));
    }
    roleMap.coverage.routesTotal = routes.length;
  });

  test.afterAll(async () => {
    writeOutputFiles(roleMap);
  });

  test('should login as OWNER', async ({ page }) => {
    const success = await loginAsOwner(page);
    expect(success).toBe(true);
  });

  test('should crawl all OWNER routes and enumerate controls', async ({ page }) => {
    test.setTimeout(600000); // 10 minutes for full crawl

    // Login first
    const loginSuccess = await loginAsOwner(page);
    if (!loginSuccess) {
      console.error('Login failed - aborting crawl');
      return;
    }

    const routes = loadOwnerRoutes();

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      console.log(`[${i + 1}/${routes.length}] Visiting ${route}...`);

      const screenMap = await visitRoute(page, route);

      // Update role map
      const existingIndex = roleMap.routes.findIndex((r) => r.route === route);
      if (existingIndex >= 0) {
        roleMap.routes[existingIndex] = screenMap;
      } else {
        roleMap.routes.push(screenMap);
      }

      // Interact with safe controls (limited for v1)
      if (screenMap.visited) {
        await interactWithControls(page, screenMap);
      }
    }

    // Write intermediate results
    roleMap.coverage = calculateCoverage(roleMap);
    writeOutputFiles(roleMap);

    // Assertions
    expect(roleMap.coverage.routesVisited).toBeGreaterThan(0);
    console.log(`\n📊 Coverage Summary:`);
    console.log(`   Routes: ${roleMap.coverage.routesVisited}/${roleMap.coverage.routesTotal} (${roleMap.coverage.routesCoverage.toFixed(1)}%)`);
    console.log(`   Controls: ${roleMap.coverage.controlsTotal} found, ${roleMap.coverage.controlsMapped} mapped`);
    console.log(`   Needs TestId: ${roleMap.coverage.controlsNeedingTestId}`);
  });

  test('should verify OWNER dashboard controls', async ({ page }) => {
    // Login
    await loginAsOwner(page);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Check for user menu
    const userMenu = page.locator('[data-testid="user-menu"], button:has-text("Joshua"), [aria-label*="user"], [aria-label*="account"]').first();
    const hasUserMenu = await userMenu.isVisible().catch(() => false);

    if (hasUserMenu) {
      await userMenu.click();
      await page.waitForTimeout(1000);

      // Check for logout option
      const logoutOption = page.locator('[role="menuitem"]:has-text("Logout"), [role="menuitem"]:has-text("Sign out")').first();
      const hasLogout = await logoutOption.isVisible().catch(() => false);
      expect(hasLogout).toBe(true);

      // Close menu
      await page.keyboard.press('Escape');
    }

    // Check for date presets (if present)
    const datePresets = page.locator('button:has-text("7 days"), button:has-text("30 days"), button:has-text("90 days")');
    const presetCount = await datePresets.count();

    if (presetCount > 0) {
      console.log(`Found ${presetCount} date preset buttons`);
    }
  });
});

// =============================================================================
// Standalone Execution Support
// =============================================================================

test.describe('OWNER UI Map - Lightweight Verification', () => {
  test('quick health check', async ({ page }) => {
    // Just verify login works
    const success = await loginAsOwner(page);
    if (!success) {
      test.skip();
      return;
    }

    // Navigate to a few key routes
    const keyRoutes = ['/dashboard', '/finance', '/inventory'];

    for (const route of keyRoutes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const url = page.url();
      const wasRedirected = url.includes('/login') || url.includes('/403');

      if (!wasRedirected) {
        // Take screenshot
        const screenshotName = `${routeToFilename(route)}-quick.png`;
        await page.screenshot({ path: path.join(SCREENS_DIR, screenshotName) });
      }
    }
  });
});
