/**
 * Phase I3: Runtime Navigation Mapping Types
 * 
 * Types for the navigation/action capture system.
 * Used when NEXT_PUBLIC_NAVMAP_MODE=1 is set.
 */

export interface NavmapSidebarLink {
  /** Link label text */
  label: string;
  /** Link href/path */
  href: string;
  /** Nav group title */
  navGroup: string;
  /** Whether link is currently active */
  isActive: boolean;
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

export interface NavmapRoleCapture {
  /** Role being captured */
  role: string;
  /** Capture timestamp */
  capturedAt: string;
  /** Routes visited during capture */
  routesVisited: string[];
  /** Sidebar links captured */
  sidebarLinks: NavmapSidebarLink[];
  /** In-page actions captured */
  actions: NavmapAction[];
}

export interface NavmapCaptureState {
  /** Whether capture mode is enabled */
  enabled: boolean;
  /** Current role being captured */
  currentRole: string | null;
  /** Accumulated capture data */
  capture: NavmapRoleCapture | null;
}
