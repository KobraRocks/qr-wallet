/*
 * QR Wallet service worker — hand-written, no Workbox.
 *
 * The Vite plugin in `build/service-worker.ts` replaces the two placeholders
 * below when the app is built: `PRECACHE_URLS` with every shell file (the
 * document, hashed JavaScript and CSS, the manifest, and the icons) and
 * `BUILD_HASH` with a content-derived hash. The cache name includes that hash,
 * so a new build always activates into a new cache and deletes the old one.
 *
 * Lifecycle: install precaches the complete shell and calls skipWaiting so a
 * new version can take over; activate deletes caches from earlier builds and
 * claims open clients; fetch is cache-first for same-origin GETs, with the
 * cached shell document as the fallback when a navigation misses and the
 * network is unavailable. Nothing here talks to a server beyond that.
 */

const BUILD_HASH = __BUILD_HASH__;
const PRECACHE_URLS = __PRECACHE_URLS__;

const CACHE_PREFIX = 'qr-wallet-';
const CACHE_NAME = CACHE_PREFIX + BUILD_HASH;
const SHELL_DOCUMENT = './index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }
  if (new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse !== undefined) {
        return cachedResponse;
      }
      return fetch(request).catch(() => respondOffline(request));
    }),
  );
});

/**
 * The last resort when a same-origin GET misses the cache and the network is
 * gone: a navigation gets the cached shell document, so an installed app opens
 * and shows every Card offline. Anything else fails as a normal network error.
 */
function respondOffline(request) {
  if (request.mode !== 'navigate') {
    return Promise.resolve(Response.error());
  }
  return caches.match(SHELL_DOCUMENT).then((shell) => shell ?? Response.error());
}
