import { useEffect, useRef } from 'react';

interface UseDialogFocusOptions {
  isOpen: boolean;
  onClose?: () => void;
}

/**
 * Basic focus + ESC handling for dialog-like overlays.
 * - Moves focus to the dialog root when opened (if focusable).
 * - Restores focus to the previously-focused element when closed.
 * - Handles Escape key to close (if onClose provided).
 */
export function useDialogFocus<T extends HTMLElement>({
  isOpen,
  onClose,
}: UseDialogFocusOptions) {
  const dialogRef = useRef<T | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Remember current focus
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    // Focus dialog root on next tick
    const id = window.setTimeout(() => {
      const el = dialogRef.current;
      if (el && typeof el.focus === 'function') {
        el.focus();
      }
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        event.stopPropagation();
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(id);
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus when dialog closes
      const prev = previousActiveElementRef.current;
      if (prev && typeof prev.focus === 'function') {
        prev.focus();
      }
    };
  }, [isOpen, onClose]);

  return dialogRef;
}
