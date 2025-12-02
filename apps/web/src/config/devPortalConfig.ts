/**
 * Dev Portal configuration (E23-DEVPORTAL-FE-S4)
 * Base URLs and display strings driven by env vars with safe fallbacks
 */

const DEFAULT_SANDBOX_BASE_URL = 'https://sandbox-api.example.com';
const DEFAULT_PRODUCTION_BASE_URL = 'https://api.example.com';

export interface DevPortalConfig {
  sandboxBaseUrl: string;
  productionBaseUrl: string;
  docsExternalUrl?: string;
}

export const devPortalConfig: DevPortalConfig = {
  sandboxBaseUrl:
    process.env.NEXT_PUBLIC_SANDBOX_API_BASE_URL ?? DEFAULT_SANDBOX_BASE_URL,
  productionBaseUrl:
    process.env.NEXT_PUBLIC_PRODUCTION_API_BASE_URL ??
    DEFAULT_PRODUCTION_BASE_URL,
  docsExternalUrl: process.env.NEXT_PUBLIC_DEV_DOCS_URL,
};
