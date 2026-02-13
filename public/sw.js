
const CACHE_NAME = 'rfe-foam-pro-v14-desktop';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-maskable.svg'
];

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

// Fetch Event: Stale-While-Revalidate Strategy
self.addEventListener('fetch', (event) => {
  // 1. Handle Navigation (HTML) - Network First for freshness, Fallback to Cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
            return caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, response.clone());
                return response;
            });
        })
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }

    // Google Script API handling removed.

  // 3. Handle Assets (JS, CSS, Images) - Stale-While-Revalidate
  // Serve from cache immediately, then update cache from network in background
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
           // Check if valid response
           if(networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
               const responseToCache = networkResponse.clone();
               caches.open(CACHE_NAME).then((cache) => {
                   cache.put(event.request, responseToCache);
               });
           }
           return networkResponse;
        }).catch(() => {
            // Network failed, nothing to do (we already returned cache if available)
        });

        // Return cached response immediately if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      })
  );
});
