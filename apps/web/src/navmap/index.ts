/**
 * NavMap Module Exports
 * 
 * This module provides runtime navigation maps and helper functions
 * for role-based UI rendering, route guards, and action guards.
 */

export {
  // Types
  type RuntimeData,
  type SidebarGroup,
  type SidebarLink,
  // Core helpers
  getRuntimeForRole,
  getSidebarForRole,
  canAccessRoute,
  canPerformAction,
  // Action helpers
  getActionsForRole,
  getActionsForRoute,
  getRoutesForRole,
  // Utility
  ALL_ROLES,
  isRoleLoaded,
  getLoadedRoleCount,
  getLoadedRoles,
} from './runtimeRegistry';

// Re-export hooks for convenience
export { useCan, useCanMultiple, useCanAccessRoute } from '@/hooks/useCan';
