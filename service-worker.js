const CACHE_NAME = 'coolmag-retro-radio-v1.0.6';
const APP_FILES = [
  './',
  './index.html',
  './admin.html',
  './style.css?v=39',
  './app.js?v=39',
  './admin.js?v=1.0.1',
  './admin-entry.js?v=1.0.0',
  './manifest.webmanifest',
  './icon.svg',
  './data/radio-presets.json',
  './data/tv-presets.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('coolmag-retro-radio-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
  );
});
