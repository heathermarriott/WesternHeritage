const CACHE_NAME = 'western-heritage-cache-v7'; // Increment cache version for update

// List of static assets to cache on install.
const STATIC_ASSETS = [
  '/',
  'index.html',
  'css/style.css',
  'js/main.js',
  'en.json',
  'questions.txt',
  'assets/hat.png',
  'assets/teddy.png',
  'assets/annie.png',
  'assets/wyatt.png',
  'assets/horse.png'
];

// Reads questions.txt, prunes any cached videos that are no longer
// referenced, and caches any videos that aren't cached yet. Shared by
// install (so it still works on a fresh service worker) and by the
// SYNC_VIDEOS message handler (so it also works any time the page asks
// for a re-check, without requiring sw.js itself to change).
async function syncVideoCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    console.log('Service Worker: Syncing video cache.');

    // Fetch the questions text file to get the list of videos.
    const response = await fetch('questions.txt', { cache: 'no-store' });
    const text = await response.text();
    const videoUrls = text.split('\n')
                          .map(line => line.trim())
                          .filter(line => line !== '' && !line.startsWith('#'))
                          .map(line => line.split('|')[3].trim()); // Video path is now the 4th item

    console.log('Service Worker: Current video list:', videoUrls);

    // Build the set of video URLs that should exist in the cache, resolved
    // to absolute URLs so they can be compared against cached request URLs.
    const validUrls = new Set(
      videoUrls.map(url => new URL(url, self.location.href).href)
    );

    // Prune any cached videos that are no longer referenced in
    // questions.txt (removed, renamed, or replaced videos) so stale
    // files don't sit around filling up storage indefinitely.
    const cachedRequests = await cache.keys();
    for (const request of cachedRequests) {
      // Only prune .mp4 files that are no longer in the valid list.
      if (request.url.endsWith('.mp4') && !validUrls.has(request.url)) {
        console.log('Service Worker: Pruning stale cached video:', request.url);
        await cache.delete(request);
      }
    }

    // Cache any videos that aren't already cached. Skipping ones already
    // present avoids re-downloading the whole library on every sync.
    for (const url of videoUrls) {
      const alreadyCached = await cache.match(url);
      if (!alreadyCached) {
        try {
          await cache.add(url);
          console.log('Service Worker: Cached new video:', url);
        } catch (err) {
          console.error(`Service Worker: Failed to cache ${url}`, err);
        }
      }
    }
  } catch (error) {
    console.error('Service Worker: Failed to sync video cache:', error);
  }
}

// Install event: cache static assets and video files
self.addEventListener('install', event => {
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log('Service Worker: Caching static assets.');
        await cache.addAll(STATIC_ASSETS);
      } catch (error) {
        console.error('Service Worker: Failed to cache static assets:', error);
      }
      // Sync video cache after static assets are cached.
      await syncVideoCache();
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

// Message event: lets the page (main.js) ask the already-running service
// worker to re-check questions.txt for new/removed videos, without needing
// a full service worker update (install only fires when sw.js itself changes).
self.addEventListener('message', event => {
  if (event.data === 'SYNC_VIDEOS') {
    event.waitUntil(syncVideoCache());
  }
});

// Fetch event: serve assets from cache
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Check if the request's pathname is exactly one of the static assets.
  // This is more robust than `endsWith` for paths like '/' or '/index.html'.
  // We remove the leading '/' from the pathname to match the asset list.
  const isStaticAsset = STATIC_ASSETS.includes(url.pathname.substring(1)) || url.pathname === '/';

  // Catch any image request by extension, not just the ones hardcoded in
  // STATIC_ASSETS - this way a new avatar/background image added later
  // still gets cached on first load, without needing a CACHE_NAME bump.
  const isImage = /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(url.pathname);

  // Handle video files
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
  } else if (isStaticAsset || isImage) {
    // Handle static assets and images: cache-first, and on a miss fetch
    // from the network and store the response for next time so images
    // added after install (e.g. new avatars) still end up cached.
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return networkResponse;
        }).catch(err => {
          console.error('Service Worker: Failed to fetch', event.request.url, err);
          throw err;
        });
      })
    );
  }
  // For any other request, do nothing and let the browser handle it normally.
});