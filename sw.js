const CACHE_NAME = 'western-heritage-video-cache-v1';
const urlsToCache = [
  'TeddyLowRes.mp4',
  'Teddy_BuckyOneill.mp4',
  'Teddy_rodeo.mp4'
];

// Install event: cache the video files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
// Fetch event: serve videos from cache
self.addEventListener('fetch', event => {
  // We only want to handle requests for video files
  if (event.request.url.endsWith('.mp4')) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        // If the video is in the cache, return it.
        if (cachedResponse) {
          return cachedResponse;
        }

        // If not, fetch it from the network, cache it, and then return it.
        return caches.open(CACHE_NAME).then(cache => {
          return fetch(event.request).then(networkResponse => {
            // Clone the response because it's a stream and can only be consumed once.
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
      })
    )
  }
});