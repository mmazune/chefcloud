/**
 * Phase I3.1: API Call Capture Module
 * 
 * Instruments the API layer to capture calls for navmap.
 * Enabled with NEXT_PUBLIC_NAVMAP_MODE=1
 * 
 * Usage:
 * - Import and call initApiCapture() at app startup
 * - Call setCurrentRoute() when route changes
 * - Call getApiCallsByRoute() to get captured calls
 */

import type { NavmapApiCall } from './types';

// Capture state
let enabled = false;
let currentRoute: string | null = null;
let currentPhase: 'page-load' | 'action' = 'page-load';
const apiCallsByRoute: Record<string, NavmapApiCall[]> = {};

// Listeners for real-time updates
type ApiCaptureListener = (call: NavmapApiCall, route: string) => void;
const listeners: ApiCaptureListener[] = [];

/**
 * Initialize API capture
 */
export function initApiCapture(): void {
  if (typeof window === 'undefined') return;
  
  enabled = process.env.NEXT_PUBLIC_NAVMAP_MODE === '1';
  
  if (enabled) {
    console.log('[Navmap API] Capture initialized');
  }
}

/**
 * Check if API capture is enabled
 */
export function isApiCaptureEnabled(): boolean {
  return enabled;
}

/**
 * Set the current route context for API calls
 */
export function setCurrentRoute(route: string): void {
  if (!enabled) return;
  currentRoute = route;
  currentPhase = 'page-load';
  
  // Initialize array for this route if needed
  if (!apiCallsByRoute[route]) {
    apiCallsByRoute[route] = [];
  }
}

/**
 * Set phase to 'action' after page load completes
 */
export function setPhaseAction(): void {
  currentPhase = 'action';
}

/**
 * Record an API call
 */
export function recordApiCall(method: string, path: string, status?: number): void {
  if (!enabled || !currentRoute) return;
  
  const call: NavmapApiCall = {
    method: method.toUpperCase(),
    path,
    phase: currentPhase,
    status,
    timestamp: new Date().toISOString(),
  };
  
  // Add to route's calls
  if (!apiCallsByRoute[currentRoute]) {
    apiCallsByRoute[currentRoute] = [];
  }
  
  // Avoid duplicate calls (same method+path+phase)
  const exists = apiCallsByRoute[currentRoute].some(
    c => c.method === call.method && c.path === call.path && c.phase === call.phase
  );
  
  if (!exists) {
    apiCallsByRoute[currentRoute].push(call);
    console.log(`[Navmap API] ${call.method} ${call.path} (${call.phase}) on ${currentRoute}`);
    
    // Notify listeners
    listeners.forEach(fn => fn(call, currentRoute!));
  }
}

/**
 * Get all captured API calls by route
 */
export function getApiCallsByRoute(): Record<string, NavmapApiCall[]> {
  return { ...apiCallsByRoute };
}

/**
 * Get API calls for a specific route
 */
export function getApiCallsForRoute(route: string): NavmapApiCall[] {
  return apiCallsByRoute[route] || [];
}

/**
 * Clear all captured API calls
 */
export function clearApiCapture(): void {
  Object.keys(apiCallsByRoute).forEach(key => {
    delete apiCallsByRoute[key];
  });
}

/**
 * Add listener for API capture events
 */
export function addApiCaptureListener(fn: ApiCaptureListener): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

/**
 * Export API calls as summary
 */
export function exportApiCaptureSummary(): { totalCalls: number; routesWithCalls: number; byRoute: Record<string, number> } {
  const byRoute: Record<string, number> = {};
  let totalCalls = 0;
  
  for (const [route, calls] of Object.entries(apiCallsByRoute)) {
    byRoute[route] = calls.length;
    totalCalls += calls.length;
  }
  
  return {
    totalCalls,
    routesWithCalls: Object.keys(byRoute).filter(r => byRoute[r] > 0).length,
    byRoute,
  };
}
