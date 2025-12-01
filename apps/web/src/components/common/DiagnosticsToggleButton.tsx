// apps/web/src/components/common/DiagnosticsToggleButton.tsx
'use client';

import React from 'react';

interface DiagnosticsToggleButtonProps {
  onClick: () => void;
}

export function DiagnosticsToggleButton({ onClick }: DiagnosticsToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
    >
      <span className="mr-1">ⓘ</span>
      Diagnostics
    </button>
  );
}
