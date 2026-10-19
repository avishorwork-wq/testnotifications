# My Notifications — phone-installable push notification app

A small Progressive Web App (PWA) for Android and iPhone. Install it to your home screen, enable notifications, and trigger push notifications remotely from the app's **Send notification** screen.

## What you need

- A Google account and a Firebase project
- Node.js 20 or later and Firebase CLI (`npm install -g firebase-tools`)
- For iPhone: iOS/iPadOS 16.4 or later, and the app must be added to the Home Screen before web push is available
- A secure place to store the sender secret

GitHub Pages only hosts static files; it cannot send push notifications by itself. This project uses Firebase Hosting for the app and Firebase Cloud Functions + Firebase Cloud Messaging for push delivery.

## 1. Create and configure Firebase

1. Go to https://console.firebase.google.com/ and create a project.
2. In **Project settings → General → Your apps**, add a **Web app**. Copy its Firebase config.
3. In **Project settings → Cloud Messaging → Web Push certificates**, generate a Web Push key pair. Copy the **Key pair** (VAPID public key).
4. In **Authentication → Sign-in method**, enable **Anonymous**.
5. In **Firestore Database**, create a database.
6. Upgrade to the **Blaze** plan if Firebase requires billing to deploy Cloud Functions. Cloud Functions may incur charges; set budget alerts.
7. Install tools:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```
8. From this project folder:
   ```bash
   firebase use --add
   ```
   Select your project and give it an alias such as `default`.

## 2. Add your Firebase web config

Edit `public/firebase-config.js` and replace every `REPLACE_ME` value with the values from your Firebase web app. Put your Web Push **VAPID public key** in `vapidKey`.

The config file is public by design. Firebase web config is not a server secret; secure your project using Firebase rules and the server-side sender secret.

## 3. Set a private sender secret

Choose a long, random secret (at least 32 characters). Do not commit it to GitHub and do not put it in `firebase-config.js`.

```bash
firebase functions:secrets:set SENDER_SECRET
```

Paste the secret when prompted. You will enter the same secret in the app's Send Notification screen when you want to trigger a notification. Keep it private.

## 4. Deploy

From the project root:

```bash
npm install
cd functions
npm install
cd ..
firebase deploy
```

Firebase Hosting will print your live HTTPS URL. Open that URL on your phone.

## 5. Enable notifications on each phone

1. Open the HTTPS app URL.
2. On Android, use the app's **Enable notifications** button and allow the browser permission. You can optionally install it from the browser menu.
3. On iPhone/iPad, open the URL in Safari, choose **Share → Add to Home Screen**, launch the installed home-screen app, then tap **Enable notifications** and allow permission.
4. Each device registers its push token with Firebase.

Push notifications require internet access and permission. iPhone web push requires iOS/iPadOS 16.4+ and an installed Home Screen web app. Browser/platform policies can affect delivery.

## 6. Send a remote notification

Open the app on any device, go to **Send notification**, enter the private sender secret, title, message, and optionally a destination URL, then tap **Send to registered devices**. The Firebase function sends to all currently registered tokens.

The sender secret is a shared bearer secret: anyone who obtains it can send notifications. Don't share it or commit it. For a multi-user production app, replace this with Firebase Authentication plus an administrator role. Tokens are stored in Firestore; this starter keeps them until Firebase reports they are invalid.

## 7. Optional GitHub repository

You can push this folder to a GitHub repository for version control. The live app is deployed to Firebase Hosting in this configuration; GitHub Pages alone cannot host the backend needed for remote push delivery.

## Troubleshooting

- **No notifications:** confirm browser permission, the correct VAPID public key, Anonymous Auth enabled, and that the device is registered. Check Functions logs with `firebase functions:log`.
- **`messaging/permission-blocked`:** enable notifications in the browser/OS settings.
- **iPhone has no notification option:** use Safari, add the app to Home Screen, launch that installed app, and check iOS/iPadOS version.
- **Deploy fails:** Cloud Functions deployment may require Blaze billing and a supported region/runtime.
- **Unauthorized:** confirm the secret entered in the app matches `SENDER_SECRET` exactly.

## Security notes

- Never commit your sender secret.
- Firebase config is client-side and is not a password.
- Firestore rules deny direct client reads/writes; token registration is handled by a callable function requiring Firebase Anonymous Authentication.
- This is a starter project, not a hardened multi-tenant notification platform. Add rate limits and administrator authentication before broad public use.
