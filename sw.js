/* Word Pal service worker — makes the app fully usable offline.
   Bump CACHE version whenever you update index.html so devices pick up the new copy. */
const CACHE = "wordpal-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-180.png",
  "./icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
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
  const url = new URL(e.request.url);

  // Online dictionary lookups: network only (the app shows a friendly
  // message if this fails while offline).
  if (url.hostname === "www.dictionaryapi.com") {
    e.respondWith(fetch(e.request));
    return;
  }

  // App shell: cache first, fall back to network, refresh cache in background.
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cached) => {
      const fetched = fetch(e.request)
        .then((resp) => {
          if (resp && resp.ok && url.origin === self.location.origin) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
