const CACHE_NAME = 'western-heritage-cache-v14'; // Increment cache version for update

// List of static assets to cache on install. This needs to include every
// page/script/style/data file the app can navigate or fetch to, not just the
// main menu - games.html and the individual game pages are full-navigation
// targets (window.location.href), and the ES module files imported by
// main.js are separate network requests, so all of them have to be listed
// explicitly here to be available before the first (possibly offline) visit.
const STATIC_ASSETS = [
  '/',
  'index.html',
  'games.html',
  'css/style.css',
  'js/main.js',
  'js/i18n.js',
  'js/renderer.js',
  'js/ui.js',
  'en.json',
  'es.json',
  'fr.json',
  'de.json',
  'it.json',
  'avatars.txt',
  'questions.txt',
  // Game pages (each is a full navigation target from games.html)
  'CowboyRoundup/index.html',
  'CowboyRoundup/style.css',
  'CowboyRoundup/script.js',
  'PanForGoldGame/index.html',
  'PanForGoldGame/style.css',
  'PanForGoldGame/script.js',
  'RodeoReflexes/index.html',
  'RodeoReflexes/style.css',
  'RodeoReflexes/script.js',
  // Images - listed explicitly so they're cached on install rather than
  // waiting for a first (possibly offline) request to trigger the
  // opportunistic isImage path below.
  'assets/hat.png',
  'assets/teddy.png',
  'assets/annie.png',
  'assets/wyatt.png',
  'assets/horse.png',
  'assets/flags.png',
  'assets/appIcon1080x1080.png',
  'assets/PanningForGoldAppIcon.png',
  'assets/RodeoReflexesAppIcon.png'
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
                          .filter(line => line && !line.startsWith('#') && line.includes('|'))
                          .map(line => line.split('|')[1].trim()) // Video path is always the 2nd item
                          .filter(url => url); // Filter out any empty/undefined URLs

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
      if (request.url.endsWith('.webm') && !validUrls.has(request.url)) {
        console.log('Service Worker: Pruning stale cached video:', request.url);
        await cache.delete(request);
      }
    }

    // Cache any videos that aren't already cached. Skipping ones already
    // present avoids re-downloading the whole library on every sync.
    // Videos are cached in small parallel batches rather than one at a
    // time - downloading them sequentially means the total wait is the
    // SUM of every video's download time, so a handful of large files
    // (or a slow dev server) can make it look like caching has stalled
    // on whichever file happens to be downloading.
    const CONCURRENCY = 4;
    const urlsToCache = [];
    for (const url of videoUrls) {
      const alreadyCached = await cache.match(url);
      if (!alreadyCached) {
        urlsToCache.push(url);
      }
    }

    async function cacheOne(url) {
      try {
        await cache.add(url);
        console.log('Service Worker: Cached new video:', url);
      } catch (err) {
        console.error(`Service Worker: Failed to cache ${url}`, err);
      }
    }

    for (let i = 0; i < urlsToCache.length; i += CONCURRENCY) {
      const batch = urlsToCache.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(cacheOne));
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
        await Promise.all(
          STATIC_ASSETS.map(async (assetUrl) => {
            try {
              await cache.add(assetUrl);
            } catch (err) {
              console.error(`Service Worker: Failed to cache static asset ${assetUrl}`, err);
            }
          })
        );
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

// Given a cached full (200) video response and the original request, builds
// the correctly-sliced 206 Partial Content response the <video> element is
// expecting. Plain caches.match() doesn't do this slicing on its own - it
// only matches by URL, so a Range-bearing request needs to be turned into
// the right byte slice manually. Returns the full response unmodified if no
// Range header was present.
async function buildRangeResponse(request, cachedResponse) {
  const rangeHeader = request.headers.get('range');
  if (!rangeHeader) {
    return cachedResponse;
  }

  const buffer = await cachedResponse.clone().arrayBuffer();
  const size = buffer.byteLength;

  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (!match) {
    return cachedResponse;
  }

  const start = match[1] ? parseInt(match[1], 10) : 0;
  const end = match[2] ? parseInt(match[2], 10) : size - 1;

  if (start >= size || end >= size || start > end) {
    return new Response(null, {
      status: 416,
      statusText: 'Range Not Satisfiable',
      headers: { 'Content-Range': `bytes */${size}` }
    });
  }

  const slice = buffer.slice(start, end + 1);

  return new Response(slice, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': cachedResponse.headers.get('Content-Type') || 'video/webm',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(slice.byteLength),
      'Accept-Ranges': 'bytes'
    }
  });
}

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

  // Same idea for pages/scripts/styles/data files: a new game page, script,
  // or translation file added later still gets cached the first time it's
  // requested, even if nobody remembers to add it to STATIC_ASSETS. This is
  // a same-origin GET-only kiosk app, so caching these opportunistically is
  // safe - it's just a fallback net under the explicit install-time list
  // above, not a replacement for it.
  const isCacheableFile = /\.(html|css|js|json|txt)$/i.test(url.pathname);

  // Handle video files
  if (event.request.url.endsWith('.webm')) {
    event.respondWith(
      // Match by URL string (not the Request object) so the incoming
      // Range header doesn't prevent finding an already-cached full
      // response - caches.match() would otherwise miss on every single
      // playback since the video element always sends a Range request.
      caches.match(event.request.url).then(async cachedResponse => {
        if (cachedResponse) {
          // Found it - slice out the requested byte range ourselves.
          return buildRangeResponse(event.request, cachedResponse);
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
  } else if (isStaticAsset || isImage || isCacheableFile) {
    // Only intercept GET requests - a cache can't usefully store the
    // response to a POST/etc, and trying to would just throw.
    if (event.request.method !== 'GET') {
      return;
    }
    // Handle static assets, images, and pages/scripts/styles/data: cache-
    // first, and on a miss fetch from the network and store the response
    // for next time so files added after install (e.g. a new game page or
    // a new avatar image) still end up cached.
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