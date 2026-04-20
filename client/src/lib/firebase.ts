/**
 * Firebase frontend setup for push notifications.
 *
 * Config diambil dari server via /api/firebase-config (runtime),
 * sehingga tidak perlu VITE_FIREBASE_* di build time.
 * Cukup set FIREBASE_API_KEY dll di Replit Secrets (server-side).
 *
 * Fallback: VITE_FIREBASE_* dari build-time env vars (untuk dev lokal dengan .env)
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";

// Build-time config (tersedia jika VITE_FIREBASE_* di-set saat build)
const buildTimeConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};
const buildTimeVapid = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let resolvedConfig: typeof buildTimeConfig | null = null;
let resolvedVapid: string | null = null;
let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

// Fetch config dari server (hanya sekali, di-cache)
let configPromise: Promise<void> | null = null;

async function fetchAndCacheConfig(): Promise<void> {
  // Jika build-time config lengkap, gunakan langsung
  if (buildTimeConfig.apiKey && buildTimeConfig.projectId && buildTimeConfig.messagingSenderId) {
    resolvedConfig = buildTimeConfig;
    resolvedVapid  = buildTimeVapid || null;
    return;
  }
  // Fetch dari server
  try {
    const resp = await fetch("/api/firebase-config");
    const data = await resp.json();
    if (data.configured) {
      resolvedConfig = {
        apiKey:            data.apiKey,
        authDomain:        data.authDomain,
        projectId:         data.projectId,
        storageBucket:     data.storageBucket,
        messagingSenderId: data.messagingSenderId,
        appId:             data.appId,
      };
      resolvedVapid = data.vapidKey || null;
    }
  } catch {
    // Server tidak tersedia / config belum di-set
  }
}

export async function ensureFirebaseConfig(): Promise<boolean> {
  if (!configPromise) {
    configPromise = fetchAndCacheConfig();
  }
  await configPromise;
  return !!(resolvedConfig?.apiKey && resolvedConfig?.projectId && resolvedConfig?.messagingSenderId);
}

export function isFirebaseConfigured(): boolean {
  // Sinkron — true jika build-time config sudah ada
  return !!(buildTimeConfig.apiKey && buildTimeConfig.projectId && buildTimeConfig.messagingSenderId);
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!resolvedConfig?.apiKey) return null;
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(resolvedConfig);
  }
  return app;
}

export function getFirebaseMessaging(): Messaging | null {
  try {
    const a = getFirebaseApp();
    if (!a) return null;
    if (!messaging) messaging = getMessaging(a);
    return messaging;
  } catch {
    return null;
  }
}

/**
 * Register service worker dan dapatkan FCM token.
 * Mengambil config dari server jika belum tersedia.
 */
export async function registerServiceWorkerAndGetToken(): Promise<string | null> {
  const ready = await ensureFirebaseConfig();
  if (!ready) return null;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;

    // Kirim config ke service worker
    registration.active?.postMessage({
      type: "FIREBASE_CONFIG",
      config: resolvedConfig,
    });

    const msg = getFirebaseMessaging();
    if (!msg) return null;

    const token = await getToken(msg, {
      vapidKey: resolvedVapid || undefined,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch {
    return null;
  }
}

/**
 * Request notification permission dari user.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  return Notification.requestPermission();
}

/**
 * Listen foreground messages.
 */
export function onForegroundMessage(handler: (payload: any) => void): (() => void) | null {
  const msg = getFirebaseMessaging();
  if (!msg) return null;
  return onMessage(msg, handler);
}

export { resolvedConfig as firebaseConfig };
