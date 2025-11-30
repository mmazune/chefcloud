// apps/web/src/hooks/useKdsSoundAlerts.ts
// M28-KDS-S5: Audio alerts for new and late tickets
// Watches KDS order changes and triggers audio based on preferences
'use client';

import { useEffect, useRef } from 'react';
import type { KdsOrder } from '@/types/pos';
import type { KdsPreferences } from '@/types/kds';
import { playNewTicketSound, playLateTicketSound } from '@/lib/kdsAudio';

interface UseKdsSoundAlertsOptions {
  orders: KdsOrder[];
  prefs: KdsPreferences;
  isOnline: boolean;
}

export function useKdsSoundAlerts(options: UseKdsSoundAlertsOptions): void {
  const { orders, prefs, isOnline } = options;

  const seenOrdersRef = useRef<Set<string>>(new Set());
  const lateAlertedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isOnline) return;
    if (typeof window === 'undefined') return;

    const currentIds = new Set<string>();
    const now = Date.now();

    // Determine thresholds in milliseconds
    const lateMs = prefs.priority.lateMinutes * 60_000;

    const newOrderIdsToAlert: string[] = [];
    const lateOrderIdsToAlert: string[] = [];

    for (const o of orders) {
      currentIds.add(o.id);

      const created = new Date(o.createdAt).getTime();
      const ageMs = now - created;

      // New ticket: order id not previously seen
      if (prefs.sounds.enableNewTicketSound && !seenOrdersRef.current.has(o.id)) {
        newOrderIdsToAlert.push(o.id);
      }

      // Late ticket: crosses late threshold and not already alerted, and in active statuses
      const isActiveStatus = o.status === 'NEW' || o.status === 'IN_PROGRESS' || o.status === 'READY';
      if (
        prefs.sounds.enableLateTicketSound &&
        isActiveStatus &&
        ageMs >= lateMs &&
        !lateAlertedRef.current.has(o.id)
      ) {
        lateOrderIdsToAlert.push(o.id);
      }
    }

    // Update seen set to all current ids
    seenOrdersRef.current = currentIds;

    // Add late-alerted ids to their set
    for (const id of lateOrderIdsToAlert) {
      lateAlertedRef.current.add(id);
    }

    // Fire sounds (new tickets first, then late)
    const playAlerts = async () => {
      if (newOrderIdsToAlert.length > 0) {
        await playNewTicketSound();
      }
      if (lateOrderIdsToAlert.length > 0) {
        await playLateTicketSound();
      }
    };

    void playAlerts();
  }, [orders, prefs.priority.lateMinutes, prefs.sounds.enableNewTicketSound, prefs.sounds.enableLateTicketSound, isOnline]);
}
