self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open("loungeos-dono-v1").then((cache) => cache.addAll(["/dono", "/favicon.png"])));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)),
  );
});
