/**
 * Developer Portal API helper for E23-DEVPORTAL-FE-S1
 * Provides typed fetch functions for Dev Portal endpoints
 */

import {
  DevApiKeyDto,
  CreateDevApiKeyRequestDto,
  CreateDevApiKeyResponseDto,
  RevokeDevApiKeyResponseDto,
  DevWebhookEndpointDto,
  CreateDevWebhookRequestDto,
  UpdateDevWebhookRequestDto,
  DevWebhookTestEventRequestDto,
  DevWebhookTestEventResponseDto,
  DevWebhookDeliveryListResponseDto,
  DevWebhookDeliveryDto,
  DevWebhookDeliveryStatus,
  DevUsageSummary,
  DevUsageRange,
} from '@/types/devPortal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Dev portal request failed (${res.status}): ${body || res.statusText}`,
    );
  }
  return res.json() as Promise<T>;
}

export async function fetchDevApiKeys(): Promise<DevApiKeyDto[]> {
  const res = await fetch(`${API_URL}/dev/keys`, {
    credentials: 'include',
  });
  return handleJson<DevApiKeyDto[]>(res);
}

export async function createDevApiKey(
  payload: CreateDevApiKeyRequestDto,
): Promise<CreateDevApiKeyResponseDto> {
  const res = await fetch(`${API_URL}/dev/keys`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJson<CreateDevApiKeyResponseDto>(res);
}

export async function revokeDevApiKey(
  id: string,
): Promise<RevokeDevApiKeyResponseDto> {
  const res = await fetch(`${API_URL}/dev/keys/${encodeURIComponent(id)}/revoke`, {
    method: 'POST',
    credentials: 'include',
  });
  return handleJson<RevokeDevApiKeyResponseDto>(res);
}

// ═══════════════════════════════════════════════════════════════════════════
// Webhook endpoints for E23-DEVPORTAL-FE-S2
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchDevWebhooks(): Promise<DevWebhookEndpointDto[]> {
  const res = await fetch(`${API_URL}/dev/webhooks`, {
    credentials: 'include',
  });
  return handleJson<DevWebhookEndpointDto[]>(res);
}

export async function createDevWebhook(
  payload: CreateDevWebhookRequestDto,
): Promise<DevWebhookEndpointDto> {
  const res = await fetch(`${API_URL}/dev/webhooks`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJson<DevWebhookEndpointDto>(res);
}

export async function updateDevWebhook(
  id: string,
  payload: UpdateDevWebhookRequestDto,
): Promise<DevWebhookEndpointDto> {
  const res = await fetch(`${API_URL}/dev/webhooks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJson<DevWebhookEndpointDto>(res);
}

export async function rotateDevWebhookSecret(
  id: string,
): Promise<DevWebhookEndpointDto> {
  const res = await fetch(
    `${API_URL}/dev/webhooks/${encodeURIComponent(id)}/rotate-secret`,
    {
      method: 'POST',
      credentials: 'include',
    },
  );
  return handleJson<DevWebhookEndpointDto>(res);
}

export async function sendDevWebhookTestEvent(
  payload: DevWebhookTestEventRequestDto,
): Promise<DevWebhookTestEventResponseDto> {
  const res = await fetch(`${API_URL}/dev/webhook/events`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJson<DevWebhookTestEventResponseDto>(res);
}

// ═══════════════════════════════════════════════════════════════════════════
// Webhook delivery endpoints for E23-DEVPORTAL-FE-S3
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchDevWebhookDeliveries(params: {
  endpointId: string;
  limit?: number;
  status?: DevWebhookDeliveryStatus | 'ALL';
  eventType?: string;
}): Promise<DevWebhookDeliveryListResponseDto> {
  const search = new URLSearchParams();
  search.set('endpointId', params.endpointId);
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.status && params.status !== 'ALL') {
    search.set('status', params.status);
  }
  if (params.eventType) search.set('eventType', params.eventType);

  const res = await fetch(
    `${API_URL}/dev/webhooks/${encodeURIComponent(
      params.endpointId,
    )}/deliveries?${search.toString()}`,
    {
      credentials: 'include',
    },
  );
  return handleJson<DevWebhookDeliveryListResponseDto>(res);
}

export async function retryDevWebhookDelivery(
  deliveryId: string,
): Promise<DevWebhookDeliveryDto> {
  const res = await fetch(
    `${API_URL}/dev/webhook/deliveries/${encodeURIComponent(deliveryId)}/retry`,
    {
      method: 'POST',
      credentials: 'include',
    },
  );
  return handleJson<DevWebhookDeliveryDto>(res);
}

// ═══════════════════════════════════════════════════════════════════════════
// Usage analytics endpoints for E23-DEVPORTAL-FE-S5
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchDevUsageSummary(
  range: DevUsageRange = '24h',
): Promise<DevUsageSummary> {
  const params = new URLSearchParams();
  params.set('range', range);

  const res = await fetch(`${API_URL}/dev/usage?${params.toString()}`, {
    credentials: 'include',
  });
  return handleJson<DevUsageSummary>(res);
}
