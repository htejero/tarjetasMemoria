// Service worker mínimo: guarda el "esqueleto" de la app para poder estudiar
// sin conexión. Los datos no pasan por aquí, viven en localStorage.
//
// Al cambiar cualquier fichero, sube CACHE_VERSION para que el móvil no se
// quede con la versión antigua.

const CACHE_VERSION = 'v1';
const CACHE = `tarjetas-${CACHE_VERSION}`;

const ASSETS = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/srs.js',
  'js/store.js',
  'js/parse.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Navegación: intenta la red y cae al índice cacheado si no hay conexión.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('index.html', { ignoreSearch: true })),
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
