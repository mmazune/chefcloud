// apps/web/src/pages/launch.tsx
// M29-PWA-S2: Launch hub for choosing device role
'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useDeviceRole } from '@/hooks/useDeviceRole';
import {
  DEVICE_ROLE_LABELS,
  DEVICE_ROLE_ROUTE,
  type DeviceRole,
} from '@/types/deviceRole';

export default function LaunchPage() {
  const router = useRouter();
  const { role, isLoaded, setRole } = useDeviceRole();

  // Optional: if you want auto-redirect once loaded AND user already has a role
  // comment out if you prefer to always show the hub.
  useEffect(() => {
    if (!isLoaded) return;
    // If you want the launch hub always visible, remove this block.
    // For now, keep hub visible and do not auto-redirect.
  }, [isLoaded]);

  const handleSetRoleAndGo = async (next: DeviceRole) => {
    setRole(next);
    await router.push(DEVICE_ROLE_ROUTE[next]);
  };

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-200 text-xs">
        Loading device role…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div>
          <h1 className="text-sm font-semibold">ChefCloud</h1>
          <p className="text-[11px] text-slate-400">
            Choose what this device is primarily used for.
          </p>
        </div>
        <div className="text-[11px] text-slate-400">
          Current role:{' '}
          <span className="font-medium text-slate-100">
            {DEVICE_ROLE_LABELS[role]}
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 py-4">
        <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-3">
          <RoleCard
            title="POS"
            description="Tables, orders, payments, offline queue."
            role="POS"
            isActive={role === 'POS'}
            onSelect={handleSetRoleAndGo}
          />
          <RoleCard
            title="Kitchen Display"
            description="Tickets, stations, live updates & alerts."
            role="KDS"
            isActive={role === 'KDS'}
            onSelect={handleSetRoleAndGo}
          />
          <RoleCard
            title="Backoffice"
            description="Reports, inventory, staff, configuration."
            role="BACKOFFICE"
            isActive={role === 'BACKOFFICE'}
            onSelect={handleSetRoleAndGo}
          />
        </div>
      </main>
    </div>
  );
}

interface RoleCardProps {
  title: string;
  description: string;
  role: DeviceRole;
  isActive: boolean;
  onSelect: (role: DeviceRole) => void;
}

function RoleCard(props: RoleCardProps) {
  const { title, description, role, isActive, onSelect } = props;

  return (
    <button
      type="button"
      onClick={() => onSelect(role)}
      className={`flex h-40 flex-col justify-between rounded-2xl border px-4 py-3 text-left transition ${
        isActive
          ? 'border-emerald-400 bg-emerald-500/10'
          : 'border-slate-700 bg-slate-900 hover:border-slate-500 hover:bg-slate-800'
      }`}
    >
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-[11px] text-slate-400">{description}</p>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-300">
          {isActive ? 'Default on this device' : 'Set as default'}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 ${
            isActive
              ? 'bg-emerald-500 text-slate-900'
              : 'bg-slate-800 text-slate-100'
          }`}
        >
          Go
        </span>
      </div>
    </button>
  );
}
