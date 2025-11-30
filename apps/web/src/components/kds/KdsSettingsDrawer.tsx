// apps/web/src/components/kds/KdsSettingsDrawer.tsx
// M28-KDS-S4: KDS Settings & Local Preferences
// Device-local settings drawer for configuring KDS behavior
'use client';

import React from 'react';
import { useKdsPreferences } from '@/hooks/useKdsPreferences';

interface KdsSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  // For display only
  isRealtimeConnected: boolean;
}

export function KdsSettingsDrawer(props: KdsSettingsDrawerProps) {
  const { isOpen, onClose, isRealtimeConnected } = props;
  const { prefs, isLoaded, updatePrefs, resetPrefs } = useKdsPreferences();

  if (!isOpen) return null;
  if (!isLoaded) return null;

  const handleNumberChange = (path: string, value: number) => {
    if (Number.isNaN(value) || value < 0) return;
    updatePrefs(prev => {
      const next = structuredClone(prev) as typeof prev;
      switch (path) {
        case 'priority.dueSoonMinutes':
          next.priority.dueSoonMinutes = value;
          break;
        case 'priority.lateMinutes':
          next.priority.lateMinutes = value;
          break;
        case 'display.dimReadyAfterMinutes':
          next.display.dimReadyAfterMinutes = value;
          break;
        default:
          break;
      }
      return next;
    });
  };

  const handleCheckboxChange = (path: string, checked: boolean) => {
    updatePrefs(prev => {
      const next = structuredClone(prev) as typeof prev;
      switch (path) {
        case 'display.hideServed':
          next.display.hideServed = checked;
          break;
        case 'sounds.enableNewTicketSound':
          next.sounds.enableNewTicketSound = checked;
          break;
        case 'sounds.enableLateTicketSound':
          next.sounds.enableLateTicketSound = checked;
          break;
        default:
          break;
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} aria-hidden="true" />
      <aside className="w-full max-w-md bg-slate-950 text-slate-100 border-l border-slate-800 flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold">KDS Settings</h2>
            <p className="text-[11px] text-slate-400">
              Device-specific preferences for this screen.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-slate-400 hover:text-slate-100"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-xs">
          {/* Priority */}
          <section>
            <h3 className="text-[11px] font-semibold text-slate-200">Ticket priority</h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Control when tickets are marked as &quot;due soon&quot; or &quot;late&quot;.
            </p>
            <div className="mt-2 space-y-2">
              <label className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-300">Due soon after (minutes)</span>
                <input
                  type="number"
                  min={1}
                  className="h-7 w-20 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-right"
                  value={prefs.priority.dueSoonMinutes}
                  onChange={e => handleNumberChange('priority.dueSoonMinutes', Number(e.target.value))}
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-300">Late after (minutes)</span>
                <input
                  type="number"
                  min={1}
                  className="h-7 w-20 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-right"
                  value={prefs.priority.lateMinutes}
                  onChange={e => handleNumberChange('priority.lateMinutes', Number(e.target.value))}
                />
              </label>
            </div>
          </section>

          {/* Display */}
          <section>
            <h3 className="text-[11px] font-semibold text-slate-200">Display</h3>
            <div className="mt-2 space-y-2">
              <label className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-300">Hide served tickets</span>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={prefs.display.hideServed}
                  onChange={e => handleCheckboxChange('display.hideServed', e.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-300">Dim ready after (minutes)</span>
                <input
                  type="number"
                  min={0}
                  className="h-7 w-20 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-right"
                  value={prefs.display.dimReadyAfterMinutes}
                  onChange={e =>
                    handleNumberChange('display.dimReadyAfterMinutes', Number(e.target.value))
                  }
                />
              </label>
            </div>
          </section>

          {/* Sounds */}
          <section>
            <h3 className="text-[11px] font-semibold text-slate-200">Sound alerts</h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Control audio alerts on this screen when new tickets arrive or existing tickets become late.
            </p>
            <div className="mt-2 space-y-2">
              <label className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-300">New ticket sound</span>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={prefs.sounds.enableNewTicketSound}
                  onChange={e =>
                    handleCheckboxChange('sounds.enableNewTicketSound', e.target.checked)
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-300">Late ticket sound</span>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={prefs.sounds.enableLateTicketSound}
                  onChange={e =>
                    handleCheckboxChange('sounds.enableLateTicketSound', e.target.checked)
                  }
                />
              </label>
            </div>
          </section>

          {/* Connection info */}
          <section>
            <h3 className="text-[11px] font-semibold text-slate-200">Connection</h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Realtime is currently{' '}
              <span
                className={
                  isRealtimeConnected ? 'text-emerald-300 font-medium' : 'text-amber-300 font-medium'
                }
              >
                {isRealtimeConnected ? 'connected' : 'in fallback mode'}
              </span>
              .
            </p>
          </section>
        </div>

        <footer className="flex items-center justify-between border-t border-slate-800 px-4 py-3 text-[11px]">
          <button
            type="button"
            onClick={resetPrefs}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-100 hover:bg-slate-800"
          >
            Reset to defaults
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-slate-100 px-3 py-1.5 text-slate-900"
          >
            Done
          </button>
        </footer>
      </aside>
    </div>
  );
}
