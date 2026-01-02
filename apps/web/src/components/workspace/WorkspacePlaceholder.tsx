/**
 * M8.1: Reusable Workspace Placeholder Component
 * 
 * Shows a role-specific landing page with quick links
 */
import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getRoleCapabilities, type JobRole } from '@/config/roleCapabilities';
import { AppShell } from '@/components/layout/AppShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoIcon } from 'lucide-react';

interface WorkspacePlaceholderProps {
  expectedRole: JobRole;
  customLinks?: { label: string; href: string; description?: string }[];
}

export function WorkspacePlaceholder({ expectedRole, customLinks }: WorkspacePlaceholderProps) {
  const { user } = useAuth();
  const capabilities = getRoleCapabilities(expectedRole);
  
  // Collect all nav items as quick links
  const quickLinks = customLinks || capabilities.navGroups.flatMap(group => 
    group.items.map(item => ({
      label: item.label,
      href: item.href,
      description: item.description || `Navigate to ${item.label}`,
    }))
  );

  // Show warning if user's jobRole doesn't match expected
  const roleMismatch = user?.jobRole && user.jobRole !== expectedRole;

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{capabilities.workspaceTitle}</h1>
          <p className="text-muted-foreground mt-1">{capabilities.workspaceDescription}</p>
        </div>

        {/* Role mismatch warning */}
        {roleMismatch && (
          <Alert variant="default">
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>Different role detected</AlertTitle>
            <AlertDescription>
              You are logged in as <strong>{user?.jobRole}</strong>, but viewing the{' '}
              <strong>{expectedRole}</strong> workspace. Some features may not be available.
            </AlertDescription>
          </Alert>
        )}

        {/* No jobRole warning */}
        {!user?.jobRole && (
          <Alert variant="default">
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>No job role assigned</AlertTitle>
            <AlertDescription>
              Your account doesn&apos;t have a job role assigned. Contact your administrator to get
              role-specific features.
            </AlertDescription>
          </Alert>
        )}

        {/* Quick Links Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickLinks.slice(0, 9).map((link) => (
            <Link key={link.href} href={link.href} className="block">
              <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{link.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{link.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Placeholder notice */}
        <div className="mt-8 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            🚧 This workspace is under construction. Role-specific widgets and dashboards will be
            added in upcoming milestones.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
