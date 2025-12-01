/**
 * M26-EXT2: POS Item Modifiers Drawer Component
 * 
 * Provides a structured UI for configuring modifiers on order items.
 * Features:
 * - Modifier group selection with min/max validation
 * - Real-time price calculation with modifier deltas
 * - Visual indicators for required vs optional groups
 * - Pre-populates from existing modifiers when editing
 */

'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { PosModifierGroup, PosOrderLineModifier } from '@/types/pos';
import { PosMenuItem } from '@/hooks/usePosCachedMenu';
import {
  calculateModifiersTotal,
  validateModifierSelection,
  isModifierSelectionValid,
} from '@/lib/posModifiers';

export interface PosItemModifiersDrawerProps {
  open: boolean;
  onClose: () => void;

  // The menu item being configured (used for name + base price + groups)
  item: PosMenuItem;

  // Existing selection from the order line (if editing)
  existingModifiers?: PosOrderLineModifier[];

  // Base unit price for the item (without modifiers)
  basePrice: number;

  // Callback when user confirms selection
  onConfirm: (modifiers: PosOrderLineModifier[], totalPrice: number) => void;
}

export function PosItemModifiersDrawer(props: PosItemModifiersDrawerProps) {
  const { open, onClose, item, existingModifiers, basePrice, onConfirm } = props;

  // Build selection state: Record<groupId, PosOrderLineModifier[]>
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, PosOrderLineModifier[]>>(
    {}
  );

  // Initialize from existing modifiers
  useEffect(() => {
    if (!existingModifiers || existingModifiers.length === 0) {
      setSelectedByGroup({});
      return;
    }

    const grouped: Record<string, PosOrderLineModifier[]> = {};
    for (const mod of existingModifiers) {
      if (!grouped[mod.groupId]) {
        grouped[mod.groupId] = [];
      }
      grouped[mod.groupId].push(mod);
    }
    setSelectedByGroup(grouped);
  }, [existingModifiers, open]);

  const allSelected = useMemo(() => {
    return Object.values(selectedByGroup).flat();
  }, [selectedByGroup]);

  const modifiersTotal = useMemo(() => {
    return calculateModifiersTotal(allSelected);
  }, [allSelected]);

  const totalPrice = basePrice + modifiersTotal;

  const validationResults = useMemo(() => {
    return validateModifierSelection(item.modifierGroups, selectedByGroup);
  }, [item.modifierGroups, selectedByGroup]);

  const canSave = useMemo(() => {
    return isModifierSelectionValid(item.modifierGroups, selectedByGroup);
  }, [item.modifierGroups, selectedByGroup]);

  const handleToggleOption = (
    group: PosModifierGroup,
    optionId: string,
    optionName: string,
    priceDelta: number
  ) => {
    setSelectedByGroup((prev) => {
      const current = prev[group.id] || [];
      const exists = current.find((m) => m.optionId === optionId);

      if (exists) {
        // Remove
        return {
          ...prev,
          [group.id]: current.filter((m) => m.optionId !== optionId),
        };
      } else {
        // Add - but enforce max
        let next = [
          ...current,
          {
            groupId: group.id,
            groupName: group.name,
            optionId,
            optionName,
            priceDelta,
          },
        ];

        // If adding would exceed max, remove the oldest
        if (next.length > group.maxSelections) {
          next = next.slice(next.length - group.maxSelections);
        }

        return {
          ...prev,
          [group.id]: next,
        };
      }
    });
  };

  const handleSave = () => {
    if (!canSave) return;
    onConfirm(allSelected, totalPrice);
    onClose();
  };

  if (!open) return null;

  const groups = item.modifierGroups || [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-xl bg-slate-900 sm:rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Configure Modifiers</h2>
            <p className="text-sm text-slate-400">{item.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {groups.length === 0 && (
            <p className="text-center text-sm text-slate-400">No modifiers available</p>
          )}

          {groups.map((group) => {
            const selectedInGroup = selectedByGroup[group.id] || [];
            const validation = validationResults.find((v) => v.groupId === group.id);

            const requirementText =
              group.minSelections === group.maxSelections
                ? `Choose ${group.minSelections}`
                : group.minSelections === 0
                  ? `Choose up to ${group.maxSelections}`
                  : `Choose ${group.minSelections}-${group.maxSelections}`;

            return (
              <div key={group.id} className="mb-6 last:mb-0">
                <div className="mb-2 flex items-baseline justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      {group.name}
                      {group.isRequired && <span className="ml-1 text-red-400">*</span>}
                    </h3>
                    {group.description && (
                      <p className="mt-0.5 text-xs text-slate-400">{group.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">{requirementText}</span>
                </div>

                {validation && !validation.isValid && (
                  <div className="mb-2 rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-400">
                    {validation.message}
                  </div>
                )}

                <div className="space-y-2">
                  {group.options.map((option) => {
                    const isSelected = selectedInGroup.some((m) => m.optionId === option.id);
                    const priceText =
                      option.priceDelta === 0
                        ? 'included'
                        : option.priceDelta > 0
                          ? `+${option.priceDelta.toFixed(0)}`
                          : option.priceDelta.toFixed(0);

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() =>
                          handleToggleOption(group, option.id, option.name, option.priceDelta)
                        }
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-100'
                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-750'
                        }`}
                      >
                        <span>{option.name}</span>
                        <span
                          className={`text-xs ${isSelected ? 'text-emerald-300' : 'text-slate-500'}`}
                        >
                          {priceText}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer - price summary and save */}
        <div className="border-t border-slate-700 bg-slate-800/50 px-4 py-3">
          <div className="mb-3 space-y-1 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Base price:</span>
              <span>{basePrice.toFixed(0)} UGX</span>
            </div>
            {modifiersTotal !== 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Modifiers:</span>
                <span>
                  {modifiersTotal > 0 ? '+' : ''}
                  {modifiersTotal.toFixed(0)} UGX
                </span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-slate-100">
              <span>Total:</span>
              <span>{totalPrice.toFixed(0)} UGX</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                canSave
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'cursor-not-allowed bg-slate-700 text-slate-500'
              }`}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
