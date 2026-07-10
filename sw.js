/* Word Pal service worker — makes the app fully usable offline.
   Bump CACHE version whenever you update index.html so devices pick up the new copy. */
const CACHE = "wordpal-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-180.png",
  "./icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      // Cache assets one by one so a single hiccup can't break the whole install.
      for (const a of ASSETS) {
        try { await c.add(a); } catch (err) { /* tolerate, index.html is retried below */ }
      }
      // index.html is the one file we truly need offline — make sure it's in.
      const got = await c.match("./index.html");
      if (!got) await c.add("./index.html");
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // Let non-GET requests (e.g. the Google Sheet sync POST) pass through untouched.
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);

  // Online dictionary lookups: network only (the app shows a friendly
  // message if this fails while offline).
  if (url.hostname === "www.dictionaryapi.com") {
    e.respondWith(fetch(e.request));
    return;
  }

  // App open (navigation): serve the cached app immediately, no matter the
  // exact URL variant iOS launches with; refresh the cache in the background.
  if (e.request.mode === "navigate") {
    e.respondWith(
      caches.match("./index.html").then((cached) => {
        const fetched = fetch(e.request).then((resp) => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put("./index.html", copy)).catch(()=>{});
          }
          return resp;
        }).catch(() => cached);
        return cached || fetched;
      })
    );
    return;
  }

  // Everything else (icons, manifest): cache first, then network.
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cached) => {
      const fetched = fetch(e.request)
        .then((resp) => {
          if (resp && resp.ok && url.origin === self.location.origin) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(()=>{});
          }
          return resp;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
