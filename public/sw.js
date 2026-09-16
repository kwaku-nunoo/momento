/**
 * MOMENTO — Event Venue Offline & Low-Connectivity Service Worker
 * Version: 2.0.0
 * 
 * Strategy:
 * 1. App Shell & Core Assets: Cache-First / Pre-cached with stale-while-revalidate fallback.
 * 2. Navigation (SPA Routing): Network-First with fast 3s timeout & App Shell fallback.
 * 3. Event API Data (/api/events/*): Network-First with cache fallback for offline gallery browsing.
 * 4. Photos & Thumbnails: Cache-First / Stale-While-Revalidate with LRU size limit.
 * 5. Mutations & Streams: Passthrough (never cached).
 */

const CACHE_VERSION = 'v3';
const SHELL_CACHE = `momento-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `momento-runtime-${CACHE_VERSION}`;
const API_CACHE = `momento-api-${CACHE_VERSION}`;
const MEDIA_CACHE = `momento-media-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/momento-192.png',
  '/momento-512.png',
  '/momento 1.svg',
  '/momento.svg',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Cabinet+Grotesk:wght@700;800;900&display=swap'
];

const MAX_MEDIA_ENTRIES = 250;

// Helper: Trim cache to max items to avoid quota exceeded
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const itemsToDelete = keys.slice(0, keys.length - maxItems);
      await Promise.all(itemsToDelete.map((key) => cache.delete(key)));
    }
  } catch (err) {
    console.debug('[SW] Cache trim non-fatal:', err);
  }
}

// 1. Install Event: Pre-cache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      // Use allSettled so single asset failure (e.g. offline CDN) doesn't abort shell installation
      const promises = PRECACHE_ASSETS.map(async (url) => {
        try {
          const req = new Request(url, { mode: url.startsWith('http') && !url.includes(self.location.hostname) ? 'cors' : 'same-origin' });
          const res = await fetch(req);
          if (res && res.status === 200) {
            await cache.put(req, res);
          }
        } catch (e) {
          console.debug(`[SW Install] Non-blocking precache note for ${url}:`, e);
        }
      });
      await Promise.allSettled(promises);
    })
  );
  self.skipWaiting();
});

// 2. Activate Event: Cleanup outdated caches and claim clients
self.addEventListener('activate', (event) => {
  const currentCaches = [SHELL_CACHE, RUNTIME_CACHE, API_CACHE, MEDIA_CACHE];
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!currentCaches.includes(key)) {
            console.log(`[SW Activate] Purging stale cache: ${key}`);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Multi-tiered caching strategy for low-connectivity venues
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // A. Bypass non-GET requests (mutations: POST, PUT, DELETE, PATCH)
  if (request.method !== 'GET') {
    return;
  }

  // B. Bypass real-time streams, SSE, heavy original full-size downloads, and ZIPs
  if (
    url.pathname.includes('/stream') ||
    url.pathname.includes('/original') ||
    url.pathname.includes('/download-zip')
  ) {
    return;
  }

  // C. Strategy for Navigation Requests (HTML / SPA Routes like /e/event-code, /admin, etc.)
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      (async () => {
        try {
          // Attempt network fetch with a 3.5s timeout for spotty venue cell service
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);

          const networkResponse = await fetch(request, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (networkResponse && networkResponse.status === 200) {
            // Update shell cache in background
            const cache = await caches.open(SHELL_CACHE);
            cache.put('/index.html', networkResponse.clone());
            return networkResponse;
          }
        } catch (err) {
          console.log('[SW] Navigation network failed/timed out, serving cached App Shell:', url.pathname);
        }

        // Fallback: App Shell cached index.html
        const cachedShell = await caches.match('/index.html');
        if (cachedShell) {
          return cachedShell;
        }

        // Deep fallback for any root match
        const rootMatch = await caches.match('/');
        return rootMatch || Response.error();
      })()
    );
    return;
  }

  // D. Strategy for API Event Metadata (/api/events/*)
  // Network-First with Cache Fallback: Keeps gallery metadata fresh when connected, but accessible when venue connection drops!
  if (url.pathname.startsWith('/api/events')) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(API_CACHE);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (networkError) {
          console.log(`[SW] API offline fallback for: ${url.pathname}`);
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            // Add custom header to let client know this is cached offline data
            const headers = new Headers(cachedResponse.headers);
            headers.set('X-Momento-Offline-Cache', 'true');
            return new Response(cachedResponse.body, {
              status: cachedResponse.status,
              statusText: cachedResponse.statusText,
              headers
            });
          }
          throw networkError;
        }
      })()
    );
    return;
  }

  // E. Strategy for Photo Thumbnails and Previews (/api/photos/*, /uploads/thumbnails/*, /uploads/previews/*)
  // Stale-While-Revalidate / Cache-First for instant scrolling in low-connectivity venues
  if (
    url.pathname.includes('/thumbnail') ||
    url.pathname.includes('/preview') ||
    url.pathname.includes('/uploads/thumbnails') ||
    url.pathname.includes('/uploads/previews')
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(MEDIA_CACHE);
        const cachedResponse = await cache.match(request);

        // Fetch in background or if not in cache
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
              trimCache(MEDIA_CACHE, MAX_MEDIA_ENTRIES);
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })()
    );
    return;
  }

  // F. Strategy for Static Assets (JS, CSS, SVGs, Web Fonts, Images in /assets/)
  // Cache-First with Network Revalidation
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.ttf') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com')
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) {
          // Revalidate in background
          fetch(request).then(async (res) => {
            if (res && res.status === 200) {
              const targetCache = (url.hostname.includes('fonts') || url.pathname.endsWith('.svg')) ? SHELL_CACHE : RUNTIME_CACHE;
              const c = await caches.open(targetCache);
              c.put(request, res);
            }
          }).catch(() => {});
          return cached;
        }

        try {
          const res = await fetch(request);
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const targetCache = (url.hostname.includes('fonts') || url.pathname.endsWith('.svg')) ? SHELL_CACHE : RUNTIME_CACHE;
            const c = await caches.open(targetCache);
            c.put(request, res.clone());
          }
          return res;
        } catch (err) {
          console.debug('[SW] Asset fetch failed and not cached:', url.pathname);
          return Response.error();
        }
      })()
    );
    return;
  }

  // G. Default: Network fetch with cache match fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      return cachedResponse || fetch(request);
    })
  );
});

// 4. Message Handler for Client Communication (Diagnostics & Cache Invalidation)
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'GET_CACHE_INFO') {
    (async () => {
      try {
        const shellCache = await caches.open(SHELL_CACHE);
        const apiCache = await caches.open(API_CACHE);
        const mediaCache = await caches.open(MEDIA_CACHE);
        const runtimeCache = await caches.open(RUNTIME_CACHE);

        const [shellKeys, apiKeys, mediaKeys, runtimeKeys] = await Promise.all([
          shellCache.keys(),
          apiCache.keys(),
          mediaCache.keys(),
          runtimeCache.keys()
        ]);

        event.ports[0]?.postMessage({
          version: CACHE_VERSION,
          shellAssetsCount: shellKeys.length,
          apiItemsCount: apiKeys.length,
          mediaItemsCount: mediaKeys.length,
          runtimeChunksCount: runtimeKeys.length,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        event.ports[0]?.postMessage({ error: err.message });
      }
    })();
  }

  if (event.data.type === 'CLEAR_MEDIA_CACHE') {
    caches.delete(MEDIA_CACHE).then(() => {
      event.ports[0]?.postMessage({ success: true });
    });
  }
});
