// CondoManager AI - Service Worker (Offline Cache, Push Notifications, Background Sync)

const CACHE_NAME = "condomanager-v2.2-cache";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/marca/icon-any-192.png",
  "/marca/icon-maskable-192.png"
];

// 1. Install Event - Pre-cache critical offline shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[ServiceWorker] A pré-carregar shell offline...");
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event - Clean up stale caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[ServiceWorker] A remover cache antiga:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event - Network First with Offline Fallback
self.addEventListener("fetch", (event) => {
  // Ignore non-GET requests, chrome-extension URLs, and cross-origin
  // requests (ex: Supabase REST API) — só se cacheia o "app shell" do
  // próprio site, nunca respostas de dados de outro utilizador que
  // possam ficar presas na cache de um dispositivo partilhado.
  if (
    event.request.method !== "GET" ||
    !event.request.url.startsWith("http") ||
    new URL(event.request.url).origin !== self.location.origin
  ) {
    return;
  }

  const isApiRequest = new URL(event.request.url).pathname.startsWith("/api/");

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache só o "app shell" estático — nunca respostas de /api/*
        // (dados reais do condomínio/utilizador), para não haver risco
        // de um dispositivo partilhado mostrar dados de outra sessão
        // depois de um logout enquanto offline.
        if (!isApiRequest && networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        console.log("[ServiceWorker] Modo Offline: A servir recurso da cache...", event.request.url);
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Offline Fallback Page
          if (event.request.headers.get("accept").includes("text/html")) {
            return caches.match("/index.html");
          }
        });
      })
  );
});

// 4. Push Notification Event
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "CondoManager AI", body: "Nova notificação do condomínio." };
  const options = {
    body: data.body,
    icon: "/marca/icon-maskable-192.png",
    badge: "/marca/icon-any-192.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/"
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
