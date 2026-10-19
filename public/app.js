(() => {
  const $ = (id) => document.getElementById(id);
  const deviceStatus = $("deviceStatus");
  const sendStatus = $("sendStatus");
  const enableBtn = $("enableBtn");
  const sendBtn = $("sendBtn");
  let messaging = null;
  let registerToken = null;
  let sendNotification = null;

  function status(el, message, kind = "") {
    el.textContent = message;
    el.className = "status" + (kind ? " " + kind : "");
  }
  function configured() {
    const c = window.FIREBASE_CONFIG;
    return c && c.apiKey && !Object.values(c).some(v => typeof v === "string" && v.includes("REPLACE_ME"));
  }
  function setPill(text, good = false) {
    $("statusPill").textContent = text;
    $("statusPill").className = "pill" + (good ? " good" : "");
  }

  async function initialize() {
    if (!configured()) {
      status(deviceStatus, "Setup needed: edit public/firebase-config.js with your Firebase web config and VAPID public key.", "bad");
      enableBtn.disabled = true;
      sendBtn.disabled = true;
      return;
    }
    try {
      if (!("serviceWorker" in navigator)) throw new Error("This browser does not support service workers.");
      if (!("Notification" in window)) throw new Error("This browser does not support web notifications.");
      if (!firebase.apps.length) firebase.initializeApp({
        apiKey: FIREBASE_CONFIG.apiKey,
        authDomain: FIREBASE_CONFIG.authDomain,
        projectId: FIREBASE_CONFIG.projectId,
        storageBucket: FIREBASE_CONFIG.storageBucket,
        messagingSenderId: FIREBASE_CONFIG.messagingSenderId,
        appId: FIREBASE_CONFIG.appId
      });
      const functions = firebase.app().functions("us-central1");
      registerToken = functions.httpsCallable("registerPushToken");
      sendNotification = functions.httpsCallable("sendPushNotification");
      await firebase.auth().signInAnonymously();
      messaging = firebase.messaging();
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      await navigator.serviceWorker.ready;
      enableBtn.disabled = false;
      sendBtn.disabled = false;
      if (Notification.permission === "granted") {
        setPill("Permission granted", true);
        status(deviceStatus, "Notifications are allowed on this browser. Tap Enable to register this device.", "good");
      } else if (Notification.permission === "denied") {
        setPill("Blocked");
        status(deviceStatus, "Notifications are blocked by your browser or OS. Enable them in settings, then reload.", "bad");
      } else {
        setPill("Not enabled");
        status(deviceStatus, "Ready. Tap Enable notifications and allow the permission prompt.");
      }
      messaging.onMessage(payload => {
        const title = payload.notification?.title || "My Notifications";
        const body = payload.notification?.body || "";
        // Foreground messages are shown in-page because browser notifications
        // while the app is focused behave differently across platforms.
        status(deviceStatus, `${title}${body ? ": " + body : ""}`, "good");
      });
    } catch (err) {
      console.error(err);
      status(deviceStatus, "Setup error: " + (err.message || String(err)), "bad");
      setPill("Setup error");
    }
  }

  enableBtn.addEventListener("click", async () => {
    enableBtn.disabled = true;
    try {
      if (!messaging) throw new Error("Firebase is not configured yet.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was not granted.");
      const token = await messaging.getToken({
        vapidKey: FIREBASE_CONFIG.vapidKey,
        serviceWorkerRegistration: await navigator.serviceWorker.ready
      });
      if (!token) throw new Error("Firebase did not return a push token.");
      await registerToken({ token, platform: /iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios" : "web" });
      setPill("Registered", true);
      status(deviceStatus, "This device is registered and ready to receive remote push notifications.", "good");
    } catch (err) {
      console.error(err);
      status(deviceStatus, "Could not enable notifications: " + (err.message || String(err)), "bad");
    } finally {
      enableBtn.disabled = false;
    }
  });

  $("sendForm").addEventListener("submit", async event => {
    event.preventDefault();
    sendBtn.disabled = true;
    status(sendStatus, "Sending…");
    try {
      if (!sendNotification) throw new Error("Firebase is not configured yet.");
      const secret = $("secret").value;
      const title = $("title").value.trim();
      const body = $("message").value.trim();
      const url = $("targetUrl").value.trim();
      if (url && !/^https:\/\//i.test(url)) throw new Error("The destination URL must begin with https://");
      const result = await sendNotification({ secret, title, body, url });
      const count = result.data?.sent ?? 0;
      const failed = result.data?.failed ?? 0;
      status(sendStatus, `Finished. Sent to ${count} device(s).${failed ? " Failed for " + failed + " device(s)." : ""}`, "good");
    } catch (err) {
      console.error(err);
      status(sendStatus, "Send failed: " + (err.message || String(err)), "bad");
    } finally {
      sendBtn.disabled = false;
    }
  });

  initialize();
})();
