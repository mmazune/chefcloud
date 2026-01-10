/**
 * Phase I3.1: Runtime Navigation Mapping Types (v2)
 * 
 * Types for the navigation/action capture system.
 * Used when NEXT_PUBLIC_NAVMAP_MODE=1 is set.
 * 
 * v2 additions:
 * - Link probe outcomes (ok/redirected/forbidden/error)
 * - API call capture per route
 */

export type ProbeOutcome = 'ok' | 'redirected' | 'forbidden' | 'error' | 'pending';

export interface NavmapSidebarLink {
  /** Link label text */
  label: string;
  /** Link href/path */
  href: string;
  /** Nav group title */
  navGroup: string;
  /** Whether link is currently active */
  isActive: boolean;
  /** Probe outcome (v2) */
  probeOutcome?: ProbeOutcome;
  /** Redirected to (if outcome is redirected) */
  redirectedTo?: string;
}

export interface NavmapApiCall {
  /** HTTP method */
  method: string;
  /** API path */
  path: string;
  /** Phase: page-load or action */
  phase: 'page-load' | 'action';
  /** Response status (if captured) */
  status?: number;
  /** Timestamp */
  timestamp?: string;
}

export interface NavmapAction {
  /** Route where action was found */
  route: string;
  /** HTML element type (button, a, etc.) */
  elementType: string;
  /** data-testid value */
  testId: string;
  /** Visible label text (best-effort) */
  label: string;
  /** Additional attributes (optional) */
  attributes?: Record<string, string>;
}

export interface NavmapRouteCapture {
  /** Route path */
  route: string;
  /** Probe outcome */
  probeOutcome: ProbeOutcome;
  /** API calls made on this route */
  apiCalls: NavmapApiCall[];
  /** Actions found on this route */
  actions: NavmapAction[];
}

export interface NavmapRoleCapture {
  /** Role being captured */
  role: string;
  /** Capture timestamp */
  capturedAt: string;
  /** Capture method: static-analysis | runtime-probe */
  captureMethod?: string;
  /** Routes visited during capture */
  routesVisited: string[];
  /** Sidebar links captured */
  sidebarLinks: NavmapSidebarLink[];
  /** In-page actions captured */
  actions: NavmapAction[];
  /** API calls per route (v2) */
  apiCallsByRoute?: Record<string, NavmapApiCall[]>;
  /** Probe results (v2) */
  probeResults?: NavmapProbeResult[];
}

export interface NavmapProbeResult {
  /** Link href that was probed */
  href: string;
  /** Link label */
  label: string;
  /** Nav group */
  navGroup: string;
  /** Probe outcome */
  outcome: ProbeOutcome;
  /** Redirected to (if applicable) */
  redirectedTo?: string;
  /** Error message (if applicable) */
  error?: string;
  /** API calls made during probe */
  apiCalls?: NavmapApiCall[];
}

export interface NavmapCaptureState {
  /** Whether capture mode is enabled */
  enabled: boolean;
  /** Current role being captured */
  currentRole: string | null;
  /** Accumulated capture data */
  capture: NavmapRoleCapture | null;
}
