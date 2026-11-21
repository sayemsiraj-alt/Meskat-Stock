/* Runtime Service Worker Interceptor for Per-Company Dynamic PWA Manifest & App Icons
 * - For /app-manifest.webmanifest & /app-icon-*.png: Network-First so Google Chrome & Android WebAPK
 *   always fetch fresh server-rendered company branding & binary PNG icons, with offline CacheStorage fallback.
 * - For legacy /manifest.webmanifest & /pwa-*.png: Serve cached company branding if available.
 */
const ERP_DYNAMIC_BRANDING_CACHE = 'erp-dynamic-branding-v1';

const SERVER_BRANDING_PATHS = new Set([
  '/app-manifest.webmanifest',
  '/app-icon-192.png',
  '/app-icon-512.png',
  '/app-icon-maskable-512.png',
  '/app-apple-touch-icon.png',
]);

const LEGACY_BRANDING_PATHS = new Set([
  '/manifest.webmanifest',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
]);

self.addEventListener('fetch', (event) => {
  if (!event || !event.request || event.request.method !== 'GET') return;

  let reqUrl;
  try {
    reqUrl = new URL(event.request.url);
  } catch {
    return;
  }

  if (reqUrl.origin !== self.location.origin) return;

  if (SERVER_BRANDING_PATHS.has(reqUrl.pathname)) {
    event.respondWith(
      (async () => {
        try {
          const networkRes = await fetch(event.request);
          if (networkRes && networkRes.ok) {
            try {
              const cache = await caches.open(ERP_DYNAMIC_BRANDING_CACHE);
              await cache.put(event.request, networkRes.clone());
            } catch {
              // ignore cache write failure
            }
            return networkRes;
          }
        } catch {
          // fall back to offline cache
        }

        try {
          const cache = await caches.open(ERP_DYNAMIC_BRANDING_CACHE);
          const exactCached = await cache.match(event.request);
          if (exactCached) return exactCached.clone();
        } catch {
          // ignore
        }

        return new Response('Offline branding asset unavailable', { status: 503 });
      })()
    );
    return;
  }

  if (!LEGACY_BRANDING_PATHS.has(reqUrl.pathname)) return;

  event.respondWith(
    (async () => {
      try {
        const cache = await caches.open(ERP_DYNAMIC_BRANDING_CACHE);
        const cached = await cache.match(reqUrl.pathname, { ignoreSearch: true });
        if (cached) {
          return cached.clone();
        }
      } catch {
        // Fall back to network or precache
      }

      try {
        return await fetch(event.request);
      } catch {
        const precached = await caches.match(reqUrl.pathname, { ignoreSearch: true });
        if (precached) return precached;
        throw new Error('Offline and no cached branding asset found');
      }
    })()
  );
});
