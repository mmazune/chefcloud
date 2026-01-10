/**
 * useCan Hook - Action Guard
 * 
 * React hook for checking if the current user can perform a specific action
 * based on their role and the NavMap runtime data.
 * 
 * This enables UI-level gating: hide or disable buttons/actions the user
 * is not authorized to perform.
 * 
 * @example
 * ```tsx
 * function InventoryPage() {
 *   const canCreateItem = useCan('inventory-create-item');
 *   const canDeleteItem = useCan('inventory-delete-item');
 *   
 *   return (
 *     <div>
 *       {canCreateItem && <Button>Create Item</Button>}
 *       <Button disabled={!canDeleteItem}>Delete</Button>
 *     </div>
 *   );
 * }
 * ```
 */

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { canPerformAction, canAccessRoute } from '@/navmap';

/**
 * Check if the current user can perform a specific action
 * 
 * @param actionKey - The action's data-testid value
 * @param options - Optional configuration
 * @returns boolean - true if the user can perform the action
 */
export function useCan(
  actionKey: string,
  options?: {
    /** If true, also check that the action is valid for the current route */
    routeScoped?: boolean;
  }
): boolean {
  const { user } = useAuth();
  const router = useRouter();

  if (!user || !user.jobRole) {
    return false;
  }

  const route = options?.routeScoped ? router.pathname : undefined;
  return canPerformAction(user.jobRole, actionKey, route);
}

/**
 * Get multiple action permissions at once
 * 
 * @param actionKeys - Array of action data-testid values
 * @returns Record<string, boolean> - Map of action key to permission
 * 
 * @example
 * ```tsx
 * const permissions = useCanMultiple([
 *   'inventory-create-item',
 *   'inventory-edit-item',
 *   'inventory-delete-item'
 * ]);
 * // { 'inventory-create-item': true, 'inventory-edit-item': true, ... }
 * ```
 */
export function useCanMultiple(actionKeys: string[]): Record<string, boolean> {
  const { user } = useAuth();
  
  if (!user || !user.jobRole) {
    return actionKeys.reduce((acc, key) => ({ ...acc, [key]: false }), {});
  }

  return actionKeys.reduce((acc, key) => ({
    ...acc,
    [key]: canPerformAction(user.jobRole, key),
  }), {} as Record<string, boolean>);
}

/**
 * Check if user has access to a specific route (hook version)
 * 
 * @param route - The route pathname
 * @returns boolean - true if user can access the route
 */
export function useCanAccessRoute(route: string): boolean {
  const { user } = useAuth();
  
  if (!user || !user.jobRole) {
    return false;
  }

  return canAccessRoute(user.jobRole, route);
}
