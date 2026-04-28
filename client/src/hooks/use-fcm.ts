import { useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import {
  ensureFirebaseConfig,
  requestNotificationPermission,
  registerServiceWorkerAndGetToken,
  onForegroundMessage,
} from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

export function useFcm(userId: string | undefined) {
  const { toast } = useToast();
  const registered = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!userId || registered.current) return;

    async function setup() {
      try {
        const configured = await ensureFirebaseConfig();
        if (!configured) return;

        const permission = await requestNotificationPermission();
        if (permission !== "granted") return;

        const token = await registerServiceWorkerAndGetToken();
        if (!token) return;

        registered.current = true;

        try {
          await apiRequest("POST", "/api/fcm/token", {
            token,
            deviceType: "web",
            platform: "admin",
          });
        } catch {
          // Non-fatal
        }

        unsubscribeRef.current = onForegroundMessage((payload) => {
          const title = payload.notification?.title || "BAPPERIDA";
          const body = payload.notification?.body || "";

          // In-app toast
          toast({ title, description: body });

          // Native desktop notification via service worker (works even when app is focused)
          if (Notification.permission === "granted" && "serviceWorker" in navigator) {
            navigator.serviceWorker.ready
              .then((reg) => {
                reg.showNotification(title, {
                  body,
                  icon: "/logo_bapperida.png",
                  badge: "/logo_bapperida.png",
                  tag: (payload.data as any)?.type || "bapperida",
                  data: payload.data || {},
                  requireInteraction: false,
                });
              })
              .catch(() => {});
          }
        });
      } catch {
        // Silent — FCM is optional
      }
    }

    setup();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps
}
