import React from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ProtectedRoute } from '../ProtectedRoute';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Main authenticated app layout with sidebar and topbar
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden pl-64">
          {/* Topbar */}
          <Topbar />

          {/* Page Content */}
          <main id="main-content" role="main" className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
