// M29-PWA-S2: Smart root redirect based on device role
// M8.1: Enhanced with jobRole-based routing for backoffice
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useDeviceRole } from '@/hooks/useDeviceRole';
import { useAuth } from '@/contexts/AuthContext';
import { DEVICE_ROLE_ROUTE } from '@/types/deviceRole';
import { getDefaultRoute } from '@/config/roleCapabilities';

export default function RootRedirectPage() {
  const router = useRouter();
  const { role, isLoaded } = useDeviceRole();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!isLoaded || authLoading) return;
    
    // M8.1: For BACKOFFICE device role, use jobRole-based routing if user is logged in
    if (role === 'BACKOFFICE' && user?.jobRole) {
      const target = getDefaultRoute(user.jobRole);
      void router.replace(target);
      return;
    }
    
    // Default device role routing
    const target = DEVICE_ROLE_ROUTE[role] ?? '/pos';
    void router.replace(target);
  }, [isLoaded, role, router, user, authLoading]);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-950 text-slate-100 text-xs">
      <p>Redirecting to your default ChefCloud screen…</p>
      <p className="mt-2 text-[11px] text-slate-500">
        If nothing happens,{' '}
        <Link href="/launch" className="underline">
          tap here to choose a role
        </Link>
        .
      </p>
    </div>
  );
}
