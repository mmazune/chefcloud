/**
 * Page Metadata Convention
 * Phase I2: Standardized page action + API catalog annotations
 * 
 * Each high-traffic page should export a `pageMeta` object that documents:
 * - Primary actions (buttons, CTAs)
 * - API calls the page makes
 * - Risk level for audit purposes
 * 
 * This enables automated catalog generation and action traceability.
 */

/**
 * Primary action definition (button, CTA, menu item)
 */
export interface PageAction {
  /** User-visible label */
  label: string;
  /** data-testid for E2E testing */
  testId: string;
  /** Action intent (create, update, delete, navigate, export, etc.) */
  intent: 'create' | 'update' | 'delete' | 'navigate' | 'export' | 'import' | 'approve' | 'reject' | 'view' | 'other';
  /** Optional notes */
  notes?: string;
}

/**
 * API call definition
 */
export interface PageApiCall {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** API endpoint path (e.g., /orders, /orders/:id) */
  path: string;
  /** When this call is made (onMount, onAction, onSubmit, etc.) */
  trigger?: 'onMount' | 'onAction' | 'onSubmit' | 'onRefresh' | 'periodic';
  /** Optional notes */
  notes?: string;
}

/**
 * Risk level for audit and compliance
 * - LOW: Read-only, no financial impact
 * - MEDIUM: Creates/modifies data, limited financial impact
 * - HIGH: Money/stock/audit sensitive operations
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Page metadata definition
 */
export interface PageMeta {
  /** Unique page identifier (route path) */
  id: string;
  /** Page title for display */
  title: string;
  /** Primary actions available on this page */
  primaryActions: PageAction[];
  /** API calls made by this page */
  apiCalls: PageApiCall[];
  /** Risk level for audit purposes */
  risk: RiskLevel;
  /** Optional: roles that can access this page */
  allowedRoles?: string[];
  /** Optional: parent route for breadcrumb */
  parent?: string;
}

/**
 * Helper to create page metadata with defaults
 */
export function definePageMeta(meta: PageMeta): PageMeta {
  return meta;
}

/**
 * Registry of all page metadata (populated by generator scan)
 * This is updated by the generate-page-action-catalog.mjs script
 */
export const PAGE_META_REGISTRY: Record<string, PageMeta> = {};
