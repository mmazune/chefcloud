/**
 * M27-S2: POS Service Worker
 * 
 * Provides offline caching and Background Sync support for POS
 * - Caches POS shell and static assets
 * - Caches POS-related GET API responses
 * - Responds to Background Sync events
 */

const POS_STATIC_CACHE = 'chefcloud-pos-static-v1';
const POS_API_CACHE = 'chefcloud-pos-api-v1';
const PRECACHE_URLS = ['/pos', '/favicon.ico'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(POS_STATIC_CACHE).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== POS_STATIC_CACHE && key !== POS_API_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // POS page navigation
  if (request.mode === 'navigate' && url.pathname === '/pos') {
    event.respondWith(networkFirst(request, POS_STATIC_CACHE));
    return;
  }

  // Static assets (Next.js build output, public assets)
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/static')) {
    event.respondWith(cacheFirst(request, POS_STATIC_CACHE));
    return;
  }

  // POS-related GET APIs
  if (
    url.pathname.startsWith('/api/pos') ||
    url.pathname.startsWith('/api/menu')
  ) {
    event.respondWith(networkFirst(request, POS_API_CACHE));
    return;
  }

  // For everything else, do nothing (browser default)
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
