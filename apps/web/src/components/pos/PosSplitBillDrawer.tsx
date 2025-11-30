/**
 * M26-EXT1: POS Split Bill Drawer Component
 * 
 * Provides a clean UX for splitting bills across multiple payments.
 * Features:
 * - Quick split by number of parts (equal distribution)
 * - Manual adjustment of individual payment amounts
 * - Real-time balance validation
 * - Support for tips and payment references
 * - Offline queue integration
 */

'use client';

import React, { useMemo, useState } from 'react';
import type { PosSplitPaymentsDto, PosPaymentDto, PaymentMethod } from '@/types/pos';

interface PosSplitBillDrawerProps {
  isOpen: boolean;
  onClose: () => void;

  orderId: string;
  orderTotal: number;    // total due for the order (including tax, minus discounts)
  currency: string;      // e.g. 'UGX', 'USD'

  onSubmitSplit: (payload: PosSplitPaymentsDto) => Promise<void>;
  isSubmitting: boolean;
}

interface PaymentRow extends PosPaymentDto {
  id: string;
}

function createPaymentRow(partAmount: number): PaymentRow {
  return {
    id: crypto.randomUUID(),
    method: 'CASH' as PaymentMethod,
    amount: partAmount,
    tipAmount: 0,
    reference: '',
  };
}

export function PosSplitBillDrawer(props: PosSplitBillDrawerProps) {
  const {
    isOpen,
    onClose,
    orderId,
    orderTotal,
    currency,
    onSubmitSplit,
    isSubmitting,
  } = props;

  const [splitCount, setSplitCount] = useState<number>(2);
  const [rows, setRows] = useState<PaymentRow[]>(() => {
    const part = Math.round(orderTotal / 2);
    return [createPaymentRow(part), createPaymentRow(orderTotal - part)];
  });
  const [error, setError] = useState<string | null>(null);

  const totalPayments = useMemo(
    () => rows.reduce((sum, r) => sum + (r.amount + (r.tipAmount ?? 0)), 0),
    [rows]
  );

  const balanceDelta = useMemo(() => totalPayments - orderTotal, [totalPayments, orderTotal]);

  const canSubmit = useMemo(
    () => !isSubmitting && Math.abs(balanceDelta) < 0.01 && rows.length > 0,
    [isSubmitting, balanceDelta, rows.length]
  );

  if (!isOpen) return null;

  const handleSplitCountChange = (value: number) => {
    if (value < 1) return;
    setSplitCount(value);

    const base = Math.floor(orderTotal / value);
    const remainder = orderTotal - base * value;

    const newRows: PaymentRow[] = [];
    for (let i = 0; i < value; i++) {
      const part = i === value - 1 ? base + remainder : base;
      newRows.push(createPaymentRow(part));
    }
    setRows(newRows);
  };

  const updateRow = (id: string, updates: Partial<PaymentRow>) => {
    setRows(prev => prev.map(row => (row.id === id ? { ...row, ...updates } : row)));
  };

  const removeRow = (id: string) => {
    setRows(prev => prev.filter(row => row.id !== id));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!canSubmit) {
      setError('Total of split payments must exactly match the order total.');
      return;
    }

    const payload: PosSplitPaymentsDto = {
      payments: rows.map(r => ({
        method: r.method,
        amount: r.amount,
        tipAmount: r.tipAmount ?? 0,
        reference: r.reference || undefined,
      })),
    };

    try {
      await onSubmitSplit(payload);
      onClose();
    } catch (err: any) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to submit split payments. Please try again.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <div
        className="flex-1 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="w-full max-w-md bg-white shadow-xl border-l border-slate-200 flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Split bill</h2>
            <p className="text-xs text-slate-500">
              Order {orderId} · Total {orderTotal.toFixed(2)} {currency}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-900"
          >
            Close
          </button>
        </header>

        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3 text-xs">
          <div className="flex flex-col">
            <span className="text-slate-600">Number of parts</span>
            <div className="mt-1 inline-flex items-center rounded-md border border-slate-200 bg-slate-50">
              <button
                type="button"
                className="px-2 py-1 text-xs text-slate-700"
                onClick={() => handleSplitCountChange(splitCount - 1)}
                disabled={splitCount <= 1}
              >
                −
              </button>
              <span className="px-3 py-1 text-xs text-slate-900">{splitCount}</span>
              <button
                type="button"
                className="px-2 py-1 text-xs text-slate-700"
                onClick={() => handleSplitCountChange(splitCount + 1)}
              >
                +
              </button>
            </div>
          </div>

          <div className="flex flex-col items-end text-xs">
            <span className="text-slate-600">Total payments</span>
            <span className="font-semibold text-slate-900">
              {totalPayments.toFixed(2)} {currency}
            </span>
            <span
              className={`text-[11px] ${
                Math.abs(balanceDelta) < 0.01 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {Math.abs(balanceDelta) < 0.01
                ? 'Balanced'
                : balanceDelta > 0
                ? `Over by ${balanceDelta.toFixed(2)} ${currency}`
                : `Under by ${(-balanceDelta).toFixed(2)} ${currency}`}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {rows.map((row, idx) => (
            <div
              key={row.id}
              className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase w-12">
                    Part {idx + 1}
                  </span>
                  <select
                    className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
                    value={row.method}
                    onChange={e => updateRow(row.id, { method: e.target.value as PaymentMethod })}
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="MOBILE">Mobile</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="h-7 w-24 rounded-md border border-slate-200 bg-white px-2 text-xs text-right"
                    value={row.amount}
                    onChange={e => updateRow(row.id, { amount: Number(e.target.value) || 0 })}
                  />
                  <span className="text-[11px] text-slate-500">{currency}</span>
                </div>
                <div className="flex items-center gap-2 pl-12">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="h-7 w-20 rounded-md border border-slate-200 bg-white px-2 text-xs text-right"
                    placeholder="Tip"
                    value={row.tipAmount ?? 0}
                    onChange={e =>
                      updateRow(row.id, { tipAmount: Number(e.target.value) || 0 })
                    }
                  />
                  <input
                    type="text"
                    className="h-7 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs"
                    placeholder="Reference (optional)"
                    value={row.reference ?? ''}
                    onChange={e => updateRow(row.id, { reference: e.target.value })}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="mt-1 text-[11px] text-slate-400 hover:text-red-500"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {error && (
          <div className="px-4 py-2 text-[11px] text-red-700 bg-red-50 border-t border-red-200">
            {error}
          </div>
        )}

        <footer className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Processing…' : 'Apply split & charge'}
          </button>
        </footer>
      </aside>
    </div>
  );
}
