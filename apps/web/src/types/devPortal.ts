/**
 * Developer Portal types for E23-DEVPORTAL-FE-S1
 * Types for API keys management
 */

export type DevEnvironment = 'SANDBOX' | 'PRODUCTION';

export type ApiKeyStatus = 'ACTIVE' | 'REVOKED';

export interface DevApiKeyDto {
  id: string;
  label: string;
  environment: DevEnvironment;
  status: ApiKeyStatus;
  createdAt: string;    // ISO
  lastUsedAt: string | null;
  truncatedKey: string; // e.g. "sk_live_****abcd"
}

export interface CreateDevApiKeyRequestDto {
  label: string;
  environment: DevEnvironment;
}

export interface CreateDevApiKeyResponseDto {
  apiKey: DevApiKeyDto;
  // May contain full key in backend; in FE we treat as just apiKey
}

export interface RevokeDevApiKeyResponseDto {
  apiKey: DevApiKeyDto;
}

// ═══════════════════════════════════════════════════════════════════════════
// Webhook types for E23-DEVPORTAL-FE-S2
// ═══════════════════════════════════════════════════════════════════════════

export type DevWebhookStatus = 'ACTIVE' | 'DISABLED';

export type DevWebhookEnvironment = DevEnvironment; // 'SANDBOX' | 'PRODUCTION'

export interface DevWebhookEndpointDto {
  id: string;
  label: string;
  url: string;
  environment: DevWebhookEnvironment;
  status: DevWebhookStatus;
  // Last 4 chars of secret, so we can show "****abcd"
  secretSuffix: string | null;
  createdAt: string;
  lastDeliveryAt: string | null;
  lastDeliveryStatusCode: number | null;
}

export interface CreateDevWebhookRequestDto {
  label: string;
  url: string;
  environment: DevWebhookEnvironment;
  // Default: ACTIVE
}

export interface UpdateDevWebhookRequestDto {
  label: string;
  url: string;
  status: DevWebhookStatus;
}

export interface DevWebhookTestEventRequestDto {
  endpointId: string;
  eventType: string; // e.g. 'order.created', 'payment.captured'
  // Optional payload overrides if backend supports it
}

export interface DevWebhookTestEventResponseDto {
  deliveryId: string;
  statusCode: number | null;
  errorMessage?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Webhook delivery types for E23-DEVPORTAL-FE-S3
// ═══════════════════════════════════════════════════════════════════════════

export type DevWebhookDeliveryStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface DevWebhookDeliveryDto {
  id: string;
  endpointId: string;
  environment: DevWebhookEnvironment;
  eventType: string;
  status: DevWebhookDeliveryStatus;
  statusCode: number | null;
  createdAt: string; // when the event was scheduled
  deliveredAt: string | null; // when the last attempt finished
  attemptCount: number;
  lastErrorMessage: string | null;
  durationMs: number | null; // optional latency measurement
}

export interface DevWebhookDeliveryListResponseDto {
  deliveries: DevWebhookDeliveryDto[];
}

// E23-DEVPORTAL-S5: API Usage & Error Analytics
export type DevUsageRange = '24h' | '7d';

export interface DevUsageTimeseriesPoint {
  timestamp: string;
  requestCount: number;
  errorCount: number;
}

export interface DevUsageTopKey {
  keyId: string;
  label: string;
  environment: DevEnvironment;
  requestCount: number;
  errorCount: number;
}

export interface DevUsageSummary {
  fromIso: string;
  toIso: string;
  range: DevUsageRange;
  totalRequests: number;
  totalErrors: number;
  errorRatePercent: number;
  sandboxRequests: number;
  productionRequests: number;
  timeseries: DevUsageTimeseriesPoint[];
  topKeys: DevUsageTopKey[];
}
