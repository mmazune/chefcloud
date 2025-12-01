// M29-PWA-S3: App version metadata
// Prefer build-time env; falls back to "dev"
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';
