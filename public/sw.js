// ============================================================
// ROZY POS — Service Worker
// Caches app shell for offline use
// ============================================================

const CACHE_NAME = "rozy-pos-v2";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icon-192.png",
];

// ---------- Install: cache app shell ----------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// ---------- Activate: clean old caches ----------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ---------- Fetch: network-first for HTML/JS, cache-first for assets ----------
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't cache Supabase API calls — always go to network
  if (url.hostname.includes("supabase")) {
    return;
  }

  // Only cache files from this site (and Google Fonts). Everything else goes straight to the network.
  if (url.origin !== self.location.origin && !url.hostname.endsWith("gstatic.com") && !url.hostname.endsWith("googleapis.com")) {
    return;
  }

  // Don't cache non-GET
  if (request.method !== "GET") {
    return;
  }

  // Skip chrome-extension and other non-http(s)
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Navigation requests (HTML pages) — network first, fallback to cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return caches.match("/index.html");
          });
        })
    );
    return;
  }

  // Other requests (JS, CSS, images) — cache first, network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Update cache in background
        fetch(request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response.clone());
            });
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy);
          });
        }
        return response;
      }).catch(() => {
        return new Response("", { status: 503, statusText: "Offline" });
      });
    })
  );
});

// ---------- Message handling (for update notifications) ----------
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});