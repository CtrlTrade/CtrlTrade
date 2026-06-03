/**
 * CtrlTradePos® Web Till — Service Worker
 *
 * Strategy:
 *  - Catalogue API reads: network-first, cache as fallback (offline catalogue browsing)
 *  - Write mutations: network only — client handles offline queuing via localStorage
 *  - App shell (/app/pos/till): cache-first with network update
 *
 * Offline transaction queuing is intentionally handled client-side (localStorage)
 * so the queue is durable, inspectable and under the client's control. The SW
 * does NOT intercept mutations or synthesise 202 responses.
 */

const CACHE_VERSION = "ctrltradepos-v1";
const API_CACHE = "ctrltradepos-api-v1";

const APP_SHELL = ["/app/pos/till"];

// Catalogue reads that should be cached so the till can browse products offline.
const CACHEABLE_API_PREFIXES = [
  "/api/products",
  "/api/branch-stock",
  "/api/pos/trade-accounts",
  "/api/pos/licences",
];

// ---------------------------------------------------------------------------
// Install — pre-cache app shell (best-effort; never blocks install)
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => null))
      .then(() => self.skipWaiting()),
  );
});

// ---------------------------------------------------------------------------
// Activate — evict stale caches
// ---------------------------------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_VERSION && k !== API_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  // GET catalogue API → network-first, cache fallback
  if (
    request.method === "GET" &&
    CACHEABLE_API_PREFIXES.some((p) => path.startsWith(p))
  ) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // App shell navigation → cache-first, network update
  if (request.mode === "navigate" || path.startsWith("/app/pos/")) {
    event.respondWith(cacheFirst(request, CACHE_VERSION));
    return;
  }

  // Everything else (mutations, auth, other API) → network only
});

async function networkFirst(request, cacheName) {
  try {
    const res = await fetch(request.clone());
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: "offline", cached: false }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  // Return cached immediately, then update in background.
  if (cached) {
    fetch(request.clone())
      .then((res) => {
        if (res.ok) {
          caches.open(cacheName).then((c) => c.put(request, res));
        }
      })
      .catch(() => null);
    return cached;
  }
  try {
    const res = await fetch(request.clone());
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    return new Response("Till app not yet cached — go online to load it.", {
      status: 503,
    });
  }
}

// ---------------------------------------------------------------------------
// Client messages (e.g. "catalogue refresh complete")
// ---------------------------------------------------------------------------
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
