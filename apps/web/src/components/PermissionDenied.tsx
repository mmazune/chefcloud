import React from 'react';
import Link from 'next/link';
import { RoleLevel } from '@/lib/auth';
import { ShieldAlert, Home } from 'lucide-react';

interface PermissionDeniedProps {
  requiredRole: RoleLevel;
  currentRole: RoleLevel | null;
}

/**
 * M7.5: Permission denied page component
 * 
 * Shows when user tries to access a route without sufficient permissions.
 * Provides clear messaging and navigation back to dashboard.
 */
export function PermissionDenied({ requiredRole, currentRole }: PermissionDeniedProps) {
  const roleLabels: Record<RoleLevel, string> = {
    L1: 'L1 (Waiter/Bartender)',
    L2: 'L2 (Cashier/Supervisor/Chef)',
    L3: 'L3 (Procurement/Stock/Event Manager)',
    L4: 'L4 (Manager/Accountant)',
    L5: 'L5 (Owner/Admin)',
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 p-8 text-center">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <ShieldAlert className="h-12 w-12 text-destructive" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">
            You don&apos;t have permission to view this page.
          </p>
        </div>

        {/* Details */}
        <div className="rounded-lg border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Your Role:</span>
            <span className="font-medium text-foreground">
              {currentRole ? roleLabels[currentRole] : 'Not authenticated'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Required Role:</span>
            <span className="font-medium text-foreground">{roleLabels[requiredRole]} or higher</span>
          </div>
        </div>

        {/* Help text */}
        <p className="text-sm text-muted-foreground">
          Contact your administrator if you believe you should have access to this resource.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
