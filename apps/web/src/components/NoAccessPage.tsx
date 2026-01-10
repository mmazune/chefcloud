/**
 * NoAccessPage Component
 * 
 * Displays a 403 "No Access" page when a user attempts to access
 * a route they are not authorized for.
 */

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getDefaultRoute } from '@/config/roleCapabilities';
import { Button } from '@/components/ui/button';

interface NoAccessPageProps {
  reason: 'forbidden' | 'not-authenticated';
  route?: string;
  role?: string;
}

/**
 * NoAccessPage: 403 Forbidden display
 */
export function NoAccessPage({ reason, route, role }: NoAccessPageProps) {
  const { user } = useAuth();
  const defaultRoute = getDefaultRoute(user?.jobRole);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto max-w-md text-center px-6">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <ShieldAlert className="h-12 w-12 text-destructive" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Access Denied
        </h1>

        {/* Subtitle */}
        <p className="text-lg text-muted-foreground mb-6">
          {reason === 'not-authenticated' 
            ? "You need to be logged in to access this page."
            : "You don't have permission to access this page."
          }
        </p>

        {/* Details */}
        {reason === 'forbidden' && route && (
          <div className="bg-muted/50 rounded-lg p-4 mb-6 text-sm text-left">
            <p className="text-muted-foreground mb-1">
              <span className="font-medium">Requested:</span> {route}
            </p>
            {role && (
              <p className="text-muted-foreground">
                <span className="font-medium">Your role:</span> {role.replace('_', ' ')}
              </p>
            )}
          </div>
        )}

        {/* Help text */}
        <p className="text-sm text-muted-foreground mb-8">
          If you believe you should have access to this page, please contact your administrator.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button 
            variant="outline"
            onClick={() => window.history.back()}
            className="inline-flex items-center"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
          
          <Link href={defaultRoute}>
            <Button className="inline-flex items-center">
              <Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
