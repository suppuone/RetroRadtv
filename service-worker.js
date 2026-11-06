const CACHE_NAME = 'rectified-retrotvra-v2-3';
const APP_FILES = [
  './',
  './index.html',
  './admin.html',
  './style.css?v=rectified-3',
  './app.js?v=rectified-3',
  './admin.js?v=rectified-3',
  './admin-entry.js?v=1.0.1',
  './manifest.webmanifest',
  './icon.svg',
  './data/radio-presets.json',
  './data/tv-presets.json',
  './data/app-settings.json'
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
      .then(keys => Promise.all(keys.filter(key => key.startsWith('rectified-retrotvra-v2-') && key !== CACHE_NAME).map(key => caches.delete(key))))
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
      .catch(() => caches.match(request).then(cached => cached || (request.mode==='navigate'?caches.match('./index.html'):Response.error())))
  );
});
