// Firebase Messaging Service Worker
// This file must be at the root of the served domain (/firebase-messaging-sw.js)
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

// Config diisi dari environment saat runtime via /api/firebase-config
// Sementara diisi dengan placeholder, actual config diambil saat instalasi
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "FIREBASE_CONFIG") {
    try {
      firebase.initializeApp(event.data.config);
      const messaging = firebase.messaging();
      messaging.onBackgroundMessage((payload) => {
        console.log("[SW] Background message received:", payload);
        const notif = payload.notification || {};
        self.registration.showNotification(notif.title || "BAPPERIDA Notifikasi", {
          body: notif.body || "",
          icon: notif.icon || "/logo_bapperida.png",
          badge: "/logo_bapperida.png",
          tag: payload.data?.type || "bapperida",
          data: payload.data || {},
          requireInteraction: true,
          actions: [{ action: "open", title: "Buka" }],
        });
      });
    } catch (e) {
      console.warn("[SW] Firebase init failed:", e.message);
    }
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
