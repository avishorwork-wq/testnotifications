const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const senderSecret = defineSecret("SENDER_SECRET");

exports.registerPushToken = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before registering a device.");
  }
  const token = request.data && request.data.token;
  const platform = request.data && request.data.platform;
  if (typeof token !== "string" || token.length < 20 || token.length > 4096) {
    throw new HttpsError("invalid-argument", "A valid push token is required.");
  }
  const safePlatform = platform === "ios" ? "ios" : "web";
  // Hash tokens for document IDs so raw push tokens are not used as paths.
  const crypto = require("crypto");
  const id = crypto.createHash("sha256").update(token).digest("hex");
  await db.collection("pushTokens").doc(id).set({
    token,
    platform: safePlatform,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true };
});

exports.sendPushNotification = onCall(
  { region: "us-central1", secrets: [senderSecret], enforceAppCheck: false },
  async (request) => {
    const supplied = request.data && request.data.secret;
    const expected = senderSecret.value();
    if (typeof supplied !== "string" || !expected || supplied.length !== expected.length ||
        !require("crypto").timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
      throw new HttpsError("permission-denied", "Invalid sender secret.");
    }

    const title = typeof request.data.title === "string" ? request.data.title.trim().slice(0, 100) : "";
    const body = typeof request.data.body === "string" ? request.data.body.trim().slice(0, 500) : "";
    let url = typeof request.data.url === "string" ? request.data.url.trim() : "/";
    if (!title || !body) throw new HttpsError("invalid-argument", "Title and message are required.");
    if (url !== "/" && (!/^https:\\/\\//i.test(url))) {
      throw new HttpsError("invalid-argument", "Destination URL must use HTTPS.");
    }
    if (url.length > 1000) throw new HttpsError("invalid-argument", "Destination URL is too long.");

    const snapshot = await db.collection("pushTokens").get();
    if (snapshot.empty) return { sent: 0, failed: 0, message: "No devices are registered yet." };

    const docs = snapshot.docs;
    const tokens = docs.map(d => d.get("token")).filter(Boolean);
    let sent = 0;
    let failed = 0;
    // FCM multicast supports at most 500 tokens per call.
    for (let i = 0; i < tokens.length; i += 500) {
      const batchTokens = tokens.slice(i, i + 500);
      const response = await admin.messaging().sendEachForMulticast({
        tokens: batchTokens,
        notification: { title, body },
        data: { title, body, url },
        webpush: {
          // The service worker handles notification clicks, including the default "/" URL.
          notification: { icon: "/icon.svg", badge: "/icon.svg" }
        },
        apns: { payload: { aps: { sound: "default" } } }
      });
      sent += response.successCount;
      failed += response.failureCount;
      const invalid = [];
      response.responses.forEach((r, index) => {
        if (!r.success && r.error &&
            ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(r.error.code)) {
          invalid.push(batchTokens[index]);
        }
      });
      if (invalid.length) {
        const crypto = require("crypto");
        const batch = db.batch();
        invalid.forEach(token => {
          const id = crypto.createHash("sha256").update(token).digest("hex");
          batch.delete(db.collection("pushTokens").doc(id));
        });
        await batch.commit();
      }
    }
    return { sent, failed };
  }
);
