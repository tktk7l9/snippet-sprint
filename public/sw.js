// Minimal offline support. Navigations are network-first (so deploys are picked
// up online) with a cached shell fallback; other same-origin GETs are
// cache-first with runtime caching (build assets are content-hashed). Snippets
// load per language, so a language is playable offline once it has been
// fetched (the app warms the rest in idle time after the first round).

// v2: the shell moved from /index.html to / (see SHELL_URL); the bump drops
// the old entry and every build asset cached under v1.
const CACHE = "snippet-sprint-v2";
// The asset host answers /index.html with a 307 to /, and a redirected
// response stored in the cache cannot be served to a navigation request
// (its redirect mode is "manual"), so the shell is cached under "/" instead.
const SHELL_URL = "/";
const SHELL = [SHELL_URL, "/favicon.svg", "/manifest.webmanifest"];

// Store a successful, non-redirected response; a failed write (quota, 206)
// must not surface as an unhandled rejection or stop the response.
function store(event, key, res) {
  if (!res.ok || res.redirected) return;
  const copy = res.clone();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.put(key, copy))
      .catch(() => {}),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => {
        await cache.addAll(SHELL);
        // The hashed entry script and stylesheet named by the shell just cached,
        // so a fresh install already opens offline (the first page load itself
        // ran before this worker controlled the page, so it cached nothing).
        const html = await cache.match(SHELL_URL).then((res) => res.text());
        const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
        await cache.addAll(assets);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only a successful response may replace the offline shell; a 404
          // or 5xx page must never become what every offline navigation shows.
          store(event, SHELL_URL, res);
          return res;
        })
        .catch(() => caches.match(SHELL_URL, { ignoreVary: true })),
    );
    return;
  }

  event.respondWith(
    // Same-origin static files: the cached copy serves any Origin / encoding variant.
    caches.match(req, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          store(event, req, res);
          return res;
        }),
    ),
  );
});
