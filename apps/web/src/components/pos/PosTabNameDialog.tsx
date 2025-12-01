/**
 * M26-EXT3: POS Tab Name Dialog Component
 * 
 * Simple modal for naming or renaming a tab.
 * Features:
 * - Clean modal overlay with keyboard support (Enter to save, Escape to cancel)
 * - Character limit indicator
 * - Validation for empty names
 * - Auto-focus on input
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface PosTabNameDialogProps {
  open: boolean;
  onClose: () => void;

  // Dialog mode
  mode: 'create' | 'rename';

  // Current tab name (for rename mode)
  currentName?: string | null;

  // Callback when user confirms
  onConfirm: (tabName: string) => void;
}

const MAX_TAB_NAME_LENGTH = 50;

export function PosTabNameDialog(props: PosTabNameDialogProps) {
  const { open, onClose, mode, currentName, onConfirm } = props;

  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize name and focus input when dialog opens
  useEffect(() => {
    if (open) {
      setName(currentName || '');
      // Focus input after a brief delay to ensure render
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [open, currentName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmed = name.trim();
    if (!trimmed) return;

    onConfirm(trimmed);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const isValid = name.trim().length > 0 && name.length <= MAX_TAB_NAME_LENGTH;
  const remainingChars = MAX_TAB_NAME_LENGTH - name.length;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {mode === 'create' ? 'Name Tab' : 'Rename Tab'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {mode === 'create' 
                ? 'Give this tab a custom name for easy identification'
                : 'Update the name of this tab'}
            </p>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            <label htmlFor="tab-name" className="block text-sm font-medium text-gray-700 mb-2">
              Tab Name
            </label>
            <input
              ref={inputRef}
              id="tab-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., John – Bar, Table 5, Patio Group"
              maxLength={MAX_TAB_NAME_LENGTH}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className={`${name.trim() ? 'text-gray-500' : 'text-red-600'}`}>
                {name.trim() ? 'Looking good!' : 'Name cannot be empty'}
              </span>
              <span className={`${remainingChars < 10 ? 'text-amber-600' : 'text-gray-400'}`}>
                {remainingChars} characters left
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mode === 'create' ? 'Create Tab' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
