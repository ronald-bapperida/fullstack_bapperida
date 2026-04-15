/**
 * Firebase Admin SDK setup for server-side push notification sending.
 * Requires FIREBASE_SERVICE_ACCOUNT env var (JSON string of service account key).
 */
import admin from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { Messaging } from 'firebase-admin/messaging';

let messagingInstance: Messaging | null = null;
let initialized = false;

function initFirebaseAdmin() {
  if (initialized) return;
  initialized = true;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    console.warn("[FCM] FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled.");
    return;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);

    if (getApps().length === 0) {
      initializeApp({
        credential: cert(serviceAccount),
      });
    }

    messagingInstance = getMessaging();
    console.log("[FCM] Firebase Admin initialized successfully.");
  } catch (err: any) {
    console.error("[FCM] Failed to initialize Firebase Admin:", err.message);
  }
}

/**
 * Send push notification to a single FCM token.
 */
export async function sendPushToToken(token: string, payload: {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}): Promise<boolean> {
  initFirebaseAdmin();
  if (!messagingInstance) return false;

  try {
    await messagingInstance.send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
      },
      data: payload.data || {},
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: "/logo_bapperida.png",
          badge: "/badge.png",
          requireInteraction: true,
        },
        fcmOptions: { link: "/" },
      },
      android: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: "notification_icon",
          sound: "default",
        },
        priority: "high",
      },
      apns: {
        payload: {
          aps: {
            alert: { title: payload.title, body: payload.body },
            sound: "default",
            badge: 1,
          },
        },
      },
    });
    return true;
  } catch (err: any) {
    if (err.code === "messaging/registration-token-not-registered" ||
        err.code === "messaging/invalid-registration-token") {
      console.warn(`[FCM] Invalid token (will be removed): ${token.substring(0, 20)}...`);
      return false;
    }
    console.error("[FCM] Send push error:", err.message);
    return false;
  }
}

/**
 * Send push notification to multiple FCM tokens at once.
 * Returns list of invalid/failed tokens.
 */
export async function sendPushToTokens(tokens: string[], payload: {
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<string[]> {
  initFirebaseAdmin();
  if (!messagingInstance || tokens.length === 0) return [];

  const failedTokens: string[] = [];

  // Firebase sendEach supports up to 500 messages at once
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }

  for (const chunk of chunks) {
    try {
      const messages = chunk.map(token => ({
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data || {},
        webpush: {
          notification: {
            title: payload.title,
            body: payload.body,
            icon: "/logo_bapperida.png",
            requireInteraction: true,
          },
          fcmOptions: { link: "/" },
        },
        android: { priority: "high" as const },
      }));

      const result = await messagingInstance.sendEach(messages);
      result.responses.forEach((resp: any, idx: number) => {
        if (!resp.success) {
          const code = resp.error?.code;
          if (code === "messaging/registration-token-not-registered" ||
              code === "messaging/invalid-registration-token") {
            failedTokens.push(chunk[idx]);
          }
        }
      });
    } catch (err: any) {
      console.error("[FCM] Batch send error:", err.message);
    }
  }

  return failedTokens;
}

/**
 * Check if Firebase Admin is available.
 */
export function isFirebaseAdminAvailable(): boolean {
  initFirebaseAdmin();
  return messagingInstance !== null;
}

/**
 * Central event push helper — look up tokens by role(s) then send push.
 * Always non-blocking (fire-and-forget). Safe to call even if Firebase not configured.
 */
export async function sendEventPush(payload: {
  title: string;
  body: string;
  data?: Record<string, string>;
  targetRoles?: string[];      // e.g. ["admin_rida"] or ["admin_bpp", "super_admin"]
  targetUserIds?: string[];    // specific user FCM tokens (mobile)
  tokenGetter: (role: string | null, userIds?: string[]) => Promise<string[]>;
  tokenRemover: (tokens: string[]) => Promise<void>;
}): Promise<void> {
  initFirebaseAdmin();
  if (!messagingInstance) return;

  try {
    const tokenSets: string[][] = [];
    if (payload.targetRoles && payload.targetRoles.length > 0) {
      for (const role of payload.targetRoles) {
        tokenSets.push(await payload.tokenGetter(role));
      }
    }
    if (payload.targetUserIds && payload.targetUserIds.length > 0) {
      tokenSets.push(await payload.tokenGetter(null, payload.targetUserIds));
    }
    const allTokens = [...new Set(tokenSets.flat())];
    if (allTokens.length === 0) return;

    const invalid = await sendPushToTokens(allTokens, {
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });
    if (invalid.length > 0) await payload.tokenRemover(invalid);
  } catch (err: any) {
    console.error("[FCM] sendEventPush error:", err.message);
  }
}