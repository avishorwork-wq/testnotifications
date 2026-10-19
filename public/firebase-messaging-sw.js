/* Firebase Messaging service worker. Keep this at the hosting root. */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");
importScripts("/firebase-config.js");

const cfg = self.FIREBASE_CONFIG;
if (cfg && cfg.apiKey && !Object.values(cfg).some(v => typeof v === "string" && v.includes("REPLACE_ME"))) {
  firebase.initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId
  });
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage(payload => {
    const title = payload.notification?.title || payload.data?.title || "My Notifications";
    const body = payload.notification?.body || payload.data?.body || "";
    const url = payload.data?.url || "/";
    self.registration.showNotification(title, {
      body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url }
    });
  });
}

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        if (target.startsWith("/") || target.startsWith(self.location.origin)) {
          if ("navigate" in client) await client.navigate(new URL(target, self.location.origin).href);
        }
        return client.focus();
      }
    }
    return clients.openWindow(new URL(target, self.location.origin).href);
  })());
});
