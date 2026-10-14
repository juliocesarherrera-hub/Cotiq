const CACHE_NAME = 'cotiq-shell-v1';
const APP_SHELL = ['/', '/manifest.webmanifest', '/cotiq-icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    const htmlResponse = await cache.match('/');
    const html = await htmlResponse.text();
    const assetUrls = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)]
      .map((match) => new URL(match[1], self.location.origin).href);
    await Promise.all(assetUrls.map(async (url) => {
      try {
        await cache.add(url);
      } catch (error) {
        console.warn('No se pudo guardar un recurso para el modo sin conexión:', url, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => (name.startsWith('cotiq-') || name.startsWith('presufast-')) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/', response.clone());
        }
        return response;
      } catch {
        return (await caches.match(request, { ignoreVary: true })) || (await caches.match('/', { ignoreVary: true }));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cachedResponse = await caches.match(request, { ignoreVary: true });
    if (cachedResponse) return cachedResponse;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
