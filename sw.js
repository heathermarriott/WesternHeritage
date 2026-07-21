const CACHE_NAME = 'western-heritage-video-cache-v3'; // Increment cache version for update

// Install event: cache the video files
self.addEventListener('install', event => {
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting();

  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log('Service Worker: Opened cache.');
 
        // Fetch the questions text file to get the list of videos.
        const response = await fetch('questions.txt', { cache: 'no-store' });
        const text = await response.text();
        const videoUrls = text.split('\n')
                              .filter(line => line.trim() !== '')
                              .map(line => line.split('|')[2].trim());

        console.log('Service Worker: Caching new videos:', videoUrls);

        // Cache videos one by one to prevent a single failure from stopping the whole process.
        for (const url of videoUrls) {
          try {
            await cache.add(url);
          } catch (err) {
            console.error(`Service Worker: Failed to cache ${url}`, err);
          }
        }
      } catch (error) {
        console.error('Service Worker: Failed to cache videos during install:', error);
      }
    })()
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // Take control of all clients (tabs) as soon as the service worker activates.
      await self.clients.claim();
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })()
  );
});
// Fetch event: serve videos from cache
self.addEventListener('fetch', event => {
  // This service worker's fetch handler is only concerned with video files.
  if (event.request.url.endsWith('.mp4')) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          // If the video is found in the cache, return it immediately.
          return cachedResponse;
        }

        // --- On-Demand Caching for Range Requests ---
        // If not in cache, let the browser's original request go to the network for immediate playback.
        const networkPromise = fetch(event.request);

        // In the background, kick off a *separate* request for the full video file (without the Range header).
        // This will get a 200 OK response that we can successfully cache for next time.
        event.waitUntil(
          (async () => {
            const cache = await caches.open(CACHE_NAME);
            const fullResponse = await fetch(event.request.url); // New request without Range header
            if (fullResponse.status === 200) {
              await cache.put(event.request.url, fullResponse);
            }
          })()
        );

        // Return the promise for the original network request to the browser.
        return networkPromise;
      })
    );
  }
  // For any other request (like .json, .png, etc.), do nothing and let the browser handle it normally.
});