const CACHE_NAME = 'cadencia-pwa-v1';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('cadencia-pwa-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      if (request.mode === 'navigate') {
        try {
          const response = await fetch(request);
          if (response.ok) {
            await cache.put('/', response.clone());
          }
          return response;
        } catch {
          const fallback = await cache.match('/');
          if (fallback) {
            return fallback;
          }
          throw new Error('A página não está disponível offline.');
        }
      }

      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    })()
  );
});
