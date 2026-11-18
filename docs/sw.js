const cachePrefix = 'atu-parking-offline:' + self.registration.scope + ':';
const cacheName = cachePrefix + 'v1';
const assets = [
  './index.html', './style.css', './atu.svg', './leaflet.css', './leaflet.js',
  './campus-map.js', './app.js', './login.js', './atu-parking-offline.html',
];
const scopePath = new URL(self.registration.scope).pathname;
const assetURLs = new Set(assets.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(cachePrefix) && key !== cacheName).map(key => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' && (url.pathname === scopePath || url.pathname === scopePath + 'index.html')) {
    event.respondWith(fetch(request).catch(() => caches.open(cacheName).then(cache => cache.match('./index.html'))));
  } else if (assetURLs.has(request.url)) {
    event.respondWith(fetch(request).catch(() => caches.open(cacheName).then(cache => cache.match(request))));
  }
});
