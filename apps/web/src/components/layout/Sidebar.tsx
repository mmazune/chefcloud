import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { RoleLevel } from '@/lib/auth';
import {
  LayoutDashboard,
  Users,
  Package,
  DollarSign,
  Wrench,
  Calendar,
  MessageSquare,
  Settings,
  BarChart3,
  FileText,
  ShoppingCart,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  minRole: RoleLevel; // Minimum role level required
  franchiseOnly?: boolean; // Only show for multi-branch orgs (L5 only)
}

// M7.5: Navigation items with RBAC enforcement
const navigationItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" />, minRole: RoleLevel.L1 },
  { label: 'POS', href: '/pos', icon: <ShoppingCart className="h-5 w-5" />, minRole: RoleLevel.L1 },
  { label: 'Analytics', href: '/analytics', icon: <BarChart3 className="h-5 w-5" />, minRole: RoleLevel.L3 },
  { label: 'Reports', href: '/reports', icon: <FileText className="h-5 w-5" />, minRole: RoleLevel.L3 },
  { label: 'Staff', href: '/staff', icon: <Users className="h-5 w-5" />, minRole: RoleLevel.L3 },
  { label: 'Inventory', href: '/inventory', icon: <Package className="h-5 w-5" />, minRole: RoleLevel.L3 },
  { label: 'Finance', href: '/finance', icon: <DollarSign className="h-5 w-5" />, minRole: RoleLevel.L4 },
  { label: 'Service Providers', href: '/service-providers', icon: <Wrench className="h-5 w-5" />, minRole: RoleLevel.L3 },
  { label: 'Reservations', href: '/reservations', icon: <Calendar className="h-5 w-5" />, minRole: RoleLevel.L3 },
  { label: 'Feedback', href: '/feedback', icon: <MessageSquare className="h-5 w-5" />, minRole: RoleLevel.L4 },
  { label: 'Settings', href: '/settings', icon: <Settings className="h-5 w-5" />, minRole: RoleLevel.L1 },
];

/**
 * Compare role levels for RBAC
 */
function canAccessRole(userRole: RoleLevel, requiredRole: RoleLevel): boolean {
  const roleOrder = { L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
  return roleOrder[userRole] >= roleOrder[requiredRole];
}

export function Sidebar() {
  const router = useRouter();
  const { user } = useAuth();

  const isActive = (href: string) => {
    return router.pathname === href || router.pathname.startsWith(href + '/');
  };

  // M7.5: Filter navigation items based on user role
  const visibleItems = navigationItems.filter((item) => {
    if (!user) return false;
    return canAccessRole(user.roleLevel, item.minRole);
  });

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
      {/* Logo/Brand */}
      <div className="flex h-16 items-center border-b px-6">
        <div className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-chefcloud-blue to-chefcloud-lavender text-white font-bold">
            CC
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">ChefCloud</h1>
            <p className="text-xs text-muted-foreground">Backoffice</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Primary" className="flex-1 space-y-1 p-4">
        {visibleItems.map((item) => (
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
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Footer Info */}
      <div className="border-t p-4">
        <div className="text-xs text-muted-foreground">
          <p>v0.1.0 (M23)</p>
          <p className="mt-1">© 2025 ChefCloud</p>
        </div>
      </div>
    </aside>
  );
}
