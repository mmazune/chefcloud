// M29-PWA-S2: Smart root redirect based on device role
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useDeviceRole } from '@/hooks/useDeviceRole';
import { DEVICE_ROLE_ROUTE } from '@/types/deviceRole';

export default function RootRedirectPage() {
  const router = useRouter();
  const { role, isLoaded } = useDeviceRole();

  useEffect(() => {
    if (!isLoaded) return;
    const target = DEVICE_ROLE_ROUTE[role] ?? '/pos';
    void router.replace(target);
  }, [isLoaded, role, router]);

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
