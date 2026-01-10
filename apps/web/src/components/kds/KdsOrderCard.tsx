/**
 * M28-KDS-S1: KDS Order Card Component
 * M28-KDS-S2: Extended with ticket priority highlighting
 * M28-KDS-S4: Extended with configurable thresholds and dimming behavior
 * 
 * Displays a single kitchen ticket with:
 * - Order metadata (table, guests, age)
 * - Item list with modifiers and notes
 * - Status-based styling
 * - Priority badges (due soon / late) based on configurable thresholds
 * - Dimming for old ready tickets based on preferences
 * - Context-appropriate action buttons
 */

'use client';

import React from 'react';
import type { KdsOrder } from '@/types/pos';

interface KdsOrderCardProps {
  order: KdsOrder;
  onStart: () => void;
  onReady: () => void;
  onRecall: () => void;
  onServed: () => void;
  dueSoonMinutes: number;
  lateMinutes: number;
  dimReadyAfterMinutes: number;
}

function statusClass(status: string): string {
  switch (status) {
    case 'NEW':
      return 'bg-blue-50 border-blue-200';
    case 'IN_PROGRESS':
      return 'bg-amber-50 border-amber-200';
    case 'READY':
      return 'bg-emerald-50 border-emerald-200';
    case 'SERVED':
      return 'bg-slate-50 border-slate-200 opacity-60';
    case 'VOIDED':
      return 'bg-red-50 border-red-200 opacity-70';
    default:
      return 'bg-slate-50 border-slate-200';
  }
}

function priorityRing(priority: 'normal' | 'dueSoon' | 'late'): string {
  switch (priority) {
    case 'dueSoon':
      return 'ring-2 ring-amber-400';
    case 'late':
      return 'ring-2 ring-red-500';
    default:
      return '';
  }
}

export function KdsOrderCard(props: KdsOrderCardProps) {
  const { order, onStart, onReady, onRecall, onServed, dueSoonMinutes, lateMinutes, dimReadyAfterMinutes } = props;

  const created = new Date(order.createdAt);
  const now = Date.now();
  const ageMin = Math.floor((now - created.getTime()) / 60000);

  // M28-KDS-S4: Use configurable thresholds from preferences
  let priority: 'normal' | 'dueSoon' | 'late' = 'normal';
  if (ageMin >= lateMinutes) priority = 'late';
  else if (ageMin >= dueSoonMinutes) priority = 'dueSoon';

  // M28-KDS-S4: Dim ready tickets after configured minutes
  const isDimmed =
    order.status === 'READY' && ageMin >= dimReadyAfterMinutes && dimReadyAfterMinutes > 0;

  return (
    <div className={`flex flex-col rounded-xl border px-3 py-2 text-xs ${statusClass(order.status)} ${priorityRing(priority)} ${
      isDimmed ? 'opacity-70' : ''
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase text-slate-700">
            {order.ticketNumber ?? order.id}
          </span>
          {order.tableLabel && (
            <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-white">
              {order.tableLabel}
            </span>
          )}
          {order.guestCount != null && order.guestCount > 0 && (
            <span className="text-[10px] text-slate-500">
              {order.guestCount} guest{order.guestCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-600">
          <span>{ageMin} min ago</span>
          {priority === 'dueSoon' && (
            <span className="inline-flex items-center rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">
              Due soon
            </span>
          )}
          {priority === 'late' && (
            <span className="inline-flex items-center rounded-full bg-red-500/30 px-1.5 py-0.5 text-[10px] text-red-100">
              Late
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
            {order.status}
          </span>
        </div>
      </div>

      <div className="mt-2 space-y-1">
        {order.items.map(item => (
          <div key={item.id} className="flex gap-2">
            <span className="w-6 text-right font-semibold text-slate-700">×{item.quantity}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-900">{item.name}</span>
              </div>
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="mt-0.5 text-[10px] text-slate-500">
                  {item.modifiers.join(', ')}
                </div>
              )}
              {item.notes && (
                <div className="mt-0.5 text-[10px] text-amber-700">
                  Note: {item.notes}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {order.status === 'NEW' && (
          <button
            type="button"
            onClick={onStart}
            data-testid="kds-in-progress"
            className="rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700"
          >
            Start ticket
          </button>
        )}
        {(order.status === 'NEW' || order.status === 'IN_PROGRESS') && (
          <button
            type="button"
            onClick={onReady}
            data-testid="kds-ready"
            className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
          >
            Mark ready
          </button>
        )}
        {order.status === 'READY' && (
          <>
            <button
              type="button"
              onClick={onRecall}
              data-testid="kds-recall"
              className="rounded-md bg-amber-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-amber-700"
            >
              Recall
            </button>
            <button
              type="button"
              onClick={onServed}
              data-testid="kds-served"
              className="rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-black"
            >
              Mark served
            </button>
          </>
        )}
      </div>
    </div>
  );
}
