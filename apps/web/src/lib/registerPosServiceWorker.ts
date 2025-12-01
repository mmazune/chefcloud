/**
 * M27-S2: POS Service Worker Registration
 * M29-PWA-S3: Extended with update detection callback
 * 
 * Registers the POS-specific service worker for offline caching
 * and Background Sync support. Optionally notifies when updates are available.
 */

export interface RegisterPosServiceWorkerOptions {
  onUpdateAvailable?: () => void;
}

export function registerPosServiceWorker(
  options: RegisterPosServiceWorkerOptions = {}
): void {
  const { onUpdateAvailable } = options;

  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  // Optional feature flag for quick disable in dev or troubleshooting
  if (process.env.NEXT_PUBLIC_ENABLE_POS_SW === 'false') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw-pos.js', { scope: '/' })
      .then(registration => {
        // eslint-disable-next-line no-console
        console.log('POS service worker registered successfully');

        // M29-PWA-S3: Detect updates
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener('statechange', () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller &&
              onUpdateAvailable
            ) {
              onUpdateAvailable();
            }
          });
        });
      })
      .catch(err => {
        // Avoid throwing, this is optional progressive enhancement
        // eslint-disable-next-line no-console
        console.error('POS service worker registration failed', err);
      });
  });
}
