/**
 * NavMap v3 - Discovery Types
 * 
 * Core type definitions for the DOM discovery scanner that enumerates
 * interactive controls for exhaustive screen-level interaction mapping.
 * 
 * @version 3.0.0
 * @see navmap/role-discovery/owner.discovery.json
 */

// =============================================================================
// Core Discovery Types
// =============================================================================

/**
 * Role discovery output containing all discovered controls across all routes
 */
export interface RoleDiscovery {
  role: string;
  generatedAt: string;
  baseUrl: string;
  routes: RouteDiscovery[];
  summary: DiscoverySummary;
  unresolved: UnresolvedControl[];
}

/**
 * Discovery for a single route/screen
 */
export interface RouteDiscovery {
  route: string;
  title: string;
  regions: {
    topbar: DiscoveredControl[];
    sidebar: DiscoveredControl[];
    content: DiscoveredControl[];
    modals: ModalDiscovery[];
  };
  controlCount: number;
  unresolvedCount: number;
}

/**
 * Modal discovery structure
 */
export interface ModalDiscovery {
  triggerId: string;
  triggerLabel: string;
  modalTitle: string;
  controls: DiscoveredControl[];
}

/**
 * Discovered interactive control
 */
export interface DiscoveredControl {
  /** Stable ID: data-testid OR generated from role+label */
  id: string;
  /** Visible label or aria-label */
  label: string;
  /** Control type */
  type: ControlTypeV3;
  /** Best selector: data-testid preferred */
  selector: string;
  /** Whether control has data-testid */
  hasTestId: boolean;
  /** Whether control has aria-label */
  hasAriaLabel: boolean;
  /** Action ID for interaction tracking */
  actionId: string;
  /** Whether actionId is mapped */
  isMapped: boolean;
  /** Classification: navigation, mutation, modal-open, export, noop */
  classification: ControlClassification;
  /** Target route if navigation */
  targetRoute?: string;
  /** Related API endpoint pattern */
  apiPattern?: string;
  /** Notes for reconciliation */
  notes?: string;
}

/**
 * Control types in NavMap v3
 */
export type ControlTypeV3 = 
  | 'button'
  | 'link'
  | 'menu-trigger'
  | 'menu-item'
  | 'tab'
  | 'dropdown-trigger'
  | 'dropdown-item'
  | 'input'
  | 'date-picker'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'toggle'
  | 'icon-button'
  | 'card-click'
  | 'chart-click'
  | 'row-action';

/**
 * Control classification for interaction outcomes
 */
export type ControlClassification =
  | 'navigate'          // Causes route change
  | 'modal-open'        // Opens modal/dialog
  | 'drawer-open'       // Opens side drawer
  | 'menu-open'         // Opens dropdown/menu
  | 'mutate'            // Triggers data mutation (POST/PUT/DELETE)
  | 'export'            // Triggers file download
  | 'refetch'           // Triggers data refresh
  | 'filter'            // Applies data filter
  | 'sort'              // Changes sort order
  | 'page-state'        // Changes local page state only
  | 'logout'            // Logs out user
  | 'noop'              // No observable effect
  | 'unsafe'            // Destructive action - blocked
  | 'unclassified';     // Not yet classified

/**
 * Control that could not be mapped
 */
export interface UnresolvedControl {
  route: string;
  id: string;
  label: string;
  type: ControlTypeV3;
  selector: string;
  reason: string;
}

/**
 * Summary statistics for discovery
 */
export interface DiscoverySummary {
  routesTotal: number;
  routesDiscovered: number;
  controlsTotal: number;
  controlsMapped: number;
  controlsWithTestId: number;
  controlsWithAriaLabel: number;
  unresolvedCount: number;
  byClassification: Record<ControlClassification, number>;
  byType: Record<ControlTypeV3, number>;
}

// =============================================================================
// Interaction Types
// =============================================================================

/**
 * Role interactions output containing recorded interaction events
 */
export interface RoleInteractions {
  role: string;
  generatedAt: string;
  baseUrl: string;
  interactions: InteractionRecord[];
  summary: InteractionSummary;
}

/**
 * Single interaction record
 */
export interface InteractionRecord {
  /** Unique interaction ID */
  interactionId: string;
  /** Timestamp */
  timestamp: string;
  /** Source route */
  sourceRoute: string;
  /** Control action ID */
  actionId: string;
  /** Control label */
  controlLabel: string;
  /** Control type */
  controlType: ControlTypeV3;
  /** Outcome type */
  outcome: InteractionOutcome;
  /** Target route if navigation */
  targetRoute?: string;
  /** Modal title if modal opened */
  modalTitle?: string;
  /** API calls triggered */
  apiCalls: ApiCallRecord[];
  /** Duration in ms */
  durationMs: number;
  /** Notes */
  notes?: string;
}

/**
 * Interaction outcome types
 */
export type InteractionOutcome =
  | 'navigate'
  | 'modal-open'
  | 'drawer-open'
  | 'menu-open'
  | 'toast'
  | 'api-success'
  | 'api-error'
  | 'no-op'
  | 'blocked'
  | 'error';

/**
 * API call record
 */
export interface ApiCallRecord {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  status: number;
  durationMs?: number;
}

/**
 * Interaction summary
 */
export interface InteractionSummary {
  totalInteractions: number;
  byOutcome: Record<InteractionOutcome, number>;
  uniqueApiEndpoints: number;
  totalApiCalls: number;
  averageDurationMs: number;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate action ID from control properties
 */
export function generateActionId(
  route: string,
  type: ControlTypeV3,
  label: string,
  testId?: string
): string {
  if (testId) {
    return testId;
  }
  const routeSlug = route.replace(/\//g, '_').replace(/\[.*?\]/g, 'param') || 'root';
  const labelSlug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
  return `${routeSlug}__${type}__${labelSlug}`;
}

/**
 * Classify a control based on its properties
 */
export function classifyControl(
  type: ControlTypeV3,
  label: string,
  href?: string,
  _testId?: string,
): ControlClassification {
  const lowerLabel = label.toLowerCase();
  
  // Check for unsafe/destructive actions
  const unsafeKeywords = ['delete', 'remove', 'void', 'refund', 'purge', 'archive'];
  if (unsafeKeywords.some(kw => lowerLabel.includes(kw))) {
    return 'unsafe';
  }
  
  // Check for logout
  if (lowerLabel.includes('logout') || lowerLabel.includes('sign out')) {
    return 'logout';
  }
  
  // Check for export/download
  if (lowerLabel.includes('export') || lowerLabel.includes('download') || lowerLabel.includes('csv')) {
    return 'export';
  }
  
  // Check for mutation keywords
  const mutateKeywords = ['save', 'submit', 'create', 'add', 'update', 'approve', 'post', 'confirm'];
  if (mutateKeywords.some(kw => lowerLabel.includes(kw))) {
    return 'mutate';
  }
  
  // Check for refresh
  if (lowerLabel.includes('refresh') || lowerLabel.includes('reload')) {
    return 'refetch';
  }
  
  // Check for filter/sort
  if (lowerLabel.includes('filter') || type === 'select') {
    return 'filter';
  }
  if (lowerLabel.includes('sort')) {
    return 'sort';
  }
  
  // Links navigate
  if (type === 'link' && href && href.startsWith('/')) {
    return 'navigate';
  }
  
  // Menu triggers open menus
  if (type === 'menu-trigger' || type === 'dropdown-trigger') {
    return 'menu-open';
  }
  
  // Tabs are navigation
  if (type === 'tab') {
    return 'navigate';
  }
  
  // Cards with onClick typically navigate
  if (type === 'card-click') {
    return 'navigate';
  }
  
  // Date pickers and inputs are filters/state
  if (type === 'date-picker' || type === 'input') {
    return 'filter';
  }
  
  return 'unclassified';
}

/**
 * Create empty discovery summary
 */
export function createEmptySummary(): DiscoverySummary {
  return {
    routesTotal: 0,
    routesDiscovered: 0,
    controlsTotal: 0,
    controlsMapped: 0,
    controlsWithTestId: 0,
    controlsWithAriaLabel: 0,
    unresolvedCount: 0,
    byClassification: {
      'navigate': 0,
      'modal-open': 0,
      'drawer-open': 0,
      'menu-open': 0,
      'mutate': 0,
      'export': 0,
      'refetch': 0,
      'filter': 0,
      'sort': 0,
      'page-state': 0,
      'logout': 0,
      'noop': 0,
      'unsafe': 0,
      'unclassified': 0,
    },
    byType: {
      'button': 0,
      'link': 0,
      'menu-trigger': 0,
      'menu-item': 0,
      'tab': 0,
      'dropdown-trigger': 0,
      'dropdown-item': 0,
      'input': 0,
      'date-picker': 0,
      'select': 0,
      'checkbox': 0,
      'radio': 0,
      'toggle': 0,
      'icon-button': 0,
      'card-click': 0,
      'chart-click': 0,
      'row-action': 0,
    },
  };
}
