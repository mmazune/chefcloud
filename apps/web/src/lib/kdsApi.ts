/**
 * M28-KDS-S1: KDS API Helper
 * 
 * Provides clean interface for KDS action endpoints.
 * Maps to backend KDS controller actions from M13.
 */

export type KdsActionType = 'markReady' | 'markServed' | 'recall' | 'start';

interface KdsActionPayload {
  orderId: string;
}

async function postKdsAction(path: string, body: unknown): Promise<void> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const resp = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `KDS action failed: ${resp.status}`);
  }
}

export async function kdsAction(action: KdsActionType, payload: KdsActionPayload): Promise<void> {
  const { orderId } = payload;

  switch (action) {
    case 'start':
      // Maps to sendToKitchen or similar "start cooking" action
      await postKdsAction(`/api/kds/orders/${orderId}/start`, {});
      return;
    case 'markReady':
      await postKdsAction(`/api/kds/orders/${orderId}/ready`, {});
      return;
    case 'recall':
      await postKdsAction(`/api/kds/orders/${orderId}/recall`, {});
      return;
    case 'markServed':
      await postKdsAction(`/api/kds/orders/${orderId}/served`, {});
      return;
    default:
      return;
  }
}
