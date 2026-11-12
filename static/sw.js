
const CACHE_NAME = 'janasetu-shell-v3';

const SHELL = [
  '/',
  '/static/style.css',
  '/static/app.js',
  '/static/manifest.json',
  '/static/app-icon.svg'
];

// Install the new application cache.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
  );

  self.skipWaiting();
});

// Remove outdated JANASETU and old DSB caches.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key =>
            (
              key.startsWith('dsb-shell-') ||
              key.startsWith('janasetu-shell-')
            ) &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

// Network-first strategy for application files.
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Do not cache API requests or external websites.
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Always try to load the latest page from the server.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/'))
    );

    return;
  }

  // Network-first for static files.
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok) {
          const responseCopy = response.clone();

          event.waitUntil(
            caches.open(CACHE_NAME).then(cache =>
              cache.put(request, responseCopy)
            )
          );
        }

        return response;
      })
      .catch(() =>
        caches.match(request)
      )
  );
});
