/**
 * Route Guard Component
 * 
 * Wraps page content and shows 403 "No Access" page if the user's role
 * cannot access the current route according to the runtime navigation map.
 * 
 * This provides defense-in-depth: the sidebar hides unauthorized items,
 * but this guard blocks direct URL access.
 */

import React from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessRoute } from '@/navmap';
import { NoAccessPage } from './NoAccessPage';

interface RouteGuardProps {
  children: React.ReactNode;
  /** If true, bypass route guard (for public pages) */
  bypass?: boolean;
}

/**
 * RouteGuard: NavMap-driven route access control
 * 
 * Usage:
 * ```tsx
 * <RouteGuard>
 *   <InventoryPage />
 * </RouteGuard>
 * ```
 */
export function RouteGuard({ children, bypass = false }: RouteGuardProps) {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Show loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If bypass mode, skip guard
  if (bypass) {
    return <>{children}</>;
  }

  // Not authenticated - should be handled by ProtectedRoute
  if (!user) {
    return <NoAccessPage reason="not-authenticated" />;
  }

  // Check route access via NavMap runtime
  const pathname = router.pathname;
  const hasAccess = canAccessRoute(user.jobRole, pathname);

  if (!hasAccess) {
    return <NoAccessPage reason="forbidden" route={pathname} role={user.jobRole} />;
  }

  // User has access, render children
  return <>{children}</>;
}
