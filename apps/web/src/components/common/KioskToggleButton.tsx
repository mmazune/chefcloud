// apps/web/src/components/common/KioskToggleButton.tsx
// M29-PWA-S1: Reusable kiosk mode toggle button for POS/KDS
'use client';

import React from 'react';
import { useKioskMode } from '@/hooks/useKioskMode';

interface KioskToggleButtonProps {
  size?: 'sm' | 'md';
}

export function KioskToggleButton({ size = 'sm' }: KioskToggleButtonProps) {
  const { isSupported, isActive, toggleKiosk } = useKioskMode();

  if (!isSupported) return null;

  const base =
    'inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800';
  const sizing =
    size === 'sm'
      ? 'px-2 py-1 text-[10px]'
      : 'px-3 py-1.5 text-xs';

  return (
    <button
      type="button"
      onClick={() => void toggleKiosk()}
      className={`${base} ${sizing}`}
    >
      <span className="mr-1 text-[11px]">{isActive ? '⤢' : '⤢'}</span>
      {isActive ? 'Exit kiosk' : 'Kiosk mode'}
    </button>
  );
}
