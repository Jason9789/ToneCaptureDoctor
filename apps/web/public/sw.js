const CACHE_NAME = 'tone-capture-doctor-shell-v2';
const APP_SHELL = ['/', '/manifest.webmanifest'];

function sameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function isStaticAsset(request) {
  return (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'image' ||
    new URL(request.url).pathname.startsWith('/assets/')
  );
}

async function cacheResponse(cache, request, response) {
  if (response && response.ok) {
    try {
      await cache.put(request, response.clone());
    } catch {
      // A full or disabled browser cache must not break the audio application.
    }
  }
  return response;
}

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  const documentResponse = await fetch('/', { cache: 'no-store' });
  await cacheResponse(cache, '/', documentResponse);
  const html = await documentResponse.clone().text();
  const assets = [...html.matchAll(/(?:src|href)=["'](\/[^"']+)["']/g)]
    .map((match) => match[1])
    .filter((path) => path && !path.startsWith('/src/'));
  await Promise.all(
    [...new Set([...APP_SHELL, ...assets])].map(async (path) => {
      try {
        await cacheResponse(cache, path, await fetch(path, { cache: 'no-store' }));
      } catch {
        // One optional asset must not prevent the rest of the shell from installing.
      }
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('tone-capture-doctor-shell-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !sameOrigin(event.request)) {
    return;
  }

  if (event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          const cache = await caches.open(CACHE_NAME);
          return cacheResponse(cache, event.request, response);
        })
        .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match('/'))),
    );
    return;
  }

  if (!isStaticAsset(event.request)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then(async (response) => {
        const cache = await caches.open(CACHE_NAME);
        await cacheResponse(cache, event.request, response);
        return response;
      }).catch(() => cached ?? Promise.reject(new Error('Static asset is unavailable offline.')));
      return cached ?? network;
    }),
  );
});
