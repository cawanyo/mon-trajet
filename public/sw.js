// Service Worker PWA, Cache Ultra-Rapide & Notifications Push
// Mon Trajet Église

const CACHE_NAME = "mon-trajet-v2";
const PRECACHE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// Installation : Mise en cache des ressources prioritaires
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {});
    })
  );
});

// Activation : Nettoyage des anciens caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Gestion des messages depuis le client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Stratégie de mise en cache : Stale-While-Revalidate pour les assets statiques
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non GET, les API Convex en temps réel et les extensions
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api") ||
    url.pathname.includes("convex.cloud")
  ) {
    return;
  }

  // Chunks Next.js, polices, images et icônes
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/")
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});

// Réception des notifications Web Push en arrière-plan
self.addEventListener("push", (event) => {
  let data = {
    title: "Mon Trajet Église",
    body: "Nouvelle mise à jour de votre trajet.",
    url: "/notifications",
  };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    vibrate: [200, 100, 200],
    data: {
      url: data.url || "/notifications",
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Clic sur une notification push -> Ouvre ou bascule vers l'application sur la bonne page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlPath = event.notification.data?.url || "/notifications";
  const targetUrl = new URL(urlPath, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
