/**
 * Phase I3.1: Navigation Map Collector (v2)
 * 
 * Lightweight runtime collector for navigation and actions.
 * Enabled with NEXT_PUBLIC_NAVMAP_MODE=1
 * 
 * v2 additions:
 * - API call capture per route
 * - Link probe results
 * 
 * This is a singleton that accumulates:
 * - Sidebar links as they render
 * - In-page actions (elements with data-testid)
 * - Routes visited
 * - API calls per route
 */

import type { NavmapRoleCapture, NavmapSidebarLink as _NavmapSidebarLink, NavmapAction, NavmapApiCall as _NavmapApiCall, NavmapProbeResult as _NavmapProbeResult } from './types';
import { getApiCallsByRoute } from './apiCapture';
import { getProbeResults } from './linkProbe';

// Singleton state
let enabled = false;
let _currentRole: string | null = null;
let capture: NavmapRoleCapture | null = null;

/**
 * Initialize the navmap collector.
 * Call once at app startup.
 */
export function initNavmapCollector(): void {
  if (typeof window === 'undefined') return;
  
  // Check env flag
  enabled = process.env.NEXT_PUBLIC_NAVMAP_MODE === '1';
  
  if (enabled) {
    console.log('[Navmap] Collector initialized in capture mode');
  }
}

/**
 * Check if navmap capture mode is enabled
 */
export function isNavmapEnabled(): boolean {
  return enabled;
}

/**
 * Start a new capture session for a role
 */
export function startCapture(role: string): void {
  if (!enabled) return;
  
  _currentRole = role;
  capture = {
    role,
    capturedAt: new Date().toISOString(),
    routesVisited: [],
    sidebarLinks: [],
    actions: [],
  };
  
  console.log(`[Navmap] Started capture for role: ${role}`);
}

/**
 * Record a route visit
 */
export function recordRoute(route: string): void {
  if (!enabled || !capture) return;
  
  if (!capture.routesVisited.includes(route)) {
    capture.routesVisited.push(route);
    console.log(`[Navmap] Recorded route: ${route}`);
  }
}

/**
 * Record sidebar links from a nav group
 */
export function recordSidebarLinks(
  navGroup: string, 
  links: Array<{ label: string; href: string; isActive: boolean }>
): void {
  if (!enabled || !capture) return;
  
  for (const link of links) {
    // Avoid duplicates
    const exists = capture.sidebarLinks.some(
      l => l.href === link.href && l.navGroup === navGroup
    );
    if (!exists) {
      capture.sidebarLinks.push({
        label: link.label,
        href: link.href,
        navGroup,
        isActive: link.isActive,
      });
    }
  }
}

/**
 * Record an in-page action element
 */
export function recordAction(action: Omit<NavmapAction, 'route'>, route: string): void {
  if (!enabled || !capture) return;
  
  // Avoid duplicates by testId + route
  const exists = capture.actions.some(
    a => a.testId === action.testId && a.route === route
  );
  
  if (!exists) {
    capture.actions.push({
      ...action,
      route,
    });
    console.log(`[Navmap] Recorded action: ${action.testId} on ${route}`);
  }
}

/**
 * Get current capture data
 */
export function getCapture(): NavmapRoleCapture | null {
  return capture;
}

/**
 * Export capture data as JSON string (v2 with API calls and probe results)
 */
export function exportCaptureJSON(): string {
  if (!capture) return '{}';
  
  // Get v2 data
  const apiCallsByRoute = getApiCallsByRoute();
  const probeResults = getProbeResults();
  
  // Sort for determinism
  const sorted: NavmapRoleCapture = {
    ...capture,
    captureMethod: 'runtime-probe',
    routesVisited: [...capture.routesVisited].sort(),
    sidebarLinks: [...capture.sidebarLinks].sort((a, b) => 
      a.navGroup.localeCompare(b.navGroup) || a.label.localeCompare(b.label)
    ),
    actions: [...capture.actions].sort((a, b) => 
      a.route.localeCompare(b.route) || a.testId.localeCompare(b.testId)
    ),
    apiCallsByRoute,
    probeResults,
  };
  
  return JSON.stringify(sorted, null, 2);
}

/**
 * Export capture data as Markdown summary
 */
export function exportCaptureMarkdown(): string {
  if (!capture) return '';
  
  const lines: string[] = [
    `# Runtime Navigation Map: ${capture.role}`,
    '',
    `> Captured: ${capture.capturedAt}`,
    '',
    '## Routes Visited',
    '',
    ...capture.routesVisited.sort().map(r => `- \`${r}\``),
    '',
    '## Sidebar Links',
    '',
    '| Nav Group | Label | Href |',
    '|-----------|-------|------|',
    ...capture.sidebarLinks
      .sort((a, b) => a.navGroup.localeCompare(b.navGroup) || a.label.localeCompare(b.label))
      .map(l => `| ${l.navGroup} | ${l.label} | \`${l.href}\` |`),
    '',
    '## In-Page Actions',
    '',
    '| Route | Test ID | Element | Label |',
    '|-------|---------|---------|-------|',
    ...capture.actions
      .sort((a, b) => a.route.localeCompare(b.route) || a.testId.localeCompare(b.testId))
      .map(a => `| \`${a.route}\` | \`${a.testId}\` | ${a.elementType} | ${a.label} |`),
    '',
    '---',
    `Total: ${capture.routesVisited.length} routes, ${capture.sidebarLinks.length} links, ${capture.actions.length} actions`,
  ];
  
  return lines.join('\n');
}

/**
 * Clear current capture
 */
export function clearCapture(): void {
  capture = null;
  _currentRole = null;
}

/**
 * Download capture files (for browser use)
 */
export function downloadCapture(role: string): void {
  if (!capture) return;
  
  const json = exportCaptureJSON();
  const md = exportCaptureMarkdown();
  
  // Download JSON
  const jsonBlob = new Blob([json], { type: 'application/json' });
  const jsonUrl = URL.createObjectURL(jsonBlob);
  const jsonLink = document.createElement('a');
  jsonLink.href = jsonUrl;
  jsonLink.download = `${role.toLowerCase()}.runtime.json`;
  jsonLink.click();
  URL.revokeObjectURL(jsonUrl);
  
  // Download MD
  const mdBlob = new Blob([md], { type: 'text/markdown' });
  const mdUrl = URL.createObjectURL(mdBlob);
  const mdLink = document.createElement('a');
  mdLink.href = mdUrl;
  mdLink.download = `${role.toLowerCase()}.runtime.md`;
  mdLink.click();
  URL.revokeObjectURL(mdUrl);
  
  console.log(`[Navmap] Downloaded capture files for ${role}`);
}
