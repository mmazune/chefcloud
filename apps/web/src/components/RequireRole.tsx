import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleLevel } from '@/lib/auth';
import { PermissionDenied } from './PermissionDenied';

interface RequireRoleProps {
  minRole: RoleLevel;
  children: React.ReactNode;
}

/**
 * Compare role levels for RBAC
 */
function canAccessRole(userRole: RoleLevel, requiredRole: RoleLevel): boolean {
  const roleOrder = { L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
  return roleOrder[userRole] >= roleOrder[requiredRole];
}

/**
 * M7.5: Route-level RBAC guard component
 * 
 * Wraps page content and shows PermissionDenied if user lacks required role.
 * This is defense-in-depth: navigation hides items, but direct URL access is blocked here.
 * 
 * Usage:
 * ```tsx
 * <RequireRole minRole={RoleLevel.L4}>
 *   <FinancePage />
 * </RequireRole>
 * ```
 */
export function RequireRole({ minRole, children }: RequireRoleProps) {
  const { user, loading } = useAuth();

  // Show loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // User not authenticated (should be handled by ProtectedRoute, but double-check)
  if (!user) {
    return <PermissionDenied requiredRole={minRole} currentRole={null} />;
  }

  // Check if user has sufficient role level
  if (!canAccessRole(user.roleLevel, minRole)) {
    return <PermissionDenied requiredRole={minRole} currentRole={user.roleLevel} />;
  }

  // User has permission, render children
  return <>{children}</>;
}
