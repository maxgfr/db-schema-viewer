// Service Worker for DB Schema Viewer
// Network-first for HTML pages, cache-first for hashed static assets

const CACHE_NAME = "db-schema-viewer-v2";

// Install: activate immediately without pre-caching stale HTML
self.addEventListener("install", () => {
  self.skipWaiting();
});

// Activate: clean old caches and take control immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Returns true for static assets that include a content hash in their filename
// These are safe to cache-first because the URL changes when the content changes
function isHashedAsset(url) {
  return /\/_next\/static\//.test(url.pathname);
}

// Fetch: network-first for navigation/HTML, cache-first for hashed assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin (AI API calls, etc.)
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Navigation requests and non-hashed resources: network-first
  // This ensures users always get the latest HTML on page load
  if (event.request.mode === "navigate" || !isHashedAsset(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            if (event.request.mode === "navigate") {
              return caches.match("./");
            }
            return new Response("Offline", { status: 503 });
          });
        })
    );
    return;
  }

  // Hashed static assets (_next/static/...): cache-first
  // URL contains content hash, so cached version is always correct
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
