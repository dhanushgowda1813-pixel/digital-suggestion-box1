/* =========================================================
   JANASETU - PROGRESSIVE WEB APP SERVICE WORKER
   Versioned cache + user-approved app updates
   ========================================================= */

const CACHE_NAME = "janasetu-shell-v8";
const SHELL = ["/"];

// Cache the main page on installation. Static assets are refreshed
// from the network whenever possible and cached for offline use.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL))
  );
  // Do not skip waiting here. The app asks the user before applying updates.
});

// Activate only after the user chooses "Update Now".
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key =>
          (key.startsWith("dsb-shell-") || key.startsWith("janasetu-shell-")) &&
          key !== CACHE_NAME
        )
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Never intercept form submissions, APIs, or third-party requests.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(response => {
          // Only cache the public home page. Never cache authenticated or
          // page-specific navigation responses as the offline home page.
          if (response && response.ok && url.pathname === "/") {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then(cache => cache.put("/", copy))
            );
          }
          return response;
        })
        .catch(() => {
          if (url.pathname === "/") return caches.match("/");
          return Response.error();
        })
    );
    return;
  }

  // Serve cached static assets immediately on repeat visits, while refreshing
  // them in the background so navigation and images feel faster.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    const refresh = fetch(request, { cache: "no-store" }).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }).catch(() => null);

    if (cached) {
      event.waitUntil(refresh);
      return cached;
    }

    return (await refresh) || Response.error();
  })());
});
