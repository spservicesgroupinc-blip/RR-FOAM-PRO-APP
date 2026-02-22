
const CACHE_NAME = 'rfe-foam-pro-v15-ios-fix';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-maskable.svg'
];

// URLs that must NEVER be cached or intercepted (Supabase API, auth, realtime)
const API_URL_PATTERNS = [
  'supabase.co',
  'supabase.in',
  'supabase.net',
  '/rest/v1/',
  '/auth/v1/',
  '/realtime/',
  '/storage/v1/',
  '/functions/v1/',
];

function isAPIRequest(url) {
  return API_URL_PATTERNS.some(pattern => url.includes(pattern));
}

// Install Event: Cache critical app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(URLS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Fetch Event: Network-first for APIs, Stale-While-Revalidate for assets
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // ── CRITICAL: Never intercept Supabase / API requests ──
  // iOS Safari aggressively caches fetch responses through the SW.
  // Letting API calls bypass the SW entirely ensures fresh data.
  if (isAPIRequest(url)) {
    return; // Let the browser handle it natively — no event.respondWith()
  }

  // ── Skip non-GET requests (POST/PUT/DELETE for APIs) ──
  if (event.request.method !== 'GET') {
    return;
  }

  // 1. Handle Navigation (HTML) - Network First, Fallback to Cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, clone);
              });
            }
            return response;
        })
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }

  // 2. Handle Assets (JS, CSS, Images) - Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
           if (networkResponse && networkResponse.status === 200) {
               const responseToCache = networkResponse.clone();
               caches.open(CACHE_NAME).then((cache) => {
                   cache.put(event.request, responseToCache);
               });
           }
           return networkResponse;
        }).catch(() => {
            // Network failed — return undefined so cachedResponse is used
            return cachedResponse;
        });

        return cachedResponse || fetchPromise;
      })
  );
});
