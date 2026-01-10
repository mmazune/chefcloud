/**
 * NavMap Runtime Registry
 * 
 * Central registry that loads all 11 role runtime maps and provides helpers
 * for sidebar rendering, route guards, and action guards.
 * 
 * This module serves as the source of truth for role-based navigation.
 * Runtime maps are generated via Phase I3 capture process.
 * 
 * @see reports/navigation/runtime/*.runtime.json
 */

import { JobRole } from '@/config/roleCapabilities';
import type {
  NavmapRoleCapture,
  NavmapAction,
} from '@/lib/navmap/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Extended runtime data structure (matches actual JSON files)
 */
export interface RuntimeData extends NavmapRoleCapture {
  summary: {
    totalRoutes: number;
    totalSidebarLinks: number;
    totalActions: number;
    probeOutcomes: Record<string, number>;
    apiCallsTotal: number;
  };
}

/**
 * Sidebar group structure for UI rendering
 */
export interface SidebarGroup {
  title: string;
  links: SidebarLink[];
}

/**
 * Individual sidebar link
 */
export interface SidebarLink {
  label: string;
  href: string;
  navGroup: string;
  isActive: boolean;
}

// =============================================================================
// Runtime Data Loading
// =============================================================================

/**
 * All 11 roles in the system
 */
export const ALL_ROLES: JobRole[] = [
  'OWNER',
  'MANAGER',
  'ACCOUNTANT',
  'PROCUREMENT',
  'STOCK_MANAGER',
  'SUPERVISOR',
  'CASHIER',
  'CHEF',
  'WAITER',
  'BARTENDER',
  'EVENT_MANAGER',
];

/**
 * Load runtime data for a role (async version, not currently used)
 * Uses dynamic imports to avoid bundling all JSON files
 */
async function _loadRuntimeData(role: JobRole): Promise<RuntimeData | null> {
  const normalizedRole = role.toLowerCase();
  try {
    // Dynamic import from reports directory
    // In production, these would be copied to a static location or embedded
    const data = await import(`../../../../reports/navigation/runtime/${normalizedRole}.runtime.json`);
    return data.default || data;
  } catch (e) {
    console.warn(`[NavMapRegistry] Failed to load runtime for ${role}:`, e);
    return null;
  }
}

/**
 * Synchronous runtime data map (pre-loaded)
 * Loaded statically at build time via require
 */
const runtimeMap: Record<string, RuntimeData | null> = {};

// Pre-load all runtime data synchronously for SSR/initial render
// This is safe because the files exist at build time
function loadRuntimeSync(role: string): RuntimeData | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(`../../../../reports/navigation/runtime/${role.toLowerCase()}.runtime.json`);
  } catch {
    return null;
  }
}

// Initialize the map
for (const role of ALL_ROLES) {
  runtimeMap[role] = loadRuntimeSync(role);
}

// =============================================================================
// Core Helpers
// =============================================================================

/**
 * Get the runtime data for a specific role
 * 
 * @param role - The job role (case-insensitive)
 * @returns RuntimeData or null if not found
 */
export function getRuntimeForRole(role: JobRole | string | null | undefined): RuntimeData | null {
  if (!role) return null;
  const normalized = role.toUpperCase() as JobRole;
  return runtimeMap[normalized] || null;
}

/**
 * Get sidebar groups for a role
 * Groups links by navGroup and maintains order from runtime JSON
 * 
 * @param role - The job role
 * @returns Array of SidebarGroup objects
 */
export function getSidebarForRole(role: JobRole | string | null | undefined): SidebarGroup[] {
  const runtime = getRuntimeForRole(role);
  if (!runtime || !runtime.sidebarLinks) {
    return [];
  }

  // Group links by navGroup while preserving order
  const groupMap = new Map<string, SidebarLink[]>();
  const groupOrder: string[] = [];

  for (const link of runtime.sidebarLinks) {
    if (!groupMap.has(link.navGroup)) {
      groupMap.set(link.navGroup, []);
      groupOrder.push(link.navGroup);
    }
    groupMap.get(link.navGroup)!.push({
      label: link.label,
      href: link.href,
      navGroup: link.navGroup,
      isActive: link.isActive,
    });
  }

  // Convert to array preserving insertion order
  return groupOrder.map(title => ({
    title,
    links: groupMap.get(title) || [],
  }));
}

/**
 * Check if a role can access a specific route
 * 
 * @param role - The job role
 * @param pathname - The route pathname (e.g., '/inventory', '/workforce/schedule')
 * @returns boolean - true if route is accessible
 */
export function canAccessRoute(role: JobRole | string | null | undefined, pathname: string): boolean {
  const runtime = getRuntimeForRole(role);
  if (!runtime) return false;

  // Normalize pathname (remove trailing slash, handle dynamic segments)
  const normalizedPathname = pathname.replace(/\/$/, '') || '/';

  // Check exact match in routesVisited
  if (runtime.routesVisited.includes(normalizedPathname)) {
    return true;
  }

  // Check if pathname matches a dynamic route pattern
  // e.g., '/inventory/items/123' matches '/inventory/items/[id]'
  for (const route of runtime.routesVisited) {
    const pattern = route.replace(/\[[^\]]+\]/g, '[^/]+');
    const regex = new RegExp(`^${pattern}$`);
    if (regex.test(normalizedPathname)) {
      return true;
    }
  }

  // Check sidebar links (some routes may be accessible via sidebar but not in routesVisited)
  for (const link of runtime.sidebarLinks || []) {
    if (normalizedPathname === link.href || normalizedPathname.startsWith(link.href + '/')) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a role can perform a specific action
 * 
 * @param role - The job role
 * @param actionKey - The action test ID (data-testid value)
 * @param route - Optional: restrict check to a specific route
 * @returns boolean - true if action is allowed
 */
export function canPerformAction(
  role: JobRole | string | null | undefined,
  actionKey: string,
  route?: string
): boolean {
  const runtime = getRuntimeForRole(role);
  if (!runtime || !runtime.actions) return false;

  // Find matching action
  for (const action of runtime.actions) {
    if (action.testId === actionKey) {
      // If route is specified, also check route match
      if (route) {
        const normalizedRoute = route.replace(/\/$/, '');
        // Handle dynamic segments
        const pattern = action.route.replace(/\[[^\]]+\]/g, '[^/]+');
        const regex = new RegExp(`^${pattern}$`);
        if (action.route === normalizedRoute || regex.test(normalizedRoute)) {
          return true;
        }
      } else {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get all actions for a role
 * 
 * @param role - The job role
 * @returns Array of NavmapAction objects
 */
export function getActionsForRole(role: JobRole | string | null | undefined): NavmapAction[] {
  const runtime = getRuntimeForRole(role);
  return runtime?.actions || [];
}

/**
 * Get actions for a specific route and role
 * 
 * @param role - The job role
 * @param route - The route pathname
 * @returns Array of NavmapAction objects for that route
 */
export function getActionsForRoute(
  role: JobRole | string | null | undefined,
  route: string
): NavmapAction[] {
  const runtime = getRuntimeForRole(role);
  if (!runtime || !runtime.actions) return [];

  const normalizedRoute = route.replace(/\/$/, '');

  return runtime.actions.filter(action => {
    // Handle dynamic segments
    const pattern = action.route.replace(/\[[^\]]+\]/g, '[^/]+');
    const regex = new RegExp(`^${pattern}$`);
    return action.route === normalizedRoute || regex.test(normalizedRoute);
  });
}

/**
 * Get all routes for a role
 * 
 * @param role - The job role
 * @returns Array of route strings
 */
export function getRoutesForRole(role: JobRole | string | null | undefined): string[] {
  const runtime = getRuntimeForRole(role);
  return runtime?.routesVisited || [];
}

// =============================================================================
// Utility Exports
// =============================================================================

/**
 * Check if a role exists in the registry
 */
export function isRoleLoaded(role: JobRole | string): boolean {
  const normalized = role.toUpperCase() as JobRole;
  return runtimeMap[normalized] !== null && runtimeMap[normalized] !== undefined;
}

/**
 * Get count of loaded roles
 */
export function getLoadedRoleCount(): number {
  return Object.values(runtimeMap).filter(Boolean).length;
}

/**
 * Get all loaded role names
 */
export function getLoadedRoles(): string[] {
  return Object.entries(runtimeMap)
    .filter(([, data]) => data !== null)
    .map(([role]) => role);
}
