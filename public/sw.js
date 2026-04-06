// ═══════════════════════════════════════════════════════════════
// Semetra Service Worker — Offline-First with Network Fallback
// Version-based cache busting + stale-while-revalidate
// ═══════════════════════════════════════════════════════════════

const SW_VERSION = "2.1.0";
const CACHE_STATIC = `semetra-static-${SW_VERSION}`;
const CACHE_PAGES = `semetra-pages-${SW_VERSION}`;
const CACHE_IMAGES = `semetra-images-${SW_VERSION}`;
const ALL_CACHES = [CACHE_STATIC, CACHE_PAGES, CACHE_IMAGES];

const OFFLINE_URL = "/offline";

// Max entries per cache to prevent unbounded growth
const MAX_PAGES_CACHE = 30;
const MAX_IMAGES_CACHE = 100;

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  "/offline",
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/favicon.ico",
];

// ── Install: Pre-cache critical assets ────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── Activate: Clean old versioned caches ──────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name.startsWith("semetra-") && !ALL_CACHES.includes(name))
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// ── Cache size limiter ────────────────────────────────────────
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    // Delete oldest entries (FIFO)
    const toDelete = keys.slice(0, keys.length - maxEntries);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}

// ── Stale-While-Revalidate strategy ──────────────────────────
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Fire off network request in background
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Return cached immediately if available, otherwise wait for network
  return cached || (await networkPromise) || new Response("Offline", { status: 503 });
}

// ── Fetch: Strategy-based routing ─────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, external, API/auth, and all dev-mode _next requests
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.includes("/_next/static/chunks/")
  ) {
    return;
  }

  // ── Next.js build assets: Cache-first (immutable hashed filenames)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_STATIC).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── Images & fonts: Stale-while-revalidate
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/)) {
    event.respondWith(
      staleWhileRevalidate(request, CACHE_IMAGES).then((response) => {
        trimCache(CACHE_IMAGES, MAX_IMAGES_CACHE);
        return response;
      })
    );
    return;
  }

  // ── CSS/JS (non-_next): Stale-while-revalidate
  if (url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_STATIC));
    return;
  }

  // ── HTML pages: Network-first, fallback to cache, then offline page
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_PAGES).then((cache) => {
            cache.put(request, clone);
            trimCache(CACHE_PAGES, MAX_PAGES_CACHE);
          });
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === "navigate") {
            return caches.match(OFFLINE_URL);
          }
          return new Response("Offline", { status: 503 });
        })
      )
  );
});

// ── Message handler for version checks ────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "GET_VERSION") {
    event.ports[0]?.postMessage({ version: SW_VERSION });
  }
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
