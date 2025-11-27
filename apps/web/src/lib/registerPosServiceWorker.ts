/**
 * M27-S2: POS Service Worker Registration
 * 
 * Registers the POS-specific service worker for offline caching
 * and Background Sync support.
 */

export async function registerPosServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;

  // Optional feature flag for quick disable in dev or troubleshooting
  if (process.env.NEXT_PUBLIC_ENABLE_POS_SW === 'false') return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw-pos.js', {
      scope: '/',
    });
    
    // eslint-disable-next-line no-console
    console.log('POS service worker registered successfully');
    return registration;
  } catch (err) {
    // Avoid throwing, this is optional progressive enhancement
    // eslint-disable-next-line no-console
    console.error('POS service worker registration failed', err);
    return null;
  }
}
