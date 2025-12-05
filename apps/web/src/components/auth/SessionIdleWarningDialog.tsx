/**
 * M32-SEC-S1: Session idle warning dialog
 * Shows a warning before automatic logout due to inactivity
 */

import React from 'react';
import { useDialogFocus } from '@/hooks/useDialogFocus';

interface Props {
  isOpen: boolean;
  minutesUntilLogout: number;
  onStaySignedIn: () => void;
  onLogoutNow: () => void;
}

export const SessionIdleWarningDialog: React.FC<Props> = ({
  isOpen,
  minutesUntilLogout,
  onStaySignedIn,
  onLogoutNow,
}) => {
  const rootRef = useDialogFocus<HTMLDivElement>({
    isOpen,
    onClose: onStaySignedIn, // ESC = treat as activity (keep session)
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
      <div
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-idle-title"
        aria-describedby="session-idle-description"
        tabIndex={-1}
        className="w-full max-w-sm rounded-lg border border-amber-700 bg-slate-950 px-5 py-4 shadow-xl"
      >
        <h2
          id="session-idle-title"
          className="mb-2 text-sm font-semibold text-amber-100"
        >
          You&apos;re about to be signed out
        </h2>
        <p
          id="session-idle-description"
          className="mb-4 text-xs text-slate-200"
        >
          For your security, you will be automatically signed out in{' '}
          <span className="font-semibold text-amber-200">
            {minutesUntilLogout} minute
            {minutesUntilLogout !== 1 ? 's' : ''}
          </span>{' '}
          if there is no activity.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onLogoutNow}
            className="rounded-md border border-rose-500 px-3 py-1.5 text-[11px] text-rose-100 hover:bg-rose-900/60"
          >
            Sign out now
          </button>
          <button
            type="button"
            onClick={onStaySignedIn}
            className="rounded-md border border-emerald-500 px-3 py-1.5 text-[11px] text-emerald-100 hover:bg-emerald-900/60"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
};
