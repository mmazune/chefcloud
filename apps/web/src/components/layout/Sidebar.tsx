import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { getRoleCapabilities } from '@/config/roleCapabilities';
import { isNavmapEnabled, recordSidebarLinks, startCapture } from '@/lib/navmap';

/**
 * M8.1: Config-driven Sidebar Navigation
 * 
 * Navigation is now fully driven by roleCapabilities.ts
 * No scattered if/else role checks - single source of truth
 * 
 * Phase I3: Navmap capture mode supported
 */
export function Sidebar() {
  const router = useRouter();
  const { user } = useAuth();

  const isActive = (href: string) => {
    return router.pathname === href || router.pathname.startsWith(href + '/');
  };

  // M8.1: Get nav groups from roleCapabilities based on jobRole
  const capabilities = getRoleCapabilities(user?.jobRole);
  const navGroups = capabilities.navGroups;

  // Phase I3: Record sidebar links for navmap capture
  useEffect(() => {
    if (!isNavmapEnabled() || !user?.jobRole) return;
    
    // Start capture for this role
    startCapture(user.jobRole);
    
    // Record all sidebar links
    navGroups.forEach(group => {
      recordSidebarLinks(
        group.title,
        group.items.map(item => ({
          label: item.label,
          href: item.href,
          isActive: isActive(item.href),
        }))
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.jobRole, navGroups]);

  // M8.6: Get role home route for logo click
  const roleHome = capabilities.defaultRoute;

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card flex flex-col">
      {/* Logo/Brand - M8.6: Clicking logo navigates to role home */}
      <div className="flex h-16 items-center border-b px-6">
        <Link
          href={roleHome}
          className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
          aria-label="Go to workspace home"
          data-testid="sidebar-logo"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-chefcloud-blue to-chefcloud-lavender text-white font-bold">
            CC
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">ChefCloud</h1>
            <p className="text-xs text-muted-foreground">
              {user?.jobRole ? user.jobRole.replace('_', ' ') : 'Backoffice'}
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation - M8.1: Grouped by roleCapabilities */}
      <nav aria-label="Primary" className="flex-1 overflow-y-auto p-4 space-y-6">
        {navGroups.map((group) => (
          <div key={group.title}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
              {group.title}
            </h2>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={cn(
                      'flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer Info */}
      <div className="border-t p-4">
        <div className="text-xs text-muted-foreground">
          <p>v0.1.0 (M8.1)</p>
          <p className="mt-1">© 2025 ChefCloud</p>
        </div>
      </div>
    </aside>
  );
}
