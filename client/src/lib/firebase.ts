/**
 * Firebase frontend setup for push notifications.
 * Requires VITE_FIREBASE_* env vars to be set.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export function isFirebaseConfigured(): boolean {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId);
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseMessaging(): Messaging | null {
  try {
    const app = getFirebaseApp();
    if (!app) return null;
    if (!messaging) {
      messaging = getMessaging(app);
    }
    return messaging;
  } catch {
    return null;
  }
}

/**
 * Register service worker and get FCM token.
 * Returns token string or null if unavailable.
 */
export async function registerServiceWorkerAndGetToken(): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    // Pass Firebase config to service worker
    await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: "FIREBASE_CONFIG", config: firebaseConfig });

    const msg = getFirebaseMessaging();
    if (!msg) return null;

    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch (err: any) {
    console.warn("[FCM] Could not get FCM token:", err.message);
    return null;
  }
}

/**
 * Request notification permission from user.
 * Returns 'granted', 'denied', or 'default'.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  const result = await Notification.requestPermission();
  return result;
}

/**
 * Listen for foreground messages and call handler.
 */
export function onForegroundMessage(handler: (payload: any) => void): (() => void) | null {
  const msg = getFirebaseMessaging();
  if (!msg) return null;
  return onMessage(msg, handler);
}

export { firebaseConfig };
