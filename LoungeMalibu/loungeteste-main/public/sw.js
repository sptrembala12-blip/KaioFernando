self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open("loungemalibu-dono-v2").then((cache) => cache.addAll(["/dono", "/favicon.png"])));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dono";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const aberto = clientsArr.find((c) => c.url.includes("/dono") && "focus" in c);
      if (aberto) return aberto.focus();
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
