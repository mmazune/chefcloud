/**
 * M27-S2: POS Service Worker
 * M27-S5: Extended to support backoffice offline (Inventory + Staff)
 * M28-KDS-S1: Extended to support KDS offline
 * M29-PWA-S3: Extended to support controlled updates via SKIP_WAITING
 * 
 * Provides offline caching and Background Sync support for POS + backoffice + KDS
 * - Caches POS, backoffice, and KDS shells and static assets
 * - Caches POS, backoffice, and KDS GET API responses
 * - Responds to Background Sync events
 * - Supports controlled app updates via message handler
 */

// M29-PWA-S3: Message handler for controlled updates
self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Bump versions when you change caching strategy so old caches are dropped
const APP_STATIC_CACHE = 'chefcloud-app-static-v3';
const APP_API_CACHE = 'chefcloud-app-api-v3';

const PRECACHE_URLS = [
  '/pos',
  '/inventory',
  '/staff',
  '/kds',
  '/favicon.ico',
];

const NAV_PATHS = ['/pos', '/inventory', '/staff', '/kds'];

const API_PREFIXES = [
  '/api/pos',
  '/api/menu',
  '/api/inventory',
  '/api/hr/staff',
  '/api/kds',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(APP_STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== APP_STATIC_CACHE && key !== APP_API_CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Navigation requests – POS + backoffice main pages
  if (request.mode === 'navigate' && NAV_PATHS.includes(url.pathname)) {
    event.respondWith(networkFirst(request, APP_STATIC_CACHE));
    return;
  }

  // Static assets (Next.js build output, public assets)
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/static')) {
    event.respondWith(cacheFirst(request, APP_STATIC_CACHE));
    return;
  }

  // GET APIs for POS + backoffice
  if (API_PREFIXES.some(prefix => url.pathname.startsWith(prefix))) {
    event.respondWith(networkFirst(request, APP_API_CACHE));
    return;
  }

  // Everything else: let the browser handle it
});

self.addEventListener('sync', event => {
  if (event.tag === 'chefcloud-pos-offline-queue-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'POS_SYNC_QUEUE' });
        });
      })
    );
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}
