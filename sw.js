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

// Fetch event: serve videos from cache
self.addEventListener('fetch', event => {
  // We only want to handle requests for video files
  if (event.request.url.endsWith('.mp4')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request);
        })
    );
  }
});